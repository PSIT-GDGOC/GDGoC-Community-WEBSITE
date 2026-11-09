# GDGoC PSIT — Production Deployment & Rollout Checklist

**Target Branch**: `feat/dynamic-identity-hub` (PR #25 targeting `main`)  
**Target Environment**: Production / Staging  
**Application**: GDGoC PSIT Community Website  
**Updated**: November 9, 2026  

Follow this checklist during deployment to ensure zero downtime, persistent media storage, valid TTL/ownership database indexes, and verified smoke behavior.

---

## 1. Pre-Deployment Preparation

### 1.1 Database Snapshot & Backup
Execute a database backup before rolling out new server code:
```bash
mongodump --uri="<PRODUCTION_MONGO_URI>" --out="/backups/gdgoc-identity-hub-$(date +%F)"
```

### 1.2 Environment Variables
Confirm these variables in your backend runtime environment (`server/index.js`, `server/utils/storage.js`, `server/utils/email.js`, `server/utils/domain.js`):

| Variable | Required | Description | Example / Notes |
|---|---|---|---|
| `MONGO_URI` | **Yes** | Production MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/gdgoc?retryWrites=true&w=majority` |
| `JWT_SECRET` | **Yes** | Cryptographic secret (`>=64` bytes) for session JWT signing | `openssl rand -base64 64` |
| `CLIENT_URL` | **Yes** | Allowed frontend origin(s), comma-separated | `https://gdgoc-community-website.vercel.app` |
| `NODE_ENV` | **Yes** | Runtime environment mode | `production` |
| `ALLOWED_EMAIL_DOMAINS` | **Yes (Prod)** | Campus email domains allowlist (`CAMPUS_EMAIL_DOMAINS` also supported) | `psit.ac.in` |
| `CLOUDINARY_URL` *(or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)* | Recommended | Persistent image CDN for avatars (`gdgoc-avatars`), banners (`gdgoc-banners`), project images (`gdgoc-projects`), and event posters | `cloudinary://key:secret@cloud_name` |
| `STORAGE_PROVIDER` / `ALLOW_MONGODB_STORAGE` | Conditional | If Cloudinary is not configured: avatars, banners, and project images default to MongoDB (`Media`); event posters in `production` require `ALLOW_MONGODB_STORAGE=true` (and `STORAGE_PROVIDER=mongodb` unless Cloudinary is set) | `STORAGE_PROVIDER=mongodb`, `ALLOW_MONGODB_STORAGE=true` |
| `RESEND_API_KEY` | **Yes (Prod)** | Resend API key for password reset delivery | `re_...` |
| `EMAIL_FROM` | Optional | Verified sender identity (defaults to `GDGoC PSIT <noreply@psit.ac.in>`) | `GDGoC PSIT <noreply@psit.ac.in>` |
| `COOKIE_DOMAIN` | Optional | Cross-subdomain cookie scope if API and UI share a root domain | `.example.com` |
| `PORT` | Optional | API listen port (defaults to `5000`) | `5000` |

---

## 2. Database Schema & Media Storage Notes

### 2.1 Zero-Downtime Additive Schema Changes
All Dynamic Identity Hub additions in [`server/models/User.js`](server/models/User.js) (`headline`, `college`, `specialization`, `bannerTheme`, `bannerUrl`, `bannerPublicId`, `bannerProvider`, `accentColor`, `cardTheme`, `socials`, `skills`, `projects`, `pendingProjectImages`, `memberVerified`, `memberVerifiedAt`, `privacy`) and [`server/models/Media.js`](server/models/Media.js) (`owner` reference + extended `type` enum `["avatar", "poster", "banner", "project"]`) are strictly additive with backward-compatible defaults. Existing member documents read cleanly without a blocking migration.

> **Legacy Media Note**: Pre-existing `Media` documents created before `Media.owner` was introduced have `owner: null`. Existing projects that already point to those images continue to work via each project's own `imageUrl` reference check; any newly uploaded project image automatically binds `owner: req.user._id`.

### 2.2 Media Storage (`Media` Collection vs Cloudinary)
- **Native MongoDB Storage (`Media` collection)**:
  - Stores binary buffers for `avatar`, `poster`, `banner`, and `project` assets and streams them via `GET /api/media/:id` (and `/api/v1/media/:id`) with `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`.
- **Cloudinary Storage**:
  - Signs uploads via SHA-1 using `CLOUDINARY_*` credentials and deletes replaced assets automatically via DB-first cleanup (`executeDbFirstMediaClear`).

### 2.3 Index Verification
Mongoose registers schema indexes on startup (`User.init()`, model initialization). Confirm the password reset TTL index (`3600s` expiry) and `Media.owner` index in MongoDB if inspecting manually:
```javascript
db.passwordresets.getIndexes(); // expects { expiresAt: 1 } with expireAfterSeconds: 3600
db.media.getIndexes();          // expects { owner: 1 }
```
If syncing core registration/email indexes via the helper script (`server/migrate.js` runs in `--dry-run` by default), never pass `--apply` without a verified backup (`--confirm-backup`) and explicit policy flag.

---

## 3. Build & Deployment Steps

### 3.1 Backend Deployment (`server/`)
1. Checkout branch `feat/dynamic-identity-hub` (post PR #25 merge/review).
2. Install production dependencies strictly from the updated lockfile (includes `body-parser@2.4.0`):
   ```bash
   cd server
   npm ci --omit=dev
   ```
3. Run verification tests against staging/CI MongoDB (`npm test`) if running in CI/CD before promotion.
4. Start the API (`node index.js` or process manager with `.env` loaded).

### 3.2 Frontend Deployment (Repository Root)
1. Install dependencies and run the full check + build pipeline:
   ```bash
   npm ci
   npm run check
   ```
2. Deploy the self-contained single-file bundle `dist/index.html` (generated by `vite-plugin-singlefile`) to your static host.

---

## 4. Post-Deployment Smoke Verification Checklist

- [ ] **Health Check**: Query `GET /api/health` → expect HTTP `200` with `{ status: "healthy", database: "connected" }`.
- [ ] **Forgot Password Flow**: On `#/login`, verify `"Forgot password?"` sends generic `200`, delivers 15-minute reset link, resets password once (second use rejected), and invalidates prior sessions (`tokenVersion`). Confirm zero password-change inputs exist on `#/profile`.
- [ ] **Avatar & Custom Banner Lifecycle**: On `#/profile`, upload/crop/save an avatar and upload/reset a custom cover banner; hard-refresh and confirm persistence via `/api/media/...` (or Cloudinary URL); test deletion and verify old asset URL returns `404`.
- [ ] **Dynamic Identity Hub & Editor Guard**: Edit headline, categorized skills, social links (`privacy.showEmail` stays off by default), and up to 6 featured projects (plus project image upload & reorder). Confirm `Escape` / `Done` with unsaved edits prompts `"Discard unsaved changes?"`.
- [ ] **Membership Card & Ticket Resilience**: Verify Member Card flips smoothly front↔pass, shows `"Community Member (Email Verified)"` vs `"Verified Chapter Member"` strictly according to `emailVerified`/`memberVerified`, and matches verified `/api/tickets` counts.
- [ ] **Responsive Mobile Layout**: Spot-check `#/profile` and the editor modal at `320px` and `390px` viewport widths to confirm `0px` horizontal overflow.
