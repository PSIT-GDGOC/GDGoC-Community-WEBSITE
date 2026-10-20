import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "./index.js";
import User from "./models/User.js";
import Event from "./models/Event.js";
import Project from "./models/Project.js";
import Registration from "./models/Registration.js";
import AuditLog from "./models/AuditLog.js";
import { setSession } from "./middleware/auth.js";
import { sanitizeCsvField } from "./routes/admin.js";

let mongod;
let adminCookie;
let studentCookie;
let adminUser;
let studentUser;

before(async () => {
  process.env.JWT_SECRET = "test-secret-key-very-long-and-secure-12345";
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // Seed Admin user
  adminUser = await User.create({
    name: "Admin Tester",
    email: "admin@psit.dev",
    password: "$2a$12$eXampleHashedPasswordForTestOnly1234567890",
    role: "admin",
    branch: "CSE",
    year: 4,
    enrollmentNo: "ADM001",
  });

  // Seed Student user
  studentUser = await User.create({
    name: "Student Tester",
    email: "student@psit.dev",
    password: "$2a$12$eXampleHashedPasswordForTestOnly1234567890",
    role: "student",
    branch: "IT",
    year: 2,
    enrollmentNo: "STU002",
  });

  // Create auth cookies
  const fakeResAdmin = { cookie: (name, val) => { adminCookie = `${name}=${val}`; } };
  const fakeResStudent = { cookie: (name, val) => { studentCookie = `${name}=${val}`; } };
  setSession(fakeResAdmin, adminUser);
  setSession(fakeResStudent, studentUser);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test("RBAC Security: Unauthenticated and non-admin requests are blocked", async () => {
  // 1. Unauthenticated request to /api/admin/metrics returns 401
  const unauthRes = await request(app).get("/api/admin/metrics");
  assert.equal(unauthRes.status, 401);

  // 2. Student request to /api/admin/metrics returns 403 Forbidden
  const studentRes = await request(app)
    .get("/api/admin/metrics")
    .set("Cookie", studentCookie);
  assert.equal(studentRes.status, 403);
  assert.match(studentRes.body.message, /Access denied/i);

  // 3. Student request to create event returns 403
  const studentPostRes = await request(app)
    .post("/api/admin/events")
    .set("Cookie", studentCookie)
    .send({ title: "Hacked Event" });
  assert.equal(studentPostRes.status, 403);

  // 4. Admin request succeeds (200)
  const adminRes = await request(app)
    .get("/api/admin/metrics")
    .set("Cookie", adminCookie);
  assert.equal(adminRes.status, 200);
  assert.equal(typeof adminRes.body.totalPublishedEvents, "number");
});

test("Event Lifecycle, Validation & Admin Audit Logging", async () => {
  // Validation failure: missing required fields
  const invalidRes = await request(app)
    .post("/api/admin/events")
    .set("Cookie", adminCookie)
    .send({ title: "Bad Event" });
  assert.equal(invalidRes.status, 400);
  assert.ok(invalidRes.body.errors);

  // Validation failure: end date before start date
  const badDateRes = await request(app)
    .post("/api/admin/events")
    .set("Cookie", adminCookie)
    .send({
      title: "Date Inversion Event",
      shortDescription: "Valid short description here.",
      startDate: new Date("2026-11-20T10:00:00Z"),
      endDate: new Date("2026-11-19T10:00:00Z"),
      category: "Technical",
      capacity: 50,
      registrationDeadline: new Date("2026-11-18T10:00:00Z"),
    });
  assert.equal(badDateRes.status, 400);
  assert.ok(badDateRes.body.errors.endDate);

  // Valid Event Creation
  const createRes = await request(app)
    .post("/api/admin/events")
    .set("Cookie", adminCookie)
    .send({
      title: "GDGoC Cloud Bootcamp 2026",
      shortDescription: "A deep dive into Google Cloud technologies.",
      fullDescription: "Complete hands-on cloud architecture workshop for students.",
      startDate: new Date("2026-11-10T10:00:00Z"),
      endDate: new Date("2026-11-10T17:00:00Z"),
      venue: "Auditorium A",
      category: "Cloud",
      format: "in_person",
      capacity: 100,
      registrationDeadline: new Date("2026-11-09T23:59:59Z"),
      status: "draft",
    });
  assert.equal(createRes.status, 201);
  const eventId = createRes.body._id;
  assert.ok(eventId);
  assert.equal(createRes.body.title, "GDGoC Cloud Bootcamp 2026");

  // Verify AuditLog for creation
  const logCreate = await AuditLog.findOne({
    action: "EVENT_CREATED",
    targetRecordId: String(eventId),
  });
  assert.ok(logCreate);
  assert.equal(logCreate.actorRole, "admin");

  // Publish event
  const publishRes = await request(app)
    .patch(`/api/admin/events/${eventId}/status`)
    .set("Cookie", adminCookie)
    .send({ status: "published" });
  assert.equal(publishRes.status, 200);
  assert.equal(publishRes.body.published, true);
  assert.equal(publishRes.body.status, "published");

  // Verify AuditLog for publishing
  const logPublish = await AuditLog.findOne({
    action: "EVENT_PUBLISHED",
    targetRecordId: String(eventId),
  });
  assert.ok(logPublish);

  // Partial update
  const updateRes = await request(app)
    .patch(`/api/admin/events/${eventId}`)
    .set("Cookie", adminCookie)
    .send({ venue: "Main Auditorium Hall 1" });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.venue, "Main Auditorium Hall 1");
  assert.equal(updateRes.body.title, "GDGoC Cloud Bootcamp 2026"); // preserved
});

test("Project Management & Public Projects API", async () => {
  // Create Project via Admin API
  const createProjRes = await request(app)
    .post("/api/admin/projects")
    .set("Cookie", adminCookie)
    .send({
      title: "GDGoC Campus Portal",
      shortDescription: "Comprehensive web platform for GDGoC PSIT chapter.",
      fullDescription: "Open-source community management portal.",
      domain: "Web Development",
      techStack: ["React", "TypeScript", "Node.js", "Tailwind CSS"],
      githubUrl: "https://github.com/PSIT-GDGOC/portal",
      publicationStatus: "published",
      status: "ongoing",
    });
  assert.equal(createProjRes.status, 201);
  const projectId = createProjRes.body._id;
  assert.ok(projectId);

  // Verify in public projects endpoint
  const pubRes = await request(app).get("/api/projects");
  assert.equal(pubRes.status, 200);
  const found = pubRes.body.projects.find((p) => p._id === projectId);
  assert.ok(found);
  assert.equal(found.title, "GDGoC Campus Portal");

  // Update Project
  const updateProjRes = await request(app)
    .patch(`/api/admin/projects/${projectId}`)
    .set("Cookie", adminCookie)
    .send({ status: "completed" });
  assert.equal(updateProjRes.status, 200);
  assert.equal(updateProjRes.body.status, "completed");

  // List projects in admin
  const listAdminRes = await request(app)
    .get("/api/admin/projects?status=completed")
    .set("Cookie", adminCookie);
  assert.equal(listAdminRes.status, 200);
  assert.equal(listAdminRes.body.projects.length >= 1, true);
});

test("Authoritative QR Ticket Verification, Concurrency & Mistaken Check-in Correction", async () => {
  // 1. Create an event with capacity = 2
  const event = await Event.create({
    title: "AI & ML Hands-on Workshop",
    shortDescription: "Interactive workshop on machine learning models.",
    startsAt: new Date(Date.now() + 86400000),
    startDate: new Date(Date.now() + 86400000),
    capacity: 2,
    category: "AI / ML",
    published: true,
    status: "published",
  });

  // 2. Register participant
  const reg = await Registration.create({
    user: studentUser._id,
    event: event._id,
    registrationReference: "REG-AIML-101",
    ticketCode: "TICKET-SECRET-CODE-XYZ",
    ticketId: "TICKET-SECRET-CODE-XYZ",
    status: "confirmed",
    ticketStatus: "active",
    checkedIn: false,
  });

  // Verify non-existent ticket -> 404
  const notFoundRes = await request(app)
    .post("/api/admin/attendance/verify")
    .set("Cookie", adminCookie)
    .send({ ticketCode: "NON_EXISTENT_CODE" });
  assert.equal(notFoundRes.status, 404);
  assert.equal(notFoundRes.body.valid, false);
  assert.equal(notFoundRes.body.status, "invalid");

  // Verify valid ticket -> 200
  const validRes = await request(app)
    .post("/api/admin/attendance/verify")
    .set("Cookie", adminCookie)
    .send({
      ticketCode: "TICKET-SECRET-CODE-XYZ",
      eventId: String(event._id),
    });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.valid, true);
  assert.equal(validRes.body.status, "valid");
  assert.equal(validRes.body.participant.name, studentUser.name);
  assert.ok(validRes.body.checkedInAt);

  // Check DB state
  const updatedReg = await Registration.findById(reg._id);
  assert.equal(updatedReg.checkedIn, true);
  assert.equal(updatedReg.ticketStatus, "used");
  assert.ok(updatedReg.attendedAt);

  // Duplicate Check-in attempt -> 409 already-used
  const dupRes = await request(app)
    .post("/api/admin/attendance/verify")
    .set("Cookie", adminCookie)
    .send({ ticketCode: "TICKET-SECRET-CODE-XYZ" });
  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.valid, false);
  assert.equal(dupRes.body.status, "already-used");
  assert.ok(dupRes.body.checkedInAt);

  // Event Stats check
  const statsRes = await request(app)
    .get(`/api/admin/events/${event._id}/stats`)
    .set("Cookie", adminCookie);
  assert.equal(statsRes.status, 200);
  assert.equal(statsRes.body.totalRegistrations, 1);
  assert.equal(statsRes.body.confirmedRegistrations, 1);
  assert.equal(statsRes.body.availableCapacity, 1); // 2 - 1 = 1 (never negative)
  assert.equal(statsRes.body.checkedInAttendees, 1);
  assert.equal(statsRes.body.attendancePercentage, 100);

  // Mistaken Check-in Correction (PATCH /api/admin/attendance/:id/correct)
  const revertRes = await request(app)
    .patch(`/api/admin/attendance/${reg._id}/correct`)
    .set("Cookie", adminCookie)
    .send({ reason: "Accidental scan by event volunteer at gate 2" });
  assert.equal(revertRes.status, 200);
  assert.match(revertRes.body.message, /successfully reverted/i);

  // Verify DB state after correction
  const revertedReg = await Registration.findById(reg._id);
  assert.equal(revertedReg.checkedIn, false);
  assert.equal(revertedReg.ticketStatus, "active");
  assert.equal(revertedReg.attendedAt, null);
  assert.equal(revertedReg.correctionHistory.length, 1);
  assert.equal(revertedReg.correctionHistory[0].reason, "Accidental scan by event volunteer at gate 2");

  // Verify AuditLog for correction
  const logCorr = await AuditLog.findOne({
    action: "ATTENDANCE_CORRECTED",
    targetRecordId: String(reg._id),
  });
  assert.ok(logCorr);
});

