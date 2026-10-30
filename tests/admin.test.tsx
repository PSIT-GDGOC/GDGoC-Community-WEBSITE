import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Admin from "../src/components/Admin";

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const mockAdminUser = {
  name: "Lead Admin",
  email: "admin@gdgoc.dev",
  role: "admin",
  branch: "CSE",
  year: 4,
};

const mockStats = {
  usersCount: 50,
  eventsCount: 5,
  publishedEventsCount: 4,
  registrationsCount: 80,
  attendedCount: 45,
  attendanceRate: 56.3,
};

const mockEvents = [
  {
    _id: "60d5ec49f1b2c8b1f8e4e1a1",
    title: "Cloud Study Jam #3",
    summary: "Hands-on labs",
    description: "Full description",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: null,
    venue: "Block C Lab",
    cancelled: false,
    published: true,
    category: "Study Jam",
    format: "in_person",
    host: "Core Team",
    capacity: 60,
    registeredCount: 30,
    registrationDeadline: null,
    meetingUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockUsers = [
  {
    name: "Lead Admin",
    email: "admin@gdgoc.dev",
    role: "admin",
    branch: "CSE",
    year: 4,
    createdAt: new Date().toISOString(),
  },
  {
    name: "Student One",
    email: "student1@gdgoc.dev",
    role: "student",
    branch: "IT",
    year: 2,
    createdAt: new Date().toISOString(),
  },
];

beforeEach(() => {
  location.hash = "#/admin";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("shows access denied when user is not an admin", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    if (String(url).endsWith("/users/me")) {
      return respond(200, { name: "Student", email: "student@test.dev", role: "student" });
    }
    return respond(404, {});
  });

  render(<Admin />);

  await waitFor(() => {
    expect(screen.getByText(/Administrator Authorization Required/i)).toBeTruthy();
  });
});

test("renders admin console with stats and events when user is admin", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    const u = String(url);
    if (u.endsWith("/users/me")) {
      return respond(200, mockAdminUser);
    }
    if (u.endsWith("/admin/stats")) {
      return respond(200, mockStats);
    }
    if (u.endsWith("/admin/events")) {
      return respond(200, { events: mockEvents });
    }
    if (u.includes("/admin/users")) {
      return respond(200, { users: mockUsers });
    }
    if (u.includes("/registrations")) {
      return respond(200, {
        event: mockEvents[0],
        stats: { total: 1, confirmed: 1, cancelled: 0, attended: 0 },
        registrations: [],
      });
    }
    return respond(404, {});
  });

  render(<Admin />);

  // Should show the title
  await waitFor(() => {
    expect(screen.getByText(/GDGoC Administrator Console/i)).toBeTruthy();
  });

  // Should display stats
  expect(screen.getByText("50")).toBeTruthy(); // usersCount
  expect(screen.getByText("56.3%")).toBeTruthy(); // attendanceRate

  // Should navigate between tabs
  const eventsTab = screen.getByRole("button", { name: /📅 Events Manager/i });
  fireEvent.click(eventsTab);

  await waitFor(() => {
    expect(screen.getByText("Cloud Study Jam #3")).toBeTruthy();
  });

  // Switch to Gate Scanner tab
  const scannerTab = screen.getByRole("button", { name: /📷 QR Gate Scanner/i });
  fireEvent.click(scannerTab);

  expect(screen.getByPlaceholderText(/e\.g\. j1A8B\.\.\./i)).toBeTruthy();
});
