import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AuthFailure from "../models/AuthFailure.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const PROD = process.env.NODE_ENV === "production";

export const COOKIE = {
  httpOnly: true,
  sameSite: PROD ? "none" : "lax",
  secure: PROD,
};

export function setSession(res, user) {
  const payload = { id: user.id, v: user.tokenVersion };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("token", token, { ...COOKIE, maxAge: WEEK });
}

async function userFromRequest(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)token=([^;]+)/)?.[1];

  try {
    const { id, v } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);

    if (!user || user.tokenVersion !== v) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const user = await userFromRequest(req);

  if (!user) {
    return res.status(401).json({ message: "Please log in." });
  }

  req.user = user;
  next();
}

export async function requireAdmin(req, res, next) {
  const user = await userFromRequest(req);

  if (!user) {
    return res.status(401).json({ message: "Please log in." });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  req.user = user;
  next();
}

export async function optionalAuth(req, res, next) {
  req.user = await userFromRequest(req);
  next();
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function failureKeys(req) {
  const keys = [`ip:${req.ip}`];
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (email) {
    keys.push(`email:${email}`);
  }
  return keys;
}

export async function limitFailures(req, res, next) {
  const blocked = await AuthFailure.exists({
    key: { $in: failureKeys(req) },
    count: { $gte: MAX_FAILURES },
    expiresAt: { $gt: new Date() },
  });

  if (blocked) {
    return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
  }
  next();
}

export async function recordAuthFailure(req) {
  const now = new Date();
  const stillOpen = { $gt: ["$expiresAt", now] };

  await Promise.all(
    failureKeys(req).map((key) =>
      AuthFailure.updateOne(
        { key },
        [
          {
            $set: {
              count: { $cond: [stillOpen, { $add: ["$count", 1] }, 1] },
              expiresAt: { $cond: [stillOpen, "$expiresAt", new Date(now.getTime() + WINDOW_MS)] },
            },
          },
        ],
        { upsert: true, updatePipeline: true },
      ),
    ),
  );
}

export async function clearAuthFailures(email) {
  await AuthFailure.deleteOne({ key: `email:${email}` });
}
