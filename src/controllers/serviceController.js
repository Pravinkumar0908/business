const pool = require("../config/db");

// CREATE SERVICE
exports.createService = async (req, res) => {
  try {
    const { name, duration, price } = req.body;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "INSERT INTO services (name, duration, price, organization_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, duration, price, organizationId]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE SERVICE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET ALL SERVICES (Tenant Safe)
exports.getServices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "SELECT * FROM services WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET SERVICE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
