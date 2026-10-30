import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import { clearAuthFailures, COOKIE, limitFailures, recordAuthFailure, setSession } from "../middleware/auth.js";
import { signupErrors } from "../utils/domain.js";

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
    branch: String(b.branch ?? ""),
    year: Number(b.year) || undefined,
  };

  const errors = signupErrors({ ...form, confirm: form.password });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Check the highlighted fields.", errors });
  }

  const exists = await User.exists({ email: form.email });
  if (exists) {
    return rejectDuplicate(req, res);
  }

  const password = await bcrypt.hash(form.password, 12);
  let user;
  try {
    user = await User.create({ ...form, password });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) {
      return rejectDuplicate(req, res);
    }
    throw error;
  }

  setSession(res, user);
  res.status(201).json(publicUser(user));
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");

  const user = await User.findOne({ email }).select("+password");
  const matches = user && (await bcrypt.compare(password, user.password));
  if (!matches) {
    await recordAuthFailure(req);
    return res.status(401).json({ message: "Wrong email or password." });
  }

  await clearAuthFailures(email);
  setSession(res, user);
  res.json(publicUser(user));
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE);
  res.json({ message: "Logged out." });
});

export default router;
