import { useState, useEffect, useRef } from "react";
import {
  Search,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import {
  adminApi,
  downloadCsv,
  type AdminEvent,
  type AdminRegistration,
  type EventStats,
} from "../../lib/admin";
import { StatusBadge, Skeleton, EmptyState, ErrorAlert } from "./AdminUi";

export default function RegistrationsSection() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [stats, setStats] = useState<EventStats | null>(null);

  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [checkedInFilter, setCheckedInFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load event list for selector
  useEffect(() => {
    adminApi<{ events: AdminEvent[] }>("/events?limit=100")
      .then((res) => {
        setEvents(res.events);
        if (res.events.length > 0 && !selectedEventId) {
          setSelectedEventId(res.events[0]._id || res.events[0].id || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load events for selector:", err);
      });
  }, []);

  // Fetch stats for selected event
  const fetchStats = (eventId: string) => {
    if (!eventId) {
      setStats(null);
      return;
    }
    adminApi<EventStats>(`/events/${eventId}/stats`)
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        setStats(null);
      });
  };

  // Fetch registrations
  const fetchRegistrations = (targetPage = page) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("limit", "15");
    if (selectedEventId) params.set("eventId", selectedEventId);
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("registrationStatus", statusFilter);
    if (checkedInFilter) params.set("checkedIn", checkedInFilter);

    adminApi<{
      registrations: AdminRegistration[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/registrations?${params.toString()}`)
      .then((res) => {
        setRegistrations(res.registrations);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      })
      .catch((err) => {
        setError(err.message || "Failed to load registrations.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchStats(selectedEventId);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRegistrations(1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedEventId, search, statusFilter, checkedInFilter]);

  const handleExportCsv = () => {
    if (!selectedEventId) {
      alert("Please select a specific event from the dropdown to export its attendee CSV.");
      return;
    }

    setExporting(true);
    try {
      downloadCsv(selectedEventId, {
        registrationStatus: statusFilter,
        checkedIn: checkedInFilter,
        search: search.trim(),
      });
    } catch (err: any) {
      alert(err.message || "Export failed.");
    } finally {
      setTimeout(() => setExporting(false), 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Registrations & Statistics
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time student registrations, seat capacity tracking, attendance ratios and CSV export.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting || !selectedEventId}
          className="hard-button inline-flex items-center gap-2 px-4 py-2 bg-ggreen text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 self-start md:self-auto"
        >
          {exporting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{exporting ? "Generating CSV..." : "Export Filtered CSV"}</span>
        </button>
      </div>

      {/* Event Selector & Live Metrics Bar */}
      <div className="bg-white border-2 border-ink shadow-[4px_4px_0_#202124] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label htmlFor="event-selector" className="font-display text-sm font-bold text-ink flex items-center gap-2">
            <span>Active Event Scope:</span>
          </label>
          <select
            id="event-selector"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 bg-panel border-2 border-ink text-sm font-bold text-ink focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">-- All Events Combined --</option>
            {events.map((ev) => (
              <option key={ev._id || ev.id} value={ev._id || ev.id}>
                {ev.title} ({ev.status || (ev.published ? "published" : "draft")})
              </option>
            ))}
          </select>
        </div>

        {/* Live Event Summary Metrics Bar */}
        {selectedEventId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-line">
            <div className="p-3 bg-panel border border-ink">
              <span className="text-[11px] font-bold uppercase text-muted block">Total Seats</span>
              <span className="font-display text-xl font-black text-ink">{stats?.capacity ?? "∞"}</span>
            </div>

            <div className="p-3 bg-wash-blue border border-ink">
              <span className="text-[11px] font-bold uppercase text-gblue block">Confirmed</span>
              <span className="font-display text-xl font-black text-ink">
                {stats?.confirmedRegistrations ?? 0}
              </span>
            </div>

            <div className="p-3 bg-panel border border-ink">
              <span className="text-[11px] font-bold uppercase text-muted block">Available</span>
              <span className="font-display text-xl font-black text-ink">
                {stats?.availableCapacity ?? 0}
              </span>
            </div>

            <div className="p-3 bg-wash-green border border-ink">
              <span className="text-[11px] font-bold uppercase text-ggreen block">Checked In</span>
              <span className="font-display text-xl font-black text-ink">
                {stats?.checkedInAttendees ?? 0}
              </span>
            </div>

            <div className="p-3 bg-wash-yellow border border-ink">
              <span className="text-[11px] font-bold uppercase text-ink block">Attendance %</span>
              <span className="font-display text-xl font-black text-ink">
                {stats?.attendancePercentage ?? 0}%
              </span>
            </div>

            <div className="p-3 bg-wash-red border border-ink">
              <span className="text-[11px] font-bold uppercase text-gred block">Cancelled</span>
              <span className="font-display text-xl font-black text-ink">
                {stats?.cancelledRegistrations ?? 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-panel border-2 border-ink shadow-[3px_3px_0_#202124] grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <label htmlFor="reg-search" className="sr-only">
            Search registrations
          </label>
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reg-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, roll no, ticket ID..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          />
        </div>

        <div>
          <label htmlFor="reg-status" className="sr-only">
            Registration Status
          </label>
          <select
            id="reg-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Registration Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="reg-checkin" className="sr-only">
            Attendance Status
          </label>
          <select
            id="reg-checkin"
            value={checkedInFilter}
            onChange={(e) => setCheckedInFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Attendance Statuses</option>
            <option value="true">Checked In</option>
            <option value="false">Not Checked In</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => fetchRegistrations()} />}

      {/* Registrations Table */}
      <div className="bg-white border-2 border-ink shadow-[4px_4px_0_#202124] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-line">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No registrations found"
              description="No attendee records match the active event and filter combination."
              actionLabel={search || statusFilter || checkedInFilter ? "Clear Filters" : undefined}
              onAction={() => {
                setSearch("");
                setStatusFilter("");
                setCheckedInFilter("");
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-panel border-b-2 border-ink text-xs font-bold text-muted uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-ink">Participant</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Event Title</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Reference & Ticket</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Registered At</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Ticket Status</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {registrations.map((r) => {
                  const isCheckedIn = r.checkedIn || r.attendedAt !== null;
                  const regDateVal = r.registeredAt || r.createdAt;
                  const regDate = regDateVal
                    ? new Date(regDateVal).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A";

                  const checkInVal = r.checkedInAt || r.attendedAt;
                  const checkInTime = checkInVal
                    ? new Date(checkInVal).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;

                  return (
                    <tr key={r._id || r.id} className="hover:bg-panel/50 transition-colors">
                      {/* Participant */}
                      <td className="py-3.5 px-4">
                        <div className="font-display font-bold text-ink">
                          {r.user?.name || "Anonymous Member"}
                        </div>
                        <div className="text-xs text-muted font-mono">{r.user?.email || "No email"}</div>
                        {r.user?.enrollmentNo && (
                          <div className="text-[11px] text-ink-2 font-mono mt-0.5">
                            Roll: {r.user.enrollmentNo}
                          </div>
                        )}
                      </td>

                      {/* Event Title */}
                      <td className="py-3.5 px-4 text-xs font-bold text-ink">
                        {r.event?.title || "Event details unavailable"}
                      </td>

                      {/* Reference & Ticket */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <div className="font-bold text-gblue">{r.registrationReference}</div>
                        <div className="text-[11px] text-muted truncate max-w-[140px]">
                          Code: {r.ticketId}
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-xs text-muted font-mono">
                        {regDate}
                      </td>

                      {/* Ticket Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={r.ticketStatus || "active"} />
                      </td>

                      {/* Attendance Status */}
                      <td className="py-3.5 px-4">
                        {isCheckedIn ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold border border-ink bg-wash-green text-ink">
                              <CheckCircle className="w-3.5 h-3.5 text-ggreen" aria-hidden="true" />
                              <span>Checked In</span>
                            </span>
                            {checkInTime && (
                              <div className="text-[10px] text-muted font-mono mt-0.5">
                                at {checkInTime}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold border border-line bg-panel2 text-muted">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Not Checked In</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t-2 border-ink bg-panel flex items-center justify-between text-xs">
            <span className="text-muted">
              Page {page} of {totalPages} ({total} registrations)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchRegistrations(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => fetchRegistrations(page + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
