import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Users,
  QrCode,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import { api, type Profile } from "../../lib/profile";
import { type AdminUser, type Role } from "../../lib/admin";
import OverviewSection from "./OverviewSection";
import EventsSection from "./EventsSection";
import ProjectsSection from "./ProjectsSection";
import RegistrationsSection from "./RegistrationsSection";
import AttendanceSection from "./AttendanceSection";
import GdgLogo from "../GdgLogo";
import { Skeleton } from "./AdminUi";

type AdminTab = "overview" | "events" | "projects" | "registrations" | "attendance";

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthorized" | "forbidden">("loading");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Quick action modal triggers
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Parse hash route
  useEffect(() => {
    const parseHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h.includes("/events")) setActiveTab("events");
      else if (h.includes("/projects")) setActiveTab("projects");
      else if (h.includes("/registrations")) setActiveTab("registrations");
      else if (h.includes("/attendance")) setActiveTab("attendance");
      else setActiveTab("overview");
    };

    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);

  // Update hash when tab changes
  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
    if (tab === "overview") window.location.hash = "#/admin";
    else window.location.hash = `#/admin/${tab}`;
  };

  // Verify Admin Session on Mount
  useEffect(() => {
    setAuthStatus("loading");
    api<AdminUser & Profile>("/users/me")
      .then((user) => {
        setCurrentUser(user);
        const allowedRoles: Role[] = ["admin", "superadmin", "organizer"];
        if (allowedRoles.includes(user.role)) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("forbidden");
        }
      })
      .catch((err) => {
        if (err.message === "401") {
          setAuthStatus("unauthorized");
        } else {
          setAuthStatus("unauthorized");
        }
      });
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api("/auth/logout", "POST");
    } finally {
      window.location.hash = "#/login";
      window.location.reload();
    }
  };

  // Keyboard Escape listener for mobile drawer
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileDrawerOpen]);

  // ----------------------------------------------------
  // 1. NEUTRAL SKELETON LOADER (Never flash sensitive admin content)
  // ----------------------------------------------------
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-bg p-6 flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <GdgLogo size={36} />
          <span className="font-display font-extrabold text-xl tracking-tight text-ink">
            GDGoC Admin Portal
          </span>
        </div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="w-full max-w-4xl p-6 bg-panel border-2 border-line mt-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. UNAUTHENTICATED (401) STATE
  // ----------------------------------------------------
  if (authStatus === "unauthorized") {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md p-8 bg-white border-[3px] border-ink shadow-[6px_6px_0_#202124] text-center space-y-5">
          <div className="w-14 h-14 bg-wash-blue border-2 border-ink grid place-items-center mx-auto text-gblue">
            <UserCheck className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-black text-ink">Authentication Required</h1>
          <p className="text-sm text-muted">
            You must be logged in with an administrator account to access the GDGoC Chapter Administration Dashboard.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#/login?next=/admin"
              className="hard-button px-5 py-2.5 bg-gblue text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              Sign In to Continue
            </a>
            <a
              href="#"
              className="px-4 py-2.5 border-2 border-ink font-display text-sm font-bold text-ink hover:bg-panel"
            >
              Return Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 3. 403 ACCESS DENIED (Non-admin student accounts)
  // ----------------------------------------------------
  if (authStatus === "forbidden") {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg p-8 bg-white border-[3px] border-ink shadow-[6px_6px_0_#202124] text-center space-y-5">
          <div className="w-14 h-14 bg-wash-red border-2 border-ink grid place-items-center mx-auto text-gred">
            <ShieldAlert className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gred bg-wash-red px-2 py-0.5 border border-gred">
              403 Forbidden
            </span>
            <h1 className="font-display text-2xl font-black text-ink mt-2">Access Denied</h1>
          </div>
          <p className="text-sm text-muted">
            Your account (<strong>{currentUser?.email}</strong>) is assigned the role of{" "}
            <span className="font-mono font-bold text-ink bg-panel px-1.5 py-0.5 border border-line capitalize">
              {currentUser?.role}
            </span>
            . Administrative privileges (<code className="text-xs">admin</code>, <code className="text-xs">superadmin</code>, or <code className="text-xs">organizer</code>) are required to access this portal.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#"
              className="hard-button inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-ink text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Return to Public Website</span>
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 border-2 border-ink font-display text-sm font-bold text-ink hover:bg-panel"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 4. AUTHENTICATED ADMIN DASHBOARD
  // ----------------------------------------------------
  const navItems = [
    { id: "overview" as AdminTab, label: "Overview", icon: LayoutDashboard },
    { id: "events" as AdminTab, label: "Events", icon: Calendar },
    { id: "projects" as AdminTab, label: "Projects", icon: Layers },
    { id: "registrations" as AdminTab, label: "Registrations", icon: Users },
    { id: "attendance" as AdminTab, label: "QR Scanner", icon: QrCode },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-ink px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile drawer toggle */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open administration navigation drawer"
            aria-expanded={mobileDrawerOpen}
            className="p-2 border border-ink hover:bg-panel lg:hidden"
          >
            <Menu className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>

          <a href="#" className="flex items-center gap-2.5 group">
            <GdgLogo size={28} />
            <div>
              <span className="font-display font-black text-base sm:text-lg tracking-tight text-ink group-hover:text-gblue transition-colors">
                GDGoC PSIT
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block -mt-1">
                Admin Console
              </span>
            </div>
          </a>
        </div>

        {/* User Role Badge & Actions */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-ink px-2.5 py-1.5 border border-line hover:border-ink transition-colors"
          >
            <span>Live Site</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-panel border border-ink">
            <span className="w-2 h-2 rounded-full bg-ggreen" aria-hidden="true" />
            <span className="text-xs font-bold text-ink">{currentUser?.name}</span>
            <span className="text-[10px] font-mono uppercase bg-wash-blue text-gblue px-1.5 py-0.2 border border-gblue">
              {currentUser?.role}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out of administration account"
            className="p-1.5 sm:px-3 sm:py-1.5 text-xs font-bold font-display border border-ink hover:bg-panel text-ink inline-flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4 text-ink" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Persistent Sidebar */}
        <aside
          className="hidden lg:flex flex-col w-64 bg-panel border-r-2 border-ink p-5 space-y-6 shrink-0"
          aria-label="Admin Navigation Sidebar"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Management
            </p>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-display font-bold border-2 transition-all ${
                      active
                        ? "bg-white border-ink text-ink shadow-[3px_3px_0_#202124] -translate-y-0.5"
                        : "bg-transparent border-transparent text-muted hover:text-ink hover:bg-white/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-gblue" : "text-muted"}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-line mt-auto text-xs text-muted space-y-1 font-mono">
            <div>PSIT GDGoC Chapter v2.0</div>
            <div className="text-[11px]">Authorized Admin Session</div>
          </div>
        </aside>

        {/* Mobile Navigation Slide-Over Drawer */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden flex"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Administration Navigation"
          >
            <div
              className="fixed inset-0 bg-ink/50 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-white border-r-2 border-ink p-6 flex flex-col justify-between shadow-2xl z-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
                  <span className="font-display font-bold text-lg text-ink">Navigation</span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    aria-label="Close navigation drawer"
                    className="p-1 border border-ink hover:bg-panel"
                  >
                    <X className="w-5 h-5 text-ink" aria-hidden="true" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => switchTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-display font-bold border-2 ${
                          active
                            ? "bg-panel border-ink text-ink shadow-[2px_2px_0_#202124]"
                            : "border-transparent text-muted hover:bg-panel"
                        }`}
                      >
                        <Icon className="w-5 h-5 text-gblue" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-line">
                <div className="text-xs text-muted mb-2 font-mono">Logged in as {currentUser?.name}</div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 bg-panel border border-ink text-xs font-bold text-ink hover:bg-line/40 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === "overview" && (
            <OverviewSection
              onNavigate={switchTab}
              onOpenCreateEvent={() => {
                switchTab("events");
                setCreateEventOpen(true);
              }}
              onOpenCreateProject={() => {
                switchTab("projects");
                setCreateProjectOpen(true);
              }}
            />
          )}

          {activeTab === "events" && (
            <EventsSection
              createOpen={createEventOpen}
              onCloseCreate={() => setCreateEventOpen(false)}
            />
          )}

          {activeTab === "projects" && (
            <ProjectsSection
              createOpen={createProjectOpen}
              onCloseCreate={() => setCreateProjectOpen(false)}
            />
          )}

          {activeTab === "registrations" && <RegistrationsSection />}

          {activeTab === "attendance" && <AttendanceSection />}
        </main>
      </div>
    </div>
  );
}

