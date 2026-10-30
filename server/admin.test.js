import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "./models/User.js";
import Event from "./models/Event.js";
import Registration from "./models/Registration.js";

const API = process.env.API_URL || "http://localhost:5000/api";
const LOCAL_DATABASE = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/;
const options = {
  skip: LOCAL_DATABASE.test(process.env.MONGO_URI ?? "")
    ? false
    : "Local MongoDB required for admin tests.",
};

async function call(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const reqHeaders = { "Content-Type": "application/json", ...headers };
  if (cookie) reqHeaders.Cookie = cookie;

  const res = await fetch(API + path, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  return {
    status: res.status,
    data,
    headers: res.headers,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

let studentCookie = "";
let adminCookie = "";
let testAdminEmail = `admin_${Date.now()}@test.dev`;
let testStudentEmail = `student_${Date.now()}@test.dev`;

before(async () => {
  if (options.skip) return;
  await mongoose.connect(process.env.MONGO_URI);
});

after(async () => {
  if (options.skip) return;
  await mongoose.disconnect();
});

test("Admin Suite: Role-based authorization guards", options, async () => {
  // 1. Unauthenticated request to /admin/stats -> 401
  const anon = await call("/admin/stats");
  assert.equal(anon.status, 401);

  // 2. Register student
  const studentReg = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Normal Student",
      email: testStudentEmail,
      password: "Password123!",
      branch: "CSE",
      year: 2,
    },
  });
  assert.equal(studentReg.status, 201);
  studentCookie = studentReg.cookie;

  // 3. Authenticated student request to /admin/stats -> 403 Forbidden
  const studentForbidden = await call("/admin/stats", { cookie: studentCookie });
  assert.equal(studentForbidden.status, 403);
  assert.equal(studentForbidden.data.message, "Admin access required.");

  // 4. Register admin account and update role in DB
  const adminReg = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Admin User",
      email: testAdminEmail,
      password: "AdminPassword123!",
      branch: "CSE",
      year: 4,
    },
  });
  assert.equal(adminReg.status, 201);
  adminCookie = adminReg.cookie;

  await User.updateOne({ email: testAdminEmail }, { role: "admin" });

  // 5. Authenticated admin request to /admin/stats -> 200 OK
  const adminStats = await call("/admin/stats", { cookie: adminCookie });
  assert.equal(adminStats.status, 200);
  assert.ok(typeof adminStats.data.usersCount === "number");
  assert.ok(typeof adminStats.data.eventsCount === "number");
});

test("Admin Suite: Event lifecycle (create, update, get registrations, delete)", options, async () => {
  // 1. Create a draft event
  const created = await call("/admin/events", {
    method: "POST",
    cookie: adminCookie,
    body: {
      title: "Test Admin Workshop",
      summary: "A workshop created via admin API",
      description: "Full description of admin workshop.",
      startsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      venue: "Lab 4",
      capacity: 50,
      format: "in_person",
      published: false,
    },
  });
  assert.equal(created.status, 201);
  const eventId = created.data._id;
  assert.ok(eventId);
  assert.equal(created.data.published, false);

  // 2. Draft event should not appear in public /events listing
  const publicEvents = await call("/events");
  assert.equal(publicEvents.status, 200);
  assert.equal(
    publicEvents.data.events.some((e) => e.id === eventId),
    false
  );

  // 3. Publish event via PUT /admin/events/:id
  const updated = await call(`/admin/events/${eventId}`, {
    method: "PUT",
    cookie: adminCookie,
    body: { published: true, title: "Published Admin Workshop" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.published, true);

  // 4. Student registers for this event
  const regResult = await call(`/events/${eventId}/register`, {
    method: "POST",
    cookie: studentCookie,
  });
  assert.equal(regResult.status, 201);
  const ticketId = regResult.data.ticket.ticketId;
  assert.ok(ticketId);

  // 5. Admin fetches registrations for the event
  const regList = await call(`/admin/events/${eventId}/registrations`, {
    cookie: adminCookie,
  });
  assert.equal(regList.status, 200);
  assert.equal(regList.data.registrations.length >= 1, true);
  assert.equal(regList.data.registrations[0].ticketId, ticketId);

  // 6. Admin exports CSV
  const csvExport = await call(`/admin/events/${eventId}/export`, {
    cookie: adminCookie,
  });
  assert.equal(csvExport.status, 200);
  assert.ok(csvExport.data.includes("Ticket ID"));
  assert.ok(csvExport.data.includes(ticketId));

  // 7. Admin scans and marks attendance
  const scanResult = await call("/admin/attendance/scan", {
    method: "POST",
    cookie: adminCookie,
    body: { ticketId },
  });
  assert.equal(scanResult.status, 200);
  assert.equal(scanResult.data.status, "admitted");

  // 8. Scanning same ticket a second time reports already attended
  const rescan = await call("/admin/attendance/scan", {
    method: "POST",
    cookie: adminCookie,
    body: { ticketId },
  });
  assert.equal(rescan.status, 200);
  assert.equal(rescan.data.status, "already_attended");

  // 9. Delete event cleans up cleanly
  const deleted = await call(`/admin/events/${eventId}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert.equal(deleted.status, 200);
});

test("Admin Suite: User management & role promotion", options, async () => {
  // List users
  const usersRes = await call("/admin/users", { cookie: adminCookie });
  assert.equal(usersRes.status, 200);
  assert.ok(Array.isArray(usersRes.data.users));

  // Promote student to admin
  const promoteRes = await call(`/admin/users/${testStudentEmail}/role`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { role: "admin" },
  });
  assert.equal(promoteRes.status, 200);
  assert.equal(promoteRes.data.user.role, "admin");

  // Revert back to student
  const demoteRes = await call(`/admin/users/${testStudentEmail}/role`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { role: "student" },
  });
  assert.equal(demoteRes.status, 200);
  assert.equal(demoteRes.data.user.role, "student");
});
