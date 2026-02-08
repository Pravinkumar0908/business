const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

// GET all services
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM \"Service\" WHERE \"salonId\" = $1 ORDER BY id DESC",
      [req.salonId]
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
      "INSERT INTO \"Service\" (id, name, price, \"salonId\") VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *",
      [name, price || 0, req.salonId]
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
      "UPDATE \"Service\" SET name=$1, price=$2 WHERE id=$3 AND \"salonId\"=$4 RETURNING *",
      [name, price, req.params.id, req.salonId]
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
      "DELETE FROM \"Service\" WHERE id=$1 AND \"salonId\"=$2",
      [req.params.id, req.salonId]
    );
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;