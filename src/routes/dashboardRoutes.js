const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.userId;

    const services = await pool.query("SELECT COUNT(*) FROM services WHERE user_id=$1", [userId]);
    const staff = await pool.query("SELECT COUNT(*) FROM staff WHERE user_id=$1", [userId]);
    const appointments = await pool.query("SELECT COUNT(*) FROM appointments WHERE user_id=$1", [userId]);
    const revenue = await pool.query("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE user_id=$1", [userId]);
    const expenses = await pool.query("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id=$1", [userId]);

    res.json({
      totalServices: parseInt(services.rows[0].count),
      totalStaff: parseInt(staff.rows[0].count),
      totalAppointments: parseInt(appointments.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total),
      totalExpenses: parseFloat(expenses.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;