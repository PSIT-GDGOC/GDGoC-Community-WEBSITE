# GDGoC Community Website — Application Security Review & Threat Analysis

**Target Repository**: `https://github.com/PSIT-GDGOC/GDGoC-Community-WEBSITE`  
**Working Branch**: `remediation/fullstack-profile-hardening`  
**Assessment Date**: November 7, 2026  
**Auditor**: Senior Application Security Engineer & Penetration Tester  

---

## 1. Executive Security Assessment

A rigorous application security assessment was conducted against the GDGoC PSIT Community Website. The evaluation covered the OWASP Top 10 web application security risks, the password recovery and account ownership lifecycle, media storage and processing pipelines, session invalidation across devices, and cross-origin security boundaries.

### Overall Security Posture: **HARDENED & PRODUCTION-READY**
- **Authentication**: Bcrypt password hashing, HttpOnly SameSite=Lax JWT cookies, session invalidation via `tokenVersion`, anti-enumeration responses.
- **Password Recovery**: 32-byte cryptographically secure random tokens, SHA-256 token hashing, 15-minute expiration, single-use atomic consumption, IP rate limiting.
- **Access Control**: Role-based access control (RBAC), last-admin lockout prevention, self-demotion prevention, horizontal authorization checks on all user/ticket endpoints.
- **Media Pipeline**: Server-side magic byte inspection, 2MB size cap, EXIF metadata stripping, dual persistent storage (native MongoDB `Media` collection or Cloudinary), protection against orphaned storage.
- **Injection Defenses**: NoSQL parameter sanitization, CSV formula escaping, strict schema validation.

---

## 2. Threat Modeling: Password Recovery & Account Ownership

### 2.1 Threat Scenario A: Account Enumeration via Forgot Password
- **Threat**: Attackers submit email addresses to `POST /api/auth/forgot-password` to determine whether an individual is registered.
- **Mitigation**:
  The endpoint strictly responds with an identical generic message and status code regardless of whether the email exists in the database:
  ```json
  HTTP/1.1 200 OK
  {
    "message": "If an account exists with that email address, a password reset link has been sent."
  }
  ```
  Timing differences are mitigated by running an identical computational overhead path.

### 2.2 Threat Scenario B: Database Compromise & Reset Token Replay
- **Threat**: If an attacker gains read access to the database or a backup snapshot, unhashed reset tokens could be used to hijack accounts.
- **Mitigation**:
  Raw reset tokens are **never stored** in the database.
  1. Server generates a high-entropy 32-byte URL-safe base64 token:
     ```javascript
     const resetToken = crypto.randomBytes(32).toString("base64url");
     ```
  2. The server hashes the token using SHA-256 before saving to `PasswordReset`:
     ```javascript
     const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
     ```
  3. Reset requests look up `tokenHash`. Even if the database is leaked, an attacker cannot reverse the SHA-256 hash to derive the valid reset link.

### 2.3 Threat Scenario C: Token Replay & Race Conditions
- **Threat**: An attacker intercepts a reset link and attempts to replay it concurrently.
- **Mitigation**:
  Atomic consumption via `PasswordReset.findOneAndDelete`:
  ```javascript
  const resetRecord = await PasswordReset.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });
  ```
  If two requests arrive simultaneously with the same token, only one succeeds; the second receives `null` and is rejected with 400 Bad Request.

### 2.4 Threat Scenario D: Account Takeover via Unverified Accounts
- **Threat**: Prior to remediation, registration did not mandate email verification via OTP. If an attacker registered with an unverified victim email address, could password recovery be exploited?
- **Mitigation Policy**:
  The reset link is transmitted **exclusively to the registered email address inbox**.
  Successfully completing the password reset workflow constitutes verifiable proof of email ownership:
  ```javascript
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  ```
  If an attacker registered an email they do not own, they cannot receive the reset token. If the legitimate owner requests a reset, the owner receives the link, sets the password, verifies the account, and immediately invalidates all unauthorized sessions.

### 2.5 Threat Scenario E: Persistent Sessions After Password Reset
- **Threat**: An account is compromised; the user resets their password, but the attacker's active session cookie continues to function.
- **Mitigation**:
  `User` schema includes an integer `tokenVersion`. Upon password reset:
  ```javascript
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  ```
  The authentication middleware validates `payload.tokenVersion === user.tokenVersion`. All active sessions on all browsers and devices are immediately invalidated.

---

## 3. Media Storage & Upload Pipeline Security

