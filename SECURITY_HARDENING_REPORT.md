# GDGoC Community Website — Security Hardening & Verification Report

**Repository**: `PSIT-GDGOC/GDGoC-Community-WEBSITE`  
**Branch**: `feat/dynamic-identity-hub` (PR #25 targeting `main`)  
**Assessment Date**: November 9, 2026  

---

## 1. Executive Security Summary

This report documents the application security controls, vulnerability fixes, and concurrency/failure-handling guarantees verified on branch `feat/dynamic-identity-hub` across both the PR #24 baseline (`e6ee55d`) and the integrated Dynamic Identity Hub hardening pass.

All temporary reference scripts in `gdgoc_hardening/` were audited, integrated directly into core modules using cleaner atomic Mongoose operations, verified with dedicated unit and end-to-end integration tests, and deleted cleanly from the repository.

---

## 2. Hardening Fixes Integrated on `feat/dynamic-identity-hub`

### 2.1 Default-Deny User Serialization (`publicUser`)
- **Risk Mitigated**: Accidental PII or internal storage metadata disclosure if a caller invokes `publicUser(user)` without explicitly opting into self-access.
- **Control Implemented**:
  - Updated `publicUser(u, options = {})` in [`server/models/User.js`](server/models/User.js) so `isSelf = options.isSelf === true` is opt-in rather than default-true.
  - When `isSelf !== true`, `publicUser()` omits `email` (unless `privacy.showEmail === true`), `enrollmentNo`, `emailVerifiedAt`, `memberVerifiedAt`, `privacy`, and hidden `projects` (when `privacy.showProjects === false`).
  - Internal fields (`pendingProjectImages`, `avatarPublicId`, `avatarProvider`, `bannerPublicId`, `bannerProvider`, and `project.imagePublicId`/`imageProvider`) are never emitted in `publicUser()`, even when `isSelf: true`.
  - Audited and updated callers in [`server/routes/auth.js`](server/routes/auth.js), [`server/routes/admin.js`](server/routes/admin.js), and [`server/routes/users.js`](server/routes/users.js) to pass `{ isSelf: true }` only where owner or administrator visibility is authorized.

### 2.2 Project Media Ownership & Path Traversal Prevention
- **Risk Mitigated**: Cross-user IDOR where a user attaches another member's private `/api/media/:id` or `/uploads/...` asset to their own project card (and could subsequently cause deletion or misuse), plus `../` path traversal or attaching `/uploads/avatars/...` / `/uploads/posters/...` paths as project images.
- **Controls Implemented**:
  - Added `owner: { type: ObjectId, ref: "User", index: true }` to [`server/models/Media.js`](server/models/Media.js) and propagated `{ ownerId: req.user._id }` through `uploadAvatar`, `uploadBanner`, and `uploadProjectImage` in [`server/utils/storage.js`](server/utils/storage.js).
  - Hardened `validateProjectInput` in [`server/utils/domain.js`](server/utils/domain.js) to reject `..` segments and restrict relative paths strictly to `/api(/v<n>)?/media/<id>` or `/uploads/projects/<filename>`.
  - Added `resolveProjectImageAsset` in [`server/routes/users.js`](server/routes/users.js) to verify that any attached internal media path belongs either to the caller's existing projects, the caller's `pendingProjectImages` buffer (max `20` items with FIFO eviction of unreferenced uploads), or a `Media` document where `type === "project"` and `owner.equals(req.user._id)`. Unauthorized attempts fail with `403 Forbidden`.

### 2.3 Atomic DB-First Media Updates & Orphan Cleanup
- **Risk Mitigated**: Concurrent upload/delete races creating dangling DB pointers pointing to deleted blobs, or orphaned storage assets leaking in MongoDB/Cloudinary/disk.
- **Controls Implemented**:
  - Exported `executeDbFirstMediaClear({ persistClear, cleanupAsset })` in [`server/routes/users.js`](server/routes/users.js): storage cleanup is invoked **only** after the database clear succeeds, and transient cleanup failures are logged without failing the completed DB transaction.
  - Converted `POST /api/users/me/avatar`, `DELETE /api/users/me/avatar`, `POST /api/users/me/banner`, and `DELETE /api/users/me/banner` to atomic `User.findOneAndUpdate(..., { returnDocument: "before" })` updates paired with rollback cleanup if the DB write throws or returns `null`.
  - Added `isProjectPublicIdInUse` reference counting so deleting or editing one project preserves shared cover images used by another project of the same user, while deleting orphaned images (`404` on subsequent GET).

### 2.4 Exact Project Reorder Integrity & Error Sanitization
- **Reorder Integrity**: `PUT /api/users/me/projects/reorder` in [`server/routes/users.js`](server/routes/users.js) strictly validates that `order` has the exact same cardinality and set of project ObjectIds belonging to the authenticated user (rejecting missing, duplicate, unknown, extra, or cross-user IDs with `400 Bad Request`).
- **Error Hygiene**: Removed raw `error?.message` reflection from `POST /api/users/me/avatar` `500` error responses so internal exceptions cannot leak stack or storage configuration strings to clients.

### 2.5 Dependency Security Audit Remediation
- Executed `npm audit fix` inside `server/`, upgrading `body-parser` from `2.3.0` to `2.4.0` in [`server/package-lock.json`](server/package-lock.json) to remediate high-severity DoS advisory `GHSA-27r3-jxmh-p828`.
- Post-remediation verification (`npm audit --omit=dev`): **0 vulnerabilities** in both root and `server/`.

---

## 3. Preserved Security Controls (Baseline + PR #24)

| Domain | Verified Control | Reference |
|---|---|---|
| **Password Recovery** | Anti-enumeration `200` on `/api/auth/forgot-password`, 32-byte `crypto.randomBytes`, SHA-256 `tokenHash` persistence, single-use atomic `PasswordReset.findOneAndDelete` on valid unexpired tokens, `tokenVersion` bump invalidating active JWT sessions across all devices, `1`-hour TTL index cleanup (`expireAfterSeconds: 3600`). | [`server/routes/auth.js`](server/routes/auth.js), [`server/models/PasswordReset.js`](server/models/PasswordReset.js), [`server/password-reset.test.js`](server/password-reset.test.js) |
| **Role & Profile Mass Assignment** | `PATCH /api/users/me` strictly allowlists editable profile/hub fields and ignores `role`, `emailVerified`, `memberVerified`, `tokenVersion`, `enrollmentNo`, `avatarUrl`, `bannerUrl`, `projects`, and `pendingProjectImages`. Admins retain self-demotion protection. | [`server/routes/users.js`](server/routes/users.js), [`server/routes/admin.js`](server/routes/admin.js) |
| **Binary Upload Sanitization** | Magic-byte inspection (`PNG`, `JPEG`, `WebP`) via `detectImageFormat`, EXIF/XMP/comment segment stripping via `stripImageMetadata`, strict per-endpoint size caps (`2 MB` avatar/project cover, `3 MB` banner), and upload rate limiting. | [`server/utils/storage.js`](server/utils/storage.js), [`server/index.js`](server/index.js) |
| **XSS & URI Safety** | Client-side `safeExternalUrl` restricts profile and project links (`github`, `linkedin`, `portfolio`, `website`, `twitter`, `liveUrl`) to `http:` / `https:`; server validation blocks `javascript:` and `data:` URIs. | [`src/lib/profile.ts`](src/lib/profile.ts), [`server/utils/domain.js`](server/utils/domain.js) |
| **Transport & Request Boundaries** | `x-powered-by` disabled, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSRF `Origin` / `Sec-Fetch-Site` validation for state-changing methods, and `20 kb` default JSON body cap outside explicit media upload routes. | [`server/index.js`](server/index.js) |

---

## 4. Security Verification Evidence

- **Backend Security & Race Tests**: Executed [`server/identity-hub.test.js`](server/identity-hub.test.js), [`server/password-reset.test.js`](server/password-reset.test.js), [`server/avatar.test.js`](server/avatar.test.js), [`server/remediation.test.js`](server/remediation.test.js), and [`server/edge.test.js`](server/edge.test.js) — **111 / 111 tests passed** (`0` failures), explicitly covering cross-user `403` media theft attempts, `400` cross-user/malformed reorders, failure-injected DB-first deletion, concurrent `Promise.all` avatar replacements and double deletions, path traversal rejection, JWT tampering, NoSQL payload sanitization, and expired/concurrent reset tokens.
- **Production Dependency Audit (`npm audit --omit=dev`)**: Root = `0 vulnerabilities`; Server = `0 vulnerabilities`.
