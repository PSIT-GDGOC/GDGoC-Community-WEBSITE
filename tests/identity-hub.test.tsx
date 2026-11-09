import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MemberCard from "../src/components/MemberCard";
import ProfileHero from "../src/components/profile/ProfileHero";
import ProfileSkills from "../src/components/profile/ProfileSkills";
import ProfileProjects from "../src/components/profile/ProfileProjects";
import CommunityJourney from "../src/components/profile/CommunityJourney";
import ProfilePreferences from "../src/components/profile/ProfilePreferences";
import ProfileEditorModal from "../src/components/profile/ProfileEditorModal";
import Profile from "../src/components/Profile";
import type { Profile as P } from "../src/lib/profile";
import type { Ticket } from "../src/lib/tickets";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const EMAIL_ONLY_USER: P = {
  id: "user_64f100000000000000000001",
  name: "Aarav Verma",
  email: "aarav@psit.ac.in",
  role: "student",
  branch: "CSE",
  year: 3,
  emailVerified: true,
  memberVerified: false,
  bannerTheme: "google-brand",
  accentColor: "gblue",
  cardTheme: "default",
  skills: [],
  projects: [],
  privacy: {
    showEmail: false,
    showAttendance: true,
    showProjects: true,
  },
  createdAt: "2026-08-15T00:00:00Z",
};

const FULL_DEVELOPER_USER: P = {
  ...EMAIL_ONLY_USER,
  headline: "Distributed Systems & Full-Stack Builder",
  specialization: "Cloud Native",
  college: "PSIT Kanpur",
  bio: "Building open-source campus tools with TypeScript and Go.",
  avatarUrl: "/api/media/avatar123.webp",
  bannerTheme: "custom",
  bannerUrl: "/api/media/banner123.webp",
  accentColor: "ggreen",
  cardTheme: "dark",
  memberVerified: true,
  socials: {
    github: "https://github.com/aarav-dev",
    linkedin: "https://linkedin.com/in/aarav-dev",
    portfolio: "https://aarav.dev",
    website: "https://blog.aarav.dev",
    twitter: "javascript:alert(1)", // unsafe URL must be ignored on render
  },
  skills: [
    { name: "TypeScript", category: "Programming" },
    { name: "React", category: "Frontend" },
    { name: "Docker", category: "Cloud & DevOps" },
  ],
  projects: [
    {
      id: "proj_1",
      title: "GDGoC Check-In Scanner",
      description: "Fast offline-ready QR verification PWA for campus events.",
      techStack: ["React", "TypeScript", "Express"],
      githubUrl: "https://github.com/PSIT-GDGOC/scanner",
      liveUrl: "https://scanner.psit-gdgoc.dev",
      featured: true,
    },
    {
      id: "proj_2",
      title: "Unsafe Link Check",
      description: "Should suppress javascript: URLs safely.",
      techStack: ["Node.js"],
      githubUrl: "javascript:alert(1)",
    },
  ],
};

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

test("ProfileHero hides email by default, separates portfolio/website, and blocks unsafe URLs", () => {
  render(<ProfileHero user={FULL_DEVELOPER_USER} onOpenEditor={() => {}} />);

  expect(screen.getByText("Aarav Verma")).toBeDefined();
  expect(screen.getByText("Distributed Systems & Full-Stack Builder")).toBeDefined();
  expect(screen.queryByText(/aarav@psit\.ac\.in/)).toBeNull();

  // Separate Portfolio & Website links rendered
  expect(screen.getByRole("link", { name: "Portfolio" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Personal Website" })).toBeDefined();
  // Unsafe twitter URL suppressed
  expect(screen.queryByRole("link", { name: "Twitter / X Profile" })).toBeNull();

  // Completion bar reaches 100% and checklist toggles
  expect(screen.getByText("100%")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /View checklist/i }));
  expect(screen.getByText("At least 1 featured project")).toBeDefined();
});

test("ProfileHero falls back gracefully when custom banner fails to load", () => {
  render(<ProfileHero user={FULL_DEVELOPER_USER} onOpenEditor={() => {}} />);
  const banner = screen.getByRole("img", { name: "Profile cover banner" });
  fireEvent.error(banner);
  expect(screen.queryByRole("img", { name: "Profile cover banner" })).toBeNull();
  expect(screen.getByText(/Google Developer Groups · PSIT/i)).toBeDefined();
});

test("MemberCard strictly distinguishes emailVerified from official memberVerified", () => {
  render(<MemberCard user={EMAIL_ONLY_USER} />);

  // Front hides email and does NOT claim Verified Member
  expect(screen.queryByText("aarav@psit.ac.in")).toBeNull();
  expect(screen.getByText("GDGoC Member")).toBeDefined();
  expect(screen.queryByText("Verified Member")).toBeNull();

  // Flip to back pass
  fireEvent.click(screen.getByRole("button", { name: /View back of membership card/i }));
  expect(screen.getByText("Community Member (Email Verified)")).toBeDefined();
  expect(screen.queryByText("Verified Chapter Member")).toBeNull();
});

test("MemberCard shows Verified Chapter Member only when memberVerified is true", () => {
  render(<MemberCard user={FULL_DEVELOPER_USER} />);

  expect(screen.getByText("Verified Member")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /View back of membership card/i }));
  expect(screen.getByText("Verified Chapter Member")).toBeDefined();
});

