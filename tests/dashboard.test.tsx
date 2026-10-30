import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Dashboard from "../src/components/Dashboard";
import MemberNav from "../src/components/MemberNav";
import NotFound from "../src/components/NotFound";
import ProjectsPage from "../src/components/ProjectsPage";
import { firstName, listText, missingDetails, ticketSummary } from "../src/lib/dashboard";
import type { EventSummary } from "../src/lib/events";
import type { Ticket, TicketState } from "../src/lib/tickets";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const MEMBER = { name: "Asha Verma", email: "asha@psit.ac.in", createdAt: "2026-08-01T00:00:00Z" };
const COMPLETE = { ...MEMBER, branch: "IT", year: 2, bio: "Web and cloud" };

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

type Handler = () => Promise<Response>;

function server(routes: Record<string, Handler | Handler[]>) {
  return vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(url).replace(/^.*\/api/, "")}`;
    const route = routes[key];
    if (Array.isArray(route)) {
      const next = route.length > 1 ? route.shift() : route[0];
      return next ? next() : respond(500, {});
    }
    return route ? route() : respond(500, { message: `Not mocked: ${key}` });
  });
}

function event(id: string, title: string, overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: id.padEnd(24, "0"),
    title,
    summary: "",
    poster: "",
    startsAt: new Date(NOW + 5 * DAY).toISOString(),
    endsAt: null,
    category: "Workshop",
    format: "in_person",
    venue: "Block C Lab",
    capacity: null,
    seatsLeft: null,
    registrationDeadline: new Date(NOW + 5 * DAY).toISOString(),
    status: "open",
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function ticket(id: string, title: string, state: TicketState, days: number): Ticket {
  return {
    ticketId: id.padEnd(22, "x"),
    state,
    registeredAt: new Date(NOW).toISOString(),
    attendedAt: state === "checked_in" ? new Date(NOW).toISOString() : null,
    event: {
      title,
      summary: "",
      startsAt: new Date(NOW + days * DAY).toISOString(),
      endsAt: null,
      venue: "Block C Lab",
      poster: "",
    },
  };
}

const EVENTS = [
  event("a1", "Cloud Study Jam", { startsAt: new Date(NOW + 2 * DAY).toISOString() }),
  event("b2", "Flutter Basics", { status: "full" }),
  event("c3", "Git Night", { status: "completed", startsAt: new Date(NOW - 10 * DAY).toISOString() }),
];

const TICKETS = [
  ticket("up", "Cloud Study Jam", "confirmed", 2),
  ticket("went", "Android Office Hours", "checked_in", -3),
  ticket("old", "Old Session", "expired", -20),
];

function signedIn(user: object = MEMBER, extra: Record<string, Handler | Handler[]> = {}) {
  const fetchMock = server({
    "GET /users/me": () => respond(200, user),
    "GET /events": () => respond(200, { events: EVENTS }),
    "GET /tickets": () => respond(200, { tickets: TICKETS }),
    ...extra,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  location.hash = "#/dashboard";
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
});

afterEach(cleanup);

test("helpers use only real profile and ticket data", () => {
  expect(firstName("  Asha   Verma ")).toBe("Asha");
  expect(missingDetails({ name: "A", email: "a@b.cd" })).toEqual(["branch", "year", "short bio"]);
  expect(missingDetails(COMPLETE)).toEqual([]);
  expect(listText(["year"])).toBe("year");
  expect(listText(["branch", "year"])).toBe("branch and year");
  expect(listText(["branch", "year", "short bio"])).toBe("branch, year and short bio");

  const summary = ticketSummary(TICKETS);
  expect(summary.upcoming.map((t) => t.event.title)).toEqual(["Cloud Study Jam"]);
  expect(summary.attended).toBe(1);
});

test("signed-out visitors go to login and nothing private is requested", async () => {
  const fetchMock = server({ "GET /users/me": () => respond(401, { message: "Please log in." }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<Dashboard />);

  await waitFor(() => expect(location.hash).toBe("#/login?next=/dashboard"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("heading", { name: /hi,/i })).toBeNull();
});

test("private details stay hidden until the session is verified", async () => {
  let finish: (value: Response) => void = () => {};
  const fetchMock = signedIn(MEMBER, {
    "GET /users/me": () => new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  });
  render(<Dashboard />);

  expect(screen.getByRole("status", { name: /checking your session/i })).toBeTruthy();
  expect(screen.queryByText(/asha/i)).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  finish(new Response(JSON.stringify(MEMBER), { status: 200 }));
  expect(await screen.findByRole("heading", { name: "Hi, Asha" })).toBeTruthy();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
});

test("a server outage offers a retry instead of a login redirect", async () => {
  signedIn(MEMBER, {
    "GET /users/me": [() => respond(500, { message: "Server error. Try again." }), () => respond(200, MEMBER)],
  });
  render(<Dashboard />);

  expect(await screen.findByText(/couldn't reach the server/i)).toBeTruthy();
  expect(location.hash).toBe("#/dashboard");

  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  expect(await screen.findByRole("heading", { name: "Hi, Asha" })).toBeTruthy();
});

test("welcome and account summary use the member's own details", async () => {
  signedIn();
  render(<Dashboard />);

  expect(await screen.findByRole("heading", { name: "Hi, Asha" })).toBeTruthy();
  expect(screen.getByRole("figure", { name: /member card for asha verma/i })).toBeTruthy();
  expect(screen.getByText("asha@psit.ac.in")).toBeTruthy();
  expect(screen.getByText(/add your branch, year and short bio/i)).toBeTruthy();
  expect(screen.getByRole("link", { name: /complete your profile/i }).getAttribute("href")).toBe("#/profile");
});

test("a complete profile is not nagged", async () => {
  signedIn(COMPLETE);
  render(<Dashboard />);

  expect(await screen.findByText(/your profile is complete/i)).toBeTruthy();
  expect(screen.queryByRole("link", { name: /complete your profile/i })).toBeNull();
});

test("events card lists only upcoming events and links to the events page", async () => {
  signedIn();
  render(<Dashboard />);

  const card = await screen.findByRole("region", { name: "Events" });
  expect(await within(card).findByText("2 upcoming events")).toBeTruthy();
  expect(within(card).getByRole("link", { name: /cloud study jam/i }).getAttribute("href")).toBe(`#/events/${EVENTS[0].id}`);
  expect(within(card).queryByText("Git Night")).toBeNull();
  expect(within(card).getByRole("link", { name: /browse events/i }).getAttribute("href")).toBe("#/events");
});

