const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { salonId: req.salonId },
      orderBy: { createdAt: "desc" }
    });
    // Parse items JSON string back to array for frontend
    const parsed = invoices.map(inv => ({
      ...inv,
      items: inv.items ? JSON.parse(inv.items) : []
    }));
    res.json({ invoices: parsed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const invoice = await prisma.invoice.create({
      data: {
        id: uuidv4(),
        customerName: customer_name || "",
        customerPhone: customer_phone || null,
        items: JSON.stringify(items || []),
        total: total || 0,
        status: status || "unpaid",
        date: date ? new Date(date) : new Date(),
        salonId: req.salonId
      }
    });
    res.status(201).json({ invoice: { ...invoice, items: JSON.parse(invoice.items || "[]") } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, status, date } = req.body;
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        customerName: customer_name,
        customerPhone: customer_phone,
        items: JSON.stringify(items || []),
        total,
        status,
        date: date ? new Date(date) : undefined
      }
    });
    res.json({ invoice: { ...invoice, items: JSON.parse(invoice.items || "[]") } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;