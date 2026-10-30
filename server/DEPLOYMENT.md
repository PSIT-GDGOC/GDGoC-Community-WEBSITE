# 🚀 GDGoC PSIT Full-Stack Platform — Production Deployment Guide & Runbook

This comprehensive runbook provides complete, step-by-step instructions for deploying and operating the full-stack **GDGoC PSIT Community Platform** (Frontend React 19 + Backend Express TypeScript + MongoDB Atlas) in staging and production environments.

---

## 📋 1. Architecture & System Topology

```mermaid
graph TD
    Client["Browser / Mobile Client"]
    Vercel["Frontend: Vercel / Netlify<br/>(React 19 + Vite + Tailwind v4)"]
    Render["Backend API: Render / Railway / Docker<br/>(Node 22 + Express + TypeScript)"]
    Atlas[("Cloud DB: MongoDB Atlas<br/>(Replica Set + Transactions)")]
    Resend["SMTP Service<br/>(Resend / SendGrid / Gmail)"]

    Client -->|HTTPS / WSS| Vercel
    Vercel -->|REST API Requests with Cookies| Render
    Render -->|Mongoose Pool| Atlas
    Render -->|Transactional Emails| Resend

    style Vercel fill:#3b82f6,color:#fff
    style Render fill:#10b981,color:#fff
    style Atlas fill:#059669,color:#fff
    style Resend fill:#f59e0b,color:#000
```

| Component | Technology | Recommended Host | Production URL / Route |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Three.js, Tailwind v4 | Vercel / Netlify / Cloudflare | `https://gdgocpsit.com` |
| **Backend API** | Node.js 22, Express 4.x, TypeScript | Render / Railway / Docker VPS | `https://api.gdgocpsit.com` |
| **Database** | MongoDB Atlas v6.0+ (M0/M10) | MongoDB Cloud (AWS Mumbai `ap-south-1`) | `mongodb+srv://...` |
| **Authentication** | JWT in `HttpOnly` Cookies & Bearer fallback | Express Middleware | 15m Access Token, 7d Refresh Token |
| **Email Service** | Nodemailer (SMTP) | Resend / SendGrid / Google Workspace | `no-reply@gdgocpsit.com` |
| **Container** | Multi-Stage Alpine Linux | Docker Hub / GitHub Packages | `server/Dockerfile` |

---

## 🔑 2. Environment Variables Matrix

### A. Backend (`server/.env`)
Configure these variables in your backend cloud dashboard (Render, Railway, or VPS):

| Variable | Required | Production Value / Format | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables secure cookies, strict CORS, disables stack traces |
| `PORT` | No | `5000` (or host-assigned `$PORT`) | Port Express listens on |
| `API_PREFIX` | No | `/api/v1` | Versioned prefix for all REST endpoints |
| `CLIENT_URL` | **Yes** | `https://gdgocpsit.com` | Primary frontend origin allowed by CORS credentials |
| `MONGO_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/gdgoc_community` | Cloud MongoDB connection string |
| `JWT_ACCESS_SECRET` | **Yes** | 64-char hex string (`crypto.randomBytes(32)`) | Secret key signing access tokens (15m expiry) |
| `JWT_REFRESH_SECRET` | **Yes** | 64-char hex string (`crypto.randomBytes(32)`) | Secret key signing refresh tokens (7d expiry) |
| `COOKIE_SECRET` | **Yes** | 64-char hex string (`crypto.randomBytes(32)`) | Key for signing Express cookie jar |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Lifetime of access token cookie |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Lifetime of refresh token cookie |
| `SUPERADMIN_EMAIL` | **Yes** | `lead@gdgocpsit.com` | Default email initialized by `npm run seed:admin` |
| `SUPERADMIN_PASSWORD` | **Yes** | Strong password (min 8 chars) | Initial password for the lead account |
| `SUPERADMIN_NAME` | No | `GDGoC PSIT Lead` | Display name for the primary administrator |
| `SMTP_HOST` | Optional | `smtp.resend.com` | SMTP relay server for ticket and status emails |
| `SMTP_PORT` | Optional | `587` | Port for TLS (`587`) or SSL (`465`) |
| `SMTP_USER` | Optional | `resend` | SMTP username |
| `SMTP_PASS` | Optional | API key / App password | Leave blank to log emails to console in staging |
| `EMAIL_FROM` | Optional | `"GDGoC PSIT" <no-reply@gdgocpsit.com>` | Verified sender address |