test("no upcoming events is an empty state, not an error", async () => {
  signedIn(MEMBER, { "GET /events": () => respond(200, { events: [] }) });
  render(<Dashboard />);

  const card = await screen.findByRole("region", { name: "Events" });
  expect(await within(card).findByText(/no upcoming events right now/i)).toBeTruthy();
  expect(within(card).queryByRole("alert")).toBeNull();
});

test("a failed events request keeps the card usable and can retry", async () => {
  signedIn(MEMBER, {
    "GET /events": [() => respond(500, { message: "Server error. Try again." }), () => respond(200, { events: EVENTS })],
  });
  render(<Dashboard />);

  const card = await screen.findByRole("region", { name: "Events" });
  expect(await within(card).findByText(/couldn't load upcoming events/i)).toBeTruthy();
  expect(within(card).getByRole("link", { name: /browse events/i })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hi, Asha" })).toBeTruthy();

  fireEvent.click(within(card).getByRole("button", { name: /try again/i }));
  expect(await within(card).findByText("2 upcoming events")).toBeTruthy();
});

test("registrations show upcoming tickets and the member card shows real counts", async () => {
  signedIn();
  render(<Dashboard />);

  const card = await screen.findByRole("region", { name: "Your registrations" });
  const link = await within(card).findByRole("link", { name: /cloud study jam/i });
  expect(link.getAttribute("href")).toBe(`#/tickets/${TICKETS[0].ticketId}`);
  expect(within(card).queryByText("Old Session")).toBeNull();
  expect(screen.getByRole("link", { name: /1\s*upcoming/i })).toBeTruthy();
  expect(screen.getByRole("link", { name: /1\s*attended/i })).toBeTruthy();
});

test("no registrations points to events, and counts never show made-up numbers while loading", async () => {
  let finish: (value: Response) => void = () => {};
  signedIn(MEMBER, {
    "GET /tickets": () => new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  });
  render(<Dashboard />);

  await screen.findByRole("heading", { name: "Hi, Asha" });
  expect(screen.getByRole("link", { name: /–\s*upcoming/i })).toBeTruthy();

  finish(new Response(JSON.stringify({ tickets: [] }), { status: 200 }));
  const card = screen.getByRole("region", { name: "Your registrations" });
  expect(await within(card).findByText(/haven't registered for an upcoming event/i)).toBeTruthy();
  expect(within(card).getByRole("link", { name: /find an event/i }).getAttribute("href")).toBe("#/events");
});

test("a session that expires while loading tickets goes back to login", async () => {
  signedIn(MEMBER, { "GET /tickets": () => respond(401, { message: "Please log in." }) });
  render(<Dashboard />);

  await waitFor(() => expect(location.hash).toBe("#/login?next=/dashboard"));
});

test("projects card and page link to real destinations without made-up projects", async () => {
  signedIn();
  render(<Dashboard />);

  const card = await screen.findByRole("region", { name: "Projects" });
  expect(within(card).getByRole("link", { name: /open projects/i }).getAttribute("href")).toBe("#/projects");
  cleanup();

  render(<ProjectsPage />);
  expect(screen.getByRole("heading", { name: /showcase is coming soon/i })).toBeTruthy();
  expect(screen.getByRole("link", { name: /browse our github/i }).getAttribute("href")).toBe("https://github.com/PSIT-GDGOC");
});

test("member navigation marks the current page and every tab is a real link", () => {
  render(<MemberNav active="dashboard" />);

  const nav = screen.getByRole("navigation", { name: "Member area" });
  const links = within(nav).getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "#/dashboard",
    "#/events",
    "#/projects",
    "#/tickets",
    "#/profile",
  ]);
  expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Events" }).getAttribute("aria-current")).toBeNull();
});

test("log out ends the session on the server before leaving", async () => {
  const fetchMock = server({ "POST /auth/logout": () => respond(200, { message: "Logged out." }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemberNav active="dashboard" />);

  const button = screen.getByRole("button", { name: "Log out" });
  button.focus();
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);

  await waitFor(() => expect(location.hash).toBe("#/login"));
  expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
});

test("a failed log out says so and stays signed in", async () => {
  vi.stubGlobal("fetch", server({ "POST /auth/logout": () => respond(500, {}) }));
  render(<MemberNav active="dashboard" />);

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(location.hash).toBe("#/dashboard");
  expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
});

test("unknown links show a not found page with a way out", () => {
  render(<NotFound />);

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /go to the homepage/i }).getAttribute("href")).toBe("#");
});
