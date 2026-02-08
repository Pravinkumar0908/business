const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");

router.get("/stats", auth, async (req, res) => {
  try {
    const salonId = req.salonId;

    const [totalServices, totalStaff, totalAppointments, revenueAgg, expenseAgg] = await Promise.all([
      prisma.service.count({ where: { salonId } }),
      prisma.staff.count({ where: { salonId } }),
      prisma.appointment.count({ where: { salonId } }),
      prisma.invoice.aggregate({ where: { salonId }, _sum: { total: true } }),
      prisma.expense.aggregate({ where: { salonId }, _sum: { amount: true } })
    ]);

    res.json({
      totalServices,
      totalStaff,
      totalAppointments,
      totalRevenue: revenueAgg._sum.total || 0,
      totalExpenses: expenseAgg._sum.amount || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;