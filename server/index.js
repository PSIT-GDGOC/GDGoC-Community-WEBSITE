import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import ticketRoutes from "./routes/tickets.js";
import eventRoutes from "./routes/events.js";
import adminRoutes from "./routes/admin.js";
import projectRoutes from "./routes/projects.js";
import User from "./models/User.js";

const app = express();
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Helmet security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Managed by client build
  })
);

app.use(express.json({ limit: "50kb" }));

// Standard security headers
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});

// CORS handling
const allowedOrigins = new Set([
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has(origin) || !process.env.NODE_ENV || process.env.NODE_ENV !== "production")) {
    res.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    });
  }

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

  const ownOrigin = `${req.protocol}://${req.get("host")}`;
  return (
    origin === process.env.CLIENT_URL ||
    origin === ownOrigin ||
    allowedOrigins.has(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isTrustedRequest(req)) {
    return next();
  }

  res.status(403).json({ message: "Request blocked: it did not come from this site." });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/admin", adminRoutes);

// Central error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err.message);
    return res.status(status).json({ message: "Server error. Try again." });
  }
  res.status(status).json({ message: err.message || "Invalid request." });
});

export { app };

// Auto-connect and listen when executed directly
if (process.env.MONGO_URI && process.env.JWT_SECRET) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      await User.init();
    }
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`API on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Database connection failure:", err.message);
  }
}
