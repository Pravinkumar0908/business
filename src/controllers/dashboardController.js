const pool = require("../config/db");

exports.getDashboardSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // 1️⃣ Total Revenue
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total_revenue
       FROM invoices
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 2️⃣ Today Revenue
    const todayRevenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS today_revenue
       FROM invoices
       WHERE organization_id = $1
       AND DATE(created_at) = CURRENT_DATE`,
      [organizationId]
    );

    // 3️⃣ Total Expenses
    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total_expense
       FROM expenses
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 4️⃣ Total Appointments
    const appointmentResult = await pool.query(
      `SELECT COUNT(*) FROM appointments
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 5️⃣ Total Staff
    const staffResult = await pool.query(
      `SELECT COUNT(*) FROM staff
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 6️⃣ Total Services
    const serviceResult = await pool.query(
      `SELECT COUNT(*) FROM services
       WHERE organization_id = $1`,
      [organizationId]
    );

    // 7️⃣ Top Service (Revenue Based)
    const topServiceResult = await pool.query(
      `
      SELECT s.name, SUM(ii.price * ii.quantity) AS revenue
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN services s ON ii.service_id = s.id
      WHERE i.organization_id = $1
      GROUP BY s.name
      ORDER BY revenue DESC
      LIMIT 1
      `,
      [organizationId]
    );

    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);
    const totalExpense = parseFloat(expenseResult.rows[0].total_expense);
    const netProfit = totalRevenue - totalExpense;

    res.json({
      totalRevenue,
      todayRevenue: parseFloat(todayRevenueResult.rows[0].today_revenue),
      totalExpense,
      netProfit,
      totalAppointments: parseInt(appointmentResult.rows[0].count),
      totalStaff: parseInt(staffResult.rows[0].count),
      totalServices: parseInt(serviceResult.rows[0].count),
      topService: topServiceResult.rows[0] || null
    });

  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