### B. Frontend (`.env` in root)
Configure this variable in your frontend cloud dashboard (Vercel, Netlify):

| Variable | Required | Recommended Production Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Optional | `https://api.gdgocpsit.com/api/v1` | Full URL to the backend API. If omitted in single-domain or proxy deployments, the frontend automatically defaults to relative `/api/v1`. |

---

### Generating Cryptographic Production Secrets
Run this command in any terminal to generate strong, unique 256-bit secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
*(Generate 3 distinct keys: one for `JWT_ACCESS_SECRET`, one for `JWT_REFRESH_SECRET`, and one for `COOKIE_SECRET`)*

---

## 🗄️ 3. Step-by-Step: MongoDB Atlas Setup (Cloud Database)

1. **Create an Account:** Go to [MongoDB Atlas](https://cloud.mongodb.com/) and register.
2. **Build a Cluster:**
   - Choose **M0 Free** (or M10 Dedicated for heavy traffic).
   - Provider: **AWS**, Region: **Mumbai (`ap-south-1`)** (closest to Kanpur/India for lowest latency).
   - Cluster Name: `gdgoc-cluster`.
3. **Configure Database Credentials:**
   - Go to **Security** → **Database Access** → **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `gdgoc_admin`.
   - Autogenerate a secure password (save it safely).
   - Built-in Role: `Read and write to any database`.
4. **Configure Network IP Access:**
   - Go to **Security** → **Network Access** → **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) since cloud hosts (Render/Railway/Vercel) use dynamic outbound IP addresses.
5. **Get Connection String:**
   - Go to **Database Deployments** → Click **Connect** → **Drivers (Node.js)**.
   - Copy URI and replace `<password>` and database name:
     ```text
     mongodb+srv://gdgoc_admin:<password>@gdgoc-cluster.xxxx.mongodb.net/gdgoc_community?retryWrites=true&w=majority
     ```

---

## ⚙️ 4. Step-by-Step: Backend Deployment

### Option A: Render.com (Recommended for Free & Managed Tier)
1. Push your repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
3. Connect your GitHub repository (`GDGoC-Community-WEBSITE`).
4. Fill in the service configuration:
   - **Name:** `gdgoc-psit-api`
   - **Region:** `Singapore` or `Frankfurt` (closest available to India)
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** `Free` or `Starter`
5. Click **Advanced** → **Add Environment Variable** and paste all variables from Section 2A.
6. Set **Health Check Path** to: `/api/v1/health`
7. Click **Create Web Service**.
8. Once deployment finishes, copy the backend URL (e.g. `https://gdgoc-psit-api.onrender.com`).

---

