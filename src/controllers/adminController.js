const pool = require("../config/db");

exports.getPlatformStats = async (req, res) => {
  try {
    // Total Organizations
    const orgResult = await pool.query(
      "SELECT COUNT(*) FROM organizations"
    );

    // Active Subscriptions
    const activeSubResult = await pool.query(
      "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
    );

    // Expired Subscriptions
    const expiredSubResult = await pool.query(
      "SELECT COUNT(*) FROM subscriptions WHERE status = 'expired'"
    );

    // Total Platform Revenue
    const revenueResult = await pool.query(
      "SELECT COALESCE(SUM(price),0) FROM plans p JOIN subscriptions s ON p.id = s.plan_id"
    );

    res.json({
      totalOrganizations: parseInt(orgResult.rows[0].count),
      activeSubscriptions: parseInt(activeSubResult.rows[0].count),
      expiredSubscriptions: parseInt(expiredSubResult.rows[0].count),
      platformRevenue: parseFloat(revenueResult.rows[0].coalesce)
    });

  } catch (error) {
    console.error("ADMIN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
