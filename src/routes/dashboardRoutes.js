const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/stats", auth, async (req, res) => {
  try {
    const salonId = req.salonId;

    // Basic counts (parallel)
    const [servicesRes, staffRes, appointmentsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count FROM "Service" WHERE "salonId" = $1', [salonId]),
      pool.query('SELECT COUNT(*)::int as count FROM "Staff" WHERE "salonId" = $1', [salonId]),
      pool.query('SELECT COUNT(*)::int as count FROM "Appointment" WHERE "salonId" = $1', [salonId]),
    ]);

    const totalServices = servicesRes.rows[0]?.count || 0;
    const totalStaff = staffRes.rows[0]?.count || 0;
    const totalAppointments = appointmentsRes.rows[0]?.count || 0;

    // Today's range
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Sales today
    let totalSalesToday = 0;
    let totalSalesAmountToday = 0;
    try {
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as count, COALESCE(SUM("totalAmount"), 0) as total FROM "Sale" WHERE "salonId" = $1 AND "date" >= $2 AND "date" <= $3',
        [salonId, startOfToday, endOfToday]
      );
      totalSalesToday = rows[0]?.count || 0;
      totalSalesAmountToday = Number(rows[0]?.total) || 0;
    } catch (e) { /* no sales data */ }

    // Expenses today
    let totalExpensesToday = 0;
    try {
      const { rows } = await pool.query(
        'SELECT COALESCE(SUM("amount"), 0) as total FROM "Expense" WHERE "salonId" = $1 AND "date" >= $2 AND "date" <= $3',
        [salonId, startOfToday, endOfToday]
      );
      totalExpensesToday = Number(rows[0]?.total) || 0;
    } catch (e) { /* no expense data */ }

    const dailyProfit = totalSalesAmountToday - totalExpensesToday;

    // Pending payments
    let pendingPayments = 0;
    try {
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as count FROM "Invoice" WHERE "salonId" = $1 AND "status" = $2',
        [salonId, "unpaid"]
      );
      pendingPayments = rows[0]?.count || 0;
    } catch (e) { /* no invoice data */ }

    // Upcoming appointments (next 5)
    let upcomingAppointments = [];
    try {
      const { rows } = await pool.query(
        'SELECT * FROM "Appointment" WHERE "salonId" = $1 AND "date" >= NOW() ORDER BY "date" ASC LIMIT 5',
        [salonId]
      );
      upcomingAppointments = rows;
    } catch (e) { /* no upcoming */ }

    res.json({
      totalServices,
      totalStaff,
      totalAppointments,
      totalSalesToday,
      totalSalesAmountToday,
      totalExpensesToday,
      dailyProfit,
      pendingPayments,
      upcomingAppointments,
      monthlyRevenue: [],
      topServices: [],
      staffPerformance: [],
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err.message);
    res.status(500).json({ message: "Failed to load dashboard data. Please try again." });
  }
});

module.exports = router;