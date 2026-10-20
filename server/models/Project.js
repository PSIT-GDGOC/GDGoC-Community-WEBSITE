import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    shortDescription: { type: String, required: true, trim: true, maxlength: 300 },
    fullDescription: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    screenshots: [{ type: String }],
    domain: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    techStack: [{ type: String, trim: true }],
    contributors: [{ type: mongoose.Schema.Types.Mixed }],
    githubUrl: { type: String, default: "", trim: true },
    liveDemoUrl: { type: String, default: "", trim: true },
    docsUrl: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["ongoing", "completed", "archived"],
      default: "ongoing",
    },
    publicationStatus: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.pre("validate", function () {
  if (this.domain && !this.category) this.category = this.domain;
  if (this.category && !this.domain) this.domain = this.category;
});

const urlValidator = (url) => !url || /^https?:\/\/\S+$/i.test(url);
projectSchema.path("githubUrl").validate(urlValidator, "GitHub URL must be a valid http(s) URL.");
projectSchema.path("liveDemoUrl").validate(urlValidator, "Live demo URL must be a valid http(s) URL.");
projectSchema.path("docsUrl").validate(urlValidator, "Docs URL must be a valid http(s) URL.");
projectSchema.path("coverImage").validate(urlValidator, "Cover image must be a valid URL.");

export default mongoose.model("Project", projectSchema);

