import path from "node:path";
import dns from "node:dns";
if (process.env.DNS_SERVERS) {
  try {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
  } catch {}
}
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import ticketRoutes from "./routes/tickets.js";
import eventRoutes from "./routes/events.js";
import adminRoutes from "./routes/admin.js";
import User from "./models/User.js";
import Media from "./models/Media.js";

const missing = ["MONGO_URI", "JWT_SECRET"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Serve public uploads statically
const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

// Stream MongoDB-backed media (avatars & posters)
app.get(["/api/media/:id", "/api/v1/media/:id"], async (req, res) => {
  try {
    const rawId = req.params.id.split(".")[0];
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(404).json({ message: "Media not found." });
    }

    const media = await Media.findById(rawId);
    if (!media) {
      return res.status(404).json({ message: "Media not found." });
    }

    res.set({
      "Content-Type": media.contentType,
      "Content-Length": media.data.length,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });

    res.end(media.data);
  } catch (error) {
    console.error("Error streaming media from MongoDB:", error);
    res.status(500).json({ message: "Failed to load media." });
  }
});

// Fallback for older /uploads/ paths to check MongoDB Media
app.get(["/uploads/avatars/:id", "/uploads/banners/:id", "/uploads/projects/:id", "/uploads/:id"], async (req, res, next) => {
  try {
    const rawId = req.params.id.split(".")[0];
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      const media = await Media.findById(rawId);
      if (media) {
        res.set({
          "Content-Type": media.contentType,
          "Content-Length": media.data.length,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(media.data);
      }
    }
  } catch {}
  next();
});

// Dedicated parsers for image upload endpoints (up to 6mb)
app.use(
  ["/api/admin/events/upload-poster", "/api/v1/admin/events/upload-poster"],
  express.raw({ type: ["image/*", "application/octet-stream"], limit: "6mb" })
);
app.use(
  ["/api/admin/events/upload-poster", "/api/v1/admin/events/upload-poster"],
  express.json({ limit: "6mb" })
);

// Dedicated parsers for avatar, banner & project image upload endpoints (up to 3mb)
app.use(
  [
    "/api/users/me/avatar",
    "/api/v1/users/me/avatar",
    "/api/users/me/banner",
    "/api/v1/users/me/banner",
    "/api/users/me/projects/image",
    "/api/v1/users/me/projects/image",
  ],
  express.raw({ type: ["image/*", "application/octet-stream"], limit: "3mb" })
);
app.use(
  [
    "/api/users/me/avatar",
    "/api/v1/users/me/avatar",
    "/api/users/me/banner",
    "/api/v1/users/me/banner",
    "/api/users/me/projects/image",
    "/api/v1/users/me/projects/image",
  ],
  express.json({ limit: "3mb" })
);

// Standard JSON limit for all other routes (DoS prevention)
app.use(express.json({ limit: "20kb" }));

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});

// Health check endpoints for Docker / K8s / monitoring probes
app.get(["/health", "/ready", "/api/health", "/api/v1/health"], (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "healthy" : "degraded",
    database: isConnected ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

function getAllowedOrigins() {
  const envUrls = (process.env.CLIENT_URL || "")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set(envUrls);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const clean = origin.replace(/\/$/, "");
  const allowed = getAllowedOrigins();
  if (allowed.has(clean)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean);
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    return next();
  }

  res.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  });

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isTrustedRequest(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return req.headers["sec-fetch-site"] !== "cross-site";
  }

  const ownOrigin = `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
  if (origin.replace(/\/$/, "") === ownOrigin || isOriginAllowed(origin)) {
    return true;
  }
  return false;
}

app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isTrustedRequest(req)) {
    return next();
  }

  res.status(403).json({ message: "Request blocked: it did not come from this site." });
});

// Mount /api endpoints
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/admin", adminRoutes);

// Attendance shortcut for backward-compatible README spec
app.post(["/api/attendance/scan", "/api/v1/attendance/scan"], (req, res, next) => {
  req.url = "/attendance/scan";
  adminRoutes(req, res, next);
});

// Mount /api/v1 aliases for backward compatibility
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/admin", adminRoutes);

// 404 handler for API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err.message);
    return res.status(status).json({ message: "Server error. Try again." });
  }
  res.status(status).json({ message: "Invalid request." });
});

await mongoose.connect(process.env.MONGO_URI);
await User.init();

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});

function shutdown() {
  server.close(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
