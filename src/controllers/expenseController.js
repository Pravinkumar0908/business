const pool = require("../config/db");

// CREATE EXPENSE
exports.createExpense = async (req, res) => {
  try {
    const { title, amount, category } = req.body;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "INSERT INTO expenses (title, amount, category, organization_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [title, amount, category, organizationId]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE EXPENSE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET EXPENSES
exports.getExpenses = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      "SELECT * FROM expenses WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET EXPENSE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
