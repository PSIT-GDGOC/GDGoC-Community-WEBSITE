import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, enum: ["avatar", "poster", "banner", "project"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);

