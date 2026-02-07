const pool = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `
      SELECT *
      FROM subscriptions
      WHERE organization_id = $1
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        message: "No active subscription found"
      });
    }

    const subscription = result.rows[0];
    const today = new Date();
    const endDate = new Date(subscription.end_date);

    if (today > endDate) {
      await pool.query(
        `UPDATE subscriptions
         SET status = 'expired'
         WHERE id = $1`,
        [subscription.id]
      );

      return res.status(403).json({
        message: "Subscription expired. Please renew."
      });
    }

    next();

  } catch (error) {
    console.error("SUBSCRIPTION CHECK ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
