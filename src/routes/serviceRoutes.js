const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// GET all services
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Service" WHERE "salonId" = $1 ORDER BY name ASC',
      [req.salonId]
    );
    res.json({ services: rows });
  } catch (err) {
    console.error("GET SERVICES ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create service
router.post("/", auth, async (req, res) => {
  try {
    const { name, price, duration, description } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      'INSERT INTO "Service" (id, name, price, duration, description, "salonId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name, price || 0, duration || 0, description || null, req.salonId]
    );
    res.status(201).json({ service: rows[0] });
  } catch (err) {
    console.error("CREATE SERVICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update service
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, price, duration, description } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Service" SET name = $1, price = $2, duration = $3, description = $4 WHERE id = $5 RETURNING *',
      [name, price, duration, description, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Service not found" });
    res.json({ service: rows[0] });
  } catch (err) {
    console.error("UPDATE SERVICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE service
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Service" WHERE id = $1', [req.params.id]);
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error("DELETE SERVICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;