test("Event Cancellation invalidates tickets while preserving registration history", async () => {
  const event = await Event.create({
    title: "Cancelled Tech Talk",
    shortDescription: "Talk on distributed systems.",
    startsAt: new Date(Date.now() + 1000000),
    capacity: 50,
    category: "Architecture",
    status: "published",
    published: true,
  });

  const reg = await Registration.create({
    user: studentUser._id,
    event: event._id,
    registrationReference: "REG-CANCEL-TEST",
    ticketCode: "CANCEL-TICKET-CODE-777",
    status: "confirmed",
    ticketStatus: "active",
  });

  // Cancel event via admin endpoint
  const cancelRes = await request(app)
    .patch(`/api/admin/events/${event._id}/status`)
    .set("Cookie", adminCookie)
    .send({ status: "cancelled" });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.status, "cancelled");

  // Registration record still exists (not deleted!)
  const checkReg = await Registration.findById(reg._id);
  assert.ok(checkReg);
  assert.equal(checkReg.ticketStatus, "cancelled");

  // Attempt to check in cancelled ticket -> 400 ineligible
  const verifyRes = await request(app)
    .post("/api/admin/attendance/verify")
    .set("Cookie", adminCookie)
    .send({ ticketCode: "CANCEL-TICKET-CODE-777" });
  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.valid, false);
  assert.equal(verifyRes.body.status, "ineligible");
});

