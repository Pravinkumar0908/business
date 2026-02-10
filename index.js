if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// DB connect
require("./src/config/db");

// Health
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// ✅ ALL ROUTES
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/services", require("./src/routes/serviceRoutes"));
app.use("/api/staff", require("./src/routes/staffRoutes"));
app.use("/api/appointments", require("./src/routes/appointmentRoutes"));
app.use("/api/invoices", require("./src/routes/invoiceRoutes"));
app.use("/api/expenses", require("./src/routes/expenseRoutes"));
app.use("/api/dashboard", require("./src/routes/dashboardRoutes"));
app.use("/api/products", require("./src/routes/productRoutes"));
app.use("/api/customers", require("./src/routes/customerRoutes"));
app.use("/api/suppliers", require("./src/routes/supplierRoutes"));

// ✅ RESTAURANT ROUTES
app.use("/api/tables", require("./src/routes/tableRoutes"));
app.use("/api/menu", require("./src/routes/menuRoutes"));
app.use("/api/orders", require("./src/routes/orderRoutes"));

// ✅ STAFF AUTH (PIN-based login, role management)
app.use("/api/staff-auth", require("./src/routes/staffAuthRoutes"));

// 404
app.use((req, res) => {
  res.status(404).json({
    message: `Route Not Found: ${req.method} ${req.originalUrl}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});