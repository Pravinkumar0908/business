const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ invoices: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const result = await pool.query(
      "INSERT INTO invoices (user_id, customer_name, customer_phone, items, total, status, date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [req.userId, customer_name, customer_phone, JSON.stringify(items || []), total || 0, status || 'unpaid', date]
    );
    res.status(201).json({ invoice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const result = await pool.query(
      "UPDATE invoices SET customer_name=$1, customer_phone=$2, items=$3, total=$4, status=$5, date=$6 WHERE id=$7 AND user_id=$8 RETURNING *",
      [customer_name, customer_phone, JSON.stringify(items || []), total, status, date, req.params.id, req.userId]
    );
    res.json({ invoice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM invoices WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;