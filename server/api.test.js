import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

const API = process.env.API_URL || "http://localhost:5000/api";
const LOCAL_DATABASE = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/;
const options = {
  skip: LOCAL_DATABASE.test(process.env.MONGO_URI ?? "")
    ? false
    : "API tests create accounts and events. Run the server and tests with a local MONGO_URI.",
};
const email = `t${Date.now()}@test.dev`;

before(async () => {
  if (options.skip) {
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("authfailures").deleteMany({});
  await mongoose.disconnect();
});

after(async () => {
  if (options.skip) {
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("authfailures").deleteMany({});
  await mongoose.disconnect();
});

async function call(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = cookie;
  }

  const res = await fetch(API + path, {
    method,
    headers,
    body: body && JSON.stringify(body),
  });

  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

test("auth and profile", options, async () => {
  let r = await call("/auth/register", {
    method: "POST",
    body: { name: "", email: "bad", password: "weak" },
  });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.errors).sort(), ["email", "name", "password"]);
  r = await call("/auth/register", {
    method: "POST",
    body: { name: "Test User", email: email.toUpperCase(), password: "secret123", role: "admin" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.role, "student");
  assert.equal(r.data.email, email);
  assert.equal(r.data.password, undefined);
  assert.match(r.cookie, /^token=/);
  const session = r.cookie;
  r = await call("/auth/register", {
    method: "POST",
    body: { name: "Test User", email, password: "secret123" },
  });
  assert.equal(r.status, 409);
  r = await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } });
  assert.equal(r.status, 401);
  assert.equal(r.data.message, "Wrong email or password.");
  r = await call("/auth/login", { method: "POST", body: { email, password: "secret123" } });
  assert.equal(r.status, 200);
  assert.equal((await call("/users/me")).status, 401);
  assert.equal((await call("/users/me", { cookie: "token=forged" })).status, 401);
  assert.equal((await call("/users/me", { cookie: session })).data.email, email);
  r = await call("/users/me", {
    method: "PATCH",
    cookie: session,
    body: { name: "Test User", role: "admin" },
  });
  assert.equal(r.data.role, "student");
  await mongoose.connect(process.env.MONGO_URI);
  const user = await mongoose.connection.collection("users").findOne({ email });
  await mongoose.disconnect();
  assert.match(user.password, /^\$2[aby]\$12\$/);
  const expired = jwt.sign({ id: user._id, v: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await call("/users/me", { cookie: `token=${expired}` })).status, 401);
  const wrongKey = jwt.sign({ id: user._id, v: 0 }, "not-the-secret");
  assert.equal((await call("/users/me", { cookie: `token=${wrongKey}` })).status, 401);
  r = await call("/auth/logout", { method: "POST", cookie: session });
  assert.equal(r.status, 200);
  assert.equal(r.cookie, "token=");
});

