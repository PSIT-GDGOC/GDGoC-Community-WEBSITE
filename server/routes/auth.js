import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import AuthFailure from "../models/AuthFailure.js";
import PasswordReset from "../models/PasswordReset.js";
import {
  clearAuthFailures,
  COOKIE,
  limitFailures,
  recordAuthFailure,
  setSession,
} from "../middleware/auth.js";
import { signupErrors, getAllowedEmailDomains, emailError, passwordError } from "../utils/domain.js";
import { sendPasswordResetEmail } from "../utils/email.js";

const router = Router();
const DUPLICATE_KEY = 11000;

async function rejectDuplicate(req, res) {
  await recordAuthFailure(req);
  return res.status(409).json({
    message: "An account with this email already exists.",
    errors: { email: "Already registered. Log in instead." },
  });
}

router.use(["/register", "/login"], limitFailures);

router.post("/register", async (req, res) => {
  const b = req.body ?? {};
  const form = {
    name: String(b.name ?? "").trim(),
    email: String(b.email ?? "")
      .trim()
      .toLowerCase(),
    password: String(b.password ?? ""),
    branch: b.branch ? String(b.branch).trim() : undefined,
    year: b.year ? Number(b.year) : undefined,
    enrollmentNo: b.enrollmentNo ? String(b.enrollmentNo).trim() : undefined,
  };

  const errors = signupErrors({ ...form, confirm: form.password });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Check the highlighted fields.", errors });
  }

  // Check if an account already exists - block duplicate registration unconditionally
  const existingUser = await User.findOne({ email: form.email });
  if (existingUser) {
    return rejectDuplicate(req, res);
  }

  const hashedPassword = await bcrypt.hash(form.password, 12);
  let user;

  try {
    user = await User.create({
      ...form,
      password: hashedPassword,
      role: "student",
      emailVerified: false,
      emailVerifiedAt: null,
    });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) {
      return rejectDuplicate(req, res);
    }
    throw error;
  }

  // Directly create an authenticated session and return public user
  await clearAuthFailures(form.email);
  setSession(res, user);
  return res.status(201).json(publicUser(user));
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  const user = await User.findOne({ email }).select("+password");
  const matches = user && (await bcrypt.compare(password, user.password));
  if (!matches) {
    await recordAuthFailure(req);
    return res.status(401).json({ message: "Wrong email or password." });
  }

  // Authenticate user directly without blocking on emailVerified
  await clearAuthFailures(email);
  setSession(res, user);
  res.json(publicUser(user));
});

const FORGOT_PW_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PW_LIMIT = 5;

async function limitForgotPassword(req, res, next) {
  const ip = req.ip;
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const keys = [`forgot:ip:${ip}`];
  if (email) keys.push(`forgot:email:${email}`);

  const blocked = await AuthFailure.exists({
    key: { $in: keys },
    count: { $gte: FORGOT_PW_LIMIT },
    expiresAt: { $gt: new Date() },
  });

  if (blocked) {
    return res.status(429).json({ message: "Too many password reset requests. Please wait 15 minutes." });
  }
  next();
}

async function recordForgotPasswordAttempt(req) {
  const now = new Date();
  const stillOpen = { $gt: ["$expiresAt", now] };
  const keys = [`forgot:ip:${req.ip}`];
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (email) keys.push(`forgot:email:${email}`);

  await Promise.all(
    keys.map((key) =>
      AuthFailure.updateOne(
        { key },
        [
          {
            $set: {
              count: { $cond: [stillOpen, { $add: ["$count", 1] }, 1] },
              expiresAt: { $cond: [stillOpen, "$expiresAt", new Date(now.getTime() + FORGOT_PW_WINDOW_MS)] },
            },
          },
        ],
        { upsert: true, updatePipeline: true },
      ),
    ),
  );
}

const GENERIC_RESET_RESPONSE = {
  message: "If an account exists with that email address, a password reset link has been sent.",
};

router.post("/forgot-password", limitForgotPassword, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  await recordForgotPasswordAttempt(req);

  // Return generic 200 response to prevent account enumeration
  if (!email || emailError(email)) {
    return res.status(200).json(GENERIC_RESET_RESPONSE);
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json(GENERIC_RESET_RESPONSE);
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // Invalidate any existing unused reset tokens for this user
  await PasswordReset.deleteMany({ email });

  // Token valid for 15 minutes
  await PasswordReset.create({
    email,
    tokenHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  const resetUrl = `${clientUrl}/#/login?mode=reset&token=${rawToken}&email=${encodeURIComponent(email)}`;

  await sendPasswordResetEmail({ email, resetUrl, token: rawToken });

  const payload = { ...GENERIC_RESET_RESPONSE };
  if (process.env.NODE_ENV !== "production") {
    payload.testResetToken = rawToken;
    payload.testResetUrl = resetUrl;
  }
  return res.status(200).json(payload);
});

router.post("/verify-reset-token", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const token = String(req.body?.token ?? "").trim();

  if (!email || !token) {
    return res.status(400).json({ message: "Reset link is invalid or has expired." });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resetRecord = await PasswordReset.findOne({
    email,
    tokenHash,
    expiresAt: { $gt: new Date() },
    usedAt: null,
  });

  if (!resetRecord) {
    return res.status(400).json({ message: "Reset link is invalid or has expired." });
  }

  res.status(200).json({ valid: true });
});

router.post("/reset-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const token = String(req.body?.token ?? "").trim();
  const password = String(req.body?.password ?? "");
  const confirm = String(req.body?.confirm ?? req.body?.confirmPassword ?? password);

  if (password !== confirm) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  const pwErr = passwordError(password);
  if (pwErr) {
    return res.status(400).json({ message: pwErr });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(400).json({ message: "Reset link is invalid or has expired." });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Atomically consume the token to enforce single-use under concurrent requests
  const resetRecord = await PasswordReset.findOneAndDelete({
    email,
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    return res.status(400).json({ message: "Reset link is invalid or has expired." });
  }

  try {
    user.password = hashedPassword;
    // Invalidate all existing sessions across devices
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    // Account ownership verified through successful token delivery and redemption
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  } catch (err) {
    // Prevent inconsistent state: restore token if database update fails
    await PasswordReset.create({
      email,
      tokenHash,
      expiresAt: resetRecord.expiresAt,
    }).catch(() => {});
    throw err;
  }

  await clearAuthFailures(email);

  res.status(200).json({
    message: "Password reset successfully. You can now log in with your new password.",
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE);
  res.json({ message: "Logged out." });
});

router.get("/domains", (req, res) => {
  res.json({
    allowedDomains: getAllowedEmailDomains(),
  });
});

export default router;
