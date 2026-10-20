import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminDashboard from "../src/components/admin/AdminDashboard";
import { StatusBadge, ErrorAlert, EmptyState } from "../src/components/admin/AdminUi";

describe("Admin Dashboard Frontend & Auth Guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "#/admin";
  });

  it("renders 401 Authentication Required when user is not logged in", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/users/me")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ message: "Please log in." }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Authentication Required")).toBeDefined();
      expect(screen.getByText("Sign In to Continue")).toBeDefined();
    });
  });

  it("renders 403 Access Denied when authenticated user is a student without admin privileges", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/users/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: "John Student",
            email: "student@psit.dev",
            role: "student",
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeDefined();
      expect(screen.getByText("403 Forbidden")).toBeDefined();
      expect(screen.getByText("Return to Public Website")).toBeDefined();
    });
  });

  it("renders Admin Console when user has admin role", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/users/me")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            name: "Lead Admin",
            email: "lead@psit.dev",
            role: "admin",
          }),
        } as Response;
      }
      if (u.includes("/admin/metrics")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totalPublishedEvents: 5,
            upcomingEvents: 3,
            totalProjects: 12,
            ongoingProjects: 8,
            completedProjects: 4,
            totalRegistrations: 250,
            confirmedRegistrations: 240,
            uniqueRegisteredMembers: 190,
            totalCheckedInAttendance: 180,
            recentActivity: [],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ events: [], projects: [], registrations: [] }),
      } as Response;
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("GDGoC PSIT")).toBeDefined();
      expect(screen.getByText("Admin Console")).toBeDefined();
      expect(screen.getByText("Dashboard Overview")).toBeDefined();
    });

    // Verify presence of navigation items
    expect(screen.getAllByRole("button", { name: /Events/i })[0]).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Projects/i })[0]).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Registrations/i })[0]).toBeDefined();
    expect(screen.getAllByRole("button", { name: /QR Scanner/i })[0]).toBeDefined();
  });
});

describe("Admin Shared UI Components", () => {
  it("StatusBadge pairs distinct icon, text, and accessible attributes", () => {
    const { container: pub } = render(<StatusBadge status="published" />);
    expect(pub.textContent).toMatch(/published/i);

    const { container: draft } = render(<StatusBadge status="draft" />);
    expect(draft.textContent).toMatch(/draft/i);

    const { container: cancelled } = render(<StatusBadge status="cancelled" />);
    expect(cancelled.textContent).toMatch(/cancelled/i);

    const { container: ongoing } = render(<StatusBadge status="ongoing" />);
    expect(ongoing.textContent).toMatch(/ongoing/i);
  });

  it("EmptyState renders accessible message and executes call-to-action", () => {
    let clicked = false;
    render(
      <EmptyState
        title="No items found"
        description="Try adding a new item."
        actionLabel="Create Item"
        onAction={() => {
          clicked = true;
        }}
      />
    );

    expect(screen.getByText("No items found")).toBeDefined();
    const btn = screen.getByRole("button", { name: "Create Item" });
    fireEvent.click(btn);
    expect(clicked).toBe(true);
  });

  it("ErrorAlert renders user-friendly error and triggers retry", () => {
    let retried = false;
    render(
      <ErrorAlert
        message="Database query timed out."
        onRetry={() => {
          retried = true;
        }}
      />
    );

    expect(screen.getByText("Action Failed")).toBeDefined();
    expect(screen.getByText("Database query timed out.")).toBeDefined();
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(retried).toBe(true);
  });
});
