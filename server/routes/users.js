import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import { requireAuth, setSession } from "../middleware/auth.js";
import { validatePassword, validateProfile } from "../utils/domain.js";
import { detectImageFormat, uploadAvatar, deleteAvatar } from "../utils/storage.js";

const router = Router();
router.use(requireAuth);

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

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

  const isSame = await bcrypt.compare(next, user.password);
  if (isSame) {
    return res.status(400).json({ message: "New password must differ from the current one." });
  }

  user.password = await bcrypt.hash(next, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  setSession(res, user);
  res.json({ message: "Password changed." });
});

// Member Profile Avatar Endpoints
router.post("/me/avatar", async (req, res) => {
  try {
    let fileBuffer = null;

    if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (req.body?.dataUrl) {
      const match = String(req.body.dataUrl).match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
      if (match) {
        fileBuffer = Buffer.from(match[1], "base64");
      }
    } else if (req.body?.base64) {
      fileBuffer = Buffer.from(req.body.base64, "base64");
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ message: "No image payload provided." });
    }

    if (fileBuffer.length > MAX_AVATAR_SIZE) {
      return res.status(413).json({ message: "Image exceeds 2MB size limit." });
    }

    const ext = detectImageFormat(fileBuffer);
    if (!ext || !["jpg", "png", "webp"].includes(ext)) {
      return res.status(400).json({
        message: "Invalid or unsupported image format. Only JPEG, PNG, and WebP are allowed.",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Clean up previous avatar if it exists
    if (user.avatarPublicId) {
      await deleteAvatar(user.avatarPublicId, user.avatarProvider);
    }

    const result = await uploadAvatar(fileBuffer, ext);

    user.avatarUrl = result.url;
    user.avatarPublicId = result.publicId;
    user.avatarProvider = result.provider;
    await user.save();

    res.status(200).json({
      message: "Profile photo updated successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({ message: "Failed to upload profile photo." });
  }
});

router.delete("/me/avatar", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.avatarUrl && !user.avatarPublicId) {
      return res.status(400).json({ message: "No profile photo to remove." });
    }

    if (user.avatarPublicId) {
      await deleteAvatar(user.avatarPublicId, user.avatarProvider);
    }

    user.avatarUrl = null;
    user.avatarPublicId = null;
    user.avatarProvider = null;
    await user.save();

    res.status(200).json({
      message: "Profile photo removed successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Avatar delete error:", error);
    res.status(500).json({ message: "Failed to remove profile photo." });
  }
});

export default router;
