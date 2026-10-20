# GDGoC PSIT — Admin Dashboard, Event Management & Attendance System

Comprehensive technical documentation for the GDGoC Community Platform administration infrastructure, event lifecycle management, authoritative QR attendance check-in, and audit logging system.

---

## 1. Authentication & Role-Based Access Control (RBAC)

The system implements strict, independent backend-enforced RBAC via `requireAuth` and `requireAdmin` middleware.

### Supported Roles
| Role | Level | Capabilities |
|---|---|---|
| `student` / `member` | User | Register for events, view tickets, view published projects and profile. Denied access to `/api/admin/*` (`403 Forbidden`). |
| `organizer` | Admin | Create/edit events, view attendees, perform QR ticket check-ins, revert check-in errors. |
| `admin` | Full Admin | Full administrative management over events, projects, registrations, and exports. |
| `superadmin` | Super Admin | Root chapter owner with unrestricted management and audit capabilities. |

### Environment Variables
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/gdgoc
JWT_SECRET=your_cryptographically_secure_long_secret_key
CLIENT_URL=http://localhost:5173
NODE_ENV=production
```

---

## 2. API Endpoints Specification

All administrative endpoints are mounted under `/api/admin/*` and require an authenticated session (`Cookie: token=...` or `Authorization: Bearer <token>`) with an admin role. Rate limiting (`express-rate-limit`) and security headers (`helmet`) are enforced.

### 2.1 Dashboard Overview Metrics
- **`GET /api/admin/metrics`**
  - **Status:** `200 OK`, `401 Unauthorized`, `403 Forbidden`
  - **Response:**
    ```json
    {
      "totalPublishedEvents": 5,
      "upcomingEvents": 2,
      "totalProjects": 12,
      "ongoingProjects": 8,
      "completedProjects": 4,
      "totalRegistrations": 310,
      "confirmedRegistrations": 295,
      "uniqueRegisteredMembers": 240,
      "totalCheckedInAttendance": 210,
      "recentActivity": [
        {
          "_id": "...",
          "actorName": "Chapter Admin",
          "actorRole": "admin",
          "action": "TICKET_VERIFIED_CHECKIN",
          "targetType": "Attendance",
          "targetRecordId": "...",
          "summary": "Checked in attendee John Doe for Cloud Bootcamp",
          "timestamp": "2026-10-20T19:50:00.000Z"
        }
      ]
    }
    ```

### 2.2 Event Management APIs
- **`GET /api/admin/events`**
  - Query parameters: `page`, `limit`, `search`, `status` (`draft`, `published`, `upcoming`, `completed`, `cancelled`), `category`, `format`, `sortBy`, `sortOrder`.
  - **Response:** `{ events: [...], total, page, limit, totalPages }`
- **`POST /api/admin/events`**
  - Validates required fields, date constraints (`endDate >= startDate`, `registrationDeadline <= startDate`), and integer `capacity >= 1`.
  - **Status:** `201 Created`
  - Records `EVENT_CREATED` in `AuditLog`.
- **`GET /api/admin/events/:id`**
  - Returns complete event record.
- **`PUT / PATCH /api/admin/events/:id`**
  - Supports partial updates without wiping unaffected fields.
  - Records `EVENT_UPDATED` in `AuditLog`.
- **`PATCH /api/admin/events/:id/status`**
  - Lifecycle transition: `{ "status": "draft" | "published" | "completed" | "cancelled" }`
  - Cancelling an event sets `cancelled = true`, `registrationOpen = false`, marks all active tickets as `cancelled`, and preserves all registration records.
  - Records `EVENT_PUBLISHED` or `EVENT_CANCELLED` in `AuditLog`.
- **`DELETE /api/admin/events/:id`**
  - Deletes draft events with 0 registrations. If registrations exist, blocks hard deletion (`400 Bad Request`) to preserve attendee history.

### 2.3 Project Management APIs
- **`GET /api/admin/projects`**
  - Query parameters: `page`, `limit`, `search`, `domain`, `status` (`ongoing`, `completed`, `archived`), `publicationStatus` (`draft`, `published`).
- **`POST /api/admin/projects`**
  - Creates project, records `PROJECT_CREATED` in `AuditLog`.
- **`GET /api/admin/projects/:id`**
- **`PUT / PATCH /api/admin/projects/:id`**
  - Updates project, records `PROJECT_UPDATED` in `AuditLog`.
- **`DELETE /api/admin/projects/:id`**
  - Deletes project, records `PROJECT_DELETED` in `AuditLog`.
- **`GET /api/projects` (Public)**
  - Returns projects with `publicationStatus: "published"` for the public community website.

### 2.4 Registrations & Event Statistics APIs
- **`GET /api/admin/registrations`**
  - Query parameters: `eventId`, `registrationStatus`, `checkedIn` (`true`/`false`), `search` (name, email, roll number, registration reference, ticket code).
  - Returns paginated list with populated `user` and `event` objects.
- **`GET /api/admin/events/:eventId/stats`**
  - Computes from persisted database records:
    - `totalRegistrations`
    - `confirmedRegistrations`
    - `cancelledRegistrations`
    - `capacity`
    - `availableCapacity`: `Math.max(0, capacity - confirmedRegistrations)` (guaranteed non-negative)
    - `checkedInAttendees`
    - `attendancePercentage`: `confirmedRegistrations > 0 ? Math.round((checkedInAttendees / confirmedRegistrations) * 100) : 0`

### 2.5 Authoritative QR Ticket Verification & Attendance Recording
- **`POST /api/admin/attendance/verify`**
  - **Payload:** `{ "ticketCode": "...", "registrationReference": "...", "eventId": "..." }`
  - **Outcomes:**
    - `404 Not Found` `{ valid: false, status: "invalid", message: "Ticket not found or does not belong to this event." }`
    - `400 Bad Request` `{ valid: false, status: "ineligible", message: "Ticket or event is cancelled and ineligible for check-in." }`
    - `409 Conflict` `{ valid: false, status: "already-used", message: "Ticket has already been checked in.", checkedInAt, participant }`
    - `200 OK` `{ valid: true, status: "valid", message: "Check-in confirmed.", checkedInAt, participant }`
      - Atomically updates: `checkedIn = true`, `attendedAt = now`, `checkedInAt = now`, `ticketStatus = "used"`, `checkedInBy = req.user._id`.
      - Writes `TICKET_VERIFIED_CHECKIN` entry in `AuditLog`.
- **`PATCH /api/admin/attendance/:registrationId/correct`**
  - **Payload:** `{ "reason": "Explanation string" }`
  - Reverts check-in: `checkedIn = false`, `attendedAt = null`, `checkedInAt = null`, `ticketStatus = "active"`.
  - Appends to `correctionHistory`: `{ correctedBy, previousState, newState, reason, timestamp }`.
  - Records `ATTENDANCE_CORRECTED` in `AuditLog`.

### 2.6 Controlled CSV Export with Formula Injection Protection
- **`GET /api/admin/events/:eventId/export-csv`**
  - Streams CSV with headers:
    `Registration Reference,Participant Name,Email,Roll Number,Event Title,Registration Status,Registered At,Ticket Status,Attendance Status,Checked In At`
  - **Spreadsheet Formula Injection Protection**: All user-controlled fields starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'` and properly escaped to prevent CSV injection / remote code execution in spreadsheet clients (Excel, Google Sheets, LibreOffice).
  - Records `CSV_EXPORTED` in `AuditLog`.

---

## 3. Data Models & Database Indexes

### 3.1 Event (`server/models/Event.js`)
- Compound validations:
  - `endsAt >= startsAt`
  - `registrationDeadline <= startsAt`
  - `capacity >= 1`
  - `meetingUrl` and `posterUrl` HTTP(S) protocol check
- Status lifecycle: `draft` -> `published` -> `completed` / `cancelled`

### 3.2 Project (`server/models/Project.js`)
- Fields: `title`, `shortDescription`, `fullDescription`, `domain`, `techStack`, `contributors`, `githubUrl`, `liveDemoUrl`, `docsUrl`, `coverImage`, `status`, `publicationStatus`.
- URL protocol validation on all external repository and documentation links.

### 3.3 Registration (`server/models/Registration.js`)
- Unique compound index: `{ user: 1, event: 1 }` prevents duplicate registrations at the database layer.
- Unique cryptographically random tokens: `ticketId` / `ticketCode` and `registrationReference` (`REG-XXXXXX`).
- Attendance fields: `checkedIn`, `attendedAt`, `checkedInAt`, `checkedInBy`, `correctionHistory`.

### 3.4 AuditLog (`server/models/AuditLog.js`)
- Fields: `actorId`, `actorName`, `actorRole`, `action`, `targetType`, `targetRecordId`, `summary`, `details`, `timestamp`.
- Strict Privacy Rule: Passwords, tokens, JWTs, and authorization headers are sanitized and excluded.

---

## 4. Frontend Admin Dashboard Architecture

- **Path / Hash Route:** `#/admin`, `#/admin/events`, `#/admin/projects`, `#/admin/registrations`, `#/admin/attendance`
- **Route Guard:** Displays a neutral skeleton loader during verification. Unauthenticated users are prompted to sign in (`#/login?next=/admin`). Non-admin users see an explicit `403 Access Denied` screen with a return link.
- **Design System:** Built using the GDGoC PSIT neo-brutalist theme with Bricolage Grotesque typography, Google four-colour tokens (`gblue`, `gred`, `gyellow`, `ggreen`), hard-edge offset shadows (`3px 3px 0 #202124`), accessible touch targets (>= 44x44px), and high-contrast badges pairing icons and text labels.
- **QR Scanner:**
  - In-browser camera scanning using native `BarcodeDetector` with automatic `jsqr` canvas decoding fallback.
  - Clean MediaStream track disposal on stop or component unmount.
  - Fallback manual ticket / registration reference search.