### Option B: Railway.app (Fastest Deployment)
1. Log into [Railway.app](https://railway.app/) and create a **New Project**.
2. Select **Deploy from GitHub repo** and pick the repository.
3. Click on the created service box → **Settings**:
   - **Root Directory:** `/server`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
4. In the **Variables** tab, add your environment variables.
5. In the **Networking** tab, click **Generate Domain** (e.g. `https://gdgoc-api.up.railway.app`).

---

### Option C: Self-Hosted Docker Container (VPS / EC2 / Droplet)
1. Connect to your Linux server via SSH.
2. Build the production multi-stage container:
   ```bash
   docker build -t gdgoc-backend:latest ./server
   ```
3. Run the container:
   ```bash
   docker run -d \
     --name gdgoc-backend \
     -p 5000:5000 \
     --env-file ./server/.env \
     --restart unless-stopped \
     gdgoc-backend:latest
   ```
4. Verify container health:
   ```bash
   docker ps
   curl -i http://localhost:5000/api/v1/health
   ```

---

## 🌐 5. Step-by-Step: Frontend Deployment

### Option A: Vercel (Recommended for React + Vite)
1. Log into [Vercel](https://vercel.com/) and click **Add New** → **Project**.
2. Import your GitHub repository (`GDGoC-Community-WEBSITE`).
3. Configure the build settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./` (leave as root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. In **Environment Variables**, add:
   - `VITE_API_URL` = `https://<your-backend-domain>/api/v1` (e.g. `https://gdgoc-psit-api.onrender.com/api/v1`)
5. Click **Deploy**.
6. Once deployed, copy your frontend URL (e.g. `https://gdgocpsit.vercel.app`).
7. **Important:** Go back to your Backend dashboard (Render/Railway) and set `CLIENT_URL` to this frontend URL so CORS accepts cookie requests!

---

### Option B: Netlify
1. Log into [Netlify](https://app.netlify.com/) and click **Add new site** → **Import an existing project**.
2. Pick GitHub and choose your repository.
3. Settings:
   - **Base directory:** (empty)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://<your-backend-domain>/api/v1`
5. Click **Deploy site**.

---

## 🍪 6. Production Domain & Cookie Architecture

In production, user authentication uses **`HttpOnly` cookies** (`accessToken` and `refreshToken`). 

### Scenario 1: Custom Domain with Subdomain (Best Practice)
If using a custom domain (e.g. `gdgocpsit.com`):
* **Frontend:** `https://gdgocpsit.com`
* **Backend:** `https://api.gdgocpsit.com`
Because both are subdomains of `gdgocpsit.com`, cookies with `sameSite: "lax"` work out of the box with zero third-party cookie blocking on iOS/Safari and Chrome.

### Scenario 2: Single-Domain Reverse Proxy via Vercel (Zero CORS)
If you deploy the frontend on Vercel and the backend on Render, you can route all `/api/*` calls through Vercel rewrites so the browser treats the backend as same-origin!

Create a `vercel.json` in the root of your project:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://gdgoc-psit-api.onrender.com/api/:path*"
    }
  ]
}
```
With this setup, you do not even need `VITE_API_URL` — all requests hit `/api/v1` on the same domain with 100% cookie reliability!

---

## 🛡️ 7. Database Initialization & Seeding Runbook

Once the backend is deployed and connected to MongoDB Atlas, run the database seeders:

### 1. Initialize Primary Superadmin Account (Required in Production)
Execute this command in your cloud host's terminal or web console:
```bash
npm run seed:admin
```
* **What it does:** Reads `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from the environment. Creates the superadmin user or ensures their role is `"admin"`.
* **Login at:** Navigate to your website, click **Sign In**, and log in with your superadmin credentials to unlock the **"⚡ Admin"** console!

### 2. Seed Realistic Demo Data (Optional for Staging / Previews)
If deploying to a staging server or demo instance and you want pre-populated events, projects, and applications:
```bash
npm run seed:dev
```
* **What it does:** Seeds 3 published events (*Cloud Community Day*, *Web & Next.js Jam*, *Solution Challenge Hackathon*), 3 showcase projects, sample student applications, and test digital tickets with QR tokens.

---

## 🩺 8. Monitoring, Health Checks & Verification

After deployment, verify that all systems are operational:

| Check | URL | Expected Response |
| :--- | :--- | :--- |
| **API Liveness Probe** | `GET /api/v1/health` | `200 OK` (`"status": "healthy"`, uptime, memory) |
| **DB Readiness Probe** | `GET /api/v1/ready` | `200 OK` (`"database": "connected"`, state: 1) |
| **Interactive Docs** | `GET /docs` | Swagger UI page listing all 21 endpoints |
| **Public Events** | `GET /api/v1/events` | `200 OK` with JSON array of events |
| **Public Projects** | `GET /api/v1/projects` | `200 OK` with JSON array of projects |

---

## 🚨 9. Troubleshooting & Incident Response Runbook

### Issue: "CORS error: Credential is not supported if the CORS header 'Access-Control-Allow-Origin' is '*'"
* **Cause:** `CLIENT_URL` in backend `.env` does not match the frontend URL.
* **Fix:** Ensure backend `CLIENT_URL` is set to the exact frontend origin including `https://` (e.g. `https://gdgocpsit.com` with NO trailing slash).

### Issue: "Database connection failed / MongooseServerSelectionError"
* **Cause:** MongoDB Atlas IP whitelist is blocking the connection.
* **Fix:** Go to MongoDB Atlas → **Network Access** → ensure `0.0.0.0/0` is active.

### Issue: "User logs in successfully, but passes say 'Sign In Required'"
* **Cause:** Cross-origin cookie policy blocking `accessToken` cookie.
* **Fix:** Ensure `credentials: "include"` is set (already implemented in `src/lib/api.ts`) and use the custom subdomain or Vercel rewrite described in Section 6.

### Issue: "Event capacity race condition / overselling"
* **Protection:** The backend uses atomic MongoDB operations (`findOneAndUpdate` with `seatsRemaining: { $gt: 0 }` and `$inc: { seatsRemaining: -1 }`). It is mathematically impossible to oversell seats even under high concurrency.
