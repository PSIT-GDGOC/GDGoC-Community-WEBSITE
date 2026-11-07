# GDGoC Community Website — Bug Fix & Defect Remediation Report

**Repository**: `https://github.com/PSIT-GDGOC/GDGoC-Community-WEBSITE`  
**Branch**: `remediation/fullstack-profile-hardening`  
**Date**: November 7, 2026  
**Engineering Leads**: Senior Full-Stack Engineer, AppSec Engineer & QA Lead  

---

## 1. Summary of Remediations

This document details the defect investigations, root causes, exact code modifications, and regression verification measures executed during the full-stack hardening initiative.

| Defect ID | Description | Severity | Target Area | Resolution Status |
|---|---|---|---|---|
| **FIX-01** | Avatar Upload Vite Proxy & Cross-Origin Display Failure | Critical (P0) | Frontend & Backend | **RESOLVED & VERIFIED** |
| **FIX-02** | Avatar Storage Provider Compatibility Test Failure | High (P1) | Backend Testing | **RESOLVED & VERIFIED** |
| **FIX-03** | Profile Inline Password Form & Missing Recovery Workflow | Critical (P0) | Auth & User Profile | **RESOLVED & VERIFIED** |
| **FIX-04** | Missing Activity Statistics on Profile Digital Card | Medium (P2) | User Profile | **RESOLVED & VERIFIED** |
| **FIX-05** | Avatar Cropper Accessibility & Keyboard Controls Defect | Medium (P2) | UI / Accessibility | **RESOLVED & VERIFIED** |
| **FIX-06** | Nav Account Avatar Thumbnail Absence | Low (P3) | Navigation UI | **RESOLVED & VERIFIED** |
| **FIX-07** | Session Invalidation Across Devices on Password Recovery | Critical (P0) | Auth & Session Mgmt | **RESOLVED & VERIFIED** |

---

## 2. Detailed Bug Fixes

### 2.1 FIX-01: Avatar Upload Vite Proxy & Cross-Origin Display Failure
- **Symptom**: In local development, uploading an avatar appeared successful, but the image broke on subsequent page renders or refreshes with 404 Not Found on `/uploads/avatars/...`.
- **Root Cause**:
  In `vite.config.ts`, only `"/api"` was proxied to the backend port 5000:
  ```ts
  proxy: {
    "/api": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },
  }
  ```
  Local disk avatar paths served from `/uploads` were intercepted by Vite's static asset handler instead of forwarding to Express.
- **Code Fix**:
  Added the `/uploads` proxy mapping to `vite.config.ts`:
  ```ts
  proxy: {
    "/api": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },
    "/uploads": {
      target: "http://localhost:5000",
      changeOrigin: true,
    },
  }
  ```
  Additionally verified `resolveImageUrl` in `src/lib/profile.ts` handles relative paths, cross-origin origins, and base64/data URLs cleanly.
- **Regression Prevention**:
  `tests/avatar.test.tsx` includes tests validating that `MemberCard` properly binds the resolved avatar URL to the `<img>` element.

---

### 2.2 FIX-02: Avatar Storage Provider Compatibility Test Failure
- **Symptom**: `server/avatar.test.js` failed at Test 14 with `AssertionError: New avatar file must exist on disk` when `STORAGE_PROVIDER=mongodb`.
- **Root Cause**:
  Test 14 asserted `fs.existsSync(diskPath)` unconditionally. However, in production and MongoDB mode, uploaded media files are streamed directly into the native MongoDB `Media` collection without touching local disk.
- **Code Fix**:
  Updated `server/avatar.test.js` to branch on `uploaded.provider`:
  ```javascript
  if (uploaded.provider === "local") {
    assert.strictEqual(fs.existsSync(diskPath), true, "New avatar file must exist on disk");
  } else if (uploaded.provider === "mongodb") {
    const Media = (await import("./models/Media.js")).default;
    const mediaDoc = await Media.findById(uploaded.mediaId);
    assert.ok(mediaDoc, "New avatar document must exist in MongoDB Media collection");
    assert.ok(mediaDoc.data && mediaDoc.data.length > 0, "Media document must contain image buffer");
  }
  ```
- **Regression Prevention**:
  Ran full `server/avatar.test.js` suite; all 15 tests now pass across both `local` and `mongodb` storage providers.

---

### 2.3 FIX-03: Profile Inline Password Form & Missing Recovery Workflow
- **Symptom**:
  1. The user profile page contained an inline password-update form, introducing clutter and an unconventional security interface.
  2. The application lacked a secure self-service password recovery flow for users who forgot their credentials.
- **Root Cause**:
  The application initially relied on an inline `<ChangePassword />` form on `/profile` and had no password reset endpoints on `/api/auth`.
- **Code Fix**:
  1. Removed `<ChangePassword />` component declaration and render call from `src/components/Profile.tsx`.
  2. Created Mongoose model `server/models/PasswordReset.js` with `tokenHash`, `email`, and `expiresAt` with a MongoDB TTL index.
  3. Added `POST /api/auth/forgot-password` with rate limiting, email enumeration prevention, SHA-256 token hashing, and transactional email dispatch.
  4. Added `POST /api/auth/verify-reset-token` for token validity checking.
  5. Added `POST /api/auth/reset-password` to enforce password complexity, atomically consume tokens, invalidate existing sessions via `tokenVersion`, and verify email ownership (`emailVerified: true`).
  6. Added frontend Forgot/Reset Password views in `src/components/Auth.tsx` and routing in `src/App.tsx`.
- **Regression Prevention**:
  Created `server/password-reset.test.js` with 7 comprehensive security integration tests. Added Vitest tests in `tests/auth.test.tsx`.

