const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

// GET all services
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM services WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json({ services: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create service
router.post("/", auth, async (req, res) => {
  try {
    const { name, price, duration, description } = req.body;
    const result = await pool.query(
      "INSERT INTO services (user_id, name, price, duration, description) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [req.userId, name, price || 0, duration || 30, description]
    );
    res.status(201).json({ service: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update service
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, price, duration, description } = req.body;
    const result = await pool.query(
      "UPDATE services SET name=$1, price=$2, duration=$3, description=$4 WHERE id=$5 AND user_id=$6 RETURNING *",
      [name, price, duration, description, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Service not found" });
    }
    res.json({ service: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE service
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM services WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;