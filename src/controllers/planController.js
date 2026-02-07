const pool = require("../config/db");

// Create Plan (Admin Only For Now)
exports.createPlan = async (req, res) => {
  try {
    const { name, price, duration_days } = req.body;

    const result = await pool.query(
      `INSERT INTO plans (name, price, duration_days)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name, price, duration_days]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("PLAN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM plans ORDER BY price ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("GET PLAN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
