import mongoose from "mongoose";
import { BRANCHES, YEARS } from "../utils/domain.js";

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
  },
  { timestamps: true },
);

export function publicUser(u) {
  return {
    id: u._id ? u._id.toString() : (u.id || undefined),
    name: u.name,
    email: u.email,
    role: u.role,
    branch: u.branch,
    year: u.year,
    bio: u.bio,
    enrollmentNo: u.enrollmentNo,
    avatarUrl: u.avatarUrl ?? null,
    emailVerified: Boolean(u.emailVerified),
    emailVerifiedAt: u.emailVerifiedAt ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export default mongoose.model("User", userSchema);
