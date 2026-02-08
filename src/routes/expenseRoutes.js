const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC",
      [req.userId]
    );
    res.json({ expenses: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { title, amount, category, date, description } = req.body;
    const result = await pool.query(
      "INSERT INTO expenses (user_id, title, amount, category, date, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.userId, title, amount || 0, category, date, description]
    );
    res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM expenses WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;