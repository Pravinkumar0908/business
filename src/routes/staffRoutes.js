const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { salonId: req.salonId }
    });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, commissionType, commissionValue, baseSalary } = req.body;
    const staff = await prisma.staff.create({
      data: {
        id: uuidv4(),
        name,
        commissionType: commissionType || "percentage",
        commissionValue: commissionValue || 0,
        baseSalary: baseSalary || 0,
        salonId: req.salonId
      }
    });
    res.status(201).json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, commissionType, commissionValue, baseSalary } = req.body;
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { name, commissionType, commissionValue, baseSalary }
    });
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.staff.delete({ where: { id: req.params.id } });
    res.json({ message: "Staff deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;