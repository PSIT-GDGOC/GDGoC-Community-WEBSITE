import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User, { publicUser } from "../models/User.js";
import { requireAuth, setSession, limitAvatarUploads, recordAvatarUpload } from "../middleware/auth.js";
import {
  validatePassword,
  validateProfile,
  BANNER_THEMES,
  ACCENT_COLORS,
  CARD_THEMES,
  validateProjectInput,
  validateSkillsInput,
  validateSocialsInput,
} from "../utils/domain.js";
import {
  detectImageFormat,
  uploadAvatar,
  uploadBanner,
  uploadProjectImage,
  deleteAvatar,
} from "../utils/storage.js";

const router = Router();
router.use(requireAuth);

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_BANNER_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_PROJECTS_PER_USER = 6;

router.get("/me", (req, res) => {
  res.json(publicUser(req.user, { isSelf: true }));
});

router.patch("/me", async (req, res) => {
  const {
    name,
    branch,
    year,
    bio,
    headline,
    college,
    specialization,
    bannerTheme,
    accentColor,
    cardTheme,
    socials,
    skills,
    privacy,
  } = req.body ?? {};

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

  const patch = {
    name: edit.name.trim(),
    branch: edit.branch,
    year: edit.year ?? null,
    bio: edit.bio,
  };

  // Professional headline (max 120 chars)
  if (headline !== undefined) {
    const hl = String(headline).trim();
    if (hl.length > 120) {
      return res.status(400).json({ message: "Headline must be 120 characters or fewer." });
    }
    patch.headline = hl;
  }

  // College name (max 120 chars)
  if (college !== undefined) {
    const c = String(college).trim();
    if (c.length > 120) {
      return res.status(400).json({ message: "College must be 120 characters or fewer." });
    }
    patch.college = c || "PSIT Kanpur";
  }

  // Specialization (max 60 chars)
  if (specialization !== undefined) {
    const s = String(specialization).trim();
    if (s.length > 60) {
      return res.status(400).json({ message: "Specialization must be 60 characters or fewer." });
    }
    patch.specialization = s;
  }

  // Banner theme
  if (bannerTheme !== undefined) {
    if (!BANNER_THEMES.includes(bannerTheme)) {
      return res.status(400).json({ message: "Invalid banner theme selected." });
    }
    patch.bannerTheme = bannerTheme;
  }

  // Accent color
  if (accentColor !== undefined) {
    if (!ACCENT_COLORS.includes(accentColor)) {
      return res.status(400).json({ message: "Invalid accent color selected." });
    }
    patch.accentColor = accentColor;
  }

  // Card theme
  if (cardTheme !== undefined) {
    if (!CARD_THEMES.includes(cardTheme)) {
      return res.status(400).json({ message: "Invalid card theme selected." });
    }
    patch.cardTheme = cardTheme;
  }

  // Social links validation
  if (socials !== undefined) {
    const socialErr = validateSocialsInput(socials);
    if (socialErr) {
      return res.status(400).json({ message: socialErr });
    }
    patch.socials = {
      github: socials.github !== undefined ? String(socials.github).trim() : (req.user.socials?.github || ""),
      linkedin: socials.linkedin !== undefined ? String(socials.linkedin).trim() : (req.user.socials?.linkedin || ""),
      portfolio: socials.portfolio !== undefined ? String(socials.portfolio).trim() : (req.user.socials?.portfolio || ""),
      website: socials.website !== undefined ? String(socials.website).trim() : (req.user.socials?.website || ""),
      twitter: socials.twitter !== undefined ? String(socials.twitter).trim() : (req.user.socials?.twitter || ""),
    };
  }

  // Skills validation
  if (skills !== undefined) {
    const skillErr = validateSkillsInput(skills);
    if (skillErr) {
      return res.status(400).json({ message: skillErr });
    }
    patch.skills = skills.map((s) => ({
      name: String(s.name).trim(),
      category: s.category ? String(s.category).trim() : "Other",
    }));
  }

  // Privacy preferences
  if (privacy !== undefined && typeof privacy === "object") {
    patch.privacy = {
      showEmail: privacy.showEmail !== undefined ? Boolean(privacy.showEmail) : Boolean(req.user.privacy?.showEmail),
      showAttendance:
        privacy.showAttendance !== undefined
          ? Boolean(privacy.showAttendance)
          : req.user.privacy?.showAttendance !== false,
      showProjects:
        privacy.showProjects !== undefined
          ? Boolean(privacy.showProjects)
          : req.user.privacy?.showProjects !== false,
    };
  }

  req.user.set(patch);
  await req.user.save();
  res.json(publicUser(req.user, { isSelf: true }));
});

