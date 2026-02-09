const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ── Auto-create tables ──────────────────────────────────
const ensureTables = async () => {
  // Main Customer table
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
      "creditLimit" DOUBLE PRECISION DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add columns if table existed before
  const colMigrations = [
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER DEFAULT 0',
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastVisitDate" TIMESTAMPTZ',
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT \'\'',
    'ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "creditLimit" DOUBLE PRECISION DEFAULT 0',
  ];
  for (const sql of colMigrations) {
    try { await pool.query(sql); } catch (e) { /* exists */ }
  }

  // ── Customer Transaction table (credit sales / returns) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "CustomerTransaction" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE CASCADE,
      "invoiceId" TEXT,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'sale',
      "paymentType" TEXT NOT NULL DEFAULT 'paid',
      description TEXT DEFAULT '',
      date TIMESTAMPTZ DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Customer Payment table (payments against credit) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "CustomerPayment" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE CASCADE,
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
//  DASHBOARD — outstanding stats (BEFORE /:id routes!)
// ════════════════════════════════════════════════════════

router.get("/stats/outstanding", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id) AS "totalCustomers",
        COALESCE(SUM(COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0)), 0) AS "totalOutstanding",
        COUNT(DISTINCT CASE WHEN COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0) > 0 THEN c.id END) AS "customersWithDue"
      FROM "Customer" c
      LEFT JOIN (
        SELECT "customerId",
          SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END) AS total_credit
        FROM "CustomerTransaction"
        WHERE "salonId" = $1
        GROUP BY "customerId"
      ) t ON t."customerId" = c.id
      LEFT JOIN (
        SELECT "customerId",
          SUM(amount) AS total_paid
        FROM "CustomerPayment"
        WHERE "salonId" = $1
        GROUP BY "customerId"
      ) p ON p."customerId" = c.id
      WHERE c."salonId" = $1
    `, [req.salonId]);

    // Top 5 customers by due
    const { rows: topDue } = await pool.query(`
      SELECT c.id, c.name, c.phone,
        COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0) AS "dueAmount"
      FROM "Customer" c
      LEFT JOIN (
        SELECT "customerId",
          SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END) AS total_credit
        FROM "CustomerTransaction" WHERE "salonId" = $1 GROUP BY "customerId"
      ) t ON t."customerId" = c.id
      LEFT JOIN (
        SELECT "customerId", SUM(amount) AS total_paid
        FROM "CustomerPayment" WHERE "salonId" = $1 GROUP BY "customerId"
      ) p ON p."customerId" = c.id
      WHERE c."salonId" = $1
        AND COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0) > 0
      ORDER BY "dueAmount" DESC
      LIMIT 5
    `, [req.salonId]);

    res.json({
      stats: rows[0],
      topDueCustomers: topDue,
    });
  } catch (err) {
    console.error("OUTSTANDING STATS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  CUSTOMER CRUD
// ════════════════════════════════════════════════════════

// GET all customers (with calculated due)
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COALESCE(t.total_credit, 0) AS "totalCredit",
        COALESCE(p.total_paid, 0)   AS "totalPaid",
        COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0) AS "dueAmount",
        t.last_txn_date AS "lastTransactionDate"
      FROM "Customer" c
      LEFT JOIN (
        SELECT "customerId",
          SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END) AS total_credit,
          MAX(date) AS last_txn_date
        FROM "CustomerTransaction"
        WHERE "salonId" = $1
        GROUP BY "customerId"
      ) t ON t."customerId" = c.id
      LEFT JOIN (
        SELECT "customerId",
          SUM(amount) AS total_paid
        FROM "CustomerPayment"
        WHERE "salonId" = $1
        GROUP BY "customerId"
      ) p ON p."customerId" = c.id
      WHERE c."salonId" = $1
      ORDER BY c.name ASC
    `, [req.salonId]);
    res.json({ customers: rows });
  } catch (err) {
    console.error("GET CUSTOMERS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create customer
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, email, address, notes, tags, creditLimit } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "Customer" (id, "salonId", name, phone, email, address, notes, tags, "creditLimit")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, req.salonId, name, phone || '', email || '', address || '', notes || '', tags || '', parseFloat(creditLimit) || 0]
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
    const { name, phone, email, address, notes, tags, creditLimit } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Customer" SET name=$1, phone=$2, email=$3, address=$4, notes=$5, tags=$6, "creditLimit"=$7
       WHERE id=$8 AND "salonId"=$9 RETURNING *`,
      [name, phone, email, address, notes, tags || '', parseFloat(creditLimit) || 0, req.params.id, req.salonId]
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

// DELETE customer — BLOCKED if due > 0
router.delete("/:id", auth, async (req, res) => {
  try {
    // Check if customer has outstanding due
    const { rows: duCheck } = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END), 0) AS credit,
        (SELECT COALESCE(SUM(amount), 0) FROM "CustomerPayment" WHERE "customerId" = $1 AND "salonId" = $2) AS paid
      FROM "CustomerTransaction"
      WHERE "customerId" = $1 AND "salonId" = $2
    `, [req.params.id, req.salonId]);

    const due = (duCheck[0]?.credit || 0) - (duCheck[0]?.paid || 0);
    if (due > 0) {
      return res.status(400).json({ message: `Cannot delete — ₹${due.toFixed(0)} due pending. Collect payment first.` });
    }

    await pool.query('DELETE FROM "Customer" WHERE id=$1 AND "salonId"=$2', [req.params.id, req.salonId]);
    res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error("DELETE CUSTOMER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  CUSTOMER TRANSACTIONS (credit sale / return records)
// ════════════════════════════════════════════════════════

// GET transactions for a customer
router.get("/:id/transactions", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "CustomerTransaction" 
       WHERE "customerId" = $1 AND "salonId" = $2 
       ORDER BY date DESC`,
      [req.params.id, req.salonId]
    );
    res.json({ transactions: rows });
  } catch (err) {
    console.error("GET TRANSACTIONS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create transaction (credit sale)
router.post("/:id/transactions", auth, async (req, res) => {
  try {
    const { amount, type, paymentType, description, invoiceId, date } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "CustomerTransaction" (id, "salonId", "customerId", "invoiceId", amount, type, "paymentType", description, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, req.salonId, req.params.id, invoiceId || null, parseFloat(amount) || 0, type || 'sale', paymentType || 'paid', description || '', date || new Date().toISOString()]
    );
    // Also update totalPurchases on customer
    const purchaseAmount = parseFloat(amount) || 0;
    const points = Math.floor(purchaseAmount / 100);
    await pool.query(
      `UPDATE "Customer" SET 
        "totalPurchases" = "totalPurchases" + $1, 
        "visitCount" = "visitCount" + 1,
        "loyaltyPoints" = "loyaltyPoints" + $2,
        "lastVisitDate" = NOW() 
       WHERE id = $3 AND "salonId" = $4`,
      [purchaseAmount, points, req.params.id, req.salonId]
    );
    res.status(201).json({ transaction: rows[0] });
  } catch (err) {
    console.error("CREATE TRANSACTION ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  CUSTOMER PAYMENTS (against credit / udhaar)
// ════════════════════════════════════════════════════════

// GET payments for a customer
router.get("/:id/payments", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "CustomerPayment" 
       WHERE "customerId" = $1 AND "salonId" = $2 
       ORDER BY date DESC`,
      [req.params.id, req.salonId]
    );
    res.json({ payments: rows });
  } catch (err) {
    console.error("GET PAYMENTS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST add payment (collect udhaar)
router.post("/:id/payments", auth, async (req, res) => {
  try {
    const { amount, mode, note, date } = req.body;
    const payAmount = parseFloat(amount) || 0;

    if (payAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    // Check current due
    const { rows: duCheck } = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END), 0) AS credit,
        (SELECT COALESCE(SUM(amount), 0) FROM "CustomerPayment" WHERE "customerId" = $1 AND "salonId" = $2) AS paid
      FROM "CustomerTransaction"
      WHERE "customerId" = $1 AND "salonId" = $2
    `, [req.params.id, req.salonId]);

    const currentDue = (duCheck[0]?.credit || 0) - (duCheck[0]?.paid || 0);
    if (payAmount > currentDue + 0.01) {
      return res.status(400).json({ message: `Overpayment not allowed. Current due: ₹${currentDue.toFixed(2)}` });
    }

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "CustomerPayment" (id, "salonId", "customerId", amount, mode, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.salonId, req.params.id, payAmount, mode || 'cash', note || '', date || new Date().toISOString()]
    );
    res.status(201).json({ payment: rows[0] });
  } catch (err) {
    console.error("ADD PAYMENT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


// ════════════════════════════════════════════════════════
//  CUSTOMER SUMMARY (due / credit / paid)
// ════════════════════════════════════════════════════════

router.get("/:id/summary", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        COALESCE(t.total_credit, 0) AS "totalCredit",
        COALESCE(t.total_sales, 0)  AS "totalSales",
        COALESCE(p.total_paid, 0)   AS "totalPaid",
        COALESCE(t.total_credit, 0) - COALESCE(p.total_paid, 0) AS "dueAmount",
        COALESCE(t.txn_count, 0)    AS "transactionCount",
        COALESCE(p.pay_count, 0)    AS "paymentCount"
      FROM "Customer" c
      LEFT JOIN (
        SELECT "customerId",
          SUM(CASE WHEN "paymentType" = 'credit' THEN amount ELSE 0 END) AS total_credit,
          SUM(amount) AS total_sales,
          COUNT(*) AS txn_count
        FROM "CustomerTransaction"
        WHERE "salonId" = $2
        GROUP BY "customerId"
      ) t ON t."customerId" = c.id
      LEFT JOIN (
        SELECT "customerId",
          SUM(amount) AS total_paid,
          COUNT(*) AS pay_count
        FROM "CustomerPayment"
        WHERE "salonId" = $2
        GROUP BY "customerId"
      ) p ON p."customerId" = c.id
      WHERE c.id = $1 AND c."salonId" = $2
    `, [req.params.id, req.salonId]);

    if (rows.length === 0) return res.status(404).json({ message: "Customer not found" });
    res.json({ summary: rows[0] });
  } catch (err) {
    console.error("CUSTOMER SUMMARY ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
