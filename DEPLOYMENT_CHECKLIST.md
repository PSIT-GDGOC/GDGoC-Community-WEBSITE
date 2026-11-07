# GDGoC PSIT — Production Deployment & Rollout Checklist

**Target Branch**: `remediation/fullstack-profile-hardening`  
**Target Environment**: Production / Staging  
**Application**: GDGoC PSIT Community Website  
**Date**: November 7, 2026  

Follow this checklist strictly during deployment to ensure zero downtime, secure transition of user sessions, and database integrity.

---

## 1. Pre-Deployment Preparation

### 1.1 Database Snapshot & Backup
Execute a complete database backup prior to deploying new code or restarting containers:
```bash
mongodump --uri="<PRODUCTION_MONGO_URI>" --out="/backups/gdgoc-pre-profile-remediation-$(date +%F)"
```

### 1.2 Verify Environment Variables
Ensure the following variables are defined in the deployment environment (e.g. Render, Railway, Fly.io, Vercel, Docker):

| Variable | Required | Description | Example / Recommended Value |
|---|---|---|---|
| `MONGO_URI` | **Yes** | Production MongoDB connection string with TLS/SSL | `mongodb+srv://user:pass@cluster.mongodb.net/gdgoc?retryWrites=true&w=majority` |
| `JWT_SECRET` | **Yes** | Cryptographic random secret for signing session cookies | 64+ char random string (`openssl rand -base64 64`) |
| `STORAGE_PROVIDER` | **Yes** | Persistent media storage engine | `mongodb` (recommended native storage) or `cloudinary` |
| `CLOUDINARY_URL` | Optional | Cloudinary API string (only if `STORAGE_PROVIDER=cloudinary`) | `cloudinary://key:secret@cloud_name` |
| `RESEND_API_KEY` | **Yes** | API key for transactional password reset emails | `re_...` |
| `EMAIL_FROM` | **Yes** | Verified sender email address | `GDGoC PSIT <noreply@psit.ac.in>` |
| `CLIENT_URL` | **Yes** | Fully qualified public frontend URL | `https://gdgoc-community-website.vercel.app` |
| `ALLOWED_EMAIL_DOMAINS` | **Yes** | Allowed campus email domains | `psit.ac.in` |
| `NODE_ENV` | **Yes** | Runtime environment mode | `production` |
| `PORT` | Optional | Application listening port (defaults to 5000) | `5000` |

---

## 2. Storage & Database Setup

### 2.1 Native MongoDB Media Storage (Recommended)
If `STORAGE_PROVIDER=mongodb`:
- All user avatar photos and event posters are stored in the native MongoDB `Media` collection (`server/models/Media.js`).
- Media survives container rebuilds, works without third-party cloud accounts, and scales with your MongoDB cluster.
- Media files are served via `GET /api/media/:id` and cached with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.

### 2.2 Password Reset TTL Index Verification
The `PasswordReset` model defines an automatic TTL index for token pruning:
```javascript
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```
Upon server startup, Mongoose registers this index. Verify via Mongo Shell:
```javascript
db.password_resets.getIndexes();
// Confirm { "expiresAt": 1 } has "expireAfterSeconds": 0
```

---

## 3. Deployment Procedure

### 3.1 Backend Deployment (API Server)
1. Pull branch `remediation/fullstack-profile-hardening`.
2. Install production dependencies:
   ```bash
   cd server
   npm ci --omit=dev
   ```
3. Run test suite verification:
   ```bash
   npm test
   ```
4. Start process manager (e.g. PM2 or Docker container):
   ```bash
   node index.js
   ```

### 3.2 Frontend Deployment (Client Single-File Bundle)
1. In repository root:
   ```bash
   npm ci
   npm run check
   ```
2. Verify `dist/index.html` was generated.
3. Deploy `dist/index.html` to static hosting (Vercel, Cloudflare Pages, Netlify).

---

## 4. Post-Deployment Verification (Smoke Tests)

Execute the following verification steps on the live production URL:

- [ ] **4.1 Health Check**
  - Query `GET /api/health` -> verify `{ status: "ok", uptime: ..., database: "connected" }`.
- [ ] **4.2 Forgot Password Flow**
  - Navigate to `#/login`, click "Forgot password?".
  - Submit registered email -> confirm generic confirmation message appears without errors.
  - Verify transactional reset email arrives in inbox with valid 15-minute token link.
  - Open reset link, set new password -> confirm successful reset and redirect to login.
  - Log in with new password -> confirm authentication succeeds and prior sessions are invalidated.
- [ ] **4.3 Profile Avatar Upload & Display**
  - Navigate to `#/profile`.
  - Upload a JPG/PNG/WebP image.
  - Use crop modal with zoom and arrow keys; click "Save photo".
  - Confirm avatar appears immediately on member card and navigation bar.
  - Hard refresh the page -> confirm image persists.
  - Test "Replace photo" and "Remove photo".
- [ ] **4.4 Digital Member Card Redesign**
  - Inspect Member Card: confirm Google 4-color stripe, role badge, initials fallback, member ID, and bio.
  - Click "Pass ↺" -> confirm card flips to reverse Chapter Pass view with verified badge and barcode.
  - Click "Front ↺" -> confirm smooth return to front view.
  - Verify `Upcoming`, `Attended`, and `Registered` activity counts match verified ticket data.
- [ ] **4.5 Mobile Responsiveness**
  - Open Chrome DevTools Device Mode; test viewports 320px, 360px, 390px, 768px, 1024px.
  - Confirm no horizontal scrolling or clipped cards.
