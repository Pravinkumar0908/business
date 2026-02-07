const pool = require("../config/db");

exports.subscribe = async (req, res) => {
  try {
    const { plan_id } = req.body;
    const organizationId = req.user.organizationId;

    const planResult = await pool.query(
      "SELECT * FROM plans WHERE id = $1",
      [plan_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const plan = planResult.rows[0];

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.duration_days);

    const result = await pool.query(
      `INSERT INTO subscriptions
       (organization_id, plan_id, start_date, end_date)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [organizationId, plan_id, startDate, endDate]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("SUBSCRIPTION ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getMySubscription = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `
      SELECT s.*, p.name as plan_name, p.price
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.organization_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
      `,
      [organizationId]
    );

    res.json(result.rows[0] || null);

  } catch (error) {
    console.error("GET SUB ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
