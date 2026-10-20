import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Event from "../models/Event.js";
import Project from "../models/Project.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import AuditLog, { logAdminAction } from "../models/AuditLog.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Strict Rate Limiting on admin endpoints to prevent abuse & brute-force QR scanning
const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many admin requests. Please slow down." },
});

router.use(adminRateLimiter);
router.use(requireAuth);
router.use(requireAdmin);

const ID_REGEX = /^[a-f\d]{24}$/i;

// ----------------------------------------------------
// 1. DASHBOARD OVERVIEW METRICS
// GET /api/admin/metrics
// ----------------------------------------------------
router.get("/metrics", async (req, res) => {
  try {
    const now = new Date();

    const [
      totalPublishedEvents,
      upcomingEvents,
      totalProjects,
      ongoingProjects,
      completedProjects,
      totalRegistrations,
      confirmedRegistrations,
      uniqueRegisteredUsers,
      totalCheckedInAttendance,
      recentActivity,
    ] = await Promise.all([
      Event.countDocuments({ $or: [{ published: true }, { status: "published" }] }),
      Event.countDocuments({
        $or: [{ startsAt: { $gt: now } }, { startDate: { $gt: now } }],
        cancelled: { $ne: true },
        status: { $ne: "cancelled" },
      }),
      Project.countDocuments(),
      Project.countDocuments({ status: "ongoing" }),
      Project.countDocuments({ status: "completed" }),
      Registration.countDocuments(),
      Registration.countDocuments({
        $or: [{ status: "confirmed" }, { registrationStatus: "confirmed" }],
      }),
      Registration.distinct("user"),
      Registration.countDocuments({
        $or: [
          { checkedIn: true },
          { attendedAt: { $ne: null } },
          { ticketStatus: "used" },
        ],
      }),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      totalPublishedEvents,
      upcomingEvents,
      totalProjects,
      ongoingProjects,
      completedProjects,
      totalRegistrations,
      confirmedRegistrations,
      uniqueRegisteredMembers: uniqueRegisteredUsers.length,
      totalCheckedInAttendance,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate dashboard metrics." });
  }
});

// ----------------------------------------------------
// 2. EVENT MANAGEMENT APIS
// ----------------------------------------------------

// GET /api/admin/events
router.get("/events", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, status, category, format, sortBy, sortOrder } = req.query;
    const query = {};

    if (search) {
      const s = new RegExp(String(search).trim(), "i");
      query.$or = [{ title: s }, { summary: s }, { shortDescription: s }, { venue: s }, { category: s }];
    }

    if (status) {
      if (status === "upcoming") {
        query.startsAt = { $gt: new Date() };
        query.cancelled = { $ne: true };
      } else if (status === "cancelled") {
        query.$or = [{ cancelled: true }, { status: "cancelled" }];
      } else if (status === "published") {
        query.$or = [{ published: true }, { status: "published" }];
        query.cancelled = { $ne: true };
      } else if (status === "draft") {
        query.$or = [{ published: false }, { status: "draft" }];
        query.cancelled = { $ne: true };
      } else if (status === "completed") {
        query.endsAt = { $lt: new Date() };
      }
    }

    if (category) query.category = category;
    if (format) query.format = format;

    const sortField = sortBy || "startsAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDir };

    const [events, total] = await Promise.all([
      Event.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Event.countDocuments(query),
    ]);

    res.json({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admin events." });
  }
});

// Validation helper for events
function validateEventInput(body, isUpdate = false) {
  const errors = {};
  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  const shortDesc = body.shortDescription || body.summary;
  const fullDesc = body.fullDescription || body.description;
  const startDate = body.startDate || body.startsAt;
  const endDate = body.endDate || body.endsAt;
  const deadline = body.registrationDeadline;
  const capacity = body.capacity;

  if (!isUpdate || title !== undefined) {
    if (!title || title.length < 2 || title.length > 120) {
      errors.title = "Title is required and must be between 2 and 120 characters.";
    }
  }

  if (!isUpdate || shortDesc !== undefined) {
    if (!shortDesc || String(shortDesc).trim().length < 5) {
      errors.shortDescription = "Short description must be at least 5 characters.";
    }
  }

  if (!isUpdate || startDate !== undefined) {
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      errors.startDate = "A valid start date is required.";
    }
  }

  if (endDate && startDate) {
    if (new Date(endDate) < new Date(startDate)) {
      errors.endDate = "End date must be on or after the start date.";
    }
  }

  if (deadline && startDate) {
    if (new Date(deadline) > new Date(startDate)) {
      errors.registrationDeadline = "Registration deadline must be before or at event start time.";
    }
  }

  if (!isUpdate || capacity !== undefined) {
    if (capacity !== null && capacity !== undefined && capacity !== "") {
      const cap = Number(capacity);
      if (!Number.isInteger(cap) || cap < 1) {
        errors.capacity = "Capacity must be an integer greater than or equal to 1.";
      }
    } else if (!isUpdate) {
      errors.capacity = "Capacity is required.";
    }
  }

  const urlCheck = (url, name) => {
    if (url && !/^https?:\/\/\S+$/i.test(String(url).trim())) {
      errors[name] = `${name} must start with http:// or https://`;
    }
  };

  urlCheck(body.posterUrl || body.poster, "posterUrl");
  urlCheck(body.onlineLink || body.meetingUrl, "onlineLink");

  return Object.keys(errors).length > 0 ? errors : null;
}

