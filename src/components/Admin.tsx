import { useEffect, useState, useRef, type FormEvent } from "react";
import { api, type Profile } from "../lib/profile";
import {
  getAdminStats,
  getAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  getEventRegistrations,
  scanTicketAttendance,
  toggleManualAttendance,
  getAdminUsers,
  updateUserRole,
  getExportCsvUrl,
  type AdminStats,
  type AdminEvent,
  type AdminRegistration,
  type ScanResult,
  type AdminUser,
} from "../lib/admin";
import { formatEventTime } from "../lib/events";

type Tab = "overview" | "events" | "roster" | "scanner" | "users";

export const inputClass =
  "w-full border-[3px] border-ink bg-bg px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-muted/60 focus:bg-white focus:outline-none";
export const labelClass = "block text-xs font-mono font-bold uppercase tracking-wider text-ink mb-1";
export const buttonPrimary =
  "hard-button inline-flex items-center justify-center gap-2 bg-gyellow px-5 py-2.5 font-display text-sm font-bold text-ink cursor-pointer active:translate-x-0.5 active:translate-y-0.5";
export const buttonDanger =
  "hard-button inline-flex items-center justify-center gap-2 bg-gred px-4 py-2 font-display text-sm font-bold text-white cursor-pointer active:translate-x-0.5 active:translate-y-0.5";
export const buttonGhost =
  "hard-button inline-flex items-center justify-center gap-2 bg-bg px-4 py-2 font-display text-sm font-bold text-ink cursor-pointer hover:bg-panel";

