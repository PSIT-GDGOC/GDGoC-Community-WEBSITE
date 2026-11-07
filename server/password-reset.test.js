import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import PasswordReset from "./models/PasswordReset.js";
import AuthFailure from "./models/AuthFailure.js";

const API = process.env.API_URL || "http://localhost:5000/api";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gdgoc-test";

async function apiCall(endpoint, { method = "GET", body, cookie, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  let reqBody;

  if (body !== undefined) {
    if (Buffer.isBuffer(body)) {
      reqBody = body;
    } else {
      reqHeaders["Content-Type"] = "application/json";
      reqBody = JSON.stringify(body);
    }
  }

  if (cookie) {
    reqHeaders["Cookie"] = cookie;
  }

  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else if (contentType.includes("text/")) {
    data = await res.text().catch(() => "");
  }

  const setCookie = res.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/token=([^;]+)/);
  const authCookie = cookieMatch ? `token=${cookieMatch[1]}` : "";

  return {
    status: res.status,
    data,
    cookie: authCookie,
    headers: res.headers,
  };
}

describe("Password Recovery & Account Verification Security Suite", () => {
  let userEmail = "";
  let initialPassword = "OldPassword123!";
  let initialUserId = "";
  let initialSessionCookie = "";
  let currentValidToken = "";

  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI);
    }
    await AuthFailure.deleteMany({ key: { $regex: /forgot/ } });

    const ts = Date.now();
    userEmail = `pwd.reset.user.${ts}@psit.ac.in`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(initialPassword, salt);

    // Create user with unverified email to test ownership verification upon reset
    const user = await User.create({
      name: "Password Reset Test Member",
      email: userEmail,
      password: hashedPassword,
      role: "student",
      branch: "CSE",
      year: 3,
      emailVerified: false,
      emailVerifiedAt: null,
      tokenVersion: 1,
    });
    initialUserId = user._id;

    // Log in to establish an active session before password reset
    const loginRes = await apiCall("/auth/login", {
      method: "POST",
      body: { email: userEmail, password: initialPassword },
    });
    assert.equal(loginRes.status, 200);
    initialSessionCookie = loginRes.cookie;
    assert.ok(initialSessionCookie);
  });

  after(async () => {
    if (initialUserId) {
      await User.deleteOne({ _id: initialUserId });
      await PasswordReset.deleteMany({ email: userEmail });
      await AuthFailure.deleteMany({ key: { $regex: /forgot/ } });
    }
    await mongoose.disconnect();
  });

  it("1. Forgot password request for unknown account returns generic 200 without leaking existence", async () => {
    const unknownEmail = `unknown.${Date.now()}@psit.ac.in`;
    const res = await apiCall("/auth/forgot-password", {
      method: "POST",
      body: { email: unknownEmail },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.data.message,
      "If an account exists with that email address, a password reset link has been sent."
    );
    assert.equal(res.data.testResetToken, undefined);
  });

  it("2. Forgot password request for valid account returns generic 200 and generates reset token", async () => {
    const res = await apiCall("/auth/forgot-password", {
      method: "POST",
      body: { email: userEmail },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.data.message,
      "If an account exists with that email address, a password reset link has been sent."
    );

    currentValidToken = res.data.testResetToken;
    assert.ok(currentValidToken, "Test reset token must be returned in non-production mode");
    assert.equal(typeof currentValidToken, "string");
    assert.ok(currentValidToken.length >= 32, "Reset token must have sufficient cryptographic entropy");

    assert.ok(res.data.testResetUrl);
    assert.ok(res.data.testResetUrl.includes(currentValidToken));

    // Verify token in DB is stored only as a cryptographic hash, NEVER in plaintext
    const expectedHash = crypto.createHash("sha256").update(currentValidToken).digest("hex");
    const record = await PasswordReset.findOne({ email: userEmail });
    assert.ok(record);
    assert.equal(record.tokenHash, expectedHash);
    assert.notEqual(record.tokenHash, currentValidToken, "Raw token must never be stored in plaintext");
    assert.ok(record.expiresAt > new Date());
  });

  it("3. Verify reset token endpoint validates genuine token and rejects invalid tokens", async () => {
    assert.ok(currentValidToken);

    // Genuine token
    const okRes = await apiCall("/auth/verify-reset-token", {
      method: "POST",
      body: { email: userEmail, token: currentValidToken },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.data.valid, true);

    // Tampered token
    const badRes = await apiCall("/auth/verify-reset-token", {
      method: "POST",
      body: { email: userEmail, token: "tampered_invalid_token_123" },
    });
    assert.equal(badRes.status, 400);
    assert.match(badRes.data.message, /invalid or has expired/i);
  });

  it("4. Reset password rejects mismatched passwords and passwords violating complexity rules", async () => {
    assert.ok(currentValidToken);

    // Mismatched confirmation
    const mismatchRes = await apiCall("/auth/reset-password", {
      method: "POST",
      body: {
        email: userEmail,
        token: currentValidToken,
        password: "NewPassword123!",
        confirm: "DifferentPassword123!",
      },
    });
    assert.equal(mismatchRes.status, 400);
    assert.match(mismatchRes.data.message, /passwords do not match/i);

    // Weak password (<8 chars)
    const weakRes = await apiCall("/auth/reset-password", {
      method: "POST",
      body: {
        email: userEmail,
        token: currentValidToken,
        password: "short",
        confirm: "short",
      },
    });
    assert.equal(weakRes.status, 400);
    assert.match(weakRes.data.message, /8 to 72 characters/i);
  });

  it("5. Reset password succeeds, invalidates previous sessions, and verifies email ownership", async () => {
    assert.ok(currentValidToken);
    const newPassword = "BrandNewSecurePassword2026!";

    const resetRes = await apiCall("/auth/reset-password", {
      method: "POST",
      body: {
        email: userEmail,
        token: currentValidToken,
        password: newPassword,
        confirm: newPassword,
      },
    });

    assert.equal(resetRes.status, 200);
    assert.match(resetRes.data.message, /password reset successfully/i);

    // 1. Verify user record updated in database
    const updatedUser = await User.findById(initialUserId).select("+password");
    assert.ok(updatedUser);
    const passMatches = await bcrypt.compare(newPassword, updatedUser.password);
    assert.equal(passMatches, true, "New password must match stored bcrypt hash");

    // 2. Verify tokenVersion incremented (invalidating all sessions)
    assert.equal(updatedUser.tokenVersion, 2);

    // 3. Verify email ownership was verified through reset link
    assert.equal(updatedUser.emailVerified, true);
    assert.ok(updatedUser.emailVerifiedAt instanceof Date);

    // 4. Verify previous session cookie is now completely INVALID
    const meRes = await apiCall("/users/me", {
      method: "GET",
      cookie: initialSessionCookie,
    });
    assert.equal(meRes.status, 401, "Previous sessions must be rejected after password reset");

    // 5. Verify single-use token was consumed and removed
    const tokenRecord = await PasswordReset.findOne({ email: userEmail });
    assert.equal(tokenRecord, null, "Used reset token must be deleted immediately");

    // 6. Attempting to reuse the token now fails
    const reuseRes = await apiCall("/auth/reset-password", {
      method: "POST",
      body: {
        email: userEmail,
        token: currentValidToken,
        password: "AnotherPassword123!",
        confirm: "AnotherPassword123!",
      },
    });
    assert.equal(reuseRes.status, 400);
    assert.match(reuseRes.data.message, /invalid or has expired/i);

    // 7. Verify login with the new password works
    const newLoginRes = await apiCall("/auth/login", {
      method: "POST",
      body: { email: userEmail, password: newPassword },
    });
    assert.equal(newLoginRes.status, 200);
    assert.ok(newLoginRes.cookie);

    // 8. Verify old password no longer works
    const oldLoginRes = await apiCall("/auth/login", {
      method: "POST",
      body: { email: userEmail, password: initialPassword },
    });
    assert.equal(oldLoginRes.status, 401);
  });

  it("6. Rejects reset request when token has expired", async () => {
    // Manually create an expired token
    const expiredToken = "expired_test_token_1234567890";
    const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
    await PasswordReset.create({
      email: userEmail,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 minute ago
    });

    const res = await apiCall("/auth/reset-password", {
      method: "POST",
      body: {
        email: userEmail,
        token: expiredToken,
        password: "ValidPassword123!",
        confirm: "ValidPassword123!",
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /invalid or has expired/i);
  });

  it("7. Rate limiting restricts excessive forgot-password requests", async () => {
    // Reset rate limiter keys before testing the limit threshold
    await AuthFailure.deleteMany({ key: { $regex: /^forgot:/ } });

    const targetEmail = `ratelimit.forgot.${Date.now()}@psit.ac.in`;

    // Send 5 requests (the allowed limit)
    for (let i = 0; i < 5; i++) {
      const res = await apiCall("/auth/forgot-password", {
        method: "POST",
        body: { email: targetEmail },
      });
      assert.equal(res.status, 200);
    }

    // 6th request must trigger 429 Too Many Requests
    const blockedRes = await apiCall("/auth/forgot-password", {
      method: "POST",
      body: { email: targetEmail },
    });
    assert.equal(blockedRes.status, 429);
    assert.match(blockedRes.data.message, /too many password reset requests/i);
  });
});