test("tickets: members only see their own tickets and QR codes for valid ones", options, async () => {
  const ownerEmail = `owner${Date.now()}@test.dev`;
  const otherEmail = `other${Date.now()}@test.dev`;
  const owner = await call("/auth/register", {
    method: "POST",
    body: { name: "Ticket Owner", email: ownerEmail, password: "secret123" },
  });
  const other = await call("/auth/register", {
    method: "POST",
    body: { name: "Someone Else", email: otherEmail, password: "secret123" },
  });

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  const ownerId = (await db.collection("users").findOne({ email: ownerEmail }))._id;
  const day = 24 * 60 * 60 * 1000;
  const soon = new Date(Date.now() + 7 * day);
  const fixtures = [
    { title: "Upcoming", startsAt: soon, cancelled: false, status: "confirmed", attendedAt: null },
    { title: "Past", startsAt: new Date(Date.now() - 7 * day), cancelled: false, status: "confirmed", attendedAt: null },
    { title: "Called off", startsAt: soon, cancelled: true, status: "confirmed", attendedAt: null },
    { title: "Withdrawn", startsAt: soon, cancelled: false, status: "cancelled", attendedAt: null },
    { title: "Waiting", startsAt: soon, cancelled: false, status: "pending", attendedAt: null },
    { title: "Attended", startsAt: soon, cancelled: false, status: "confirmed", attendedAt: new Date() },
  ];
  const events = await db.collection("events").insertMany(
    fixtures.map(({ title, startsAt, cancelled }) => ({ title, startsAt, cancelled })),
  );
  const ids = Object.values(events.insertedIds);
  const ticketIds = ids.map(() => randomBytes(16).toString("base64url"));
  await db.collection("registrations").insertMany(
    ids.map((event, i) => ({
      user: ownerId,
      event,
      ticketId: ticketIds[i],
      status: fixtures[i].status,
      attendedAt: fixtures[i].attendedAt,
      createdAt: new Date(),
    })),
  );
  await mongoose.disconnect();

  assert.equal((await call("/tickets")).status, 401);

  const list = await call("/tickets", { cookie: owner.cookie });
  assert.equal(list.status, 200);
  const states = Object.fromEntries(list.data.tickets.map((t) => [t.event.title, t.state]));
  assert.deepEqual(states, {
    Upcoming: "confirmed",
    Past: "expired",
    "Called off": "event_cancelled",
    Withdrawn: "cancelled",
    Waiting: "pending",
    Attended: "checked_in",
  });
  assert.equal(JSON.stringify(list.data).includes(String(ownerId)), false);

  const upcoming = await call(`/tickets/${ticketIds[0]}`, { cookie: owner.cookie });
  assert.equal(upcoming.status, 200);
  assert.match(upcoming.data.qrSvg, /^<svg/);

  for (const blocked of ticketIds.slice(1)) {
    const res = await call(`/tickets/${blocked}`, { cookie: owner.cookie });
    assert.equal(res.status, 200);
    assert.equal(res.data.qrSvg, null);
  }

  assert.equal((await call(`/tickets/${ticketIds[0]}`, { cookie: other.cookie })).status, 404);
  assert.deepEqual((await call("/tickets", { cookie: other.cookie })).data.tickets, []);
  assert.equal((await call("/tickets/not-a-real-id", { cookie: owner.cookie })).status, 404);
});


test("concurrent duplicate registrations return one 201 and clean 409s", options, async () => {
  const raceEmail = `race${Date.now()}@test.dev`;
  const attempts = await Promise.all(
    Array.from({ length: 4 }, () =>
      call("/auth/register", { method: "POST", body: { name: "Race Tester", email: raceEmail, password: "secret123" } }),
    ),
  );
  const statuses = attempts.map((attempt) => attempt.status).sort();

  assert.deepEqual(statuses, [201, 409, 409, 409]);
  for (const attempt of attempts.filter((a) => a.status === 409)) {
    assert.equal(attempt.data.errors.email, "Already registered. Log in instead.");
  }
});

test("profile updates save allowed fields and reject invalid values", options, async () => {
  const profileEmail = `profile${Date.now()}@test.dev`;
  const created = await call("/auth/register", {
    method: "POST",
    body: { name: "Profile Tester", email: profileEmail, password: "secret123" },
  });

  const saved = await call("/users/me", {
    method: "PATCH",
    cookie: created.cookie,
    body: { name: "  Asha Verma ", branch: "IT", year: "2", bio: "web + cloud", email: "x@y.zz", role: "admin" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.name, "Asha Verma");
  assert.equal(saved.data.branch, "IT");
  assert.equal(saved.data.year, 2);
  assert.equal(saved.data.bio, "web + cloud");
  assert.equal(saved.data.email, profileEmail);
  assert.equal(saved.data.role, "student");

  const invalid = await call("/users/me", {
    method: "PATCH",
    cookie: created.cookie,
    body: { name: "Asha Verma", branch: "Hacking" },
  });
  assert.equal(invalid.status, 400);

  const me = await call("/users/me", { cookie: created.cookie });
  assert.equal(me.data.branch, "IT");
});

test("password change checks the current password and signs out other sessions", options, async () => {
  const passwordEmail = `password${Date.now()}@test.dev`;
  const thisDevice = await call("/auth/register", {
    method: "POST",
    body: { name: "Password Tester", email: passwordEmail, password: "secret123" },
  });
  const otherDevice = await call("/auth/login", {
    method: "POST",
    body: { email: passwordEmail, password: "secret123" },
  });

  const wrongCurrent = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "wrong1234", newPassword: "newpass99" },
  });
  assert.equal(wrongCurrent.status, 400);

  const weak = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "secret123", newPassword: "short" },
  });
  assert.equal(weak.status, 400);

  const changed = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "secret123", newPassword: "newpass99" },
  });
  assert.equal(changed.status, 200);

  assert.equal((await call("/users/me", { cookie: changed.cookie })).status, 200);
  assert.equal((await call("/users/me", { cookie: otherDevice.cookie })).status, 401);

  const oldPassword = await call("/auth/login", { method: "POST", body: { email: passwordEmail, password: "secret123" } });
  assert.equal(oldPassword.status, 401);
  const newPassword = await call("/auth/login", { method: "POST", body: { email: passwordEmail, password: "newpass99" } });
  assert.equal(newPassword.status, 200);
});

