import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Nav from "../src/components/Nav";
import Join from "../src/components/Join";
import Footer from "../src/components/Footer";
import { SOCIAL_LINKS } from "../src/data/content";

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function signedIn(user: object | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const status = user ? 200 : 401;
      return Promise.resolve(new Response(JSON.stringify(user ?? {}), { status }));
    }),
  );
}

beforeEach(() => {
  location.hash = "";
  vi.stubGlobal("IntersectionObserver", StubObserver);
  vi.stubGlobal("ResizeObserver", StubObserver);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  signedIn(null);
});

afterEach(cleanup);

test("menu opens on click, focuses the first item and closes with Escape", async () => {
  render(<Nav />);
  const menuButton = screen.getByRole("button", { name: /menu/i });

  fireEvent.click(menuButton);
  expect(menuButton.getAttribute("aria-expanded")).toBe("true");
  await waitFor(() => expect(document.activeElement?.textContent).toContain("Board"));

  fireEvent.keyDown(window, { key: "Escape" });
  expect(menuButton.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(menuButton);
});

test("menu does not open on hover", () => {
  render(<Nav />);
  const menuButton = screen.getByRole("button", { name: /menu/i });

  fireEvent.mouseEnter(menuButton);
  expect(menuButton.getAttribute("aria-expanded")).toBe("false");
});

test("nav shows Log in when signed out and Dashboard when signed in", async () => {
  render(<Nav />);
  expect(await screen.findByRole("link", { name: "Log in" })).toBeTruthy();
  cleanup();

  signedIn({ name: "Asha Verma", email: "a@psit.ac.in" });
  render(<Nav />);
  expect(await screen.findByRole("link", { name: "Your dashboard" })).toBeTruthy();
});

test("join form validates and hands off to sign up with details prefilled", async () => {
  render(<Join />);
  fireEvent.click(screen.getByRole("button", { name: /create your account/i }));

  expect(screen.getByText("Name required")).toBeTruthy();
  expect(screen.getByText("Valid email required")).toBeTruthy();
  expect(location.hash).toBe("");

  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Asha Verma" } });
  fireEvent.change(screen.getByLabelText(/campus email/i), { target: { value: "a@psit.ac.in" } });
  fireEvent.change(screen.getByLabelText(/year/i), { target: { value: "2nd year" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /create your account/i }));
  });

  const params = new URLSearchParams(location.hash.split("?")[1]);
  expect(location.hash.startsWith("#/login?")).toBe(true);
  expect(params.get("mode")).toBe("signup");
  expect(params.get("name")).toBe("Asha Verma");
  expect(params.get("email")).toBe("a@psit.ac.in");
  expect(params.get("year")).toBe("2");
});

test("footer only links to real community destinations and opens them safely", () => {
  render(<Footer />);

  for (const link of SOCIAL_LINKS) {
    const anchor = screen.getByRole("link", { name: new RegExp(link.label, "i") });
    expect(anchor.getAttribute("href")).toBe(link.href);
    expect(anchor.getAttribute("rel")).toContain("noopener");
  }

  const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(hrefs).not.toContain("https://instagram.com");
  expect(hrefs).not.toContain("https://discord.com");
  expect(hrefs).not.toContain("https://github.com");
});
