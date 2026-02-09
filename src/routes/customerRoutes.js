const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ── Auto-create table if not exists ──────────────────────
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Customer" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      "totalPurchases" DOUBLE PRECISION DEFAULT 0,
      "visitCount" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
ensureTable().catch(console.error);

// GET all customers
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Customer" WHERE "salonId" = $1 ORDER BY name ASC',
      [req.salonId]
    );
    res.json({ customers: rows });
  } catch (err) {
    console.error("GET CUSTOMERS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create customer
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "Customer" (id, "salonId", name, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.salonId, name, phone || '', email || '', address || '', notes || '']
    );
    res.status(201).json({ customer: rows[0] });
  } catch (err) {
    console.error("CREATE CUSTOMER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update customer
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Customer" SET name=$1, phone=$2, email=$3, address=$4, notes=$5
       WHERE id=$6 AND "salonId"=$7 RETURNING *`,
      [name, phone, email, address, notes, req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ customer: rows[0] });
  } catch (err) {
    console.error("UPDATE CUSTOMER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE customer
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Customer" WHERE id=$1 AND "salonId"=$2', [req.params.id, req.salonId]);
    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("DELETE CUSTOMER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