// ============================================================================
// Featured Projects Endpoints
// ============================================================================

router.post("/me/projects/image", limitAvatarUploads, async (req, res) => {
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
      return res.status(413).json({ message: "Project image exceeds 2MB size limit." });
    }

    const ext = detectImageFormat(fileBuffer);
    if (!ext || !["jpg", "png", "webp"].includes(ext)) {
      return res.status(400).json({
        message: "Invalid image format. Only JPEG, PNG, and WebP are allowed.",
      });
    }

    await recordAvatarUpload(req);
    const result = await uploadProjectImage(fileBuffer, ext);
    res.status(201).json({ url: result.url, message: "Project image uploaded." });
  } catch (error) {
    console.error("Project image upload error:", error);
    res.status(500).json({ message: "Failed to upload project image." });
  }
});

router.post("/me/projects", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.projects && user.projects.length >= MAX_PROJECTS_PER_USER) {
      return res.status(400).json({
        message: `Maximum ${MAX_PROJECTS_PER_USER} featured projects allowed. Delete an existing project to add a new one.`,
      });
    }

    const err = validateProjectInput(req.body);
    if (err) {
      return res.status(400).json({ message: err });
    }

    const {
      title,
      description = "",
      techStack = [],
      githubUrl = "",
      liveUrl = "",
      imageUrl = null,
      featured = false,
    } = req.body;

    const newProject = {
      title: String(title).trim(),
      description: String(description).trim(),
      techStack: Array.isArray(techStack) ? techStack.map((t) => String(t).trim()).filter(Boolean) : [],
      githubUrl: String(githubUrl).trim(),
      liveUrl: String(liveUrl).trim(),
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      featured: Boolean(featured),
      order: user.projects.length,
    };

    user.projects.push(newProject);
    await user.save();

    const created = user.projects[user.projects.length - 1];
    res.status(201).json({
      message: "Project added successfully.",
      project: {
        id: created._id.toString(),
        title: created.title,
        description: created.description,
        techStack: created.techStack,
        githubUrl: created.githubUrl,
        liveUrl: created.liveUrl,
        imageUrl: created.imageUrl,
        featured: created.featured,
        order: created.order,
        createdAt: created.createdAt,
      },
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Add project error:", error);
    res.status(500).json({ message: "Failed to add project." });
  }
});

