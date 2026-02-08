const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Expense" WHERE "salonId" = $1 ORDER BY date DESC',
      [req.salonId]
    );
    res.json({ expenses: rows });
  } catch (err) {
    console.error("GET EXPENSES ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      'INSERT INTO "Expense" (id, title, amount, category, date, "salonId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, title, amount || 0, category || "General", date ? new Date(date) : new Date(), req.salonId]
    );
    res.status(201).json({ expense: rows[0] });
  } catch (err) {
    console.error("CREATE EXPENSE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Expense" WHERE id = $1', [req.params.id]);
    res.json({ message: "Expense deleted" });
  } catch (err) {
    console.error("DELETE EXPENSE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;