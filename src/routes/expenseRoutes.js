const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { salonId: req.salonId },
      orderBy: { date: "desc" }
    });
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;
    const expense = await prisma.expense.create({
      data: {
        id: uuidv4(),
        title,
        amount: amount || 0,
        category: category || "General",
        date: date ? new Date(date) : new Date(),
        salonId: req.salonId
      }
    });
    res.status(201).json({ expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;