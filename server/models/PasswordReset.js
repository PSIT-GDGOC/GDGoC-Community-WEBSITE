import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index to automatically prune expired reset requests after 1 hour
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model("PasswordReset", passwordResetSchema);