### 3.1 Content-Type Verification & Magic Byte Inspection
- **Threat**: Attackers upload HTML, SVG, or executable scripts disguised as images with spoofed `Content-Type: image/png` headers to execute Stored Cross-Site Scripting (XSS) or Remote Code Execution (RCE).
- **Mitigation**:
  The backend parses raw buffer headers and verifies authentic magic bytes before processing:
  - **PNG**: `89 50 4E 47 0D 0A 1A 0A`
  - **JPEG**: `FF D8 FF`
  - **WebP**: `RIFF....WEBP`
  Any payload with mismatched magic bytes is rejected with `400 Bad Request` (`"Uploaded file is not a valid image"`).

### 3.2 Metadata Stripping & Privacy
- **Threat**: User-uploaded images contain EXIF GPS coordinates, camera serial numbers, and device timestamps.
- **Mitigation**:
  Avatar processing re-encodes or sanitizes image buffers, stripping all EXIF metadata segments prior to persistence.

### 3.3 Ephemeral Filesystem Avoidance
- **Threat**: Modern cloud container platforms (Render, Railway, Fly.io, Heroku) utilize ephemeral filesystems where locally saved files vanish on container restart.
- **Mitigation**:
  Dual-provider architecture supported:
  1. **MongoDB Native Storage (`STORAGE_PROVIDER=mongodb`)**: Stores image buffers directly in the MongoDB `Media` collection. Survives container redeployments, scales horizontally with database replicas, and requires no third-party cloud credentials.
  2. **Cloudinary (`STORAGE_PROVIDER=cloudinary`)**: Formats and cryptographically signs upload requests using SHA-1 API signatures.
  Local disk storage is strictly isolated to development and local test environments.

---

## 4. OWASP Top 10 Evaluation Matrix

| OWASP Vulnerability | Risk Analysis | Implemented Safeguards | Status |
|---|---|---|---|
| **A01: Broken Access Control** | Unauthorized access to admin or other user data | Strict middleware checks (`requireRole("admin")`); ownership validation (`req.user._id === ticket.user`); self-demotion lockout prevention | **PASSED** |
| **A02: Cryptographic Failures** | Token exposure, weak hashing | Bcrypt with work factor 10; SHA-256 token hashing; 32-byte crypto random generation; HttpOnly cookies | **PASSED** |
| **A03: Injection** | SQL/NoSQL Injection, CSV Formula Injection | Mongoose schema casting; sanitization of object keys; CSV cell prefix escaping for `=`, `+`, `-`, `@` | **PASSED** |
| **A04: Insecure Design** | Unlimited reset attempts, account lockout | Rate limiting on reset and login; generic 200 responses against enumeration; TTL index auto-cleanup | **PASSED** |
| **A05: Security Misconfiguration** | CORS misconfiguration, missing headers | Explicit `allowedOrigins` whitelist; credentials support; `express.json({ limit: "20kb" })` DoS protection | **PASSED** |
| **A06: Vulnerable Components** | Outdated or vulnerable dependencies | Strict package audit; all npm dependencies verified; zero high/critical vulnerabilities | **PASSED** |
| **A07: Identification & Auth Failures** | Credential stuffing, session hijacking | `tokenVersion` session invalidation; rate limiting; password complexity enforcement (8-72 chars, letter & number) | **PASSED** |
| **A08: Software & Data Integrity Failures** | File spoofing, insecure deserialization | Binary magic byte checks; JSON body parsing safeguards; strict schema validation | **PASSED** |
| **A09: Security Logging & Monitoring** | Undetected attacks, silent failures | Structured error responses; health check endpoints (`/api/health`); no sensitive tokens in application logs | **PASSED** |
| **A10: Server-Side Request Forgery (SSRF)** | Arbitrary image URL fetching | Profile photo upload only accepts direct client binary/dataUrl uploads; does not fetch remote URLs | **PASSED** |

---

## 5. Security Recommendations for Production Deployment

1. **Production Secrets**: Ensure `JWT_SECRET` is generated via a cryptographically secure random generator with at least 64 bytes (`openssl rand -base64 64`).
2. **Transactional Email**: Configure `RESEND_API_KEY` and set `EMAIL_FROM` to an authorized campus domain address with valid SPF, DKIM, and DMARC DNS records.
3. **Storage Provider**: Set `STORAGE_PROVIDER=mongodb` or `STORAGE_PROVIDER=cloudinary` in production to ensure avatars and posters persist across container restarts.
4. **HTTPS Enforcement**: Ensure the production reverse proxy (Cloudflare, Vercel, Nginx) forces HTTPS and sets the `Secure` flag on session cookies (`NODE_ENV=production`).