export default function Admin() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isDenied, setIsDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Selected event for roster
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [rosterData, setRosterData] = useState<{
    event: AdminEvent;
    stats: { total: number; confirmed: number; cancelled: number; attended: number };
    registrations: AdminRegistration[];
  } | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");

  // Event modal / editor state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventFormData, setEventFormData] = useState<Partial<AdminEvent>>({
    title: "",
    summary: "",
    description: "",
    startsAt: "",
    endsAt: "",
    venue: "",
    category: "Workshop",
    format: "in_person",
    host: "GDGoC PSIT Core Team",
    prerequisites: "",
    capacity: 60,
    published: true,
    meetingUrl: "",
  });

  // Scanner state
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const showToast = (text: string, ok = true) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 5000);
  };

  // Check user role on mount
  useEffect(() => {
    api<Profile>("/users/me")
      .then((user) => {
        setCurrentUser(user);
        if (user.role !== "admin") {
          setIsDenied(true);
        } else {
          loadAllData();
        }
      })
      .catch((err) => {
        if (err.message === "401") {
          location.hash = "#/login?next=#/admin";
        } else {
          setIsDenied(true);
        }
      })
      .finally(() => setAuthChecking(false));
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [s, evs, usrs] = await Promise.all([
        getAdminStats().catch(() => null),
        getAdminEvents().catch(() => []),
        getAdminUsers().catch(() => []),
      ]);
      if (s) setStats(s);
      setEvents(evs);
      setUsers(usrs);
      if (evs.length > 0 && !selectedEventId) {
        setSelectedEventId(evs[0]._id);
      }
    } catch {
      showToast("Failed to refresh admin data.", false);
    } finally {
      setLoading(false);
    }
  };

  // Load roster when selectedEventId changes
  useEffect(() => {
    if (selectedEventId) {
      getEventRegistrations(selectedEventId)
        .then((data) => setRosterData(data))
        .catch(() => setRosterData(null));
    }
  }, [selectedEventId]);

  // Clean camera on unmount or tab switch
  useEffect(() => {
    if (tab !== "scanner" && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, [tab]);

  // Web camera scanner toggle
  const toggleCamera = async () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      showToast("Camera active. Point towards ticket QR.");
    } catch (e) {
      showToast("Could not access camera. Use manual ID scan below.", false);
    }
  };

  const handleScanSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const id = scanInput.trim();
    if (!id) return;
    setIsScanning(true);
    try {
      const res = await scanTicketAttendance(id);
      setScanResult(res);
      setScanInput("");
      if (res.status === "admitted") {
        showToast(`Admitted: ${res.user?.name || "Attendee"}!`);
      } else if (res.status === "already_attended") {
        showToast(`Warning: Already checked in.`, false);
      } else {
        showToast(res.message, false);
      }
      // Refresh stats and roster if relevant
      loadAllData();
    } catch (err: any) {
      setScanResult({
        status: "invalid",
        message: err.message || "Failed to scan ticket.",
      });
      showToast(err.message || "Error validating ticket.", false);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventFormData.title || !eventFormData.startsAt) {
      showToast("Title and Start Date/Time are required.", false);
      return;
    }

    setLoading(true);
    try {
      if (eventFormData._id) {
        await updateAdminEvent(eventFormData._id, eventFormData);
        showToast("Event updated successfully!");
      } else {
        await createAdminEvent(eventFormData);
        showToast("Event created successfully!");
      }
      setIsEditingEvent(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to save event.", false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete '${title}'? This will remove all associated registrations.`)) {
      return;
    }
    setLoading(true);
    try {
      await deleteAdminEvent(id);
      showToast("Event deleted.");
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete event.", false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (regId: string, currentAttended: boolean) => {
    try {
      const res = await toggleManualAttendance(regId, !currentAttended);
      showToast(res.message);
      if (selectedEventId) {
        const updated = await getEventRegistrations(selectedEventId);
        setRosterData(updated);
      }
      getAdminStats().then(setStats);
    } catch (err: any) {
      showToast(err.message || "Failed to update attendance.", false);
    }
  };

  const handleRoleChange = async (userEmail: string, currentRole: string) => {
    const nextRole = currentRole === "admin" ? "student" : "admin";
    if (
      !confirm(
        `Are you sure you want to change ${userEmail}'s role to ${nextRole.toUpperCase()}?`
      )
    ) {
      return;
    }
    try {
      await updateUserRole(userEmail, nextRole as "student" | "admin");
      showToast(`Updated ${userEmail} to ${nextRole}.`);
      getAdminUsers().then(setUsers);
    } catch (err: any) {
      showToast(err.message || "Failed to update role.", false);
    }
  };

  if (authChecking) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-32 pb-24 sm:px-6">
        <p className="font-mono text-sm" role="status">
          Verifying administrator permissions…
        </p>
      </main>
    );
  }

  if (isDenied) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-32 pb-24 sm:px-6">
        <div className="border-[3px] border-ink bg-bg p-8 shadow-[8px_8px_0_var(--color-ink)]">
          <div className="inline-block border-2 border-ink bg-gred px-3 py-1 font-mono text-xs font-bold text-white uppercase">
            Access Denied
          </div>
          <h1 className="mt-4 font-display text-2xl font-black">Administrator Authorization Required</h1>
          <p className="mt-2 text-sm text-muted">
            Your current account ({currentUser?.email || "Signed out"}) does not have administrator privileges.
          </p>
          <div className="mt-6 flex gap-4">
            <a href="#/login?next=#/admin" className={buttonPrimary}>
              Sign In as Admin
            </a>
            <a href="#/profile" className={buttonGhost}>
              Return to Profile
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {message && (
        <div
          role="status"
          className={`fixed top-6 right-6 z-[100] border-[3px] border-ink px-5 py-3 font-mono text-sm font-bold shadow-[6px_6px_0_var(--color-ink)] transition-all ${
            message.ok ? "bg-ggreen text-ink" : "bg-gred text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-ink pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border-2 border-ink bg-gred px-2.5 py-0.5 font-mono text-xs font-bold text-white uppercase">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Lead Console
            </span>
            <span className="font-mono text-xs text-muted">
              {currentUser?.name} · {currentUser?.email}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            ⚡ GDGoC Administrator Console
          </h1>
          <p className="mt-1 text-sm text-muted">
            Official management portal for events, attendance check-in, member rosters, and CSV exports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className={buttonGhost}
          >
            ↻ {loading ? "Syncing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEventFormData({
                title: "",
                summary: "",
                description: "",
                startsAt: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
                endsAt: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString().slice(0, 16),
                venue: "PSIT Block C Lab",
                category: "Workshop",
                format: "in_person",
                host: "GDGoC PSIT Core Team",
                prerequisites: "Laptop with development tools installed.",
                capacity: 60,
                published: true,
                meetingUrl: "",
              });
              setIsEditingEvent(true);
            }}
            className={buttonPrimary}
          >
            + Create New Event
          </button>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b-[3px] border-ink pb-px">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "events", label: "📅 Events Manager" },
          { id: "roster", label: "👥 Attendee Roster" },
          { id: "scanner", label: "📷 QR Gate Scanner" },
          { id: "users", label: "🛡️ Member Roles" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as Tab)}
            className={`border-t-[3px] border-x-[3px] border-b-[3px] px-5 py-2.5 font-display text-sm font-extrabold transition-transform ${
              tab === t.id
                ? "border-ink bg-bg -mb-[3px] z-10 shadow-[4px_0_0_var(--color-ink)]"
                : "border-transparent bg-panel2/60 text-muted hover:bg-panel2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === "overview" && (
        <section className="mt-8 space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Chapter Members"
              value={stats?.usersCount ?? "–"}
              subtitle="Registered students & leads"
              color="gblue"
            />
            <StatCard
              title="Total Events"
              value={stats ? `${stats.publishedEventsCount} / ${stats.eventsCount}` : "–"}
              subtitle="Published / Total logged"
              color="gred"
            />
            <StatCard
              title="Event Registrations"
              value={stats?.registrationsCount ?? "–"}
              subtitle="Active tickets claimed"
              color="gyellow"
            />
            <StatCard
              title="Attendance Rate"
              value={stats ? `${stats.attendanceRate}%` : "–"}
              subtitle={`${stats?.attendedCount ?? 0} attendees verified`}
              color="ggreen"
            />
          </div>

          {/* Quick Actions & Recent Events Summary */}
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="border-[3px] border-ink bg-bg p-6 shadow-[6px_6px_0_var(--color-ink)] lg:col-span-2">
              <div className="flex items-center justify-between border-b-2 border-ink pb-3">
                <h2 className="font-display text-xl font-black">Upcoming & Active Events</h2>
                <button
                  type="button"
                  onClick={() => setTab("events")}
                  className="font-mono text-xs font-bold text-gblue hover:underline"
                >
                  View all ({events.length}) →
                </button>
              </div>
              <div className="mt-4 divide-y-2 divide-ink/10">
                {events.slice(0, 5).map((ev) => (
                  <div key={ev._id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            ev.cancelled ? "bg-gred" : ev.published ? "bg-ggreen" : "bg-gyellow"
                          }`}
                        />
                        <span className="font-display font-extrabold">{ev.title}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        {formatEventTime(ev.startsAt)} · {ev.venue || "Online"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted">
                        Cap: {ev.registeredCount ?? 0} / {ev.capacity ?? "∞"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(ev._id);
                          setTab("roster");
                        }}
                        className="hard-button bg-panel px-3 py-1 font-mono text-xs font-bold"
                      >
                        Roster
                      </button>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="py-8 text-center font-mono text-sm text-muted">
                    No events currently configured. Click "+ Create New Event" to schedule one.
                  </p>
                )}
              </div>
            </div>

            <div className="border-[3px] border-ink bg-bg p-6 shadow-[6px_6px_0_var(--color-ink)]">
              <h2 className="border-b-2 border-ink pb-3 font-display text-xl font-black">
                Quick Gate Launch
              </h2>
              <p className="mt-3 text-sm text-muted">
                On event day, gate volunteers can open the instant QR attendance scanner to verify tickets.
              </p>
              <button
                type="button"
                onClick={() => setTab("scanner")}
                className={`${buttonPrimary} mt-6 w-full text-center`}
              >
                Launch QR Scanner →
              </button>
              <button
                type="button"
                onClick={() => setTab("users")}
                className={`${buttonGhost} mt-3 w-full text-center`}
              >
                Manage Member Roles →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: EVENTS MANAGER */}
      {tab === "events" && (
        <section className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">All Chapter Events ({events.length})</h2>
            <button
              type="button"
              onClick={() => {
                setEventFormData({
                  title: "",
                  summary: "",
                  description: "",
                  startsAt: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
                  endsAt: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString().slice(0, 16),
                  venue: "PSIT Block C Lab",
                  category: "Workshop",
                  format: "in_person",
                  host: "GDGoC PSIT Core Team",
                  prerequisites: "Laptop required.",
                  capacity: 60,
                  published: true,
                  meetingUrl: "",
                });
                setIsEditingEvent(true);
              }}
              className={buttonPrimary}
            >
              + Create Event
            </button>
          </div>

          <div className="overflow-x-auto border-[3px] border-ink bg-bg shadow-[6px_6px_0_var(--color-ink)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[3px] border-ink bg-panel2/40 font-mono text-xs uppercase tracking-wider text-ink">
                  <th className="p-3.5">Title & Format</th>
                  <th className="p-3.5">Schedule</th>
                  <th className="p-3.5">Venue / Link</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Capacity</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink/10 font-body text-sm">
                {events.map((ev) => (
                  <tr key={ev._id} className="hover:bg-panel/40">
                    <td className="p-3.5">
                      <p className="font-display font-extrabold text-ink">{ev.title}</p>
                      <span className="font-mono text-xs text-muted">
                        {ev.category} · {ev.format === "online" ? "🌐 Online" : "📍 In Person"}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-xs">
                      {formatEventTime(ev.startsAt)}
                    </td>
                    <td className="p-3.5 font-mono text-xs text-muted">
                      {ev.venue || (ev.meetingUrl ? "Meeting Link Set" : "–")}
                    </td>
                    <td className="p-3.5">
                      {ev.cancelled ? (
                        <span className="inline-block border border-ink bg-gred px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          Cancelled
                        </span>
                      ) : ev.published ? (
                        <span className="inline-block border border-ink bg-ggreen px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                          Published
                        </span>
                      ) : (
                        <span className="inline-block border border-ink bg-gyellow px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-xs">
                      {ev.registeredCount ?? 0} / {ev.capacity ?? "∞"}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventId(ev._id);
                            setTab("roster");
                          }}
                          className="hard-button bg-gyellow px-2.5 py-1 font-mono text-xs font-bold"
                          title="View attendee roster"
                        >
                          Roster
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEventFormData({
                              ...ev,
                              startsAt: ev.startsAt ? new Date(ev.startsAt).toISOString().slice(0, 16) : "",
                              endsAt: ev.endsAt ? new Date(ev.endsAt).toISOString().slice(0, 16) : "",
                              registrationDeadline: ev.registrationDeadline
                                ? new Date(ev.registrationDeadline).toISOString().slice(0, 16)
                                : "",
                            });
                            setIsEditingEvent(true);
                          }}
                          className="hard-button bg-bg px-2.5 py-1 font-mono text-xs font-bold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev._id, ev.title)}
                          className="hard-button bg-gred px-2.5 py-1 font-mono text-xs font-bold text-white"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: ATTENDEE ROSTER */}
      {tab === "roster" && (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <label className={labelClass}>Select Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className={`${inputClass} max-w-md font-bold`}
              >
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title} ({formatEventTime(ev.startsAt)})
                  </option>
                ))}
              </select>
            </div>

            {selectedEventId && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={getExportCsvUrl(selectedEventId)}
                  download
                  className={`${buttonPrimary} text-xs`}
                >
                  📥 Export CSV
                </a>
              </div>
            )}
          </div>

          {rosterData && (
            <div className="space-y-4">
              {/* Event Attendance Banner */}
              <div className="grid gap-4 sm:grid-cols-4 border-[3px] border-ink bg-bg p-4 shadow-[4px_4px_0_var(--color-ink)]">
                <div>
                  <span className="font-mono text-xs text-muted">Total Registered</span>
                  <p className="font-display text-2xl font-black">{rosterData.stats.total}</p>
                </div>
                <div>
                  <span className="font-mono text-xs text-muted">Confirmed</span>
                  <p className="font-display text-2xl font-black text-ggreen">
                    {rosterData.stats.confirmed}
                  </p>
                </div>
                <div>
                  <span className="font-mono text-xs text-muted">Checked In (Attended)</span>
                  <p className="font-display text-2xl font-black text-gblue">
                    {rosterData.stats.attended}
                  </p>
                </div>
                <div>
                  <span className="font-mono text-xs text-muted">Cancelled</span>
                  <p className="font-display text-2xl font-black text-gred">
                    {rosterData.stats.cancelled}
                  </p>
                </div>
              </div>

              {/* Search Filter */}
              <div className="max-w-md">
                <input
                  type="search"
                  placeholder="Filter attendees by name, email, or ticket ID…"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Attendees Table */}
              <div className="overflow-x-auto border-[3px] border-ink bg-bg shadow-[6px_6px_0_var(--color-ink)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-[3px] border-ink bg-panel2/40 font-mono text-xs uppercase text-ink">
                      <th className="p-3.5">Attendee</th>
                      <th className="p-3.5">Branch & Year</th>
                      <th className="p-3.5">Ticket ID</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Attended At</th>
                      <th className="p-3.5 text-right">Gate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-ink/10 font-body text-sm">
                    {rosterData.registrations
                      .filter((r) => {
                        const q = rosterSearch.toLowerCase();
                        return (
                          !q ||
                          r.user?.name.toLowerCase().includes(q) ||
                          r.user?.email.toLowerCase().includes(q) ||
                          r.ticketId.toLowerCase().includes(q)
                        );
                      })
                      .map((r) => (
                        <tr key={r._id} className="hover:bg-panel/40">
                          <td className="p-3.5">
                            <p className="font-display font-extrabold">{r.user?.name || "Unknown"}</p>
                            <p className="font-mono text-xs text-muted">{r.user?.email || "–"}</p>
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {r.user?.branch || "–"} {r.user?.year ? `(Yr ${r.user.year})` : ""}
                          </td>
                          <td className="p-3.5 font-mono text-xs font-bold text-muted">
                            {r.ticketId}
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {r.status === "confirmed" ? (
                              <span className="text-ggreen font-bold">Confirmed</span>
                            ) : (
                              <span className="text-gred font-bold">Cancelled</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {r.attendedAt ? (
                              <span className="text-gblue font-bold">
                                ✓ {new Date(r.attendedAt).toLocaleTimeString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-muted">–</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleManualCheckIn(r._id, Boolean(r.attendedAt))}
                              className={`hard-button px-3 py-1 font-mono text-xs font-bold ${
                                r.attendedAt ? "bg-panel2 text-ink" : "bg-ggreen text-ink"
                              }`}
                            >
                              {r.attendedAt ? "Undo Check-in" : "Mark Present"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    {rosterData.registrations.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center font-mono text-sm text-muted">
                          No registrations found for this event.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: QR SCANNER */}
      {tab === "scanner" && (
        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Scan Controls & Manual Input */}
          <div className="space-y-6">
            <div className="border-[3px] border-ink bg-bg p-6 shadow-[6px_6px_0_var(--color-ink)]">
              <h2 className="font-display text-xl font-black">Gate Ticket Validator</h2>
              <p className="mt-1 text-sm text-muted">
                Scan attendee QR code or type / paste Ticket ID directly. Attendance is marked instantly.
              </p>

              <form onSubmit={handleScanSubmit} className="mt-6 space-y-4">
                <div>
                  <label className={labelClass}>Ticket ID or QR string</label>
                  <input
                    type="text"
                    placeholder="e.g. j1A8B... (16-22 chars base64url)"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className={`${inputClass} text-base font-bold`}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isScanning || !scanInput.trim()}
                    className={`${buttonPrimary} flex-1`}
                  >
                    {isScanning ? "Verifying…" : "Verify & Admit Attendee"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={buttonGhost}
                  >
                    {cameraActive ? "Turn Off Camera" : "📷 Toggle Camera"}
                  </button>
                </div>
              </form>

              {cameraActive && (
                <div className="mt-6 border-[3px] border-ink bg-black p-2">
                  <video
                    ref={videoRef}
                    className="w-full aspect-video object-cover"
                    playsInline
                    muted
                  />
                  <p className="mt-2 text-center font-mono text-xs text-white">
                    Aim camera at attendee's ticket screen.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Scan Results Card */}
          <div>
            {scanResult ? (
              <div
                className={`border-[4px] border-ink p-8 shadow-[8px_8px_0_var(--color-ink)] ${
                  scanResult.status === "admitted"
                    ? "bg-ggreen/20"
                    : scanResult.status === "already_attended"
                    ? "bg-gyellow/20"
                    : "bg-gred/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-block border-2 border-ink px-3 py-1 font-mono text-xs font-black uppercase ${
                      scanResult.status === "admitted"
                        ? "bg-ggreen text-ink"
                        : scanResult.status === "already_attended"
                        ? "bg-gyellow text-ink"
                        : "bg-gred text-white"
                    }`}
                  >
                    {scanResult.status === "admitted"
                      ? "✓ Admitted"
                      : scanResult.status === "already_attended"
                      ? "⚠️ Duplicate Scan"
                      : "✕ Admission Denied"}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {new Date().toLocaleTimeString("en-IN")}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-2xl font-black">
                  {scanResult.user?.name || "Unknown Attendee"}
                </h3>
                <p className="font-mono text-sm text-ink/80">{scanResult.user?.email}</p>

                {scanResult.event && (
                  <div className="mt-4 border-t-2 border-ink/20 pt-3">
                    <p className="font-mono text-xs text-muted uppercase">Event Details</p>
                    <p className="font-display font-bold text-lg">{scanResult.event.title}</p>
                    <p className="font-mono text-xs text-muted">{scanResult.event.venue}</p>
                  </div>
                )}

                <div className="mt-6 border-t-2 border-ink/20 pt-4">
                  <p className="font-mono text-sm font-bold">{scanResult.message}</p>
                </div>
              </div>
            ) : (
              <div className="border-[3px] border-dashed border-ink/40 p-12 text-center">
                <p className="font-display text-xl font-bold text-muted">
                  No ticket currently active in scanner.
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  Type a ticket ID or scan a barcode/QR to review credential validation.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 5: MEMBERS & ROLES */}
      {tab === "users" && (
        <section className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">Member Directory ({users.length})</h2>
          </div>

          <div className="overflow-x-auto border-[3px] border-ink bg-bg shadow-[6px_6px_0_var(--color-ink)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[3px] border-ink bg-panel2/40 font-mono text-xs uppercase text-ink">
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Branch & Year</th>
                  <th className="p-3.5">Current Role</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink/10 font-body text-sm">
                {users.map((u) => (
                  <tr key={u.email} className="hover:bg-panel/40">
                    <td className="p-3.5 font-display font-extrabold">{u.name}</td>
                    <td className="p-3.5 font-mono text-xs text-muted">{u.email}</td>
                    <td className="p-3.5 font-mono text-xs">
                      {u.branch || "–"} {u.year ? `(Yr ${u.year})` : ""}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block border border-ink px-2 py-0.5 font-mono text-[11px] font-bold ${
                          u.role === "admin" ? "bg-gred text-white" : "bg-panel2 text-ink"
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRoleChange(u.email, u.role)}
                        className="hard-button bg-bg px-3 py-1 font-mono text-xs font-bold"
                      >
                        {u.role === "admin" ? "Demote to Student" : "Promote to Admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {isEditingEvent && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-2xl border-[4px] border-ink bg-bg p-6 sm:p-8 shadow-[12px_12px_0_var(--color-ink)]">
            <div className="flex items-center justify-between border-b-2 border-ink pb-4">
              <h2 className="font-display text-2xl font-black">
                {eventFormData._id ? "Edit Event" : "Create New Chapter Event"}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditingEvent(false)}
                className="font-mono text-lg font-bold hover:text-gred"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="mt-6 space-y-4">
              <div>
                <label className={labelClass}>Event Title *</label>
                <input
                  type="text"
                  required
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Cloud Study Jam #4"
                />
              </div>

              <div>
                <label className={labelClass}>Summary (Short card description)</label>
                <input
                  type="text"
                  value={eventFormData.summary}
                  onChange={(e) => setEventFormData({ ...eventFormData, summary: e.target.value })}
                  className={inputClass}
                  placeholder="Hands-on labs and skill badges"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Starts At (IST) *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventFormData.startsAt}
                    onChange={(e) => setEventFormData({ ...eventFormData, startsAt: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ends At (Optional)</label>
                  <input
                    type="datetime-local"
                    value={eventFormData.endsAt || ""}
                    onChange={(e) => setEventFormData({ ...eventFormData, endsAt: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Format</label>
                  <select
                    value={eventFormData.format}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, format: e.target.value as any })
                    }
                    className={inputClass}
                  >
                    <option value="in_person">In Person</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input
                    type="text"
                    value={eventFormData.category}
                    onChange={(e) => setEventFormData({ ...eventFormData, category: e.target.value })}
                    className={inputClass}
                    placeholder="Workshop, Study Jam…"
                  />
                </div>
                <div>
                  <label className={labelClass}>Capacity (Seats)</label>
                  <input
                    type="number"
                    min="1"
                    value={eventFormData.capacity ?? ""}
                    onChange={(e) =>
                      setEventFormData({
                        ...eventFormData,
                        capacity: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={inputClass}
                    placeholder="Unlimited if empty"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Venue Location or Google Meet URL</label>
                <input
                  type="text"
                  value={eventFormData.venue}
                  onChange={(e) => setEventFormData({ ...eventFormData, venue: e.target.value })}
                  className={inputClass}
                  placeholder="PSIT Block C Lab or Online link"
                />
              </div>

              {eventFormData.format === "online" && (
                <div>
                  <label className={labelClass}>Meeting URL (Shared only with registered attendees)</label>
                  <input
                    type="url"
                    value={eventFormData.meetingUrl || ""}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, meetingUrl: e.target.value })
                    }
                    className={inputClass}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Description & Agenda</label>
                <textarea
                  rows={4}
                  value={eventFormData.description}
                  onChange={(e) =>
                    setEventFormData({ ...eventFormData, description: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Detailed schedule, speaker bio, prerequisites…"
                />
              </div>

              <div className="flex items-center gap-6 border-t-2 border-ink pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventFormData.published}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, published: e.target.checked })
                    }
                    className="h-4 w-4 border-2 border-ink accent-ggreen"
                  />
                  <span className="font-mono text-xs font-bold uppercase">Publish to Public Board</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventFormData.cancelled}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, cancelled: e.target.checked })
                    }
                    className="h-4 w-4 border-2 border-ink accent-gred"
                  />
                  <span className="font-mono text-xs font-bold uppercase text-gred">Mark Cancelled</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-ink">
                <button
                  type="button"
                  onClick={() => setIsEditingEvent(false)}
                  className={buttonGhost}
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className={buttonPrimary}>
                  {loading ? "Saving…" : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  color: "gblue" | "gred" | "gyellow" | "ggreen";
}) {
  const topColors = {
    gblue: "bg-gblue",
    gred: "bg-gred",
    gyellow: "bg-gyellow",
    ggreen: "bg-ggreen",
  };

  return (
    <div className="relative border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)]">
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${topColors[color]}`} />
      <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
        {title}
      </span>
      <p className="mt-2 font-display text-3xl font-black">{value}</p>
      <span className="mt-1 block font-mono text-xs text-muted">{subtitle}</span>
    </div>
  );
}
