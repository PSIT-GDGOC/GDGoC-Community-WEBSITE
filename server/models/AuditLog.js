import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, default: "System Admin" },
    actorRole: { type: String, default: "admin" },
    action: {
      type: String,
      required: true,
      enum: [
        "EVENT_CREATED",
        "EVENT_UPDATED",
        "EVENT_PUBLISHED",
        "EVENT_CANCELLED",
        "EVENT_DELETED",
        "PROJECT_CREATED",
        "PROJECT_UPDATED",
        "PROJECT_DELETED",
        "TICKET_VERIFIED_CHECKIN",
        "ATTENDANCE_CORRECTED",
        "CSV_EXPORTED",
      ],
    },
    targetType: {
      type: String,
      required: true,
      enum: ["Event", "Project", "Registration", "Ticket", "Attendance"],
    },
    targetRecordId: { type: String, required: true },
    summary: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helper function to safely record audit logs without exposing sensitive information
export async function logAdminAction({
  actor,
  action,
  targetType,
  targetRecordId,
  summary,
  details = {},
}) {
  try {
    // Sanitize details to never log credentials, tokens, or hashes
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.jwt;
    delete sanitizedDetails.cookie;
    delete sanitizedDetails.authorization;

    return await mongoose.model("AuditLog").create({
      actorId: actor?._id || actor?.id,
      actorName: actor?.name || "System Admin",
      actorRole: actor?.role || "admin",
      action,
      targetType,
      targetRecordId: String(targetRecordId),
      summary: summary || `${action} on ${targetType} ${targetRecordId}`,
      details: sanitizedDetails,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
    return null;
  }
}

export default mongoose.model("AuditLog", auditLogSchema);

