const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ── Auto-create tables ──────────────────────────────────
const ensureTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Supplier" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      "gstin" TEXT DEFAULT '',
      company TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      "outstandingBalance" DOUBLE PRECISION DEFAULT 0,
      "totalPurchases" DOUBLE PRECISION DEFAULT 0,
      "orderCount" INTEGER DEFAULT 0,
      "lastOrderDate" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add columns if table existed before
  const colMigrations = [
    'ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS company TEXT DEFAULT \'\'',
    'ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS category TEXT DEFAULT \'General\'',
    'ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "totalPurchases" DOUBLE PRECISION DEFAULT 0',
    'ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "orderCount" INTEGER DEFAULT 0',
    'ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "lastOrderDate" TIMESTAMPTZ',
  ];
  for (const sql of colMigrations) {
    try { await pool.query(sql); } catch (e) { /* exists */ }
  }

  // ── Supplier Transaction table (purchase records) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SupplierTransaction" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL REFERENCES "Supplier"(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'purchase',
      "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
      description TEXT DEFAULT '',
      "invoiceNumber" TEXT DEFAULT '',
      date TIMESTAMPTZ DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Supplier Payment table (payments to suppliers) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SupplierPayment" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL REFERENCES "Supplier"(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'cash',
      note TEXT DEFAULT '',
      date TIMESTAMPTZ DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
ensureTables().catch(console.error);


// ════════════════════════════════════════════════════════
//  STATS — outstanding summary
// ════════════════════════════════════════════════════════

