const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Staff" WHERE "salonId" = $1 ORDER BY name ASC',
      [req.salonId]
    );
    res.json({ staff: rows });
  } catch (err) {
    console.error("GET STAFF ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, commissionType, commissionValue, baseSalary } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      'INSERT INTO "Staff" (id, name, phone, "commissionType", "commissionValue", "baseSalary", "salonId") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name, phone || null, commissionType || "percentage", commissionValue || 0, baseSalary || 0, req.salonId]
    );
    res.status(201).json({ staff: rows[0] });
  } catch (err) {
    console.error("CREATE STAFF ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, commissionType, commissionValue, baseSalary } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Staff" SET name = $1, phone = $2, "commissionType" = $3, "commissionValue" = $4, "baseSalary" = $5 WHERE id = $6 RETURNING *',
      [name, phone, commissionType, commissionValue, baseSalary, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Staff not found" });
    res.json({ staff: rows[0] });
  } catch (err) {
    console.error("UPDATE STAFF ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Staff" WHERE id = $1', [req.params.id]);
    res.json({ message: "Staff deleted" });
  } catch (err) {
    console.error("DELETE STAFF ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;