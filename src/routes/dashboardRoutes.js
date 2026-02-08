const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");

router.get("/stats", auth, async (req, res) => {
  try {
    const salonId = req.salonId;
    // Basic counts
    const [totalServices, totalStaff, totalAppointments] = await Promise.all([
      prisma.service.count({ where: { salonId } }),
      prisma.staff.count({ where: { salonId } }),
      prisma.appointment.count({ where: { salonId } }),
    ]);

    // Today's range
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date();
    endOfToday.setHours(23,59,59,999);

    // Total sales today (count + amount) - avoid aggregate() (PgBouncer prepared-statement issue)
    let totalSalesToday = 0;
    let totalSalesAmountToday = 0;
    try {
      const salesToday = await prisma.sale.findMany({ where: { salonId, date: { gte: startOfToday, lte: endOfToday } }, select: { totalAmount: true } });
      totalSalesToday = salesToday.length;
      totalSalesAmountToday = salesToday.reduce((s, it) => s + (it.totalAmount || 0), 0);
    } catch (e) {
      totalSalesToday = 0;
      totalSalesAmountToday = 0;
    }

    // Daily expenses today - avoid aggregate()
    let totalExpensesToday = 0;
    try {
      const expensesToday = await prisma.expense.findMany({ where: { salonId, date: { gte: startOfToday, lte: endOfToday } }, select: { amount: true } });
      totalExpensesToday = expensesToday.reduce((s, it) => s + (it.amount || 0), 0);
    } catch (e) {
      totalExpensesToday = 0;
    }

    const dailyProfit = totalSalesAmountToday - totalExpensesToday;

    // Monthly revenue for last 6 months
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    // Monthly revenue for last 6 months - compute via findMany and sum to avoid aggregate()
    const monthlyRevenue = [];
    for (let idx = 0; idx < months.length; idx++) {
      const m = months[idx];
      try {
        const sales = await prisma.sale.findMany({
          where: {
            salonId,
            date: {
              gte: new Date(m.year, m.month - 1, 1),
              lt: new Date(m.year, m.month, 1),
            },
          },
          select: { totalAmount: true },
        });
        const total = sales.reduce((s, it) => s + (it.totalAmount || 0), 0);
        monthlyRevenue.push({ year: m.year, month: m.month, total });
      } catch (e) {
        monthlyRevenue.push({ year: m.year, month: m.month, total: 0 });
      }
    }

    // Top services (by quantity sold)
    let topServices = [];
    try {
      topServices = await prisma.saleItem.groupBy({
        by: ['serviceId'],
        where: { sale: { salonId } },
        _sum: { price: true },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5
      });
    } catch (e) {
      // Fallback if groupBy fails (e.g., prepared statement issues)
      const items = await prisma.saleItem.findMany({
        where: { sale: { salonId } },
        select: { serviceId: true, quantity: true },
      });
      const map = {};
      items.forEach(it => {
        map[it.serviceId] = (map[it.serviceId] || 0) + (it.quantity || 1);
      });
      const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const results = [];
      for (const [serviceId, qty] of sorted) {
        const svc = await prisma.service.findUnique({ where: { id: serviceId } });
        results.push({ serviceId, name: svc?.name || 'Unknown', qty });
      }
      topServices = results;
    }

    // Normalize topServices if groupBy returned structured objects
    let topServicesNormalized = [];
    if (Array.isArray(topServices)) {
      topServicesNormalized = await Promise.all(topServices.map(async s => {
        if (s.serviceId) {
          const svc = await prisma.service.findUnique({ where: { id: s.serviceId } });
          return { serviceId: s.serviceId, name: svc?.name || 'Unknown', count: s._count?.serviceId || 0, revenue: s._sum?.price || 0 };
        }
        return s;
      }));
    }

    // Staff performance: services sold and revenue per staff
    const staffPerfAgg = await prisma.saleItem.groupBy({
      by: ['staffId'],
      where: { sale: { salonId }, },
      _sum: { price: true },
      _count: { staffId: true },
    }).catch(async () => {
      // fallback
      const items = await prisma.saleItem.findMany({ where: { sale: { salonId } }, select: { staffId: true, price: true, quantity: true } });
      const map = {};
      items.forEach(it => {
        if (!it.staffId) return;
        const entry = map[it.staffId] || { revenue: 0, count: 0 };
        entry.revenue += (it.price || 0) * (it.quantity || 1);
        entry.count += (it.quantity || 1);
        map[it.staffId] = entry;
      });
      const results = [];
      for (const sid of Object.keys(map)) {
        const staff = await prisma.staff.findUnique({ where: { id: sid } });
        results.push({ staffId: sid, staffName: staff?.name || 'Unknown', services: map[sid].count, revenue: map[sid].revenue });
      }
      return results;
    });

    let staffPerformance = [];
    if (Array.isArray(staffPerfAgg)) {
      staffPerformance = await Promise.all(staffPerfAgg.map(async s => {
        const staff = await prisma.staff.findUnique({ where: { id: s.staffId } });
        return { staffId: s.staffId, staffName: staff?.name || 'Unknown', services: s._count?.staffId || 0, revenue: s._sum?.price || 0 };
      }));
    }

    // Pending payments (invoices with status unpaid)
    const pendingPayments = await prisma.invoice.count({ where: { salonId, status: 'unpaid' } });

    // Upcoming appointments (next 5)
    const upcomingAppointments = await prisma.appointment.findMany({ where: { salonId, date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 5 });

    res.json({
      totalServices,
      totalStaff,
      totalAppointments,
      totalSalesToday,
      totalSalesAmountToday,
      totalExpensesToday,
      dailyProfit,
      monthlyRevenue,
      topServices: topServicesNormalized,
      staffPerformance,
      pendingPayments,
      upcomingAppointments,
      note: "lowStockAlerts not available (no products model)"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;