// POST /api/admin/events
router.post("/events", async (req, res) => {
  try {
    const errors = validateEventInput(req.body, false);
    if (errors) {
      return res.status(400).json({ message: "Validation error.", errors });
    }

    const {
      title,
      shortDescription,
      summary,
      fullDescription,
      description,
      startDate,
      startsAt,
      endDate,
      endsAt,
      venue,
      onlineLink,
      meetingUrl,
      posterUrl,
      poster,
      category,
      format,
      speakers,
      organizers,
      host,
      capacity,
      registrationDeadline,
      status = "draft",
      registrationOpen = true,
      participationInstructions,
      prerequisites,
    } = req.body;

    const event = new Event({
      title: title.trim(),
      shortDescription: shortDescription || summary || "",
      summary: summary || shortDescription || "",
      fullDescription: fullDescription || description || "",
      description: description || fullDescription || "",
      startDate: new Date(startDate || startsAt),
      startsAt: new Date(startsAt || startDate),
      endDate: endDate || endsAt ? new Date(endDate || endsAt) : null,
      endsAt: endsAt || endDate ? new Date(endsAt || endDate) : null,
      venue: venue || "",
      onlineLink: onlineLink || meetingUrl || "",
      meetingUrl: meetingUrl || onlineLink || "",
      posterUrl: posterUrl || poster || "",
      poster: poster || posterUrl || "",
      category: (category || "General").trim(),
      format: format || "in_person",
      speakers: speakers || host || "",
      organizers: organizers || host || "",
      host: host || speakers || "",
      capacity: Number(capacity),
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      status,
      published: status === "published",
      registrationOpen: Boolean(registrationOpen),
      participationInstructions: participationInstructions || prerequisites || "",
      prerequisites: prerequisites || participationInstructions || "",
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await event.save();

    await logAdminAction({
      actor: req.user,
      action: "EVENT_CREATED",
      targetType: "Event",
      targetRecordId: event._id,
      summary: `Created event "${event.title}"`,
      details: { title: event.title, status: event.status, capacity: event.capacity },
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create event." });
  }
});

// GET /api/admin/events/:id
router.get("/events/:id", async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve event." });
  }
});

// PUT / PATCH /api/admin/events/:id
const updateEvent = async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const errors = validateEventInput(req.body, true);
    if (errors) {
      return res.status(400).json({ message: "Validation error.", errors });
    }

    const b = req.body;
    if (b.title !== undefined) event.title = b.title.trim();
    if (b.shortDescription !== undefined || b.summary !== undefined) {
      event.shortDescription = b.shortDescription || b.summary;
      event.summary = b.shortDescription || b.summary;
    }
    if (b.fullDescription !== undefined || b.description !== undefined) {
      event.fullDescription = b.fullDescription || b.description;
      event.description = b.fullDescription || b.description;
    }
    if (b.startDate !== undefined || b.startsAt !== undefined) {
      event.startDate = new Date(b.startDate || b.startsAt);
      event.startsAt = event.startDate;
    }
    if (b.endDate !== undefined || b.endsAt !== undefined) {
      event.endDate = b.endDate || b.endsAt ? new Date(b.endDate || b.endsAt) : null;
      event.endsAt = event.endDate;
    }
    if (b.venue !== undefined) event.venue = b.venue;
    if (b.onlineLink !== undefined || b.meetingUrl !== undefined) {
      event.onlineLink = b.onlineLink || b.meetingUrl;
      event.meetingUrl = event.onlineLink;
    }
    if (b.posterUrl !== undefined || b.poster !== undefined) {
      event.posterUrl = b.posterUrl || b.poster;
      event.poster = event.posterUrl;
    }
    if (b.category !== undefined) event.category = b.category.trim();
    if (b.format !== undefined) event.format = b.format;
    if (b.speakers !== undefined) event.speakers = b.speakers;
    if (b.organizers !== undefined) event.organizers = b.organizers;
    if (b.host !== undefined) event.host = b.host;
    if (b.capacity !== undefined) event.capacity = Number(b.capacity);
    if (b.registrationDeadline !== undefined) {
      event.registrationDeadline = b.registrationDeadline ? new Date(b.registrationDeadline) : null;
    }
    if (b.registrationOpen !== undefined) event.registrationOpen = Boolean(b.registrationOpen);
    if (b.participationInstructions !== undefined || b.prerequisites !== undefined) {
      event.participationInstructions = b.participationInstructions || b.prerequisites;
      event.prerequisites = event.participationInstructions;
    }

    event.updatedBy = req.user._id;
    await event.save();

    await logAdminAction({
      actor: req.user,
      action: "EVENT_UPDATED",
      targetType: "Event",
      targetRecordId: event._id,
      summary: `Updated event "${event.title}"`,
    });

    res.json(event);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update event." });
  }
};

