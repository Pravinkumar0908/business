const express = require("express");
require("dotenv").config();

const app = express();
app.use(express.json());

/* =========================
   REQUEST LOGGER
========================= */
app.use((req, res, next) => {
  console.log("Incoming:", req.method, req.url);
  next();
});


const authMiddleware = require("./src/middleware/authMiddleware");

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route working",
    user: req.user
  });
});

/* =========================
   DATABASE INIT
========================= */
require("./src/config/db");

/* =========================
   ROOT ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Backend Running (PostgreSQL Mode)");
});

/* =========================
   ROUTES
========================= */
app.use("/api/debug", require("./src/routes/debugRoutes"));
app.use("/api/auth", require("./src/routes/authRoutes"));
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
app.use("/api/dashboard", require("./src/routes/dashboardRoutes"));
app.use("/api/plans", require("./src/routes/planRoutes"));
app.use("/api/subscriptions", require("./src/routes/subscriptionRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));



/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