test("events: listing, details and registration rules", options, async () => {
  const stamp = Date.now();
  const [alice, bob, cara] = await Promise.all(
    ["alice", "bob", "cara"].map((name) =>
      call("/auth/register", {
        method: "POST",
        body: { name: `Events ${name}`, email: `${name}${stamp}@test.dev`, password: "secret123" },
      }),
    ),
  );

  const day = 24 * 60 * 60 * 1000;
  const soon = new Date(Date.now() + 7 * day);
  const base = {
    summary: "",
    description: "",
    venue: "Block C Lab",
    poster: "",
    cancelled: false,
    published: true,
    category: "Workshop",
    format: "in_person",
    host: "",
    prerequisites: "",
    capacity: null,
    registeredCount: 0,
    registrationDeadline: null,
    startsAt: soon,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await mongoose.connect(process.env.MONGO_URI);
  const inserted = await mongoose.connection.collection("events").insertMany([
    { ...base, title: `Open ${stamp}` },
    { ...base, title: `Two seats ${stamp}`, capacity: 2 },
    { ...base, title: `Deadline passed ${stamp}`, registrationDeadline: new Date(Date.now() - day) },
    { ...base, title: `Cancelled ${stamp}`, cancelled: true },
    { ...base, title: `Draft ${stamp}`, published: false },
  ]);
  await mongoose.disconnect();
  const [open, twoSeats, deadline, cancelled, draft] = Object.values(inserted.insertedIds).map(String);

  const list = await call("/events");
  assert.equal(list.status, 200);
  const listed = Object.fromEntries(list.data.events.map((event) => [event.id, event]));
  assert.equal(listed[open].status, "open");
  assert.equal(listed[twoSeats].seatsLeft, 2);
  assert.equal(listed[deadline].status, "closed");
  assert.equal(listed[cancelled].status, "cancelled");
  assert.equal(listed[draft], undefined);
  assert.equal(listed[open].registeredCount, undefined);

  assert.equal((await call(`/events/${draft}`)).status, 404);
  assert.equal((await call("/events/not-an-id")).status, 404);
  assert.equal((await call("/events/000000000000000000000000")).status, 404);

  const anonymous = await call(`/events/${open}`);
  assert.equal(anonymous.status, 200);
  assert.deepEqual(anonymous.data.viewer, { signedIn: false, registration: null });
  assert.equal((await call(`/events/${open}/register`, { method: "POST" })).status, 401);

  const first = await call(`/events/${open}/register`, { method: "POST", cookie: alice.cookie });
  assert.equal(first.status, 201);
  assert.equal(first.data.ticket.state, "confirmed");
  assert.equal(first.data.ticket.event.title, `Open ${stamp}`);

  const again = await call(`/events/${open}/register`, { method: "POST", cookie: alice.cookie });
  assert.equal(again.status, 409);
  assert.equal(again.data.ticketId, first.data.ticket.ticketId);

  const seen = await call(`/events/${open}`, { cookie: alice.cookie });
  assert.equal(seen.data.viewer.signedIn, true);
  assert.deepEqual(seen.data.viewer.registration, {
    ticketId: first.data.ticket.ticketId,
    state: "confirmed",
    meetingUrl: null,
  });

  const tickets = await call("/tickets", { cookie: alice.cookie });
  assert.ok(tickets.data.tickets.some((ticket) => ticket.ticketId === first.data.ticket.ticketId));

  const doubleClick = await Promise.all(
    [0, 1].map(() => call(`/events/${open}/register`, { method: "POST", cookie: bob.cookie })),
  );
  assert.deepEqual(doubleClick.map((r) => r.status).sort(), [201, 409]);

  const race = await Promise.all(
    [alice, bob, cara].map((user) => call(`/events/${twoSeats}/register`, { method: "POST", cookie: user.cookie })),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 201, 409]);
  assert.equal(race.find((r) => r.status === 409).data.message, "This event is full.");

  const full = await call(`/events/${twoSeats}`);
  assert.equal(full.data.seatsLeft, 0);
  assert.equal(full.data.status, "full");

  const late = await call(`/events/${deadline}/register`, { method: "POST", cookie: cara.cookie });
  assert.equal(late.status, 409);
  assert.equal(late.data.message, "Registration for this event has closed.");

  const called = await call(`/events/${cancelled}/register`, { method: "POST", cookie: cara.cookie });
  assert.equal(called.status, 409);
  assert.equal(called.data.message, "This event was cancelled.");

  assert.equal((await call(`/events/${draft}/register`, { method: "POST", cookie: cara.cookie })).status, 404);
});