router.get("/stats", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) AS "totalSuppliers",
        COALESCE(SUM(COALESCE(t.total_purchase, 0) - COALESCE(p.total_paid, 0)), 0) AS "totalPayable",
        COUNT(DISTINCT CASE WHEN COALESCE(t.total_purchase, 0) - COALESCE(p.total_paid, 0) > 0 THEN s.id END) AS "suppliersWithDue"
      FROM "Supplier" s
      LEFT JOIN (
        SELECT "supplierId",
          SUM(CASE WHEN "paymentStatus" = 'unpaid' OR "paymentStatus" = 'partial' THEN amount ELSE 0 END) AS total_purchase
        FROM "SupplierTransaction"
        WHERE "salonId" = $1
        GROUP BY "supplierId"
      ) t ON t."supplierId" = s.id
      LEFT JOIN (
        SELECT "supplierId",
          SUM(amount) AS total_paid
        FROM "SupplierPayment"
        WHERE "salonId" = $1
        GROUP BY "supplierId"
      ) p ON p."supplierId" = s.id
      WHERE s."salonId" = $1
    `, [req.salonId]);

    res.json({ stats: rows[0] });
  } catch (err) {
    console.error("SUPPLIER STATS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  SUPPLIER CRUD
// ════════════════════════════════════════════════════════

// GET all suppliers (with calculated payable)
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        COALESCE(t.total_purchase, 0) AS "totalCredit",
        COALESCE(p.total_paid, 0)     AS "totalPaid",
        COALESCE(t.total_purchase, 0) - COALESCE(p.total_paid, 0) AS "payableAmount",
        t.last_txn_date AS "lastTransactionDate"
      FROM "Supplier" s
      LEFT JOIN (
        SELECT "supplierId",
          SUM(CASE WHEN "paymentStatus" IN ('unpaid','partial') THEN amount ELSE 0 END) AS total_purchase,
          MAX(date) AS last_txn_date
        FROM "SupplierTransaction"
        WHERE "salonId" = $1
        GROUP BY "supplierId"
      ) t ON t."supplierId" = s.id
      LEFT JOIN (
        SELECT "supplierId",
          SUM(amount) AS total_paid
        FROM "SupplierPayment"
        WHERE "salonId" = $1
        GROUP BY "supplierId"
      ) p ON p."supplierId" = s.id
      WHERE s."salonId" = $1
      ORDER BY s.name ASC
    `, [req.salonId]);
    res.json({ suppliers: rows });
  } catch (err) {
    console.error("GET SUPPLIERS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create supplier
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, gstin, company, address, notes, category } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "Supplier" (id, "salonId", name, phone, email, "gstin", company, address, notes, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, req.salonId, name, phone || '', email || '', gstin || '', company || '', address || '', notes || '', category || 'General']
    );
    res.status(201).json({ supplier: rows[0] });
  } catch (err) {
    console.error("CREATE SUPPLIER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update supplier
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, email, gstin, company, address, notes, category } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Supplier" SET name=$1, phone=$2, email=$3, "gstin"=$4, company=$5, address=$6, notes=$7, category=$8
       WHERE id=$9 AND "salonId"=$10 RETURNING *`,
      [name, phone, email, gstin || '', company || '', address, notes, category || 'General', req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Supplier not found" });
    res.json({ supplier: rows[0] });
  } catch (err) {
    console.error("UPDATE SUPPLIER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE supplier — BLOCKED if payable > 0
router.delete("/:id", auth, async (req, res) => {
  try {
    const { rows: duCheck } = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN "paymentStatus" IN ('unpaid','partial') THEN amount ELSE 0 END), 0) AS credit,
        (SELECT COALESCE(SUM(amount), 0) FROM "SupplierPayment" WHERE "supplierId" = $1 AND "salonId" = $2) AS paid
      FROM "SupplierTransaction"
      WHERE "supplierId" = $1 AND "salonId" = $2
    `, [req.params.id, req.salonId]);

    const due = (duCheck[0]?.credit || 0) - (duCheck[0]?.paid || 0);
    if (due > 0) {
      return res.status(400).json({ message: `Cannot delete — ₹${due.toFixed(0)} payable pending. Clear dues first.` });
    }

    await pool.query('DELETE FROM "Supplier" WHERE id=$1 AND "salonId"=$2', [req.params.id, req.salonId]);
    res.json({ message: "Supplier deleted" });
  } catch (err) {
    console.error("DELETE SUPPLIER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  SUPPLIER TRANSACTIONS (purchase records)
// ════════════════════════════════════════════════════════

router.get("/:id/transactions", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "SupplierTransaction" 
       WHERE "supplierId" = $1 AND "salonId" = $2 
       ORDER BY date DESC`,
      [req.params.id, req.salonId]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error("GET SUPPLIER TXN ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/transactions", auth, async (req, res) => {
  try {
    const { amount, type, paymentStatus, description, invoiceNumber, date } = req.body;
    const id = uuidv4();
    const purchaseAmount = parseFloat(amount) || 0;
    const { rows } = await pool.query(
      `INSERT INTO "SupplierTransaction" (id, "salonId", "supplierId", amount, type, "paymentStatus", description, "invoiceNumber", date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, req.salonId, req.params.id, purchaseAmount, type || 'purchase', paymentStatus || 'unpaid', description || '', invoiceNumber || '', date || new Date().toISOString()]
    );

    // Update supplier stats
    await pool.query(
      `UPDATE "Supplier" SET 
        "totalPurchases" = "totalPurchases" + $1,
        "orderCount" = "orderCount" + 1,
        "lastOrderDate" = NOW()
       WHERE id = $2 AND "salonId" = $3`,
      [purchaseAmount, req.params.id, req.salonId]
    );

    res.status(201).json({ transaction: rows[0] });
  } catch (err) {
    console.error("CREATE SUPPLIER TXN ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  SUPPLIER PAYMENTS (payments to supplier)
// ════════════════════════════════════════════════════════

router.get("/:id/payments", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "SupplierPayment" 
       WHERE "supplierId" = $1 AND "salonId" = $2 
       ORDER BY date DESC`,
      [req.params.id, req.salonId]
    );
    res.json({ payments: rows });
  } catch (err) {
    console.error("GET SUPPLIER PAYMENTS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/payments", auth, async (req, res) => {
  try {
    const { amount, mode, note, date } = req.body;
    const payAmount = parseFloat(amount) || 0;

    if (payAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    // Check current payable
    const { rows: duCheck } = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN "paymentStatus" IN ('unpaid','partial') THEN amount ELSE 0 END), 0) AS credit,
        (SELECT COALESCE(SUM(amount), 0) FROM "SupplierPayment" WHERE "supplierId" = $1 AND "salonId" = $2) AS paid
      FROM "SupplierTransaction"
      WHERE "supplierId" = $1 AND "salonId" = $2
    `, [req.params.id, req.salonId]);

    const currentDue = (duCheck[0]?.credit || 0) - (duCheck[0]?.paid || 0);
    if (payAmount > currentDue + 0.01) {
      return res.status(400).json({ message: `Overpayment not allowed. Current payable: ₹${currentDue.toFixed(2)}` });
    }

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "SupplierPayment" (id, "salonId", "supplierId", amount, mode, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.salonId, req.params.id, payAmount, mode || 'cash', note || '', date || new Date().toISOString()]
    );
    res.status(201).json({ payment: rows[0] });
  } catch (err) {
    console.error("ADD SUPPLIER PAYMENT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  SUPPLIER SUMMARY
// ════════════════════════════════════════════════════════

router.get("/:id/summary", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        s.*,
        COALESCE(t.total_purchase, 0) AS "totalCredit",
        COALESCE(p.total_paid, 0)     AS "totalPaid",
        COALESCE(t.total_purchase, 0) - COALESCE(p.total_paid, 0) AS "payableAmount",
        COALESCE(t.txn_count, 0)      AS "transactionCount",
        COALESCE(p.pay_count, 0)      AS "paymentCount"
      FROM "Supplier" s
      LEFT JOIN (
        SELECT "supplierId",
          SUM(CASE WHEN "paymentStatus" IN ('unpaid','partial') THEN amount ELSE 0 END) AS total_purchase,
          COUNT(*) AS txn_count
        FROM "SupplierTransaction"
        WHERE "salonId" = $2
        GROUP BY "supplierId"
      ) t ON t."supplierId" = s.id
      LEFT JOIN (
        SELECT "supplierId",
          SUM(amount) AS total_paid,
          COUNT(*) AS pay_count
        FROM "SupplierPayment"
        WHERE "salonId" = $2
        GROUP BY "supplierId"
      ) p ON p."supplierId" = s.id
      WHERE s.id = $1 AND s."salonId" = $2
    `, [req.params.id, req.salonId]);

    if (rows.length === 0) return res.status(404).json({ message: "Supplier not found" });
    res.json({ summary: rows[0] });
  } catch (err) {
    console.error("SUPPLIER SUMMARY ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
