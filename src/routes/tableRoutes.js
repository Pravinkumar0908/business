const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ═══════════════════════════════════════════════
//  🍽  RESTAURANT TABLE ROUTES
// ═══════════════════════════════════════════════

// GET all tables for this salon
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "RestaurantTable" WHERE "salonId" = $1 ORDER BY name ASC`,
      [req.salonId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET TABLES ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create table
router.post("/", auth, async (req, res) => {
  try {
    const { name, seats } = req.body;
    if (!name) return res.status(400).json({ message: "Table name is required" });

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "RestaurantTable" (id, "salonId", name, seats, status, "createdAt")
       VALUES ($1, $2, $3, $4, 'empty', NOW())
       RETURNING *`,
      [id, req.salonId, name, seats || 4]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("CREATE TABLE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update table status
router.put("/:id", auth, async (req, res) => {
  try {
    const { status, customerName, currentOrderId } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (customerName !== undefined) {
      fields.push(`"customerName" = $${idx++}`);
      values.push(customerName);
    }
    if (currentOrderId !== undefined) {
      fields.push(`"currentOrderId" = $${idx++}`);
      values.push(currentOrderId);
    }

    // If status is empty, clear occupancy fields
    if (status === "empty") {
      fields.push(`"customerName" = NULL`);
      fields.push(`"currentOrderId" = NULL`);
      fields.push(`"occupiedSince" = NULL`);
    }
    if (status === "occupied") {
      fields.push(`"occupiedSince" = NOW()`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE "RestaurantTable" SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ message: "Table not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("UPDATE TABLE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE table
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM "RestaurantTable" WHERE id = $1 AND "salonId" = $2`,
      [req.params.id, req.salonId]
    );
    res.json({ message: "Table deleted" });
  } catch (err) {
    console.error("DELETE TABLE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
