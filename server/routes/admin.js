import { Router } from "express";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import User, { publicUser } from "../models/User.js";
import { requireAdmin } from "../middleware/auth.js";
import { TICKET_ID_PATTERN } from "../utils/tickets.js";

const router = Router();
router.use(requireAdmin);

const EVENT_ID_PATTERN = /^[a-f\d]{24}$/i;

// 1. Dashboard Overview Stats
router.get("/stats", async (req, res) => {
  try {
    const [usersCount, eventsCount, publishedEventsCount, registrationsCount, attendedCount] =
      await Promise.all([
        User.countDocuments(),
        Event.countDocuments(),
        Event.countDocuments({ published: true }),
        Registration.countDocuments({ status: { $ne: "cancelled" } }),
        Registration.countDocuments({ attendedAt: { $ne: null } }),
      ]);

    const attendanceRate =
      registrationsCount > 0 ? Number(((attendedCount / registrationsCount) * 100).toFixed(1)) : 0;

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

    const event = await Event.create({
      title: String(title).trim(),
      summary: String(summary).trim(),
      description: String(description).trim(),
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : undefined,
      venue: String(venue).trim(),
      poster: String(poster).trim(),
      cancelled: Boolean(cancelled),
      published: Boolean(published),
      category: String(category).trim(),
      format: format === "online" ? "online" : "in_person",
      host: String(host).trim(),
      prerequisites: String(prerequisites).trim(),
      capacity: capacity ? Number(capacity) : null,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
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
    if (b.capacity !== undefined) event.capacity = b.capacity ? Number(b.capacity) : null;
    if (b.registrationDeadline !== undefined) {
      event.registrationDeadline = b.registrationDeadline ? new Date(b.registrationDeadline) : null;
    }
    if (b.meetingUrl !== undefined) event.meetingUrl = String(b.meetingUrl).trim();

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
      attended: registrations.filter((r) => r.attendedAt !== null).length,
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
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
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
      escapeCsv(r.attendedAt ? new Date(r.attendedAt).toISOString() : "Not attended"),
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
  const { ticketId } = req.body ?? {};
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

    if (registration.status === "cancelled") {
      return res.status(409).json({
        status: "cancelled",
        message: "This registration was cancelled by the attendee.",
        registration,
        user: registration.user,
        event: registration.event,
      });
    }

    if (registration.attendedAt) {
      return res.status(200).json({
        status: "already_attended",
        message: `Already checked in at ${new Date(registration.attendedAt).toLocaleTimeString("en-IN")}.`,
        registration,
        user: registration.user,
        event: registration.event,
      });
    }

    registration.attendedAt = new Date();
    await registration.save();

    return res.status(200).json({
      status: "admitted",
      message: `Checked in successfully: ${registration.user?.name || "Attendee"}`,
      registration,
      user: registration.user,
      event: registration.event,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process ticket scan." });
  }
});

// 9. Manual Check-in / Attendance Toggle for an Attendee
router.post("/attendance/manual", async (req, res) => {
  const { registrationId, attended } = req.body ?? {};
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

    registration.attendedAt = attended ? new Date() : null;
    await registration.save();

    res.json({
      message: attended ? "Attendance recorded." : "Attendance reset.",
      registration,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update attendance." });
  }
});

// 10. List Users (Members)
router.get("/users", async (req, res) => {
  const { q = "", role = "" } = req.query;
  const filter = {};

  if (role) {
    filter.role = role;
  }
  if (q) {
    const regex = new RegExp(String(q).trim(), "i");
    filter.$or = [{ name: regex }, { email: regex }, { branch: regex }];
  }

  try {
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ users: users.map(publicUser) });
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

    // Safety: prevent an admin from demoting themselves if they are the sole admin
    if (target._id.equals(req.user._id) && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot demote the only remaining administrator." });
      }
    }

    target.role = role;
    await target.save();

    res.json({ message: `Role updated to ${role}.`, user: publicUser(target) });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user role." });
  }
});

export default router;
