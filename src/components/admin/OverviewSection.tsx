import { useState, useEffect } from "react";
import {
  Calendar,
  Layers,
  Users,
  QrCode,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { adminApi, type DashboardMetrics } from "../../lib/admin";
import { Skeleton, ErrorAlert, EmptyState } from "./AdminUi";

export default function OverviewSection({
  onNavigate,
  onOpenCreateEvent,
  onOpenCreateProject,
}: {
  onNavigate: (tab: "overview" | "events" | "projects" | "registrations" | "attendance") => void;
  onOpenCreateEvent: () => void;
  onOpenCreateProject: () => void;
}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = () => {
    setLoading(true);
    setError(null);
    adminApi<DashboardMetrics>("/metrics")
      .then((data) => {
        setMetrics(data);
      })
      .catch((err) => {
        setError(err.message || "Failed to load dashboard metrics.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time status of GDGoC community events, projects, attendance and registrations.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="hard-button inline-flex items-center gap-1.5 px-3.5 py-2 bg-gblue text-white font-display text-xs sm:text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span>New Event</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateProject}
            className="hard-button inline-flex items-center gap-1.5 px-3.5 py-2 bg-gyellow text-ink font-display text-xs sm:text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>New Project</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("attendance")}
            className="hard-button inline-flex items-center gap-1.5 px-3.5 py-2 bg-ggreen text-white font-display text-xs sm:text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>QR Scanner</span>
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchMetrics} />}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Published Events */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("events")}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("events")}
          className="group relative p-5 bg-white border-2 border-ink shadow-[4px_4px_0_#202124] hover:shadow-[6px_6px_0_#202124] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 border-2 border-ink bg-wash-blue text-gblue">
              <Calendar className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted group-hover:text-ink">
              Manage <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Published Events</p>
          <div className="mt-1 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="font-display text-3xl font-black text-ink">
                {metrics?.totalPublishedEvents ?? 0}
              </span>
            )}
            <span className="text-xs text-muted">
              ({metrics?.upcomingEvents ?? 0} upcoming)
            </span>
          </div>
        </div>

        {/* Total Projects */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("projects")}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("projects")}
          className="group relative p-5 bg-white border-2 border-ink shadow-[4px_4px_0_#202124] hover:shadow-[6px_6px_0_#202124] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 border-2 border-ink bg-wash-yellow text-gyellow">
              <Layers className="w-5 h-5 text-ink" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted group-hover:text-ink">
              View <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Projects</p>
          <div className="mt-1 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="font-display text-3xl font-black text-ink">
                {metrics?.totalProjects ?? 0}
              </span>
            )}
            <span className="text-xs text-muted">
              ({metrics?.ongoingProjects ?? 0} ongoing · {metrics?.completedProjects ?? 0} completed)
            </span>
          </div>
        </div>

        {/* Confirmed Registrations */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("registrations")}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("registrations")}
          className="group relative p-5 bg-white border-2 border-ink shadow-[4px_4px_0_#202124] hover:shadow-[6px_6px_0_#202124] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 border-2 border-ink bg-wash-green text-ggreen">
              <Users className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted group-hover:text-ink">
              Explore <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Confirmed Registrations</p>
          <div className="mt-1 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="font-display text-3xl font-black text-ink">
                {metrics?.confirmedRegistrations ?? 0}
              </span>
            )}
            <span className="text-xs text-muted">
              ({metrics?.uniqueRegisteredMembers ?? 0} unique students)
            </span>
          </div>
        </div>

        {/* Checked-In Attendance */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("attendance")}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("attendance")}
          className="group relative p-5 bg-white border-2 border-ink shadow-[4px_4px_0_#202124] hover:shadow-[6px_6px_0_#202124] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 border-2 border-ink bg-wash-red text-gred">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-muted group-hover:text-ink">
              Scanner <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Verified Attendees</p>
          <div className="mt-1 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="font-display text-3xl font-black text-ink">
                {metrics?.totalCheckedInAttendance ?? 0}
              </span>
            )}
            <span className="text-xs text-muted">
              admitted across sessions
            </span>
          </div>
        </div>

        {/* Registration Rate Indicator */}
        <div className="p-5 bg-panel border-2 border-ink shadow-[4px_4px_0_#202124] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Attendance Health</span>
              <Sparkles className="w-4 h-4 text-gblue" aria-hidden="true" />
            </div>
            <div className="mt-1">
              <span className="font-display text-2xl font-bold text-ink">
                {metrics?.confirmedRegistrations
                  ? Math.round(
                      ((metrics.totalCheckedInAttendance || 0) / metrics.confirmedRegistrations) * 100
                    )
                  : 0}
                %
              </span>
              <p className="text-xs text-muted mt-1">Average turnout relative to confirmed seats</p>
            </div>
          </div>
          <div className="w-full bg-line h-2 mt-4 border border-ink overflow-hidden">
            <div
              className="bg-ggreen h-full transition-all duration-500"
              style={{
                width: `${
                  metrics?.confirmedRegistrations
                    ? Math.min(
                        100,
                        Math.round(
                          ((metrics.totalCheckedInAttendance || 0) / metrics.confirmedRegistrations) * 100
                        )
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Security & Audit Summary */}
        <div className="p-5 bg-panel border-2 border-ink shadow-[4px_4px_0_#202124] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Audit & Integrity</span>
            <ShieldCheck className="w-5 h-5 text-ggreen" aria-hidden="true" />
          </div>
          <p className="text-xs text-muted">
            All check-ins, status transitions, and CSV exports are cryptographically signed and logged with actor IDs.
          </p>
          <div className="mt-3 text-xs font-bold text-ink flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-ggreen shrink-0" aria-hidden="true" />
            <span>Tamper-evident Audit Trail Active</span>
          </div>
        </div>
      </div>

      {/* Recent Administrative Activity Feed */}
      <div className="bg-white border-2 border-ink shadow-[4px_4px_0_#202124] p-6">
        <div className="flex items-center justify-between mb-6 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-ink">
              Recent Administrative Activity
            </h2>
          </div>
          <span className="text-xs font-bold text-muted bg-panel px-2.5 py-1 border border-ink">
            Audit Trail
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-line">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : !metrics?.recentActivity || metrics.recentActivity.length === 0 ? (
          <EmptyState
            title="No activity recorded yet"
            description="Mutations on events, projects, check-ins, and data exports will appear here automatically."
          />
        ) : (
          <div className="divide-y divide-line">
            {metrics.recentActivity.map((act) => {
              const dateStr = new Date(act.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={act._id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-panel/50 px-2 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-gblue shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-ink">{act.summary}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                        <span>By {act.actorName}</span>
                        <span>•</span>
                        <span className="capitalize border border-line px-1.5 py-0.2 bg-panel text-ink">
                          {act.actorRole}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">{act.action}</span>
                      </div>
                    </div>
                  </div>
                  <time className="text-xs text-muted font-mono shrink-0 self-start sm:self-auto pl-5 sm:pl-0">
                    {dateStr}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
