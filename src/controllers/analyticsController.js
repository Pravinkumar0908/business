const prisma = require("../lib/prisma");

//////////////////////////////
// 1️⃣ STAFF PERFORMANCE
//////////////////////////////

exports.getStaffPerformance = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const grouped = await prisma.saleItem.groupBy({
      by: ["staffId"],
      _sum: {
        price: true,
        commission: true
      },
      _count: {
        id: true
      },
      where: {
        sale: {
          salonId,
          date: {
            gte: startOfMonth
          }
        }
      }
    });

    const result = await Promise.all(
      grouped.map(async (item) => {
        const staff = await prisma.staff.findUnique({
          where: { id: item.staffId }
        });

        return {
          staffId: item.staffId,
          staffName: staff?.name || "Unknown",
          totalServices: item._count.id,
          totalRevenue: item._sum.price || 0,
          totalCommission: item._sum.commission || 0
        };
      })
    );

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

//////////////////////////////
// 2️⃣ DAILY REVENUE
//////////////////////////////

exports.getDailyRevenue = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const sales = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
        taxAmount: true
      },
      _count: {
        id: true
      },
      where: {
        salonId,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    res.json({
      date: today.toISOString().split("T")[0],
      totalSales: sales._count.id,
      totalRevenue: sales._sum.totalAmount || 0,
      totalTax: sales._sum.taxAmount || 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

//////////////////////////////
// 3️⃣ MONTHLY REVENUE
//////////////////////////////

exports.getMonthlyRevenue = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sales = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
        taxAmount: true
      },
      _count: {
        id: true
      },
      where: {
        salonId,
        date: {
          gte: startOfMonth
        }
      }
    });

    res.json({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalSales: sales._count.id,
      totalRevenue: sales._sum.totalAmount || 0,
      totalTax: sales._sum.taxAmount || 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

//////////////////////////////
// 4️⃣ MONTHLY NET PROFIT
//////////////////////////////

exports.getMonthlyNetProfit = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total Revenue
    const revenue = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true
      },
      where: {
        salonId,
        date: {
          gte: startOfMonth
        }
      }
    });

    // Total Expenses
    const expenses = await prisma.expense.aggregate({
      _sum: {
        amount: true
      },
      where: {
        salonId,
        date: {
          gte: startOfMonth
        }
      }
    });

    const totalRevenue = revenue._sum.totalAmount || 0;
    const totalExpenses = expenses._sum.amount || 0;

    const netProfit = totalRevenue - totalExpenses;

    res.json({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalRevenue,
      totalExpenses,
      netProfit
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
