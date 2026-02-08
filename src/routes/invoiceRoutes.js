const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Invoice" WHERE "salonId" = $1 ORDER BY "createdAt" DESC',
      [req.salonId]
    );
    // Parse items JSON string back to array for frontend
    const parsed = rows.map(inv => ({
      ...inv,
      items: inv.items ? JSON.parse(inv.items) : []
    }));
    res.json({ invoices: parsed });
  } catch (err) {
    console.error("GET INVOICES ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const id = uuidv4();
    const itemsJson = JSON.stringify(items || []);
    const { rows } = await pool.query(
      'INSERT INTO "Invoice" (id, "customerName", "customerPhone", items, total, status, date, "salonId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
      [id, customer_name || "", customer_phone || null, itemsJson, total || 0, status || "unpaid", date ? new Date(date) : new Date(), req.salonId]
    );
    const invoice = rows[0];
    res.status(201).json({ invoice: { ...invoice, items: JSON.parse(invoice.items || "[]") } });
  } catch (err) {
    console.error("CREATE INVOICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const itemsJson = JSON.stringify(items || []);
    const { rows } = await pool.query(
      'UPDATE "Invoice" SET "customerName" = $1, "customerPhone" = $2, items = $3, total = $4, status = $5, date = COALESCE($6, date) WHERE id = $7 RETURNING *',
      [customer_name, customer_phone, itemsJson, total, status, date ? new Date(date) : null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Invoice not found" });
    const invoice = rows[0];
    res.json({ invoice: { ...invoice, items: JSON.parse(invoice.items || "[]") } });
  } catch (err) {
    console.error("UPDATE INVOICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Invoice" WHERE id = $1', [req.params.id]);
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    console.error("DELETE INVOICE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;