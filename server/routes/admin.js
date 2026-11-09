import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import User, { publicUser } from "../models/User.js";
import { requireAdmin } from "../middleware/auth.js";
import { TICKET_ID_PATTERN, validateAdmission } from "../utils/tickets.js";
import { uploadPoster } from "../utils/storage.js";

const router = Router();
router.use(requireAdmin);

const EVENT_ID_PATTERN = /^[a-f\d]{24}$/i;
const MAX_POSTER_SIZE = 5 * 1024 * 1024; // 5 MB

export function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 3) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

// 1. Dashboard Overview Stats
router.get("/stats", async (req, res) => {
  try {
    const eligibleFilter = { status: "confirmed" };
    const [usersCount, eventsCount, publishedEventsCount, registrationsCount, attendedCount] =
      await Promise.all([
        User.countDocuments(),
        Event.countDocuments(),
        Event.countDocuments({ published: true }),
        Registration.countDocuments(eligibleFilter),
        Registration.countDocuments({
          ...eligibleFilter,
          attendedAt: { $type: "date" },
        }),
      ]);

    const attendanceRate =
      registrationsCount === 0
        ? 0
        : Number(((attendedCount / registrationsCount) * 100).toFixed(1));

    res.json({
      usersCount,
      eventsCount,
      publishedEventsCount,
      registrationsCount,
      attendedCount,
      attendanceRate,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate stats." });
  }
});

// 2. Events List (All events, including drafts and cancelled)
router.get("/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ startsAt: -1 });
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch events." });
  }
});

// 3. Create Event
router.post("/events", async (req, res) => {
  try {
    const {
      title,
      summary = "",
      description = "",
      startsAt,
      endsAt,
      venue = "",
      poster = "",
      cancelled = false,
      published = false,
      category = "",
      format = "in_person",
      host = "",
      prerequisites = "",
      capacity = null,
      registrationDeadline = null,
      meetingUrl = "",
    } = req.body ?? {};

    if (!title || !startsAt) {
      return res.status(400).json({ message: "Title and start date/time are required." });
    }

    const startDate = new Date(startsAt);
    const endDate = endsAt ? new Date(endsAt) : undefined;
    const deadlineDate = registrationDeadline ? new Date(registrationDeadline) : null;

    if (endDate && endDate <= startDate) {
      return res.status(400).json({ message: "End time must be after start time." });
    }
    if (deadlineDate && deadlineDate > startDate) {
      return res.status(400).json({ message: "Registration deadline must be before or equal to start time." });
    }

    let parsedCapacity = null;
    if (capacity !== null && capacity !== undefined && capacity !== "") {
      parsedCapacity = Number(capacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
        return res.status(400).json({ message: "Capacity must be a positive integer." });
      }
    }

    const event = await Event.create({
      title: String(title).trim(),
      summary: String(summary).trim(),
      description: String(description).trim(),
      startsAt: startDate,
      endsAt: endDate,
      venue: String(venue).trim(),
      poster: String(poster).trim(),
      cancelled: Boolean(cancelled),
      published: Boolean(published),
      category: String(category).trim(),
      format: format === "online" ? "online" : "in_person",
      host: String(host).trim(),
      prerequisites: String(prerequisites).trim(),
      capacity: parsedCapacity,
      registrationDeadline: deadlineDate,
      meetingUrl: String(meetingUrl).trim(),
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create event." });
  }
});

// 4. Update Event
router.put("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!EVENT_ID_PATTERN.test(id)) {
    return res.status(404).json({ message: "Event not found." });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const b = req.body ?? {};
    if (b.title !== undefined) event.title = String(b.title).trim();
    if (b.summary !== undefined) event.summary = String(b.summary).trim();
    if (b.description !== undefined) event.description = String(b.description).trim();
    if (b.startsAt !== undefined) event.startsAt = new Date(b.startsAt);
    if (b.endsAt !== undefined) event.endsAt = b.endsAt ? new Date(b.endsAt) : null;
    if (b.venue !== undefined) event.venue = String(b.venue).trim();
    if (b.poster !== undefined) event.poster = String(b.poster).trim();
    if (b.cancelled !== undefined) event.cancelled = Boolean(b.cancelled);
    if (b.published !== undefined) event.published = Boolean(b.published);
    if (b.category !== undefined) event.category = String(b.category).trim();
    if (b.format !== undefined) event.format = b.format === "online" ? "online" : "in_person";
    if (b.host !== undefined) event.host = String(b.host).trim();
    if (b.prerequisites !== undefined) event.prerequisites = String(b.prerequisites).trim();

    if (b.capacity !== undefined) {
      if (b.capacity === null || b.capacity === "") {
        event.capacity = null;
      } else {
        const capNum = Number(b.capacity);
        if (!Number.isInteger(capNum) || capNum < 1) {
          return res.status(400).json({ message: "Capacity must be a positive integer." });
        }
        if (event.registeredCount > 0 && capNum < event.registeredCount) {
          return res.status(400).json({
            message: `Capacity cannot be reduced below current registered attendees (${event.registeredCount}).`,
          });
        }
        event.capacity = capNum;
      }
    }

    if (b.registrationDeadline !== undefined) {
      event.registrationDeadline = b.registrationDeadline ? new Date(b.registrationDeadline) : null;
    }
    if (b.meetingUrl !== undefined) event.meetingUrl = String(b.meetingUrl).trim();

    if (event.endsAt && event.endsAt <= event.startsAt) {
      return res.status(400).json({ message: "End time must be after start time." });
    }
    if (event.registrationDeadline && event.registrationDeadline > event.startsAt) {
      return res.status(400).json({ message: "Registration deadline must be before or equal to start time." });
    }

    await event.save();
    res.json(event);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update event." });
  }
});

