const prisma = require("../lib/prisma");

exports.generatePayroll = async (req, res) => {
  try {
    const salonId = req.user.salonId;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year required"
      });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const staffList = await prisma.staff.findMany({
      where: { salonId }
    });

    const payrollResults = [];

    for (const staff of staffList) {

      const saleItems = await prisma.saleItem.findMany({
        where: {
          staffId: staff.id,
          sale: {
            salonId,
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      });

      const totalServices = saleItems.length;

      const totalRevenue = saleItems.reduce(
        (sum, item) => sum + item.price,
        0
      );

      const totalCommission = saleItems.reduce(
        (sum, item) => sum + item.commission,
        0
      );

      const baseSalary = staff.baseSalary || 0;

      const finalPayable =
        baseSalary + totalCommission;

      const payroll = await prisma.payroll.upsert({
        where: {
          salonId_staffId_month_year: {
            salonId,
            staffId: staff.id,
            month,
            year
          }
        },
        update: {
          totalServices,
          totalRevenue,
          totalCommission,
          baseSalary,
          finalPayable
        },
        create: {
          salonId,
          staffId: staff.id,
          month,
          year,
          totalServices,
          totalRevenue,
          totalCommission,
          baseSalary,
          finalPayable
        }
      });

      payrollResults.push(payroll);
    }

    res.json({
      message: "Payroll generated successfully",
      data: payrollResults
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
