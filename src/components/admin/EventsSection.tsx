import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MapPin,
  Clock,
} from "lucide-react";
import {
  adminApi,
  type AdminEvent,
  type EventStatus,
  type EventFormat,
} from "../../lib/admin";
import { StatusBadge, Skeleton, EmptyState, ErrorAlert, Modal } from "./AdminUi";

interface EventFormData {
  title: string;
  shortDescription: string;
  fullDescription: string;
  startDate: string;
  endDate: string;
  venue: string;
  onlineLink: string;
  posterUrl: string;
  category: string;
  format: EventFormat;
  speakers: string;
  capacity: string;
  registrationDeadline: string;
  status: EventStatus;
  participationInstructions: string;
}

const initialForm: EventFormData = {
  title: "",
  shortDescription: "",
  fullDescription: "",
  startDate: "",
  endDate: "",
  venue: "",
  onlineLink: "",
  posterUrl: "",
  category: "Technical Workshop",
  format: "in_person",
  speakers: "",
  capacity: "100",
  registrationDeadline: "",
  status: "draft",
  participationInstructions: "",
};

export default function EventsSection({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("startDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal State
  const [editEvent, setEditEvent] = useState<AdminEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Cancel Confirmation Modal State
  const [eventToCancel, setEventToCancel] = useState<AdminEvent | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Search debounce ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEvents = (targetPage = page) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("limit", "8");
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);

    adminApi<{
      events: AdminEvent[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/events?${params.toString()}`, "GET", undefined, abortControllerRef.current.signal)
      .then((res) => {
        setEvents(res.events);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load events.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEvents(1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [search, statusFilter, categoryFilter, sortBy, sortOrder]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Open Create Modal
  useEffect(() => {
    if (createOpen) {
      setEditEvent(null);
      setFormData(initialForm);
      setFormErrors({});
      setServerError(null);
    }
  }, [createOpen]);

  // Open Edit Modal
  const handleOpenEdit = (ev: AdminEvent) => {
    setEditEvent(ev);
    const startVal = ev.startDate || ev.startsAt;
    const endVal = ev.endDate || ev.endsAt;
    setFormData({
      title: ev.title || "",
      shortDescription: ev.shortDescription || ev.summary || "",
      fullDescription: ev.fullDescription || ev.description || "",
      startDate: startVal ? new Date(startVal).toISOString().slice(0, 16) : "",
      endDate: endVal ? new Date(endVal).toISOString().slice(0, 16) : "",
      venue: ev.venue || "",
      onlineLink: ev.onlineLink || ev.meetingUrl || "",
      posterUrl: ev.posterUrl || ev.poster || "",
      category: ev.category || "General",
      format: ev.format || "in_person",
      speakers: ev.speakers || ev.host || "",
      capacity: String(ev.capacity || 100),
      registrationDeadline: ev.registrationDeadline
        ? new Date(ev.registrationDeadline).toISOString().slice(0, 16)
        : "",
      status: ev.status || (ev.published ? "published" : "draft"),
      participationInstructions: ev.participationInstructions || ev.prerequisites || "",
    });
    setFormErrors({});
    setServerError(null);
  };

  const handleCloseModal = () => {
    setEditEvent(null);
    onCloseCreate();
  };

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim() || formData.title.trim().length < 2) {
      errs.title = "Title is required (at least 2 characters).";
    }
    if (!formData.shortDescription.trim() || formData.shortDescription.trim().length < 5) {
      errs.shortDescription = "Short description must be at least 5 characters.";
    }
    if (!formData.startDate) {
      errs.startDate = "Event start date and time is required.";
    }
    if (formData.endDate && formData.startDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        errs.endDate = "End date must be on or after start date.";
      }
    }
    if (formData.registrationDeadline && formData.startDate) {
      if (new Date(formData.registrationDeadline) > new Date(formData.startDate)) {
        errs.registrationDeadline = "Registration deadline cannot be after start date.";
      }
    }
    const capNum = Number(formData.capacity);
    if (!formData.capacity || isNaN(capNum) || capNum < 1 || !Number.isInteger(capNum)) {
      errs.capacity = "Capacity must be an integer >= 1.";
    }
    if (!formData.category.trim()) {
      errs.category = "Category is required.";
    }
    if (formData.onlineLink && !/^https?:\/\/\S+$/i.test(formData.onlineLink.trim())) {
      errs.onlineLink = "Online meeting link must start with http:// or https://";
    }
    if (formData.posterUrl && !/^https?:\/\/\S+$/i.test(formData.posterUrl.trim())) {
      errs.posterUrl = "Poster URL must start with http:// or https://";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit form (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const payload = {
      ...formData,
      capacity: Number(formData.capacity),
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      registrationDeadline: formData.registrationDeadline
        ? new Date(formData.registrationDeadline).toISOString()
        : null,
    };

    try {
      if (editEvent) {
        await adminApi(`/events/${editEvent._id || editEvent.id}`, "PATCH", payload);
        showToast(`Event "${formData.title}" updated successfully.`);
      } else {
        await adminApi("/events", "POST", payload);
        showToast(`Event "${formData.title}" created successfully.`);
      }
      handleCloseModal();
      fetchEvents();
    } catch (err: any) {
      setServerError(err.message || "Failed to save event. Inputs preserved for retry.");
      if (err.errors) setFormErrors(err.errors);
    } finally {
      setSubmitting(false);
    }
  };

  // Publish Quick Action
  const handlePublishEvent = async (ev: AdminEvent) => {
    try {
      await adminApi(`/events/${ev._id || ev.id}/status`, "PATCH", { status: "published" });
      showToast(`Event "${ev.title}" is now published.`);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || "Could not publish event.");
    }
  };

  // Cancel Event Confirmation Action
  const handleConfirmCancelEvent = async () => {
    if (!eventToCancel) return;
    setCancelling(true);
    try {
      await adminApi(`/events/${eventToCancel._id || eventToCancel.id}/status`, "PATCH", {
        status: "cancelled",
      });
      showToast(`Event "${eventToCancel.title}" has been cancelled.`);
      setEventToCancel(null);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || "Failed to cancel event.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-wash-green border-2 border-ggreen text-ink text-sm font-bold flex items-center gap-2 shadow-[3px_3px_0_#34A853] animate-in fade-in"
        >
          <CheckCircle className="w-5 h-5 text-ggreen shrink-0" aria-hidden="true" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Event Management
          </h1>
          <p className="text-sm text-muted mt-1">
            Create, publish, edit and track lifecycle states across GDGoC chapter events ({total} total).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditEvent(null);
            setFormData(initialForm);
            setFormErrors({});
            setServerError(null);
            // Open modal via state
            setEditEvent({} as any);
          }}
          className="hard-button inline-flex items-center gap-1.5 px-4 py-2 bg-gblue text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform self-start md:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-panel border-2 border-ink shadow-[3px_3px_0_#202124] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search Input */}
        <div className="relative">
          <label htmlFor="event-search" className="sr-only">
            Search events
          </label>
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="event-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, venue, topic..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-ink text-sm text-ink placeholder:text-muted focus:outline-hidden focus:ring-2 focus:ring-gblue"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="event-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="event-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label htmlFor="event-category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="event-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Categories</option>
            <option value="Technical Workshop">Technical Workshop</option>
            <option value="Cloud">Cloud</option>
            <option value="AI / ML">AI / ML</option>
            <option value="Web & Mobile">Web & Mobile</option>
            <option value="Hackathon">Hackathon</option>
            <option value="Speaker Session">Speaker Session</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label htmlFor="event-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="event-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="startDate">Sort by Start Date</option>
            <option value="createdAt">Sort by Creation Date</option>
            <option value="title">Sort by Title</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            title={`Sort order: ${sortOrder}`}
            aria-label={`Toggle sort order, current ${sortOrder}`}
            className="p-2 bg-white border border-ink hover:bg-panel"
          >
            <ArrowUpDown className="w-4 h-4 text-ink" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => fetchEvents()} />}

      {/* Events Table Container */}
      <div className="bg-white border-2 border-ink shadow-[4px_4px_0_#202124] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-line">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No events found"
              description={
                search || statusFilter || categoryFilter
                  ? "No events matched your current filters. Try resetting search or filter options."
                  : "Start by organizing your first community event."
              }
              actionLabel={
                search || statusFilter || categoryFilter ? "Clear Filters" : "Create First Event"
              }
              onAction={() => {
                if (search || statusFilter || categoryFilter) {
                  setSearch("");
                  setStatusFilter("");
                  setCategoryFilter("");
                } else {
                  setEditEvent({} as any);
                  setFormData(initialForm);
                }
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-panel border-b-2 border-ink text-xs font-bold text-muted uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-ink">Event Title & Venue</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Dates</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Status</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Capacity & Fill</th>
                  <th className="py-3.5 px-4 font-bold text-ink text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {events.map((ev) => {
                  const startDateStr = new Date(ev.startDate || ev.startsAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  );
                  const isDraft = !ev.published && ev.status !== "cancelled";
                  const isCancelled = ev.cancelled || ev.status === "cancelled";
                  const fillPct = ev.capacity
                    ? Math.min(100, Math.round(((ev.registeredCount || 0) / ev.capacity) * 100))
                    : 0;

                  return (
                    <tr key={ev._id || ev.id} className="hover:bg-panel/50 transition-colors">
                      {/* Title & Category */}
                      <td className="py-3.5 px-4">
                        <div className="font-display font-bold text-ink flex items-center gap-2">
                          <span>{ev.title}</span>
                          {ev.format === "online" && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-wash-blue text-gblue border border-gblue">
                              Online
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted mt-1">
                          <span className="font-semibold text-ink-2">{ev.category}</span>
                          {ev.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted" aria-hidden="true" />
                              <span className="truncate max-w-[180px]">{ev.venue}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-ink font-semibold">
                          <Clock className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                          <span>{startDateStr}</span>
                        </div>
                        {ev.registrationDeadline && (
                          <div className="text-[11px] text-muted mt-0.5">
                            Closes: {new Date(ev.registrationDeadline).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={ev.status || (ev.published ? "published" : "draft")} />
                      </td>

                      {/* Capacity Bar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-baseline justify-between text-xs font-mono font-bold mb-1">
                          <span>
                            {ev.registeredCount || 0} / {ev.capacity || "∞"}
                          </span>
                          <span className="text-muted">{fillPct}%</span>
                        </div>
                        <div className="w-28 bg-line h-1.5 border border-line2 overflow-hidden">
                          <div
                            className={fillPct >= 100 ? "bg-gred h-full" : "bg-ggreen h-full"}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ev)}
                            className="p-1.5 text-ink border border-ink hover:bg-panel shadow-[1px_1px_0_#202124]"
                            title="Edit Event"
                            aria-label={`Edit ${ev.title}`}
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </button>

                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handlePublishEvent(ev)}
                              className="px-2.5 py-1 text-xs font-bold font-display bg-wash-green text-ggreen border border-ink hover:bg-ggreen hover:text-white transition-colors shadow-[1px_1px_0_#202124]"
                              title="Publish Event"
                            >
                              Publish
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => setEventToCancel(ev)}
                              className="px-2 py-1 text-xs font-bold font-display bg-wash-red text-gred border border-ink hover:bg-gred hover:text-white transition-colors shadow-[1px_1px_0_#202124]"
                              title="Cancel Event"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t-2 border-ink bg-panel flex items-center justify-between text-xs">
            <span className="text-muted">
              Page {page} of {totalPages} ({total} events)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchEvents(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => fetchEvents(page + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT EVENT MODAL */}
      <Modal
        isOpen={Boolean(editEvent || createOpen)}
        onClose={handleCloseModal}
        title={editEvent && editEvent._id ? `Edit Event: ${editEvent.title}` : "Create Community Event"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {serverError && <ErrorAlert message={serverError} />}

          {/* Title */}
          <div>
            <label htmlFor="ev-title" className="block text-xs font-bold text-ink uppercase mb-1">
              Event Title <span className="text-gred">*</span>
            </label>
            <input
              id="ev-title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Google Cloud & Kubernetes Workshop"
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
            {formErrors.title && <p className="text-xs text-gred mt-1 font-semibold">{formErrors.title}</p>}
          </div>

          {/* Short Description */}
          <div>
            <label htmlFor="ev-shortDesc" className="block text-xs font-bold text-ink uppercase mb-1">
              Short Description / Summary <span className="text-gred">*</span>
            </label>
            <textarea
              id="ev-shortDesc"
              rows={2}
              required
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="A concise 1-2 sentence overview shown in event preview cards..."
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
            {formErrors.shortDescription && (
              <p className="text-xs text-gred mt-1 font-semibold">{formErrors.shortDescription}</p>
            )}
          </div>

          {/* Full Description */}
          <div>
            <label htmlFor="ev-fullDesc" className="block text-xs font-bold text-ink uppercase mb-1">
              Full Description & Agenda
            </label>
            <textarea
              id="ev-fullDesc"
              rows={4}
              value={formData.fullDescription}
              onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
              placeholder="Detailed schedule, prerequisites, what attendees will learn..."
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
          </div>

          {/* Date Range & Deadline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="ev-startDate" className="block text-xs font-bold text-ink uppercase mb-1">
                Start Date & Time <span className="text-gred">*</span>
              </label>
              <input
                id="ev-startDate"
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-xs focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.startDate && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.startDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="ev-endDate" className="block text-xs font-bold text-ink uppercase mb-1">
                End Date & Time
              </label>
              <input
                id="ev-endDate"
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-xs focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.endDate && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.endDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="ev-deadline" className="block text-xs font-bold text-ink uppercase mb-1">
                Registration Deadline
              </label>
              <input
                id="ev-deadline"
                type="datetime-local"
                value={formData.registrationDeadline}
                onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-xs focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.registrationDeadline && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.registrationDeadline}</p>
              )}
            </div>
          </div>

          {/* Category, Format, Capacity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="ev-category" className="block text-xs font-bold text-ink uppercase mb-1">
                Category <span className="text-gred">*</span>
              </label>
              <select
                id="ev-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              >
                <option value="Technical Workshop">Technical Workshop</option>
                <option value="Cloud">Cloud</option>
                <option value="AI / ML">AI / ML</option>
                <option value="Web & Mobile">Web & Mobile</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Speaker Session">Speaker Session</option>
                <option value="Open Source">Open Source</option>
              </select>
            </div>

            <div>
              <label htmlFor="ev-format" className="block text-xs font-bold text-ink uppercase mb-1">
                Format
              </label>
              <select
                id="ev-format"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value as EventFormat })}
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              >
                <option value="in_person">In-Person (Offline)</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label htmlFor="ev-capacity" className="block text-xs font-bold text-ink uppercase mb-1">
                Seat Capacity <span className="text-gred">*</span>
              </label>
              <input
                id="ev-capacity"
                type="number"
                min="1"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.capacity && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.capacity}</p>
              )}
            </div>
          </div>

          {/* Venue & Online Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ev-venue" className="block text-xs font-bold text-ink uppercase mb-1">
                Physical Venue / Room
              </label>
              <input
                id="ev-venue"
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="e.g. CS Lab 3 / Auditorium B"
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
            </div>

            <div>
              <label htmlFor="ev-onlineLink" className="block text-xs font-bold text-ink uppercase mb-1">
                Online Link (Google Meet / Zoom)
              </label>
              <input
                id="ev-onlineLink"
                type="url"
                value={formData.onlineLink}
                onChange={(e) => setFormData({ ...formData, onlineLink: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.onlineLink && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.onlineLink}</p>
              )}
            </div>
          </div>

          {/* Poster URL with Preview */}
          <div>
            <label htmlFor="ev-posterUrl" className="block text-xs font-bold text-ink uppercase mb-1">
              Event Poster Image URL
            </label>
            <div className="flex gap-3">
              <input
                id="ev-posterUrl"
                type="url"
                value={formData.posterUrl}
                onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                placeholder="https://images.unsplash.com/... or poster image URL"
                className="flex-1 px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formData.posterUrl && (
                <div className="w-10 h-10 border border-ink bg-panel shrink-0 overflow-hidden relative">
                  <img
                    src={formData.posterUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
            {formErrors.posterUrl && (
              <p className="text-xs text-gred mt-1 font-semibold">{formErrors.posterUrl}</p>
            )}
          </div>

          {/* Speakers / Hosts */}
          <div>
            <label htmlFor="ev-speakers" className="block text-xs font-bold text-ink uppercase mb-1">
              Speakers & Facilitators
            </label>
            <input
              id="ev-speakers"
              type="text"
              value={formData.speakers}
              onChange={(e) => setFormData({ ...formData, speakers: e.target.value })}
              placeholder="e.g. Jane Doe (GDE), Alex Smith (Core Team Lead)"
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={submitting}
              className="px-4 py-2 border border-ink text-sm font-bold text-ink hover:bg-panel disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hard-button inline-flex items-center gap-2 px-5 py-2 bg-gblue text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editEvent && editEvent._id ? "Save Changes" : "Create Event"}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM CANCEL EVENT MODAL */}
      <Modal
        isOpen={Boolean(eventToCancel)}
        onClose={() => setEventToCancel(null)}
        title="Confirm Event Cancellation"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-wash-red border border-gred text-ink">
            <AlertTriangle className="w-5 h-5 text-gred shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong>Warning:</strong> Cancelling this event will immediately close new registrations and invalidate active student QR tickets for entry. All registration records and attendance histories will be preserved.
            </div>
          </div>

          <p className="text-sm text-ink">
            Are you sure you want to cancel{" "}
            <strong>"{eventToCancel?.title}"</strong>?
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setEventToCancel(null)}
              disabled={cancelling}
              className="px-4 py-2 border border-ink text-sm font-bold text-ink hover:bg-panel"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelEvent}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gred text-white text-sm font-bold border-2 border-ink shadow-[2px_2px_0_#202124] hover:bg-red-700"
            >
              {cancelling ? "Cancelling..." : "Yes, Cancel Event"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
