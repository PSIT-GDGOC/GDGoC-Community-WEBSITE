# GDGoC Dynamic Identity Hub — Architecture, Schema & Deployment Guide

This document describes the modular **Dynamic Identity Hub** profile architecture built on top of PR #24 (`remediation/fullstack-profile-hardening`), including newly supported database fields, API endpoints, security controls, and non-destructive deployment notes.

---

## 1. Frontend Architecture (6 Core Areas)

The monolithic profile view has been decomposed into focused, accessible neo-brutalist components under `src/components/profile/` orchestrated by [`src/components/Profile.tsx`](src/components/Profile.tsx):

1. **Identity & Personalization Hero** ([`ProfileHero.tsx`](src/components/profile/ProfileHero.tsx))
   - Customizable cover banner (5 designer presets: `google-brand`, `midnight-slate`, `cyber-grid`, `sunset-gradient`, `emerald-code`, plus `custom` uploaded artwork with automatic error fallback).
   - Overlapping avatar container with initials fallback, role & verification badges, social links (GitHub, LinkedIn, Portfolio, Personal Website, X/Twitter with XSS-safe `safeExternalUrl` protocol enforcement), copyable profile link, **Customize Profile** trigger, and an expandable **Profile Completeness** progress bar.
   - Public email remains hidden by default (`privacy.showEmail: false`).
2. **About & Technical Skills** ([`ProfileSkills.tsx`](src/components/profile/ProfileSkills.tsx))
   - Groups selected skills by category (`Programming`, `Frontend`, `Backend`, `Databases`, `Cloud & DevOps`, `AI & ML`, `Design`, `Developer Tools`, `Other`).
   - Supports curated multi-select toggles and custom skill tags (max 25 skills, max 40 chars/tag) without fabricated proficiency bars.
3. **Featured Projects Showcase** ([`ProfileProjects.tsx`](src/components/profile/ProfileProjects.tsx))
   - Responsive 2-column project grid supporting up to 6 projects per member, optional project cover image upload or verified external URL, tech stack pills (max 10/project), `Featured ★` highlight, validated GitHub/Live URL links, reordering, editing, deletion, and clean empty states.
4. **Community Journey & Activity** ([`CommunityJourney.tsx`](src/components/profile/CommunityJourney.tsx))
   - Connects directly to real `/api/tickets` records to surface verified attendance (`checked_in` / `attendedAt`), upcoming sessions, total confirmed registrations (excluding `cancelled` and `event_cancelled`), and a chronological **Participation Timeline**.
5. **Digital Membership Card** ([`MemberCard.tsx`](src/components/MemberCard.tsx))
   - Preserves the double-sided Card Front / Chapter Pass flip, customizable card themes (`default`, `dark`, `minimal`, `accent`) and accent stripes (`gblue`, `gred`, `gyellow`, `ggreen`, `slate`).
   - Strictly separates account email confirmation (`emailVerified` → `"Community Member (Email Verified)"`) from official chapter verification (`memberVerified` → `"Verified Chapter Member"`).
6. **Privacy & Account Preferences** ([`ProfilePreferences.tsx`](src/components/profile/ProfilePreferences.tsx))
   - Defaults to a clean **View Mode** summary and expands via `⚙ Configure` to edit banner/card/accent presets and privacy toggles (`showEmail`, `showAttendance`, `showProjects`), plus a direct link to `#/forgot-password` (preserving removal of inline profile password forms).

Supporting Modals:
- [`ProfileEditorModal.tsx`](src/components/profile/ProfileEditorModal.tsx): Tabbed customization modal (`Identity & Bio`, `Photo & Banner`, `Skills`, `Projects`, `Socials & Style`) with keyboard `Escape` handling and accessible labels.
- [`AvatarCropModal.tsx`](src/components/profile/AvatarCropModal.tsx): Extracted accessible canvas cropping modal with zoom slider (`+/-`), arrow-key panning, pointer drag, and `Escape` dismissal.

---

## 2. Database Schema Extensions (Additive & Non-Destructive)

### `User` Model (`server/models/User.js`)

| Field | Type / Enum | Default | Editable by User? | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `headline` | `String` (max 120) | `""` | Yes (`PATCH /me`) | Professional tagline shown in Hero & MemberCard |
| `college` | `String` (max 120) | `"PSIT Kanpur"` | Yes (`PATCH /me`) | Campus / institution affiliation |
| `specialization` | `String` (max 60) | `""` | Yes (`PATCH /me`) | Primary engineering focus area |
| `bannerTheme` | `Enum` (`google-brand`, `midnight-slate`, `cyber-grid`, `sunset-gradient`, `emerald-code`, `custom`) | `"google-brand"` | Yes (`PATCH /me`) | Set automatically to `"custom"` on banner upload |
| `bannerUrl` | `String \| null` | `null` | Via `/me/banner` only | Direct URL injection blocked in `PATCH /me` |
| `bannerPublicId` | `String \| null` | `null` | Internal only | Used for atomic cleanup of replaced banners |
| `bannerProvider` | `String \| null` | `null` | Internal only | Storage backend (`mongodb`, `cloudinary`, `local`) |
| `accentColor` | `Enum` (`gblue`, `gred`, `gyellow`, `ggreen`, `slate`) | `"gblue"` | Yes (`PATCH /me`) | Hero top border & membership card accent |
| `cardTheme` | `Enum` (`default`, `dark`, `minimal`, `accent`) | `"default"` | Yes (`PATCH /me`) | Digital membership card appearance |
| `socials` | `{ github, linkedin, portfolio, website, twitter }` | `{ ... "" }` | Yes (`PATCH /me`) | Enforces `http(s)://` URLs; supports explicit clearing (`""`) |
| `skills` | `[{ name, category }]` (max 25, 40 chars each) | `[]` | Yes (`PATCH /me`) | Categorized developer tags |
| `projects` | `[projectSchema]` (max 6) | `[]` | Via `/me/projects*` | `title`, `description`, `techStack[]`, `githubUrl`, `liveUrl`, `imageUrl`, `featured`, `order` |
| `memberVerified` | `Boolean` | `false` | **Protected (Admin only)** | Ignored on `PATCH /me`; distinguishes official chapter verification from `emailVerified` |
| `memberVerifiedAt` | `Date \| null` | `null` | **Protected (Admin only)** | Timestamp when chapter verification was granted |
| `privacy` | `{ showEmail, showAttendance, showProjects }` | `{ showEmail: false, showAttendance: true, showProjects: true }` | Yes (`PATCH /me`) | `publicUser(u, { isSelf: false })` masks `email` and `projects` accordingly |

