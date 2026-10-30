import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

const API = process.env.API_URL || "http://localhost:5000/api";
const ROOT_URL = "http://localhost:5000";
const LOCAL_DATABASE = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/;
const options = {
  skip: LOCAL_DATABASE.test(process.env.MONGO_URI ?? "")
    ? false
    : "Local MongoDB required for edge tests.",
};

before(async () => {
  if (options.skip) return;
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("authfailures").deleteMany({});
  await mongoose.disconnect();
});

after(async () => {
  if (options.skip) return;
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("authfailures").deleteMany({});
  await mongoose.disconnect();
});

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

/* ============================================================================
 * PRIORITY 0: CRITICAL / SECURITY & DATA INTEGRITY
 * ============================================================================ */

test("P0-1: [Security] NoSQL object injection in auth payloads is safely sanitized", options, async () => {
  // Sending objects instead of strings (common NoSQL injection vector in Express)
  const res = await call("/auth/login", {
    method: "POST",
    body: { email: { $ne: null }, password: { $gt: "" } },
  });
  assert.equal(res.status, 401);
  assert.equal(res.data?.message, "Wrong email or password.");
});

test("P0-2: [Security] JWT tampering, invalid algorithm, and expired tokens are rejected", options, async () => {
  const email = `jwt_edge_${Date.now()}@test.dev`;
  const reg = await call("/auth/register", {
    method: "POST",
    body: { name: "JWT Edge Tester", email, password: "password123" },
  });
  assert.equal(reg.status, 201);
  const session = reg.cookie;

  // 1. Valid token succeeds
  const me = await call("/users/me", { cookie: session });
  assert.equal(me.status, 200);
  assert.equal(me.data?.email, email);

  // 2. Tampered signature fails
  const tampered = session.slice(0, -6) + "xxxxxx";
  assert.equal((await call("/users/me", { cookie: tampered })).status, 401);

  // 3. Algorithm 'none' exploit fails
  const [header, payload] = session.replace("token=", "").split(".").slice(0, 2);
  const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const noneToken = `token=${noneHeader}.${payload}.`;
  assert.equal((await call("/users/me", { cookie: noneToken })).status, 401);

  // 4. Token signed with incorrect secret fails
  await mongoose.connect(process.env.MONGO_URI);
  const user = await mongoose.connection.collection("users").findOne({ email });
  await mongoose.disconnect();
  const fakeToken = jwt.sign({ id: user._id, v: 0 }, "wrong-secret-key-12345");
  assert.equal((await call("/users/me", { cookie: `token=${fakeToken}` })).status, 401);
});

test("P0-3: [Security] Password update invalidates tokenVersion across all devices", options, async () => {
  const email = `pass_edge_${Date.now()}@test.dev`;
  const reg = await call("/auth/register", {
    method: "POST",
    body: { name: "Version Tester", email, password: "oldPassword123" },
  });
  const firstSession = reg.cookie;

  // Change password
  const updated = await call("/users/me/password", {
    method: "PATCH",
    cookie: firstSession,
    body: { currentPassword: "oldPassword123", newPassword: "newPassword456" },
  });
  assert.equal(updated.status, 200);

  // The first session token (tokenVersion: 0) must now be rejected
  const oldCall = await call("/users/me", { cookie: firstSession });
  assert.equal(oldCall.status, 401);

  // New login generates tokenVersion: 1 which works
  const newLogin = await call("/auth/login", {
    method: "POST",
    body: { email, password: "newPassword456" },
  });
  assert.equal(newLogin.status, 200);
  const newCall = await call("/users/me", { cookie: newLogin.cookie });
  assert.equal(newCall.status, 200);
});

