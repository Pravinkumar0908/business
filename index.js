/* =========================
   FORCE IPV4 (VERY TOP)
========================= */
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === "number") {
    options = { family: 4 };
  } else {
    options = Object.assign({}, options, { family: 4 });
  }
  return origLookup.call(this, hostname, options, callback);
};

/* =========================
   LOAD ENV (DEV ONLY)
========================= */
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();

/* =========================
   SECURITY MIDDLEWARE
========================= */

// 1. Helmet — HTTP headers protection
app.use(helmet());

// 2. CORS — Control who can access your API
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://your-frontend-domain.com"  // ← Replace with real frontend URL later
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 3. Rate Limiting — Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per IP per 15 min
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/", limiter);

// Stricter limit for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // Only 20 login attempts per 15 min
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes."
  }
});

/* =========================
   BODY PARSER
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   LOGGING
========================= */
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

/* =========================
   REQUEST LOGGER (Custom)
========================= */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* =========================
   DATABASE INIT
========================= */
const pool = require("./src/config/db");

/* =========================
   HEALTH CHECK ENDPOINTS
========================= */

// Basic health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Deep health check (with DB)
app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).json({
      status: "OK",
      database: "Connected",
      serverTime: result.rows[0].now,
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(503).json({
      status: "ERROR",
      database: "Disconnected",
      error: err.message
    });
  }
});

// Readiness check (for monitoring tools)
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ready: true });
  } catch (err) {
    res.status(503).json({ ready: false });
  }
});

/* =========================
   ROOT ROUTE
========================= */
app.get("/", (req, res) => {
  res.json({
    name: "Business API",
    version: "1.0.0",
    status: "Running",
    docs: {
      health: "/health",
      healthDB: "/health/db",
      ready: "/ready"
    }
  });
});

/* =========================
   AUTH MIDDLEWARE
========================= */
const authMiddleware = require("./src/middleware/authMiddleware");

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route working",
    user: req.user
  });
});

/* =========================
   API ROUTES
========================= */
app.use("/api/auth", authLimiter, require("./src/routes/authRoutes"));
app.use("/api/debug", require("./src/routes/debugRoutes"));
app.use("/api/staff", require("./src/routes/staffRoutes"));
app.use("/api/services", require("./src/routes/serviceRoutes"));
app.use("/api/analytics", require("./src/routes/analyticsRoutes"));
app.use("/api/expenses", require("./src/routes/expenseRoutes"));
app.use("/api/users", require("./src/routes/userRoutes"));
app.use("/api/payroll", require("./src/routes/payrollRoutes"));
app.use("/api/dashboard", require("./src/routes/dashboardRoutes"));
app.use("/api/sales", require("./src/routes/saleRoutes"));
app.use("/api/appointments", require("./src/routes/appointmentRoutes"));
app.use("/api/invoices", require("./src/routes/invoiceRoutes"));
app.use("/api/plans", require("./src/routes/planRoutes"));
app.use("/api/subscriptions", require("./src/routes/subscriptionRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found: ${req.method} ${req.originalUrl}`
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

/* =========================
   GRACEFUL SHUTDOWN
========================= */
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: /health`);
});