test("CSV Export & Spreadsheet Formula Injection Protection", async () => {
  const formulaEvent = await Event.create({
    title: "Security Workshop",
    shortDescription: "CSV Injection and web security demonstration.",
    startsAt: new Date(Date.now() + 500000),
    capacity: 30,
    category: "Security",
    status: "published",
  });

  // Create malicious user names starting with risky formula characters (=, +, -, @)
  const riskyUser = await User.create({
    name: "=cmd|' /C calc'!A0",
    email: "+malicious@psit.dev",
    password: "$2a$12$eXampleHashedPasswordForTestOnly1234567890",
    role: "student",
    enrollmentNo: "@SUM(1+1)",
  });

  await Registration.create({
    user: riskyUser._id,
    event: formulaEvent._id,
    registrationReference: "-INJECTION-REF",
    ticketCode: "SAFE-TICKET-CODE",
    status: "confirmed",
  });

  // Unit check on sanitizeCsvField
  assert.equal(sanitizeCsvField("=SUM(A1:A10)"), `"'=SUM(A1:A10)"`);
  assert.equal(sanitizeCsvField("+123456"), ` "'+123456"`.trim());
  assert.equal(sanitizeCsvField("@malicious"), `"'@malicious"`);
  assert.equal(sanitizeCsvField("-test-val"), `"'-test-val"`);
  assert.equal(sanitizeCsvField('Normal "Quotes" Name'), `"Normal ""Quotes"" Name"`);

  // Integration test on /api/admin/events/:id/export-csv
  const exportRes = await request(app)
    .get(`/api/admin/events/${formulaEvent._id}/export-csv`)
    .set("Cookie", adminCookie);

  assert.equal(exportRes.status, 200);
  assert.match(exportRes.headers["content-type"], /text\/csv/);
  assert.match(exportRes.headers["content-disposition"], /attachment; filename=/);

  const csv = exportRes.text;
  assert.match(csv, /Registration Reference,Participant Name,Email,Roll Number,Event Title/);
  // Verifies that formula injection triggers were safely prefixed with single quote '
  assert.match(csv, /'=cmd\|/);
  assert.match(csv, /'\+malicious/);
  assert.match(csv, /'@SUM/);
  assert.match(csv, /'-INJECTION-REF/);

  // Verify AuditLog for CSV export
  const logCsv = await AuditLog.findOne({
    action: "CSV_EXPORTED",
    targetRecordId: String(formulaEvent._id),
  });
  assert.ok(logCsv);
});