// 5. Delete Event
router.delete("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!EVENT_ID_PATTERN.test(id)) {
    return res.status(404).json({ message: "Event not found." });
  }

  try {
    const event = await Event.findByIdAndDelete(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }
    // Remove related registrations
    await Registration.deleteMany({ event: id });
    res.json({ message: "Event and associated registrations deleted.", id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete event." });
  }
});

// 6. Get Event Registrations
router.get("/events/:id/registrations", async (req, res) => {
  const { id } = req.params;
  if (!EVENT_ID_PATTERN.test(id)) {
    return res.status(404).json({ message: "Event not found." });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const registrations = await Registration.find({ event: id })
      .populate("user", "name email branch year enrollmentNo")
      .sort({ createdAt: -1 });

    const stats = {
      total: registrations.length,
      confirmed: registrations.filter((r) => r.status === "confirmed").length,
      cancelled: registrations.filter((r) => r.status === "cancelled").length,
      attended: registrations.filter((r) => r.status === "confirmed" && r.attendedAt !== null).length,
    };

    res.json({ event, stats, registrations });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch registrations." });
  }
});

// 7. CSV Export of Registrations
router.get("/events/:id/export", async (req, res) => {
  const { id } = req.params;
  if (!EVENT_ID_PATTERN.test(id)) {
    return res.status(404).json({ message: "Event not found." });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const registrations = await Registration.find({ event: id })
      .populate("user", "name email branch year enrollmentNo")
      .sort({ createdAt: 1 });

    const escapeCsv = (val) => {
      let str = String(val ?? "");
      // Prevent formula injection
      if (/^[=+@\-\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Ticket ID",
      "Full Name",
      "Email Address",
      "Branch",
      "Year",
      "Enrollment No",
      "Status",
      "Registered At",
      "Attended At",
    ];

    const rows = registrations.map((r) => [
      escapeCsv(r.ticketId),
      escapeCsv(r.user?.name),
      escapeCsv(r.user?.email),
      escapeCsv(r.user?.branch),
      escapeCsv(r.user?.year),
      escapeCsv(r.user?.enrollmentNo),
      escapeCsv(r.status),
      escapeCsv(r.createdAt ? new Date(r.createdAt).toISOString() : ""),
      escapeCsv(
        r.status === "confirmed" && r.attendedAt
          ? new Date(r.attendedAt).toISOString()
          : r.status === "cancelled"
            ? "Cancelled"
            : "Not attended"
      ),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    const safeFilename = event.title.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendees_${safeFilename}_${id.slice(-6)}.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: "Failed to export registrations." });
  }
});

// 8. QR / Barcode / Ticket ID Scanner & Check-in
router.post("/attendance/scan", async (req, res) => {
  const { ticketId, eventId } = req.body ?? {};
  const cleanedId = String(ticketId ?? "").trim();

  if (!cleanedId || !TICKET_ID_PATTERN.test(cleanedId)) {
    return res.status(400).json({
      status: "invalid",
      message: "Invalid ticket format. Check the QR code or ticket ID.",
    });
  }

  try {
    const registration = await Registration.findOne({ ticketId: cleanedId })
      .populate("user", "name email branch year enrollmentNo")
      .populate("event");

    if (!registration || !registration.event) {
      return res.status(404).json({
        status: "not_found",
        message: "No ticket matches this ID.",
      });
    }

    // Verify ticket belongs to the selected event if eventId provided
    if (eventId && registration.event._id.toString() !== String(eventId).trim()) {
      return res.status(400).json({
        status: "invalid_event",
        message: "This ticket is registered for a different event.",
        registration,
        user: registration.user,
        event: registration.event,
      });
    }

    const validation = validateAdmission(registration, registration.event);
    if (!validation.allowed) {
      return res.status(validation.statusCode).json({
        status: validation.status,
        message: validation.message,
        registration,
        user: registration.user,
        event: registration.event,
      });
    }

    // Concurrency-safe atomic check-in
    const now = new Date();
    const updated = await Registration.findOneAndUpdate(
      { _id: registration._id, attendedAt: null, status: "confirmed" },
      { $set: { attendedAt: now, checkedInBy: req.user._id } },
      { returnDocument: "after" }
    )
      .populate("user", "name email branch year enrollmentNo")
      .populate("event");

    if (!updated) {
      const fresh = await Registration.findById(registration._id)
        .populate("user", "name email branch year enrollmentNo")
        .populate("event");
      return res.status(200).json({
        status: "already_attended",
        message: `Already checked in at ${new Date(fresh.attendedAt || now).toLocaleTimeString("en-IN")}.`,
        registration: fresh,
        user: fresh.user,
        event: fresh.event,
      });
    }

    return res.status(200).json({
      status: "admitted",
      message: `Checked in successfully: ${updated.user?.name || "Attendee"}`,
      registration: updated,
      user: updated.user,
      event: updated.event,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process ticket scan." });
  }
});

// 9. Manual Check-in / Attendance Toggle for an Attendee
router.post("/attendance/manual", async (req, res) => {
  const { registrationId, attended, reason = "" } = req.body ?? {};
  if (!EVENT_ID_PATTERN.test(registrationId)) {
    return res.status(400).json({ message: "Invalid registration ID." });
  }

  try {
    const registration = await Registration.findById(registrationId)
      .populate("user", "name email branch year enrollmentNo")
      .populate("event");

    if (!registration) {
      return res.status(404).json({ message: "Registration not found." });
    }

    if (attended) {
      if (registration.status === "cancelled") {
        return res.status(409).json({ message: "Cannot check in a cancelled registration." });
      }
      if (registration.event?.cancelled) {
        return res.status(409).json({ message: "Cannot check in for a cancelled event." });
      }
      if (registration.status !== "confirmed") {
        return res.status(409).json({ message: "Only confirmed registrations can be checked in." });
      }
      registration.attendedAt = new Date();
      registration.checkedInBy = req.user._id;
      if (reason) registration.overrideReason = String(reason).trim();
    } else {
      registration.attendedAt = null;
      if (reason) registration.overrideReason = String(reason).trim();
    }

    await registration.save();

    res.json({
      message: attended ? "Attendance recorded." : "Attendance reset.",
      registration,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update attendance." });
  }
});

// 10. List Users (Members) with Pagination
router.get("/users", async (req, res) => {
  const { q = "", role = "", page = 1, limit = 50 } = req.query;
  const filter = {};

  if (role) {
    filter.role = role;
  }
  if (q) {
    const regex = new RegExp(String(q).trim(), "i");
    filter.$or = [{ name: regex }, { email: regex }, { branch: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  try {
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    ]);

    res.json({
      users: users.map((user) => publicUser(user, { isSelf: true })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users." });
  }
});

// 11. Update User Role
router.patch("/users/:email/role", async (req, res) => {
  const email = String(req.params.email ?? "").trim().toLowerCase();
  const { role } = req.body ?? {};

  if (!["student", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be 'student' or 'admin'." });
  }

  try {
    const target = await User.findOne({ email });
    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    // Safety rule: NO ADMINISTRATOR MAY DEMOTE THEIR OWN ACCOUNT THROUGH MEMBER ROLE MANAGEMENT
    if (target._id.equals(req.user._id) && role !== "admin") {
      return res.status(403).json({
        message: "You cannot remove your own administrator access.",
      });
    }

    // Safety rule: Prevent removal of the last remaining administrator
    if (role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot demote the only remaining administrator." });
      }
    }

    target.role = role;
    await target.save();

    res.json({ message: `Role updated to ${role}.`, user: publicUser(target, { isSelf: true }) });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user role." });
  }
});

// 12. Event Poster Image Upload
router.post("/events/upload-poster", async (req, res) => {
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

    if (fileBuffer.length > MAX_POSTER_SIZE) {
      return res.status(413).json({ message: "Image exceeds 5MB size limit." });
    }

    // Verify magic bytes
    const ext = detectImageFormat(fileBuffer);
    if (!ext) {
      return res.status(400).json({
        message: "Invalid or unsupported image format. Only JPEG, PNG, and WebP are allowed.",
      });
    }

    // Upload via persistent storage adapter (Cloudinary in prod, local disk in dev/test)
    const uploadResult = await uploadPoster(fileBuffer, ext);

    return res.status(201).json({
      url: uploadResult.url,
      key: uploadResult.key,
      provider: uploadResult.provider,
      message: "Poster uploaded successfully.",
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to upload event poster." });
  }
});

export default router;
