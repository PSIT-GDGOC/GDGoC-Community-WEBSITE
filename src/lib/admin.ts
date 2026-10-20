const API = import.meta.env?.VITE_API_URL ?? "/api";

export type Role = "student" | "member" | "admin" | "organizer" | "superadmin";

export type AdminUser = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: Role;
  branch?: string;
  year?: number;
  enrollmentNo?: string;
};

export type AuditLogItem = {
  _id: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action:
    | "EVENT_CREATED"
    | "EVENT_UPDATED"
    | "EVENT_PUBLISHED"
    | "EVENT_CANCELLED"
    | "EVENT_DELETED"
    | "PROJECT_CREATED"
    | "PROJECT_UPDATED"
    | "PROJECT_DELETED"
    | "TICKET_VERIFIED_CHECKIN"
    | "ATTENDANCE_CORRECTED"
    | "CSV_EXPORTED";
  targetType: "Event" | "Project" | "Registration" | "Ticket" | "Attendance";
  targetRecordId: string;
  summary: string;
  timestamp: string;
};

export type DashboardMetrics = {
  totalPublishedEvents: number;
  upcomingEvents: number;
  totalProjects: number;
  ongoingProjects: number;
  completedProjects: number;
  totalRegistrations: number;
  confirmedRegistrations: number;
  uniqueRegisteredMembers: number;
  totalCheckedInAttendance: number;
  recentActivity: AuditLogItem[];
};

export type EventStatus = "draft" | "published" | "upcoming" | "completed" | "cancelled";
export type EventFormat = "in_person" | "online" | "offline" | "hybrid";

export type AdminEvent = {
  _id: string;
  id?: string;
  title: string;
  shortDescription: string;
  summary?: string;
  fullDescription: string;
  description?: string;
  startDate: string;
  startsAt: string;
  endDate?: string | null;
  endsAt?: string | null;
  venue?: string;
  onlineLink?: string;
  meetingUrl?: string;
  posterUrl?: string;
  poster?: string;
  category: string;
  format: EventFormat;
  speakers?: string;
  organizers?: string;
  host?: string;
  capacity: number;
  registeredCount: number;
  registrationDeadline: string | null;
  status: EventStatus;
  published: boolean;
  cancelled: boolean;
  registrationOpen: boolean;
  participationInstructions?: string;
  prerequisites?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectStatus = "ongoing" | "completed" | "archived";
export type ProjectPublication = "draft" | "published";

export type AdminProject = {
  _id: string;
  id?: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  coverImage?: string;
  screenshots?: string[];
  domain: string;
  category?: string;
  techStack: string[];
  contributors?: Array<{ name: string; role?: string; github?: string; avatar?: string } | string>;
  githubUrl?: string;
  liveDemoUrl?: string;
  docsUrl?: string;
  status: ProjectStatus;
  publicationStatus: ProjectPublication;
  createdAt: string;
  updatedAt: string;
};

export type AdminRegistration = {
  _id: string;
  id?: string;
  user: {
    _id: string;
    id?: string;
    name: string;
    email: string;
    branch?: string;
    year?: number;
    enrollmentNo?: string;
  };
  event: {
    _id: string;
    id?: string;
    title: string;
    startsAt: string;
    startDate?: string;
    venue?: string;
    capacity: number;
    registeredCount: number;
    cancelled: boolean;
  };
  registrationReference: string;
  ticketId: string;
  ticketCode?: string;
  status: "confirmed" | "cancelled" | "pending";
  registrationStatus: "confirmed" | "cancelled" | "pending";
  registeredAt?: string;
  createdAt: string;
  ticketStatus: "active" | "used" | "cancelled" | "invalid";
  checkedIn: boolean;
  attendedAt?: string | null;
  checkedInAt?: string | null;
  correctionHistory?: Array<{
    correctedBy: string;
    reason: string;
    timestamp: string;
  }>;
};

export type EventStats = {
  eventId: string;
  eventTitle: string;
  totalRegistrations: number;
  confirmedRegistrations: number;
  cancelledRegistrations: number;
  capacity: number;
  availableCapacity: number;
  checkedInAttendees: number;
  attendancePercentage: number;
};

export type VerificationResult = {
  valid: boolean;
  status: "valid" | "already-used" | "invalid" | "ineligible" | "network-error";
  message: string;
  participant?: {
    name: string;
    email: string;
    enrollmentNo?: string;
    branch?: string;
    year?: number | null;
  };
  checkedInAt?: string;
  registrationReference?: string;
  ticketId?: string;
};

export async function adminApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const url = `${API}/admin${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    credentials: "include",
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch((err) => {
    if (err.name === "AbortError") throw err;
    throw new Error("Unable to connect to administration server. Check network connection.");
  });

  if (res.status === 401) {
    throw new Error("401");
  }
  if (res.status === 403) {
    throw new Error("403");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    throw Object.assign(error, { status: res.status, errors: data.errors });
  }

  return data as T;
}

export function downloadCsv(eventId: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const downloadUrl = `${API}/admin/events/${eventId}/export-csv${query}`;
  window.open(downloadUrl, "_blank");
}