router.put("/events/:id", updateEvent);
router.patch("/events/:id", updateEvent);

// PATCH /api/admin/events/:id/status - Lifecycle transitions
router.patch("/events/:id/status", async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const { status } = req.body;
    const allowed = ["draft", "published", "upcoming", "completed", "cancelled"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(", ")}` });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    if (status === "published") {
      // Prevent publishing incomplete records
      if (!event.title || !event.startsAt || !event.category || !event.capacity) {
        return res.status(400).json({
          message: "Cannot publish incomplete event. Title, start date, category, and capacity are required.",
        });
      }
      event.status = "published";
      event.published = true;
      event.cancelled = false;
      event.registrationOpen = true;

      await event.save();
      await logAdminAction({
        actor: req.user,
        action: "EVENT_PUBLISHED",
        targetType: "Event",
        targetRecordId: event._id,
        summary: `Published event "${event.title}"`,
      });
    } else if (status === "cancelled") {
      event.status = "cancelled";
      event.cancelled = true;
      event.published = false;
      event.registrationOpen = false;

      await event.save();

      // Invalidate active tickets while preserving registration history
      await Registration.updateMany(
        { event: event._id, ticketStatus: "active" },
        { $set: { ticketStatus: "cancelled" } }
      );

      await logAdminAction({
        actor: req.user,
        action: "EVENT_CANCELLED",
        targetType: "Event",
        targetRecordId: event._id,
        summary: `Cancelled event "${event.title}" and marked active tickets cancelled`,
      });
    } else {
      event.status = status;
      if (status === "draft") {
        event.published = false;
      }
      await event.save();

      await logAdminAction({
        actor: req.user,
        action: "EVENT_UPDATED",
        targetType: "Event",
        targetRecordId: event._id,
        summary: `Transitioned event "${event.title}" status to "${status}"`,
      });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Failed to update event status." });
  }
});

// DELETE /api/admin/events/:id
router.delete("/events/:id", async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const regCount = await Registration.countDocuments({ event: req.params.id });
    if (regCount > 0) {
      return res.status(400).json({
        message: `Cannot delete event with ${regCount} existing registration(s). Please cancel the event instead to preserve student attendance and registration history.`,
      });
    }

    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    await logAdminAction({
      actor: req.user,
      action: "EVENT_DELETED",
      targetType: "Event",
      targetRecordId: req.params.id,
      summary: `Deleted event "${event.title}"`,
    });

    res.json({ message: "Event deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete event." });
  }
});

// ----------------------------------------------------
// 3. PROJECT MANAGEMENT APIS
// ----------------------------------------------------

// GET /api/admin/projects
router.get("/projects", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { search, domain, status, publicationStatus, sortBy, sortOrder } = req.query;
    const query = {};

    if (search) {
      const s = new RegExp(String(search).trim(), "i");
      query.$or = [{ title: s }, { shortDescription: s }, { domain: s }, { techStack: s }];
    }

    if (domain) query.domain = domain;
    if (status) query.status = status;
    if (publicationStatus) query.publicationStatus = publicationStatus;

    const sortField = sortBy || "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDir };

    const [projects, total] = await Promise.all([
      Project.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Project.countDocuments(query),
    ]);

    res.json({
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch admin projects." });
  }
});

// POST /api/admin/projects
router.post("/projects", async (req, res) => {
  try {
    const {
      title,
      shortDescription,
      fullDescription,
      coverImage,
      screenshots = [],
      domain,
      category,
      techStack = [],
      contributors = [],
      githubUrl,
      liveDemoUrl,
      docsUrl,
      status = "ongoing",
      publicationStatus = "published",
    } = req.body;

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ message: "Title is required (min 2 characters)." });
    }
    if (!shortDescription || String(shortDescription).trim().length < 5) {
      return res.status(400).json({ message: "Short description is required (min 5 characters)." });
    }
    if (!domain && !category) {
      return res.status(400).json({ message: "Domain or category is required." });
    }

    const project = new Project({
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription || "",
      coverImage: coverImage || "",
      screenshots: Array.isArray(screenshots) ? screenshots : [],
      domain: (domain || category).trim(),
      category: (category || domain).trim(),
      techStack: Array.isArray(techStack)
        ? techStack
        : String(techStack || "").split(",").map((t) => t.trim()).filter(Boolean),
      contributors: Array.isArray(contributors) ? contributors : [],
      githubUrl: githubUrl || "",
      liveDemoUrl: liveDemoUrl || "",
      docsUrl: docsUrl || "",
      status,
      publicationStatus,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await project.save();

    await logAdminAction({
      actor: req.user,
      action: "PROJECT_CREATED",
      targetType: "Project",
      targetRecordId: project._id,
      summary: `Created project "${project.title}"`,
    });

    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create project." });
  }
});

// GET /api/admin/projects/:id
router.get("/projects/:id", async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Project not found." });
    }

    const project = await Project.findById(req.params.id).lean();
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve project." });
  }
});

// PUT / PATCH /api/admin/projects/:id
const updateProject = async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Project not found." });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const b = req.body;
    if (b.title !== undefined) project.title = b.title.trim();
    if (b.shortDescription !== undefined) project.shortDescription = b.shortDescription.trim();
    if (b.fullDescription !== undefined) project.fullDescription = b.fullDescription;
    if (b.coverImage !== undefined) project.coverImage = b.coverImage;
    if (b.screenshots !== undefined) project.screenshots = Array.isArray(b.screenshots) ? b.screenshots : [];
    if (b.domain !== undefined || b.category !== undefined) {
      project.domain = (b.domain || b.category).trim();
      project.category = project.domain;
    }
    if (b.techStack !== undefined) {
      project.techStack = Array.isArray(b.techStack)
        ? b.techStack
        : String(b.techStack || "").split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (b.contributors !== undefined) {
      project.contributors = Array.isArray(b.contributors) ? b.contributors : [];
    }
    if (b.githubUrl !== undefined) project.githubUrl = b.githubUrl;
    if (b.liveDemoUrl !== undefined) project.liveDemoUrl = b.liveDemoUrl;
    if (b.docsUrl !== undefined) project.docsUrl = b.docsUrl;
    if (b.status !== undefined) project.status = b.status;
    if (b.publicationStatus !== undefined) project.publicationStatus = b.publicationStatus;

    project.updatedBy = req.user._id;
    await project.save();

    await logAdminAction({
      actor: req.user,
      action: "PROJECT_UPDATED",
      targetType: "Project",
      targetRecordId: project._id,
      summary: `Updated project "${project.title}"`,
    });

    res.json(project);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update project." });
  }
};

router.put("/projects/:id", updateProject);
router.patch("/projects/:id", updateProject);

// DELETE /api/admin/projects/:id
router.delete("/projects/:id", async (req, res) => {
  try {
    if (!ID_REGEX.test(req.params.id)) {
      return res.status(404).json({ message: "Project not found." });
    }

    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    await logAdminAction({
      actor: req.user,
      action: "PROJECT_DELETED",
      targetType: "Project",
      targetRecordId: req.params.id,
      summary: `Deleted project "${project.title}"`,
    });

    res.json({ message: "Project deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete project." });
  }
});

// ----------------------------------------------------
// 4. REGISTRATION & EVENT STATISTICS APIS
// ----------------------------------------------------

// GET /api/admin/registrations
router.get("/registrations", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { eventId, registrationStatus, checkedIn, search } = req.query;
    const query = {};

    if (eventId && ID_REGEX.test(eventId)) {
      query.$or = [{ event: eventId }, { eventId: eventId }];
    }

    if (registrationStatus) {
      query.$or = [{ status: registrationStatus }, { registrationStatus: registrationStatus }];
    }

    if (checkedIn !== undefined && checkedIn !== "") {
      const isChecked = checkedIn === "true";
      if (isChecked) {
        query.$and = [
          ...(query.$and || []),
          { $or: [{ checkedIn: true }, { attendedAt: { $ne: null } }, { ticketStatus: "used" }] },
        ];
      } else {
        query.$and = [
          ...(query.$and || []),
          { checkedIn: { $ne: true }, attendedAt: null },
        ];
      }
    }

    // If search text provided, search users or references
    if (search && String(search).trim()) {
      const term = String(search).trim();
      const s = new RegExp(term, "i");

      // Find matching users
      const matchingUsers = await User.find({
        $or: [{ name: s }, { email: s }, { enrollmentNo: s }],
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { user: { $in: userIds } },
            { userId: { $in: userIds } },
            { registrationReference: s },
            { ticketId: term },
            { ticketCode: term },
          ],
        },
      ];
    }

    const [registrations, total] = await Promise.all([
      Registration.find(query)
        .populate("user", "name email branch year enrollmentNo")
        .populate("event", "title startsAt startDate venue capacity registeredCount cancelled")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Registration.countDocuments(query),
    ]);

    res.json({
      registrations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch registrations." });
  }
});

// GET /api/admin/events/:eventId/stats
router.get("/events/:eventId/stats", async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!ID_REGEX.test(eventId)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const [
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      checkedInAttendees,
    ] = await Promise.all([
      Registration.countDocuments({ $or: [{ event: event._id }, { eventId: event._id }] }),
      Registration.countDocuments({
        $or: [{ event: event._id }, { eventId: event._id }],
        $and: [{ status: { $ne: "cancelled" } }, { registrationStatus: { $ne: "cancelled" } }],
      }),
      Registration.countDocuments({
        $or: [{ event: event._id }, { eventId: event._id }],
        $or: [{ status: "cancelled" }, { registrationStatus: "cancelled" }],
      }),
      Registration.countDocuments({
        $or: [{ event: event._id }, { eventId: event._id }],
        $or: [{ checkedIn: true }, { attendedAt: { $ne: null } }, { ticketStatus: "used" }],
      }),
    ]);

    const capacity = Number(event.capacity || 0);
    // Capacity can never be negative
    const availableCapacity = Math.max(0, capacity - confirmedRegistrations);
    const attendancePercentage =
      confirmedRegistrations > 0
        ? Math.round((checkedInAttendees / confirmedRegistrations) * 100)
        : 0;

    res.json({
      eventId: event._id,
      eventTitle: event.title,
      totalRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      capacity,
      availableCapacity,
      checkedInAttendees,
      attendancePercentage,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to calculate event statistics." });
  }
});

// ----------------------------------------------------
// 5. AUTHORITATIVE QR TICKET VERIFICATION & ATTENDANCE
// POST /api/admin/attendance/verify
// ----------------------------------------------------
router.post("/attendance/verify", async (req, res) => {
  try {
    const { ticketCode, registrationReference, eventId } = req.body;
    const lookup = (ticketCode || registrationReference || "").trim();

    if (!lookup) {
      return res.status(400).json({
        valid: false,
        status: "invalid",
        message: "Ticket code or registration reference is required.",
      });
    }

    // Search by ticketId, ticketCode, or registrationReference
    const query = {
      $or: [
        { ticketId: lookup },
        { ticketCode: lookup },
        { registrationReference: lookup },
      ],
    };

    if (eventId && ID_REGEX.test(eventId)) {
      query.$and = [{ $or: [{ event: eventId }, { eventId: eventId }] }];
    }

    const registration = await Registration.findOne(query)
      .populate("event")
      .populate("user", "name email branch year enrollmentNo");

    if (!registration || !registration.event) {
      return res.status(404).json({
        valid: false,
        status: "invalid",
        message: "Ticket not found or does not belong to this event.",
      });
    }

    const event = registration.event;
    const user = registration.user || {};

    // Check cancellation
    const isCancelled =
      event.cancelled ||
      event.status === "cancelled" ||
      registration.status === "cancelled" ||
      registration.registrationStatus === "cancelled" ||
      registration.ticketStatus === "cancelled";

    if (isCancelled) {
      return res.status(400).json({
        valid: false,
        status: "ineligible",
        message: "Ticket or event is cancelled and ineligible for check-in.",
        participant: {
          name: user.name || "Unknown",
          email: user.email || "",
          enrollmentNo: user.enrollmentNo || "",
        },
      });
    }

    // Check duplicate check-in
    const alreadyCheckedIn =
      registration.checkedIn ||
      registration.attendedAt !== null ||
      registration.ticketStatus === "used";

    if (alreadyCheckedIn) {
      return res.status(409).json({
        valid: false,
        status: "already-used",
        message: "Ticket has already been checked in.",
        checkedInAt: registration.checkedInAt || registration.attendedAt,
        participant: {
          name: user.name || "Unknown",
          email: user.email || "",
          enrollmentNo: user.enrollmentNo || "",
          branch: user.branch || "",
          year: user.year || null,
        },
      });
    }

    // Atomically record attendance
    const now = new Date();
    registration.checkedIn = true;
    registration.attendedAt = now;
    registration.checkedInAt = now;
    registration.ticketStatus = "used";
    registration.checkedInBy = req.user._id;

    await registration.save();

    await logAdminAction({
      actor: req.user,
      action: "TICKET_VERIFIED_CHECKIN",
      targetType: "Attendance",
      targetRecordId: registration._id,
      summary: `Checked in attendee "${user.name}" for "${event.title}"`,
      details: {
        registrationReference: registration.registrationReference,
        ticketId: registration.ticketId,
        participant: user.name,
      },
    });

    res.status(200).json({
      valid: true,
      status: "valid",
      message: "Check-in confirmed.",
      checkedInAt: now,
      registrationReference: registration.registrationReference,
      ticketId: registration.ticketId,
      participant: {
        name: user.name,
        email: user.email,
        enrollmentNo: user.enrollmentNo || "",
        branch: user.branch || "",
        year: user.year || null,
      },
    });
  } catch (err) {
    res.status(500).json({
      valid: false,
      status: "error",
      message: "Server error during ticket verification. Please try again.",
    });
  }
});

// PATCH /api/admin/attendance/:registrationId/correct
// Reverts a mistaken check-in
router.patch("/attendance/:registrationId/correct", async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { reason } = req.body;

    if (!reason || String(reason).trim().length < 3) {
      return res.status(400).json({
        message: "A valid explanation reason is required to correct attendance.",
      });
    }

    let registration;
    if (ID_REGEX.test(registrationId)) {
      registration = await Registration.findById(registrationId)
        .populate("user", "name email enrollmentNo")
        .populate("event", "title");
    } else {
      registration = await Registration.findOne({
        $or: [{ registrationReference: registrationId }, { ticketId: registrationId }],
      })
        .populate("user", "name email enrollmentNo")
        .populate("event", "title");
    }

    if (!registration) {
      return res.status(404).json({ message: "Registration record not found." });
    }

    const previousState = {
      checkedIn: registration.checkedIn,
      attendedAt: registration.attendedAt,
      ticketStatus: registration.ticketStatus,
    };

    registration.checkedIn = false;
    registration.attendedAt = null;
    registration.checkedInAt = null;
    registration.ticketStatus = "active";

    registration.correctionHistory = registration.correctionHistory || [];
    registration.correctionHistory.push({
      correctedBy: req.user._id,
      previousState,
      newState: { checkedIn: false, ticketStatus: "active" },
      reason: String(reason).trim(),
      timestamp: new Date(),
    });

    await registration.save();

    await logAdminAction({
      actor: req.user,
      action: "ATTENDANCE_CORRECTED",
      targetType: "Attendance",
      targetRecordId: registration._id,
      summary: `Corrected attendance for "${registration.user?.name || "Participant"}": ${reason}`,
      details: { reason, previousState },
    });

    res.json({
      message: "Attendance check-in successfully reverted.",
      registration,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to correct attendance record." });
  }
});

// ----------------------------------------------------
// 6. CONTROLLED CSV EXPORT
// GET /api/admin/events/:eventId/export-csv
// ----------------------------------------------------
export function sanitizeCsvField(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();

  // Spreadsheet formula injection mitigation:
  // If value starts with =, +, -, @, \t, or \r, prefix with single quote '
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

router.get("/events/:eventId/export-csv", async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!ID_REGEX.test(eventId)) {
      return res.status(404).json({ message: "Event not found." });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const { registrationStatus, checkedIn, search } = req.query;
    const query = { $or: [{ event: event._id }, { eventId: event._id }] };

    if (registrationStatus) {
      query.$or = [{ status: registrationStatus }, { registrationStatus: registrationStatus }];
    }

    if (checkedIn !== undefined && checkedIn !== "") {
      const isChecked = checkedIn === "true";
      if (isChecked) {
        query.$and = [{ $or: [{ checkedIn: true }, { attendedAt: { $ne: null } }] }];
      } else {
        query.$and = [{ checkedIn: { $ne: true }, attendedAt: null }];
      }
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const s = new RegExp(term, "i");
      const users = await User.find({
        $or: [{ name: s }, { email: s }, { enrollmentNo: s }],
      }).select("_id");
      const userIds = users.map((u) => u._id);

      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { user: { $in: userIds } },
            { userId: { $in: userIds } },
            { registrationReference: s },
            { ticketId: term },
          ],
        },
      ];
    }

    const records = await Registration.find(query)
      .populate("user", "name email enrollmentNo")
      .populate("event", "title")
      .sort({ createdAt: -1 })
      .lean();

    // Headers strictly required:
    // Registration Reference,Participant Name,Email,Roll Number,Event Title,Registration Status,Registered At,Ticket Status,Attendance Status,Checked In At
    const headers = [
      "Registration Reference",
      "Participant Name",
      "Email",
      "Roll Number",
      "Event Title",
      "Registration Status",
      "Registered At",
      "Ticket Status",
      "Attendance Status",
      "Checked In At",
    ];

    const rows = [headers.join(",")];

    for (const r of records) {
      const user = r.user || {};
      const ev = r.event || event;
      const ref = r.registrationReference || r.ticketId || "";
      const name = user.name || "N/A";
      const email = user.email || "N/A";
      const rollNumber = user.enrollmentNo || "N/A";
      const eventTitle = ev.title || event.title;
      const regStatus = r.status || r.registrationStatus || "confirmed";
      const registeredAt = r.createdAt ? new Date(r.createdAt).toISOString() : "";
      const ticketStatus = r.ticketStatus || "active";
      const isAttended = r.checkedIn || r.attendedAt !== null;
      const attendanceStatus = isAttended ? "Checked In" : "Not Checked In";
      const checkedInAt = r.checkedInAt || r.attendedAt ? new Date(r.checkedInAt || r.attendedAt).toISOString() : "";

      const row = [
        sanitizeCsvField(ref),
        sanitizeCsvField(name),
        sanitizeCsvField(email),
        sanitizeCsvField(rollNumber),
        sanitizeCsvField(eventTitle),
        sanitizeCsvField(regStatus),
        sanitizeCsvField(registeredAt),
        sanitizeCsvField(ticketStatus),
        sanitizeCsvField(attendanceStatus),
        sanitizeCsvField(checkedInAt),
      ];

      rows.push(row.join(","));
    }

    const csvContent = rows.join("\r\n");

    await logAdminAction({
      actor: req.user,
      action: "CSV_EXPORTED",
      targetType: "Registration",
      targetRecordId: event._id,
      summary: `Exported ${records.length} registration records for event "${event.title}"`,
    });

    const safeFilename = `registrations-${event.title.replace(/[^a-z0-9_-]/gi, "_")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ message: "Failed to generate CSV export." });
  }
});

// ----------------------------------------------------
// 7. AUDIT LOGS API
// GET /api/admin/audit-logs
// ----------------------------------------------------
router.get("/audit-logs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { action, targetType } = req.query;
    const query = {};

    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve audit logs." });
  }
});

export default router;

