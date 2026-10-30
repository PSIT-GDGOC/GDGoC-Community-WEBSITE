import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import { requireAuth, setSession } from "../middleware/auth.js";
import { validatePassword, validateProfile } from "../utils/domain.js";

const router = Router();
router.use(requireAuth);

router.get("/me", (req, res) => {
  res.json(publicUser(req.user));
});

router.patch("/me", async (req, res) => {
  const { name, branch, year, bio } = req.body ?? {};

  const edit = {
    name: name !== undefined ? String(name) : req.user.name,
    branch: branch !== undefined ? String(branch) : req.user.branch || "",
    year: year !== undefined ? (Number(year) || undefined) : req.user.year,
    bio: bio !== undefined ? String(bio) : req.user.bio || "",
  };

  const err = validateProfile(edit);
  if (err) {
    return res.status(400).json({ message: err });
  }

  req.user.set({ ...edit, name: edit.name.trim(), year: edit.year ?? null });
  await req.user.save();
  res.json(publicUser(req.user));
});

router.patch("/me/password", async (req, res) => {
  const { currentPassword = "", newPassword = "" } = req.body ?? {};
  const current = String(currentPassword);
  const next = String(newPassword);

  const err = validatePassword(current, next, next);
  if (err) {
    return res.status(400).json({ message: err });
  }

  const user = await User.findById(req.user.id).select("+password");
  const matches = await bcrypt.compare(current, user.password);
  if (!matches) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }

  user.password = await bcrypt.hash(next, 12);
  user.tokenVersion += 1;
  await user.save();

  setSession(res, user);
  res.json({ message: "Password changed." });
});

export default router;
