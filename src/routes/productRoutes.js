const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ── Auto-create table if not exists ──────────────────────
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Product" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      price DOUBLE PRECISION DEFAULT 0,
      "costPrice" DOUBLE PRECISION DEFAULT 0,
      stock DOUBLE PRECISION DEFAULT 0,
      "lowStockAlert" DOUBLE PRECISION DEFAULT 5,
      barcode TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      "productType" TEXT DEFAULT 'fixed',
      "unitType" TEXT DEFAULT 'piece',
      "trackInventory" BOOLEAN DEFAULT true,
      description TEXT DEFAULT '',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add new columns if table existed before this update
  const cols = [
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" TEXT DEFAULT \'fixed\'',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitType" TEXT DEFAULT \'piece\'',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackInventory" BOOLEAN DEFAULT true',
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (e) { /* column exists */ }
  }
  // Migrate stock to DOUBLE PRECISION if it was INTEGER
  try {
    await pool.query('ALTER TABLE "Product" ALTER COLUMN stock TYPE DOUBLE PRECISION');
    await pool.query('ALTER TABLE "Product" ALTER COLUMN "lowStockAlert" TYPE DOUBLE PRECISION');
  } catch (e) { /* already correct */ }
};
ensureTable().catch(console.error);

// GET all products
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Product" WHERE "salonId" = $1 ORDER BY name ASC',
      [req.salonId]
    );
    res.json({ products: rows });
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create product
router.post("/", auth, async (req, res) => {
  try {
    const {
      name, category, price, costPrice, stock, lowStockAlert,
      barcode, unit, productType, unitType, trackInventory, description
    } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "Product"
        (id, "salonId", name, category, price, "costPrice", stock, "lowStockAlert",
         barcode, unit, "productType", "unitType", "trackInventory", description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        id, req.salonId, name, category || '', price || 0, costPrice || 0,
        stock || 0, lowStockAlert || 5, barcode || '', unit || 'pcs',
        productType || 'fixed', unitType || 'piece',
        trackInventory !== undefined ? trackInventory : true,
        description || ''
      ]
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update product
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name, category, price, costPrice, stock, lowStockAlert,
      barcode, unit, productType, unitType, trackInventory, description
    } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Product" SET
        name=$1, category=$2, price=$3, "costPrice"=$4, stock=$5,
        "lowStockAlert"=$6, barcode=$7, unit=$8, "productType"=$9,
        "unitType"=$10, "trackInventory"=$11, description=$12
       WHERE id=$13 AND "salonId"=$14 RETURNING *`,
      [
        name, category, price, costPrice, stock, lowStockAlert,
        barcode, unit, productType || 'fixed', unitType || 'piece',
        trackInventory !== undefined ? trackInventory : true,
        description, req.params.id, req.salonId
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update stock only (supports decimal for measured products)
router.patch("/:id/stock", auth, async (req, res) => {
  try {
    const { stock } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Product" SET stock=$1 WHERE id=$2 AND "salonId"=$3 RETURNING *',
      [parseFloat(stock) || 0, req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error("UPDATE STOCK ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH deduct stock after sale (array of items)
router.patch("/deduct-stock", auth, async (req, res) => {
  try {
    const { items } = req.body; // [{ id, qty }]
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "items array required" });
    }
    for (const item of items) {
      await pool.query(
        `UPDATE "Product" SET stock = GREATEST(stock - $1, 0)
         WHERE id = $2 AND "salonId" = $3 AND "trackInventory" = true`,
        [parseFloat(item.qty) || 0, item.id, req.salonId]
      );
    }
    res.json({ message: "Stock deducted", count: items.length });
  } catch (err) {
    console.error("DEDUCT STOCK ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE product
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Product" WHERE id=$1 AND "salonId"=$2', [req.params.id, req.salonId]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