test("events: meeting links stay private and members can cancel and register again", options, async () => {
  const stamp = Date.now();
  const [dana, erin, fay] = await Promise.all(
    ["dana", "erin", "fay"].map((name) =>
      call("/auth/register", {
        method: "POST",
        body: { name: `Cancel ${name}`, email: `${name}${stamp}@test.dev`, password: "secret123" },
      }),
    ),
  );

  const day = 24 * 60 * 60 * 1000;
  const meetingUrl = "https://meet.google.com/abc-defg-hij";
  const base = {
    summary: "",
    description: "",
    venue: "Google Meet",
    poster: "",
    cancelled: false,
    published: true,
    category: "Talk",
    format: "online",
    host: "",
    prerequisites: "",
    capacity: 1,
    registeredCount: 0,
    registrationDeadline: null,
    meetingUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await mongoose.connect(process.env.MONGO_URI);
  const inserted = await mongoose.connection.collection("events").insertMany([
    { ...base, title: `One seat ${stamp}`, startsAt: new Date(Date.now() + 3 * day) },
    { ...base, title: `Started ${stamp}`, startsAt: new Date(Date.now() - 1000), capacity: null },
  ]);
  await mongoose.disconnect();
  const [oneSeat, started] = Object.values(inserted.insertedIds).map(String);

  const list = await call("/events");
  const anonymous = await call(`/events/${oneSeat}`);
  assert.ok(!JSON.stringify(list.data).includes(meetingUrl));
  assert.ok(!JSON.stringify(anonymous.data).includes(meetingUrl));

  const first = await call(`/events/${oneSeat}/register`, { method: "POST", cookie: dana.cookie });
  assert.equal(first.status, 201);
  const oldTicketId = first.data.ticket.ticketId;
  assert.equal(first.data.ticket.event.id, oneSeat);

  const seen = await call(`/events/${oneSeat}`, { cookie: dana.cookie });
  assert.equal(seen.data.viewer.registration.meetingUrl, meetingUrl);
  const ticket = await call(`/tickets/${oldTicketId}`, { cookie: dana.cookie });
  assert.equal(ticket.data.meetingUrl, meetingUrl);
  assert.ok(!JSON.stringify((await call(`/events/${oneSeat}`, { cookie: erin.cookie })).data).includes(meetingUrl));

  assert.equal((await call(`/events/${oneSeat}/register`, { method: "POST", cookie: erin.cookie })).status, 409);
  assert.equal((await call(`/events/${oneSeat}/cancel`, { method: "POST" })).status, 401);
  assert.equal((await call(`/events/${oneSeat}/cancel`, { method: "POST", cookie: fay.cookie })).status, 404);

  const cancels = await Promise.all(
    [0, 1].map(() => call(`/events/${oneSeat}/cancel`, { method: "POST", cookie: dana.cookie })),
  );
  assert.deepEqual(cancels.map((r) => r.status), [200, 200]);
  assert.equal(cancels[0].data.state, "cancelled");

  const afterCancel = await call(`/events/${oneSeat}`, { cookie: dana.cookie });
  assert.equal(afterCancel.data.seatsLeft, 1);
  assert.deepEqual(afterCancel.data.viewer.registration, { ticketId: oldTicketId, state: "cancelled", meetingUrl: null });
  assert.equal((await call(`/tickets/${oldTicketId}`, { cookie: dana.cookie })).data.meetingUrl, null);

  assert.equal((await call(`/events/${oneSeat}/register`, { method: "POST", cookie: erin.cookie })).status, 201);
  assert.equal((await call(`/events/${oneSeat}/register`, { method: "POST", cookie: dana.cookie })).status, 409);
  assert.equal((await call(`/events/${oneSeat}/cancel`, { method: "POST", cookie: erin.cookie })).status, 200);

  const again = await call(`/events/${oneSeat}/register`, { method: "POST", cookie: dana.cookie });
  assert.equal(again.status, 201);
  assert.notEqual(again.data.ticket.ticketId, oldTicketId);
  assert.equal((await call(`/tickets/${oldTicketId}`, { cookie: dana.cookie })).status, 404);
  assert.equal((await call(`/events/${oneSeat}`)).data.seatsLeft, 0);

  const late = await call(`/events/${started}/cancel`, { method: "POST", cookie: dana.cookie });
  assert.equal(late.status, 409);
  assert.equal(late.data.message, "This event has already started, so the registration can't be cancelled.");
});

test("dashboard data is only served to the signed-in member", options, async () => {
  const stamp = Date.now();
  const member = await call("/auth/register", {
    method: "POST",
    body: { name: "Dash Member", email: `dash${stamp}@test.dev`, password: "secret123" },
  });

  await mongoose.connect(process.env.MONGO_URI);
  const user = await mongoose.connection.collection("users").findOne({ email: `dash${stamp}@test.dev` });
  await mongoose.disconnect();
  const expired = jwt.sign({ id: user._id, v: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
  const stale = jwt.sign({ id: user._id, v: 5 }, process.env.JWT_SECRET);

  for (const cookie of [undefined, "token=forged", `token=${expired}`, `token=${stale}`]) {
    assert.equal((await call("/users/me", { cookie })).status, 401);
    assert.equal((await call("/tickets", { cookie })).status, 401);
  }

  const me = await call("/users/me", { cookie: member.cookie });
  assert.equal(me.data.email, `dash${stamp}@test.dev`);
  assert.equal(me.data.password, undefined);
  assert.deepEqual((await call("/tickets", { cookie: member.cookie })).data.tickets, []);

  const events = await call("/events");
  assert.equal(events.status, 200);
  assert.ok(!JSON.stringify(events.data).includes(`dash${stamp}@test.dev`));
});

test("state-changing requests from other sites are blocked", options, async () => {
  const res = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(res.status, 403);

  const noOriginCrossSite = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(noOriginCrossSite.status, 403);

  const trusted = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { Origin: process.env.CLIENT_URL },
  });
  assert.equal(trusted.status, 200);
});

test("form validation errors do not count toward the login limit", options, async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await call("/auth/register", { method: "POST", body: { name: "", email: "bad", password: "x" } });
    assert.equal(res.status, 400);
  }

  const login = await call("/auth/login", { method: "POST", body: { email, password: "secret123" } });
  assert.equal(login.status, 200);
});

test("rate limit blocks repeated failed logins", options, async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push(
      (await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } })).status,
    );
  }
  assert.equal(statuses.at(-1), 429);
});
