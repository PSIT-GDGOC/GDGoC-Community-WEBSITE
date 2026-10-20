import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import "./Event.js";

export function newTicketId() {
  return randomBytes(16).toString("base64url");
}

export function newRegRef() {
  return `REG-${randomBytes(5).toString("hex").toUpperCase()}`;
}

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    registrationReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: newRegRef,
    },
    ticketId: { type: String, required: true, unique: true, default: newTicketId },
    ticketCode: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "confirmed",
    },
    registrationStatus: {
      type: String,
      enum: ["confirmed", "cancelled", "pending"],
      default: "confirmed",
    },
    registeredAt: { type: Date, default: Date.now },
    ticketStatus: {
      type: String,
      enum: ["active", "used", "cancelled", "invalid"],
      default: "active",
    },
    checkedIn: { type: Boolean, default: false },
    attendedAt: { type: Date, default: null },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    correctionHistory: [
      {
        correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        previousState: { type: mongoose.Schema.Types.Mixed },
        newState: { type: mongoose.Schema.Types.Mixed },
        reason: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

registrationSchema.pre("validate", function () {
  if (this.user && !this.userId) this.userId = this.user;
  if (this.userId && !this.user) this.user = this.userId;

  if (this.event && !this.eventId) this.eventId = this.event;
  if (this.eventId && !this.event) this.event = this.eventId;

  if (this.ticketId && !this.ticketCode) this.ticketCode = this.ticketId;
  if (this.ticketCode && !this.ticketId) this.ticketId = this.ticketCode;

  if (this.status && !this.registrationStatus) this.registrationStatus = this.status;
  if (this.registrationStatus && !this.status) this.status = this.registrationStatus;

  if (!this.registrationReference) {
    this.registrationReference = newRegRef();
  }

  if (this.attendedAt && !this.checkedInAt) this.checkedInAt = this.attendedAt;
  if (this.checkedInAt && !this.attendedAt) this.attendedAt = this.checkedInAt;

  if (this.checkedInAt || this.attendedAt) {
    this.checkedIn = true;
    if (this.ticketStatus === "active") {
      this.ticketStatus = "used";
    }
  }

  if (this.status === "cancelled" || this.registrationStatus === "cancelled") {
    if (this.ticketStatus === "active") {
      this.ticketStatus = "cancelled";
    }
  }
});

registrationSchema.index({ user: 1, event: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, userId: 1 });

export default mongoose.model("Registration", registrationSchema);
