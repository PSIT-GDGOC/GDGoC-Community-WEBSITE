import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MemberCard from "../src/components/MemberCard";
import Profile from "../src/components/Profile";
import type { Profile as P } from "../src/lib/profile";

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

const MEMBER_WITHOUT_AVATAR: P = {
  name: "Priya Sharma",
  email: "priya@psit.ac.in",
  branch: "CSE",
  year: 3,
  avatarUrl: null,
  createdAt: "2026-08-01T00:00:00Z",
};

const MEMBER_WITH_AVATAR: P = {
  ...MEMBER_WITHOUT_AVATAR,
  avatarUrl: "/uploads/avatars/avatar_test_123.webp",
};

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

test("MemberCard renders image when avatarUrl is provided", () => {
  render(<MemberCard user={MEMBER_WITH_AVATAR} />);

  const img = screen.getByRole("img", { name: "Priya Sharma" });
  expect(img).toBeDefined();
  expect(img.getAttribute("src")).toBe("/uploads/avatars/avatar_test_123.webp");
  expect(img.className).toContain("object-cover");
});

test("MemberCard falls back to initials when avatarUrl is null", () => {
  render(<MemberCard user={MEMBER_WITHOUT_AVATAR} />);

  expect(screen.queryByRole("img", { name: "Priya Sharma" })).toBeNull();
  expect(screen.getAllByText("PS").length).toBeGreaterThan(0);
});

test("MemberCard falls back to initials when avatar fails to load (onError)", () => {
  render(<MemberCard user={MEMBER_WITH_AVATAR} />);

  const img = screen.getByRole("img", { name: "Priya Sharma" });
  expect(img).toBeDefined();

  // Simulate image load failure
  fireEvent.error(img);

  // Avatar image should be replaced with initials fallback
  expect(screen.queryByRole("img", { name: "Priya Sharma" })).toBeNull();
  expect(screen.getAllByText("PS").length).toBeGreaterThan(0);
});

test("Profile page renders Profile photo card with Upload button when user has no avatar", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/users/me")) {
        return respond(200, MEMBER_WITHOUT_AVATAR);
      }
      return respond(404, {});
    })
  );

  render(<Profile />);

  await waitFor(() => {
    expect(screen.getByText("Profile photo")).toBeDefined();
  });

  expect(screen.getByRole("button", { name: "Upload photo" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
});

test("Profile page renders Replace and Remove buttons when user has an avatar", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/users/me")) {
        return respond(200, MEMBER_WITH_AVATAR);
      }
      return respond(404, {});
    })
  );

  render(<Profile />);

  await waitFor(() => {
    expect(screen.getByText("Profile photo")).toBeDefined();
  });

  expect(screen.getByRole("button", { name: "Replace photo" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Remove photo" })).toBeDefined();
});

test("Removing photo calls DELETE /users/me/avatar and updates the UI immediately", async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? "GET";

    if (path.includes("/users/me/avatar") && method === "DELETE") {
      return respond(200, {
        message: "Profile photo removed successfully.",
        user: { ...MEMBER_WITH_AVATAR, avatarUrl: null },
      });
    }

    if (path.includes("/users/me") && method === "GET") {
      return respond(200, MEMBER_WITH_AVATAR);
    }

    return respond(404, {});
  });

  vi.stubGlobal("fetch", fetchMock);
  render(<Profile />);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeDefined();
  });

  const removeBtn = screen.getByRole("button", { name: "Remove photo" });
  fireEvent.click(removeBtn);

  await waitFor(() => {
    expect(screen.getByText("Profile photo removed.")).toBeDefined();
  });

  // Upload button should now appear instead of Replace photo
  expect(screen.getByRole("button", { name: "Upload photo" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
});
