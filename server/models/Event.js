import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, default: "", maxlength: 280 },
    shortDescription: { type: String, default: "", maxlength: 280 },
    description: { type: String, default: "" },
    fullDescription: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    startDate: { type: Date },
    endsAt: { type: Date },
    endDate: { type: Date },
    venue: { type: String, default: "" },
    poster: { type: String, default: "" },
    posterUrl: { type: String, default: "" },
    cancelled: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published", "upcoming", "completed", "cancelled"],
      default: "draft",
    },
    registrationOpen: { type: Boolean, default: true },
    category: { type: String, required: true, trim: true },
    format: {
      type: String,
      enum: ["in_person", "online", "offline", "hybrid"],
      default: "in_person",
    },
    host: { type: String, default: "" },
    speakers: { type: mongoose.Schema.Types.Mixed, default: "" },
    organizers: { type: mongoose.Schema.Types.Mixed, default: "" },
    prerequisites: { type: String, default: "" },
    participationInstructions: { type: String, default: "" },
    capacity: { type: Number, min: 1, default: null },
    registeredCount: { type: Number, min: 0, default: 0 },
    registrationDeadline: { type: Date, default: null },
    meetingUrl: { type: String, default: "", trim: true },
    onlineLink: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eventSchema.pre("validate", function () {
  // Sync mirror fields seamlessly
  if (this.startDate && !this.startsAt) this.startsAt = this.startDate;
  if (this.startsAt && !this.startDate) this.startDate = this.startsAt;

  if (this.endDate && !this.endsAt) this.endsAt = this.endDate;
  if (this.endsAt && !this.endDate) this.endDate = this.endsAt;

  if (this.shortDescription && !this.summary) this.summary = this.shortDescription;
  if (this.summary && !this.shortDescription) this.shortDescription = this.summary;

  if (this.fullDescription && !this.description) this.description = this.fullDescription;
  if (this.description && !this.fullDescription) this.fullDescription = this.description;

  if (this.posterUrl && !this.poster) this.poster = this.posterUrl;
  if (this.poster && !this.posterUrl) this.posterUrl = this.poster;

  if (this.onlineLink && !this.meetingUrl) this.meetingUrl = this.onlineLink;
  if (this.meetingUrl && !this.onlineLink) this.onlineLink = this.meetingUrl;

  if (this.participationInstructions && !this.prerequisites) this.prerequisites = this.participationInstructions;
  if (this.prerequisites && !this.participationInstructions) this.participationInstructions = this.prerequisites;

  // Sync lifecycle flags
  if (this.cancelled) {
    this.status = "cancelled";
  } else if (this.status === "cancelled") {
    this.cancelled = true;
  } else if (this.published || this.status === "published") {
    this.published = true;
    if (this.status === "draft") this.status = "published";
  } else if (this.status === "draft") {
    this.published = false;
  }
});

eventSchema.path("endsAt").validate(function (endsAt) {
  const start = this.startsAt || this.startDate;
  return !endsAt || !start || endsAt >= start;
}, "End time must be after or equal to the start time.");

eventSchema.path("registrationDeadline").validate(function (deadline) {
  const start = this.startsAt || this.startDate;
  return !deadline || !start || deadline <= start;
}, "Registration must close before the event starts.");

eventSchema.path("meetingUrl").validate(function (url) {
  return !url || /^https?:\/\/\S+$/i.test(url);
}, "Meeting link must start with http:// or https://.");

export default mongoose.model("Event", eventSchema);
