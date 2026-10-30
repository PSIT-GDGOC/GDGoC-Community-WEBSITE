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
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export function publicUser(u) {
  return {
    name: u.name,
    email: u.email,
    role: u.role,
    branch: u.branch,
    year: u.year,
    bio: u.bio,
    enrollmentNo: u.enrollmentNo,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export default mongoose.model("User", userSchema);
