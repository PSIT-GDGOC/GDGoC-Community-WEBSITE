import mongoose from "mongoose";
import { BRANCHES, YEARS } from "../utils/domain.js";

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 280 },
    techStack: [{ type: String, trim: true, maxlength: 30 }],
    githubUrl: { type: String, default: "", trim: true },
    liveUrl: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: null },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    category: { type: String, default: "Other", trim: true, maxlength: 40 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    branch: { type: String, enum: [...BRANCHES, ""] },
    year: { type: Number, enum: YEARS },
    bio: { type: String, maxlength: 280 },
    enrollmentNo: String,
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },
    avatarProvider: { type: String, default: null },
    tokenVersion: { type: Number, default: 0 },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    // Phase 10: Dynamic Identity Hub fields
    headline: { type: String, maxlength: 120, default: "" },
    college: { type: String, maxlength: 120, default: "PSIT Kanpur" },
    specialization: { type: String, maxlength: 60, default: "" },
    bannerTheme: {
      type: String,
      enum: ["google-brand", "midnight-slate", "cyber-grid", "sunset-gradient", "emerald-code", "custom"],
      default: "google-brand",
    },
    bannerUrl: { type: String, default: null },
    bannerPublicId: { type: String, default: null },
    bannerProvider: { type: String, default: null },
    accentColor: {
      type: String,
      enum: ["gblue", "gred", "gyellow", "ggreen", "slate"],
      default: "gblue",
    },
    cardTheme: {
      type: String,
      enum: ["default", "dark", "minimal", "accent"],
      default: "default",
    },
    socials: {
      github: { type: String, default: "", trim: true },
      linkedin: { type: String, default: "", trim: true },
      portfolio: { type: String, default: "", trim: true },
      website: { type: String, default: "", trim: true },
      twitter: { type: String, default: "", trim: true },
    },
    skills: { type: [skillSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    memberVerified: { type: Boolean, default: false },
    memberVerifiedAt: { type: Date, default: null },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showAttendance: { type: Boolean, default: true },
      showProjects: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export function publicUser(u, options = {}) {
  const isSelf = options.isSelf ?? true;
  return {
    id: u._id ? u._id.toString() : (u.id || undefined),
    name: u.name,
    email: isSelf || u.privacy?.showEmail ? u.email : undefined,
    role: u.role,
    branch: u.branch,
    year: u.year,
    bio: u.bio,
    enrollmentNo: u.enrollmentNo,
    avatarUrl: u.avatarUrl ?? null,
    emailVerified: Boolean(u.emailVerified),
    emailVerifiedAt: u.emailVerifiedAt ?? null,
    memberVerified: Boolean(u.memberVerified),
    memberVerifiedAt: u.memberVerifiedAt ?? null,
    headline: u.headline || "",
    college: u.college || "PSIT Kanpur",
    specialization: u.specialization || "",
    bannerTheme: u.bannerTheme || "google-brand",
    bannerUrl: u.bannerUrl ?? null,
    accentColor: u.accentColor || "gblue",
    cardTheme: u.cardTheme || "default",
    socials: {
      github: u.socials?.github || "",
      linkedin: u.socials?.linkedin || "",
      portfolio: u.socials?.portfolio || "",
      website: u.socials?.website || "",
      twitter: u.socials?.twitter || "",
    },
    skills: Array.isArray(u.skills)
      ? u.skills.map((s) => ({ name: s.name, category: s.category || "Other" }))
      : [],
    projects: Array.isArray(u.projects)
      ? (isSelf || u.privacy?.showProjects !== false
          ? u.projects.map((p) => ({
              id: p._id ? p._id.toString() : (p.id || undefined),
              title: p.title,
              description: p.description || "",
              techStack: Array.isArray(p.techStack) ? p.techStack : [],
              githubUrl: p.githubUrl || "",
              liveUrl: p.liveUrl || "",
              imageUrl: p.imageUrl || null,
              featured: Boolean(p.featured),
              order: p.order || 0,
              createdAt: p.createdAt,
            }))
          : [])
      : [],
    privacy: {
      showEmail: Boolean(u.privacy?.showEmail),
      showAttendance: u.privacy?.showAttendance !== false,
      showProjects: u.privacy?.showProjects !== false,
    },
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export default mongoose.model("User", userSchema);