router.patch("/me/projects/:projectId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
      return res.status(404).json({ message: "Project not found." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const project = user.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const { title, description, techStack, githubUrl, liveUrl, imageUrl, featured } = req.body ?? {};

    const candidate = {
      title: title !== undefined ? title : project.title,
      description: description !== undefined ? description : project.description,
      techStack: techStack !== undefined ? techStack : project.techStack,
      githubUrl: githubUrl !== undefined ? githubUrl : project.githubUrl,
      liveUrl: liveUrl !== undefined ? liveUrl : project.liveUrl,
      imageUrl: imageUrl !== undefined ? imageUrl : project.imageUrl,
    };

    const err = validateProjectInput(candidate);
    if (err) {
      return res.status(400).json({ message: err });
    }

    if (title !== undefined) project.title = String(title).trim();
    if (description !== undefined) project.description = String(description).trim();
    if (techStack !== undefined && Array.isArray(techStack)) {
      project.techStack = techStack.map((t) => String(t).trim()).filter(Boolean);
    }
    if (githubUrl !== undefined) project.githubUrl = String(githubUrl).trim();
    if (liveUrl !== undefined) project.liveUrl = String(liveUrl).trim();
    if (imageUrl !== undefined) project.imageUrl = imageUrl ? String(imageUrl).trim() : null;
    if (featured !== undefined) project.featured = Boolean(featured);

    await user.save();

    res.json({
      message: "Project updated successfully.",
      project: {
        id: project._id.toString(),
        title: project.title,
        description: project.description,
        techStack: project.techStack,
        githubUrl: project.githubUrl,
        liveUrl: project.liveUrl,
        imageUrl: project.imageUrl,
        featured: project.featured,
        order: project.order,
        createdAt: project.createdAt,
      },
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Failed to update project." });
  }
});

router.delete("/me/projects/:projectId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
      return res.status(404).json({ message: "Project not found." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const project = user.projects.id(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    user.projects.pull({ _id: req.params.projectId });
    await user.save();

    res.json({
      message: "Project removed successfully.",
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ message: "Failed to delete project." });
  }
});

router.put("/me/projects/reorder", async (req, res) => {
  try {
    const { order } = req.body ?? {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ message: "Order must be an array of project IDs." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const idMap = new Map();
    order.forEach((id, index) => {
      idMap.set(String(id), index);
    });

    user.projects.forEach((proj) => {
      const projId = proj._id.toString();
      if (idMap.has(projId)) {
        proj.order = idMap.get(projId);
      }
    });

    user.projects.sort((a, b) => a.order - b.order);
    await user.save();

    res.json({
      message: "Projects reordered successfully.",
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Reorder projects error:", error);
    res.status(500).json({ message: "Failed to reorder projects." });
  }
});

// ============================================================================
// Cover Banner Upload & Management
// ============================================================================

router.post("/me/banner", limitAvatarUploads, async (req, res) => {
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
      return res.status(400).json({ message: "No banner image payload provided." });
    }

    if (fileBuffer.length > MAX_BANNER_SIZE) {
      return res.status(413).json({ message: "Banner image exceeds 3MB size limit." });
    }

    const ext = detectImageFormat(fileBuffer);
    if (!ext || !["jpg", "png", "webp"].includes(ext)) {
      return res.status(400).json({
        message: "Invalid image format. Only JPEG, PNG, and WebP are allowed.",
      });
    }

    await recordAvatarUpload(req);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const oldPublicId = user.bannerPublicId;
    const oldProvider = user.bannerProvider;

    const result = await uploadBanner(fileBuffer, ext);

    user.bannerUrl = result.url;
    user.bannerPublicId = result.publicId;
    user.bannerProvider = result.provider;
    user.bannerTheme = "custom";

    try {
      await user.save();
    } catch (saveErr) {
      await deleteAvatar(result.publicId, result.provider);
      throw saveErr;
    }

    if (oldPublicId) {
      try {
        await deleteAvatar(oldPublicId, oldProvider);
      } catch (cleanupErr) {
        console.error("Failed to clean up old banner:", cleanupErr);
      }
    }

    res.status(200).json({
      message: "Cover banner updated successfully.",
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Banner upload error:", error);
    res.status(500).json({ message: "Failed to upload cover banner." });
  }
});

router.delete("/me/banner", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.bannerPublicId) {
      await deleteAvatar(user.bannerPublicId, user.bannerProvider);
    }

    user.bannerUrl = null;
    user.bannerPublicId = null;
    user.bannerProvider = null;
    user.bannerTheme = "google-brand";
    await user.save();

    res.status(200).json({
      message: "Cover banner removed successfully.",
      user: publicUser(user, { isSelf: true }),
    });
  } catch (error) {
    console.error("Banner delete error:", error);
    res.status(500).json({ message: "Failed to remove cover banner." });
  }
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
router.post("/me/avatar", limitAvatarUploads, async (req, res) => {
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

    await recordAvatarUpload(req);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const oldPublicId = user.avatarPublicId;
    const oldProvider = user.avatarProvider;

    // Upload new avatar first before deleting the old one
    const result = await uploadAvatar(fileBuffer, ext);

    user.avatarUrl = result.url;
    user.avatarPublicId = result.publicId;
    user.avatarProvider = result.provider;

    try {
      await user.save();
    } catch (saveErr) {
      // If saving fails, clean up the newly uploaded orphaned avatar
      await deleteAvatar(result.publicId, result.provider);
      throw saveErr;
    }

    // Clean up previous avatar only after the new one is safely uploaded and saved
    if (oldPublicId) {
      try {
        await deleteAvatar(oldPublicId, oldProvider);
      } catch (cleanupErr) {
        console.error("Failed to clean up old avatar:", cleanupErr);
      }
    }

    res.status(200).json({
      message: "Profile photo updated successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    const detail = error?.message;
    res.status(500).json({
      message: detail && !detail.includes("\n") ? detail : "Failed to upload profile photo.",
    });
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
