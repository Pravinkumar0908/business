const pool = require("../config/db");

// CREATE STAFF
exports.createStaff = async (req, res) => {
  try {
    const { name, commission_rate } = req.body;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "INSERT INTO staff (name, commission_rate, organization_id) VALUES ($1,$2,$3) RETURNING *",
      [name, commission_rate || 0, organizationId]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE STAFF ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET STAFF
exports.getStaff = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "SELECT * FROM staff WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET STAFF ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
