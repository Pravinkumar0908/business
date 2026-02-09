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
      "loyaltyPoints" INTEGER DEFAULT 0,
      "lastVisitDate" TIMESTAMPTZ,
      tags TEXT DEFAULT '',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add new columns if table existed before
  const cols = [
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER DEFAULT 0',
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastVisitDate" TIMESTAMPTZ',
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT \'\'',
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (e) { /* exists */ }
  }
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
    const { name, phone, email, address, notes, tags } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "Customer" (id, "salonId", name, phone, email, address, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, req.salonId, name, phone || '', email || '', address || '', notes || '', tags || '']
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
    const { name, phone, email, address, notes, tags } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Customer" SET name=$1, phone=$2, email=$3, address=$4, notes=$5, tags=$6
       WHERE id=$7 AND "salonId"=$8 RETURNING *`,
      [name, phone, email, address, notes, tags || '', req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ customer: rows[0] });
  } catch (err) {
    console.error("UPDATE CUSTOMER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH record purchase (update stats after sale)
router.patch("/:id/purchase", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const purchaseAmount = parseFloat(amount) || 0;
    // 1 loyalty point per ₹100 spent
    const points = Math.floor(purchaseAmount / 100);
    const { rows } = await pool.query(
      `UPDATE "Customer" SET
        "totalPurchases" = "totalPurchases" + $1,
        "visitCount" = "visitCount" + 1,
        "loyaltyPoints" = "loyaltyPoints" + $2,
        "lastVisitDate" = NOW()
       WHERE id = $3 AND "salonId" = $4 RETURNING *`,
      [purchaseAmount, points, req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ customer: rows[0] });
  } catch (err) {
    console.error("RECORD PURCHASE ERROR:", err.message);
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
