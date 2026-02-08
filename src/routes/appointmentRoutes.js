const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const prisma = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { salonId: req.salonId },
      orderBy: { date: "desc" }
    });
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const appointment = await prisma.appointment.create({
      data: {
        id: uuidv4(),
        customerName: customer_name || "",
        customerPhone: customer_phone || null,
        serviceId: service_id || null,
        staffId: staff_id || null,
        date: date ? new Date(date) : new Date(),
        time: time || null,
        status: status || "pending",
        notes: notes || null,
        salonId: req.salonId
      }
    });
    res.status(201).json({ appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        customerName: customer_name,
        customerPhone: customer_phone,
        serviceId: service_id,
        staffId: staff_id,
        date: date ? new Date(date) : undefined,
        time,
        status,
        notes
      }
    });
    res.json({ appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;