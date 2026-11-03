import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User, { publicUser } from "./models/User.js";
import { stripImageMetadata, detectImageFormat } from "./utils/storage.js";

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
  };
}

// Minimal valid PNG (1x1 transparent)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR header
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
  0x42, 0x60, 0x82,
]);

// Minimal valid JPEG
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
  0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00,
  0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf,
  0x00, 0xff, 0xd9,
]);

// Minimal valid WebP
const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x1a, 0x00, 0x00, 0x00, // Size: 26 bytes
  0x57, 0x45, 0x42, 0x50, // "WEBP"
  0x56, 0x50, 0x38, 0x20, // "VP8 "
  0x0e, 0x00, 0x00, 0x00, // Chunk size: 14 bytes
  0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00,
  0x01, 0x00, 0x02, 0x00, 0x34, 0x25,
]);

describe("Personal Profile Picture & Avatar Management Suite", () => {
  let userA = null;
  let cookieA = "";
  let userB = null;
  let cookieB = "";

  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI);
    }

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash("Password123!", salt);

    const ts = Date.now();
    userA = await User.create({
      name: "Avatar Test User A",
      email: `avatar.user.a.${ts}@psit.ac.in`,
      password,
      role: "student",
      branch: "CSE",
      year: 3,
      emailVerified: true,
    });

    userB = await User.create({
      name: "Avatar Test User B",
      email: `avatar.user.b.${ts}@psit.ac.in`,
      password,
      role: "student",
      branch: "IT",
      year: 2,
      emailVerified: true,
    });

    // Login user A
    const loginResA = await apiCall("/auth/login", {
      method: "POST",
      body: { email: userA.email, password: "Password123!" },
    });
    cookieA = loginResA.cookie;

    // Login user B
    const loginResB = await apiCall("/auth/login", {
      method: "POST",
      body: { email: userB.email, password: "Password123!" },
    });
    cookieB = loginResB.cookie;
  });

  after(async () => {
    if (userA) {
      await User.deleteOne({ _id: userA._id });
    }
    if (userB) {
      await User.deleteOne({ _id: userB._id });
    }
  });

  it("1. Successfully uploads a valid PNG profile picture", async () => {
    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/png" },
      body: VALID_PNG_BUFFER,
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.user.avatarUrl);
    assert.match(res.data.user.avatarUrl, /\.(png|webp)$|^https?:\/\//i);

    // Verify database record
    const updated = await User.findById(userA._id);
    assert.ok(updated.avatarUrl);
    assert.ok(updated.avatarPublicId);
    assert.ok(updated.avatarProvider);

    // Verify publicUser does not leak internal storage keys
    const pub = publicUser(updated);
    assert.equal(pub.avatarUrl, updated.avatarUrl);
    assert.equal(pub.avatarPublicId, undefined);
    assert.equal(pub.avatarProvider, undefined);
  });

  it("2. Successfully uploads a valid JPEG avatar using binary payload", async () => {
    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/jpeg" },
      body: VALID_JPEG_BUFFER,
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.user.avatarUrl);

    const updated = await User.findById(userA._id);
    assert.equal(updated.avatarUrl, res.data.user.avatarUrl);
  });

  it("3. Successfully uploads a valid WebP avatar using dataUrl payload", async () => {
    const dataUrl = `data:image/webp;base64,${VALID_WEBP_BUFFER.toString("base64")}`;
    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      body: { dataUrl },
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.user.avatarUrl);
  });

  it("4. Rejects oversized avatar files (>2 MB) with 413 Payload Too Large", async () => {
    // 2.2 MB buffer with valid PNG magic bytes
    const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024);
    VALID_PNG_BUFFER.copy(largeBuffer, 0, 0, Math.min(VALID_PNG_BUFFER.length, largeBuffer.length));

    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/png" },
      body: largeBuffer,
    });

    assert.equal(res.status, 413);
    assert.match(res.data.message, /2MB/i);
  });

  it("5. Rejects non-image and disguised files with 400 Bad Request", async () => {
    const fakeBuffer = Buffer.from("<html><script>alert(1)</script></html>");

    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/png" },
      body: fakeBuffer,
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /unsupported image format/i);
  });

  it("6. Rejects unauthenticated avatar requests with 401", async () => {
    const postRes = await apiCall("/users/me/avatar", {
      method: "POST",
      body: { dataUrl: `data:image/png;base64,${VALID_PNG_BUFFER.toString("base64")}` },
    });
    assert.equal(postRes.status, 401);

    const deleteRes = await apiCall("/users/me/avatar", {
      method: "DELETE",
    });
    assert.equal(deleteRes.status, 401);
  });

  it("7. Enforces strict account isolation between users", async () => {
    // User B uploads avatar
    const resB = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieB,
      headers: { "Content-Type": "image/png" },
      body: VALID_PNG_BUFFER,
    });
    assert.equal(resB.status, 200);

    const docA = await User.findById(userA._id);
    const docB = await User.findById(userB._id);

    assert.notEqual(docA.avatarUrl, docB.avatarUrl);
    assert.notEqual(docA.avatarPublicId, docB.avatarPublicId);

    // User B deletes avatar, user A is unaffected
    const delB = await apiCall("/users/me/avatar", {
      method: "DELETE",
      cookie: cookieB,
    });
    assert.equal(delB.status, 200);

    const freshA = await User.findById(userA._id);
    assert.ok(freshA.avatarUrl);
  });

  it("8. Replacing an avatar cleans up the previous storage file", async () => {
    const freshUser = await User.findById(userA._id);
    const oldPublicId = freshUser.avatarPublicId;
    const oldProvider = freshUser.avatarProvider;

    // Upload new avatar
    const res = await apiCall("/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/png" },
      body: VALID_PNG_BUFFER,
    });
    assert.equal(res.status, 200);

    const updatedUser = await User.findById(userA._id);
    assert.notEqual(updatedUser.avatarPublicId, oldPublicId);

    // If local storage, verify old file was cleaned up from disk
    if (oldProvider === "local" && oldPublicId) {
      const oldPath = path.join(process.cwd(), "uploads", "avatars", oldPublicId);
      assert.equal(fs.existsSync(oldPath), false, "Previous avatar file should be removed from disk");
    }
  });

  it("9. Successfully deletes profile avatar and handles double deletion cleanly", async () => {
    const userBefore = await User.findById(userA._id);
    const publicId = userBefore.avatarPublicId;
    const provider = userBefore.avatarProvider;

    const res = await apiCall("/users/me/avatar", {
      method: "DELETE",
      cookie: cookieA,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.user.avatarUrl, null);

    const userAfter = await User.findById(userA._id);
    assert.equal(userAfter.avatarUrl, null);
    assert.equal(userAfter.avatarPublicId, null);
    assert.equal(userAfter.avatarProvider, null);

    if (provider === "local" && publicId) {
      const filePath = path.join(process.cwd(), "uploads", "avatars", publicId);
      assert.equal(fs.existsSync(filePath), false);
    }

    // Double deletion should return 400
    const res2 = await apiCall("/users/me/avatar", {
      method: "DELETE",
      cookie: cookieA,
    });
    assert.equal(res2.status, 400);
    assert.match(res2.data.message, /no profile photo to remove/i);
  });

  it("10. PATCH /api/users/me blocks arbitrary avatar URL injection", async () => {
    const maliciousUrl = "https://attacker.site/spoofed-avatar.png";
    const res = await apiCall("/users/me", {
      method: "PATCH",
      cookie: cookieA,
      body: {
        name: userA.name,
        avatarUrl: maliciousUrl,
        avatarPublicId: "spoofed-key",
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.avatarUrl, null);

    const dbUser = await User.findById(userA._id);
    assert.equal(dbUser.avatarUrl, null);
    assert.equal(dbUser.avatarPublicId, null);
  });

  it("11. Verifies server-side metadata stripping logic", () => {
    // Construct JPEG buffer with APP1 EXIF segment (0xFF 0xE1) and COM segment (0xFF 0xFE)
    const exifPayload = Buffer.from("Exif\0\0CameraModelXYZ");
    const app1Len = exifPayload.length + 2;
    const app1Segment = Buffer.alloc(app1Len + 2);
    app1Segment[0] = 0xff;
    app1Segment[1] = 0xe1;
    app1Segment.writeUInt16BE(app1Len, 2);
    exifPayload.copy(app1Segment, 4);

    const commentPayload = Buffer.from("User metadata comment");
    const comLen = commentPayload.length + 2;
    const comSegment = Buffer.alloc(comLen + 2);
    comSegment[0] = 0xff;
    comSegment[1] = 0xfe;
    comSegment.writeUInt16BE(comLen, 2);
    commentPayload.copy(comSegment, 4);

    const jpegWithMetadata = Buffer.concat([
      VALID_JPEG_BUFFER.subarray(0, 2), // SOI
      app1Segment,
      comSegment,
      VALID_JPEG_BUFFER.subarray(2), // Rest of image
    ]);

    assert.ok(jpegWithMetadata.includes(Buffer.from("CameraModelXYZ")));
    assert.ok(jpegWithMetadata.includes(Buffer.from("User metadata comment")));

    const stripped = stripImageMetadata(jpegWithMetadata, "jpg");
    assert.equal(stripped.includes(Buffer.from("CameraModelXYZ")), false);
    assert.equal(stripped.includes(Buffer.from("User metadata comment")), false);
    assert.equal(detectImageFormat(stripped), "jpg");
  });

  it("12. /api/v1/users/me/avatar alias routes work seamlessly", async () => {
    const postRes = await apiCall("/v1/users/me/avatar", {
      method: "POST",
      cookie: cookieA,
      headers: { "Content-Type": "image/png" },
      body: VALID_PNG_BUFFER,
    });

    assert.equal(postRes.status, 200);
    assert.ok(postRes.data.user.avatarUrl);

    const deleteRes = await apiCall("/v1/users/me/avatar", {
      method: "DELETE",
      cookie: cookieA,
    });

    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.data.user.avatarUrl, null);
  });
});