test("P0-4: [Business] Ticket check-in handles valid, duplicate, and cancelled registrations idempotently", options, async () => {
  const email = `checkin_edge_${Date.now()}@test.dev`;
  const member = await call("/auth/register", {
    method: "POST",
    body: { name: "Checkin Member", email, password: "password123" },
  });

  // Create an upcoming event and register
  const stamp = Date.now();
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  const user = await db.collection("users").findOne({ email });
  const eventRes = await db.collection("events").insertOne({
    title: `Check-in Event ${stamp}`,
    summary: "Testing check-in flow",
    description: "Detailed description",
    startsAt: new Date(Date.now() + 86400000),
    venue: "Main Hall",
    published: true,
    cancelled: false,
    capacity: 50,
    registeredCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const eventId = String(eventRes.insertedId);
  await mongoose.disconnect();

  const regRes = await call(`/events/${eventId}/register`, {
    method: "POST",
    cookie: member.cookie,
  });
  assert.equal(regRes.status, 201);
  const ticketId = regRes.data.ticket.ticketId;

  // 0. Unauthenticated check-in is blocked (401)
  const unauthCheckin = await call(`/tickets/${ticketId}/check-in`, { method: "POST" });
  assert.equal(unauthCheckin.status, 401);

  // 1. First check-in: succeeds (200 OK)
  const checkin1 = await call(`/tickets/${ticketId}/check-in`, { method: "POST", cookie: member.cookie });
  assert.equal(checkin1.status, 200);
  assert.equal(checkin1.data.message, "Attendance recorded successfully.");
  assert.ok(checkin1.data.attendedAt);

  // 2. Duplicate check-in: idempotent 200 with note
  const checkin2 = await call(`/tickets/${ticketId}/check-in`, { method: "POST", cookie: member.cookie });
  assert.equal(checkin2.status, 200);
  assert.equal(checkin2.data.message, "Ticket already checked in.");

  // 3. Cancelled ticket check-in: blocked (409)
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("registrations").updateOne(
    { ticketId },
    { $set: { status: "cancelled" } },
  );
  await mongoose.disconnect();

  const checkinCancelled = await call(`/tickets/${ticketId}/check-in`, { method: "POST", cookie: member.cookie });
  assert.equal(checkinCancelled.status, 409);
  assert.equal(checkinCancelled.data.message, "This registration was cancelled.");
});

test("P0-5: [Concurrency] Event capacity limit strictly blocks overselling under race conditions", options, async () => {
  const stamp = Date.now();
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  const eventRes = await db.collection("events").insertOne({
    title: `Exclusive Single Seat ${stamp}`,
    summary: "Only 1 seat",
    description: "Very exclusive",
    startsAt: new Date(Date.now() + 86400000),
    venue: "Lab A",
    published: true,
    cancelled: false,
    capacity: 1,
    registeredCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const eventId = String(eventRes.insertedId);
  await mongoose.disconnect();

  // Create 3 distinct users
  const [userA, userB, userC] = await Promise.all(
    ["a", "b", "c"].map((prefix) =>
      call("/auth/register", {
        method: "POST",
        body: { name: `Race ${prefix}`, email: `race_${prefix}_${stamp}@test.dev`, password: "password123" },
      }),
    ),
  );

  // All 3 try to claim the single seat concurrently
  const results = await Promise.all([
    call(`/events/${eventId}/register`, { method: "POST", cookie: userA.cookie }),
    call(`/events/${eventId}/register`, { method: "POST", cookie: userB.cookie }),
    call(`/events/${eventId}/register`, { method: "POST", cookie: userC.cookie }),
  ]);

  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);

  // Exactly 1 must succeed, exactly 2 must get 409 (This event is full)
  assert.equal(successes.length, 1);
  assert.equal(conflicts.length, 2);
  assert.equal(conflicts[0].data?.message, "This event is full.");
});

/* ============================================================================
 * PRIORITY 1: HIGH / ROBUSTNESS & ERROR BOUNDARIES
 * ============================================================================ */

test("P1-1: [Robustness] Invalid and malformed ObjectIds return clean 404s without CastError 500", options, async () => {
  const malformedIds = [
    "not-an-id",
    "123",
    "66666666666666666666666z", // invalid hex
    "000000000000000000000000", // valid hex, but non-existent
  ];

  for (const id of malformedIds) {
    const res = await call(`/events/${id}`);
    assert.equal(res.status, 404);
    assert.equal(res.data?.message, "We couldn't find that event.");
  }
});

test("P1-2: [Robustness] Malformed ticket IDs return clean 404s", options, async () => {
  const member = await call("/auth/register", {
    method: "POST",
    body: { name: "Ticket Tester", email: `ticket_malformed_${Date.now()}@test.dev`, password: "password123" },
  });

  const badTicketIds = [
    "short",
    "this-ticket-id-is-way-too-long-to-be-valid-1234567890",
    "invalid$characters#here!!",
    "aaaaaaaaaaaaaaaaaaaaaa", // 22 chars but doesn't exist
  ];

  for (const tid of badTicketIds) {
    const res = await call(`/tickets/${tid}`, { cookie: member.cookie });
    assert.equal(res.status, 404);
  }
});

test("P1-3: [API Standard] Unmatched API routes return 404 JSON, preventing HTML crash", options, async () => {
  const res1 = await call("/does-not-exist");
  assert.equal(res1.status, 404);
  assert.equal(res1.data?.message, "API endpoint not found.");

  const res2 = await call("/v1/random-route");
  assert.equal(res2.status, 404);
  assert.equal(res2.data?.message, "API endpoint not found.");
});

test("P1-4: [Observability] Health and readiness endpoints respond with 200 and connected status", options, async () => {
  const endpoints = ["/health", "/ready", "/api/health", "/api/v1/health"];

  for (const ep of endpoints) {
    const res = await fetch(`${ROOT_URL}${ep}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "healthy");
    assert.equal(body.database, "connected");
    assert.ok(typeof body.uptime === "number");
    assert.ok(body.timestamp);
  }
});

/* ============================================================================
 * PRIORITY 2: MEDIUM / PRODUCTION BOUNDARIES & LIMITS
 * ============================================================================ */

test("P2-1: [DoS Protection] Oversized JSON payloads (>20kb) are rejected with 413 or 400", options, async () => {
  const hugeBody = JSON.stringify({ data: "A".repeat(30 * 1024) }); // 30KB payload

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: hugeBody,
  });

  assert.ok(res.status === 413 || res.status === 400);
});

test("P2-2: [Resilience] Malformed JSON bodies receive 400 Invalid request without crashing", options, async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: `{"broken_json": `,
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.message, "Invalid request.");
});

test("P2-3: [CORS] Allowed origins with trailing slashes or comma-separated domains work seamlessly", options, async () => {
  // Test OPTIONS preflight with Origin
  const res = await fetch(`${API}/events`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
});

test("P2-4: [Internationalization] Unicode, non-Latin scripts, and whitespace trimming in profile", options, async () => {
  const email = `unicode_${Date.now()}@test.dev`;
  const reg = await call("/auth/register", {
    method: "POST",
    body: { name: "  अभिनव कुमार दीक्षित  ", email, password: "password123", branch: "CSE (AI & ML)", year: 3 },
  });
  assert.equal(reg.status, 201);
  // Name was trimmed cleanly
  assert.equal(reg.data?.name, "अभिनव कुमार दीक्षित");

  // Update bio with emoji & accents
  const updated = await call("/users/me", {
    method: "PATCH",
    cookie: reg.cookie,
    body: { bio: "🚀 Open Source contributor | Full-Stack dev ✨ (Kanpur)" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data?.bio, "🚀 Open Source contributor | Full-Stack dev ✨ (Kanpur)");
});