---

### 2.4 FIX-04: Missing Activity Statistics on Profile Digital Card
- **Symptom**: `MemberCard` supported displaying `Upcoming` and `Attended` activity counters, but these numbers were missing when viewing `/profile`.
- **Root Cause**:
  `src/components/Profile.tsx` only called `GET /api/users/me` and never queried `GET /api/tickets`. As a result, `MemberCard` was invoked without `upcoming` or `attended` props:
  ```tsx
  <MemberCard user={user} />
  ```
- **Code Fix**:
  In `src/components/Profile.tsx`, updated `loadUser` to load tickets simultaneously:
  ```tsx
  const [me, ticketData] = await Promise.all([
    api<P>("/users/me"),
    api<{ tickets: Ticket[] }>("/tickets").catch(() => ({ tickets: [] })),
  ]);
  ```
  Computed:
  ```tsx
  const summary = ticketSummary(tickets);
  const upcomingCount = summary.upcoming.length;
  const attendedCount = summary.attended;
  const registeredCount = tickets.filter((t) => t.state !== "cancelled").length;
  ```
  Passed to `<MemberCard user={user} upcoming={upcomingCount} attended={attendedCount} registered={registeredCount} />`.
- **Regression Prevention**:
  Verified in `tests/avatar.test.tsx` and `tests/dashboard.test.tsx` that `MemberCard` correctly displays all activity counts.

---

### 2.5 FIX-05: Avatar Cropper Accessibility & Keyboard Controls Defect
- **Symptom**: The avatar cropping modal lacked keyboard navigation, focus trap, and ARIA modal semantics.
- **Root Cause**:
  `CropModal` only supported pointer dragging and range slider input; arrow keys and Enter keys were not handled.
- **Code Fix**:
  In `src/components/Profile.tsx`:
  - Added auto-focus to modal container via `modalRef.current?.focus()`.
  - Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="crop-modal-title"`, and `aria-describedby="crop-modal-desc"`.
  - Added keyboard listeners: Arrow keys to nudge pan position (with Shift for 25px steps, default 10px), `+`/`-` keys to zoom, Enter to save, Escape to cancel.
- **Regression Prevention**:
  Verified modal focus and dismissal behavior in test suites.

---

### 2.6 FIX-06: Nav Account Avatar Thumbnail Absence
- **Symptom**: The top navigation account button only ever rendered a default text initial, even when a user uploaded a profile picture.
- **Root Cause**:
  `src/components/Nav.tsx` rendered `<span>{initials}</span>` unconditionally without inspecting `user.avatarUrl`.
- **Code Fix**:
  Updated `AccountLink` in `src/components/Nav.tsx`:
  ```tsx
  {user.avatarUrl && !imgError ? (
    <img
      src={resolveImageUrl(user.avatarUrl)}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setImgError(true)}
    />
  ) : (
    <span>{initials}</span>
  )}
  ```
- **Regression Prevention**:
  Verified image rendering and `onError` fallback behavior.

---

### 2.7 FIX-07: Session Invalidation Across Devices on Password Recovery
- **Symptom**: Rotating a password or completing a password reset did not log out older compromised sessions on other browsers.
- **Root Cause**:
  JWT tokens lacked a mechanism to detect credential rotation after issuance.
- **Code Fix**:
  In `server/routes/auth.js` (`POST /api/auth/reset-password`):
  ```javascript
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.password = await hashPassword(password);
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();
  ```
  The auth middleware checks `payload.tokenVersion === user.tokenVersion`, immediately invalidating all previous JWTs.
- **Regression Prevention**:
  Test 5 in `server/password-reset.test.js` specifically validates that older session cookies are rejected immediately after a password reset.

---

## 3. Verification Matrix

| Test Suite | Tests Run | Passed | Failed | Status |
|---|---|---|---|---|
| `server/password-reset.test.js` | 7 | 7 | 0 | **100% PASS** |
| `server/avatar.test.js` | 15 | 15 | 0 | **100% PASS** |
| `server/api.test.js` | 14 | 14 | 0 | **100% PASS** |
| `server/remediation.test.js` | 26 | 26 | 0 | **100% PASS** |
| `server/edge.test.js` | 13 | 13 | 0 | **100% PASS** |
| `server/admin.test.js` | 3 | 3 | 0 | **100% PASS** |
| `server/email-allowlist.test.js` | 14 | 14 | 0 | **100% PASS** |
| `server/utils/tickets.test.js` | 5 | 5 | 0 | **100% PASS** |
| `tests/auth.test.tsx` (Vitest) | 15 | 15 | 0 | **100% PASS** |
| `tests/avatar.test.tsx` (Vitest) | 6 | 6 | 0 | **100% PASS** |
| `tests/dashboard.test.tsx` (Vitest) | 17 | 17 | 0 | **100% PASS** |
| `tests/events.test.tsx` (Vitest) | 18 | 18 | 0 | **100% PASS** |
| `tests/tickets.test.tsx` (Vitest) | 11 | 11 | 0 | **100% PASS** |
| `tests/homepage.test.tsx` (Vitest) | 5 | 5 | 0 | **100% PASS** |
| `tests/review.test.tsx` (Vitest) | 4 | 4 | 0 | **100% PASS** |
| `tests/admin.test.tsx` (Vitest) | 2 | 2 | 0 | **100% PASS** |
| Script Suites (`profile`, `oso`, `ruru`, `statuscard`) | 90 | 90 | 0 | **100% PASS** |
| Vite Production Build | 1 | 1 | 0 | **100% PASS** |

