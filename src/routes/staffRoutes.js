const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM staff WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ staff: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, role, salary } = req.body;
    const result = await pool.query(
      "INSERT INTO staff (user_id, name, phone, email, role, salary) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.userId, name, phone, email, role, salary || 0]
    );
    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, email, role, salary } = req.body;
    const result = await pool.query(
      "UPDATE staff SET name=$1, phone=$2, email=$3, role=$4, salary=$5 WHERE id=$6 AND user_id=$7 RETURNING *",
      [name, phone, email, role, salary, req.params.id, req.userId]
    );
    res.json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM staff WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    res.json({ message: "Staff deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;