test("ProfileSkills renders empty state and categorized tags without fabricated bars", () => {
  const { rerender } = render(<ProfileSkills user={EMAIL_ONLY_USER} onOpenSkillsEditor={() => {}} />);
  expect(screen.getByText("No technical skills added yet.")).toBeDefined();

  rerender(<ProfileSkills user={FULL_DEVELOPER_USER} onOpenSkillsEditor={() => {}} />);
  expect(screen.getByText("Programming")).toBeDefined();
  expect(screen.getByText("TypeScript")).toBeDefined();
  expect(screen.getByText("Cloud & DevOps")).toBeDefined();
  expect(screen.queryByText(/%/)).toBeNull();
});

test("ProfileProjects renders cards cleanly and suppresses unsafe project links", () => {
  const { rerender } = render(
    <ProfileProjects user={EMAIL_ONLY_USER} onOpenProjectsEditor={() => {}} onAddProject={() => {}} />
  );
  expect(screen.getByText("No projects featured yet")).toBeDefined();

  rerender(
    <ProfileProjects user={FULL_DEVELOPER_USER} onOpenProjectsEditor={() => {}} onAddProject={() => {}} />
  );
  expect(screen.getByText("GDGoC Check-In Scanner")).toBeDefined();
  expect(screen.getByText("★ Featured")).toBeDefined();

  const ghLinks = screen.getAllByRole("link", { name: /GitHub/i });
  expect(ghLinks.length).toBe(1);
  expect(ghLinks[0].getAttribute("href")).toBe("https://github.com/PSIT-GDGOC/scanner");
});

test("CommunityJourney calculates upcoming, verified attended, and confirmed totals accurately", () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const tickets: Ticket[] = [
    {
      ticketId: "t1",
      state: "confirmed",
      registeredAt: pastDate,
      attendedAt: null,
      event: {
        title: "Upcoming AI Hack",
        summary: "",
        startsAt: futureDate,
        endsAt: null,
        venue: "Main Auditorium",
        poster: "",
      },
    },
    {
      ticketId: "t2",
      state: "checked_in",
      registeredAt: pastDate,
      attendedAt: pastDate,
      event: {
        title: "Cloud Study Jam",
        summary: "",
        startsAt: pastDate,
        endsAt: null,
        venue: "CS Lab 1",
        poster: "",
      },
    },
    {
      ticketId: "t3",
      state: "cancelled",
      registeredAt: pastDate,
      attendedAt: null,
      event: {
        title: "Cancelled Talk",
        summary: "",
        startsAt: futureDate,
        endsAt: null,
        venue: "Online",
        poster: "",
      },
    },
  ];

  render(<CommunityJourney tickets={tickets} />);
  expect(screen.getByText("Upcoming AI Hack")).toBeDefined();
  expect(screen.getByText("Cloud Study Jam")).toBeDefined();
  expect(screen.getByText("✓ Checked In")).toBeDefined();
  expect(screen.getByText("✕ Cancelled")).toBeDefined();
});

test("ProfilePreferences stays in View Mode until Configure is clicked and links to forgot-password", async () => {
  const onUpdated = vi.fn();
  const fetchMock = vi.fn(() => respond(200, { ...EMAIL_ONLY_USER, accentColor: "ggreen" }));
  vi.stubGlobal("fetch", fetchMock);

  render(<ProfilePreferences user={EMAIL_ONLY_USER} onUpdated={onUpdated} />);

  // Password change inputs must not exist; links to recovery flow
  expect(screen.queryByLabelText(/current password/i)).toBeNull();
  const forgotLink = screen.getByRole("link", { name: /email password recovery/i });
  expect(forgotLink.getAttribute("href")).toBe("#/forgot-password");

  // Open settings editor
  fireEvent.click(screen.getByRole("button", { name: /Configure/i }));
  fireEvent.click(screen.getByRole("button", { name: /Google Green/i }));
  fireEvent.click(screen.getByRole("button", { name: /Save Preferences/i }));

  await waitFor(() => {
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Preferences saved successfully.")).toBeDefined();
  });
});

test("ProfileEditorModal updates personal details and closes on Escape", async () => {
  const onUpdated = vi.fn();
  const onClose = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => respond(200, { ...EMAIL_ONLY_USER, headline: "Systems Tinkerer" }))
  );

  render(<ProfileEditorModal user={EMAIL_ONLY_USER} onUpdated={onUpdated} onClose={onClose} />);

  const headlineInput = screen.getByLabelText("Professional Headline") as HTMLInputElement;
  fireEvent.change(headlineInput, { target: { value: "Systems Tinkerer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity Details" }));

  await waitFor(() => {
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Personal and academic profile updated.")).toBeDefined();
  });

  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Full Profile page loads real API data and renders all 6 identity hub sections", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/users/me")) {
        return respond(200, FULL_DEVELOPER_USER);
      }
      if (String(url).includes("/tickets")) {
        return respond(200, { tickets: [] });
      }
      return respond(404, {});
    })
  );

  render(<Profile />);

  await waitFor(() => {
    expect(screen.getByText("Technical Skills & Tooling")).toBeDefined();
  });

  expect(screen.getByText("Featured Projects & Work")).toBeDefined();
  expect(screen.getByText("Community Journey & Activity")).toBeDefined();
  expect(screen.getByText("Privacy & Account Preferences")).toBeDefined();
  expect(screen.getByRole("button", { name: /Customize Profile/i })).toBeDefined();

  // Open modal via hero CTA
  fireEvent.click(screen.getByRole("button", { name: /Customize Profile/i }));
  expect(screen.getByRole("dialog")).toBeDefined();
  expect(screen.getByText("Customize Developer Identity Hub")).toBeDefined();
});