### `Media` Model (`server/models/Media.js`)

- Extended `type` enum from `["avatar", "poster"]` to `["avatar", "poster", "banner", "project"]` to store custom cover banners and project preview images in the existing MongoDB media store (and landscape-preserving Cloudinary folders `gdgoc-banners` / `gdgoc-projects` when Cloudinary is configured).

---

## 3. API Endpoints & Security Controls

All endpoints are mounted under `/api/users` (and `/api/v1/users`) behind `requireAuth` and CSRF origin verification (`isTrustedRequest`):

- `GET /api/users/me` — Returns full `publicUser(req.user, { isSelf: true })`.
- `PATCH /api/users/me` — Strict allowlist (`name`, `branch`, `year`, `bio`, `headline`, `college`, `specialization`, `bannerTheme`, `accentColor`, `cardTheme`, `socials`, `skills`, `privacy`). Explicitly ignores `role`, `emailVerified`, `memberVerified`, `tokenVersion`, `enrollmentNo`, `avatarUrl`, `bannerUrl`, `projects`.
- `POST /api/users/me/banner` — Accepts binary or base64 dataUrl up to 3MB, verifies JPEG/PNG/WebP magic bytes (`detectImageFormat`), strips EXIF/XMP/comment chunks (`stripImageMetadata`), saves via `uploadBanner`, rolls back on DB failure, and deletes the replaced banner afterward.
- `DELETE /api/users/me/banner` — Deletes stored banner asset, clears `bannerUrl`/`bannerPublicId`, and resets `bannerTheme` to `"google-brand"`.
- `POST /api/users/me/projects/image` — Accepts image up to 2MB, enforces JPEG/PNG/WebP magic bytes, strips metadata, stores via `uploadProjectImage`, and returns `{ url }`.
- `POST /api/users/me/projects` — Enforces max 6 projects per user, validates title length, description length, tech stack size (<=10), and `http(s):` URLs (or safe `/api/media/...` / `/uploads/...` relative image paths).
- `PATCH /api/users/me/projects/:projectId` — Validates ObjectId cleanly (returning `404` on invalid IDs) and applies field-level validation.
- `DELETE /api/users/me/projects/:projectId` — Pulls project subdocument cleanly (returns `404` on invalid IDs).
- `PUT /api/users/me/projects/reorder` — Re-indexes `order` from client-supplied project ID array and persists sorted order in MongoDB.

---

## 4. Migration & Deployment Notes

1. **Zero Destructive Migrations Needed**: All new `User` fields are strictly additive with backward-compatible Mongoose defaults (`bannerTheme: "google-brand"`, `college: "PSIT Kanpur"`, `privacy.showEmail: false`, `memberVerified: false`, `skills: []`, `projects: []`). Existing member records work automatically upon read/write without running a blocking backfill script.
2. **Storage Provider Compatibility**:
   - **Cloudinary configured (`CLOUDINARY_URL` or `CLOUDINARY_CLOUD_NAME/KEY/SECRET`)**: Avatars crop to `400x400,g_face` in `gdgoc-avatars`; banners upload with `c_limit,w_1600,q_auto,f_auto` in `gdgoc-banners`; project covers upload with `c_limit,w_1200,q_auto,f_auto` in `gdgoc-projects`.
   - **MongoDB Media Storage (default when Cloudinary is absent outside `NODE_ENV=test`)**: Binary images store in the `Media` collection and stream via `/api/media/:id.<ext>`.
3. **Existing Features Preserved**: All PR #24 fixes (atomic password reset token consumption, login forgot-password recovery flow, absence of password-change UI on the profile page, avatar upload/crop/remove workflow, event registration/tickets, and admin controls) remain intact.

---

## 5. Visual Captures

- Desktop View Mode: [`desktop-profile-hub.png`](docs/screenshots/identity-hub/desktop-profile-hub.png)
- Desktop Chapter Pass (Card Back): [`desktop-member-card-pass.png`](docs/screenshots/identity-hub/desktop-member-card-pass.png)
- Desktop Identity Hub Editor Modal: [`desktop-profile-editor.png`](docs/screenshots/identity-hub/desktop-profile-editor.png)
- Mobile Responsive Layout (`390px`, `0px` horizontal overflow): [`mobile-profile-hub.png`](docs/screenshots/identity-hub/mobile-profile-hub.png)

