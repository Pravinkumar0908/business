const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");

// GET all services
router.get("/", auth, async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { salonId: req.salonId }
    });
    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create service
router.post("/", auth, async (req, res) => {
  try {
    const { name, price, duration } = req.body;
    const service = await prisma.service.create({
      data: {
        id: require("uuid").v4(),
        name,
        price: price || 0,
        salonId: req.salonId
      }
    });
    res.status(201).json({ service });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update service
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, price } = req.body;
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: { name, price }
    });
    res.json({ service });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE service
router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.service.delete({
      where: { id: req.params.id }
    });
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;