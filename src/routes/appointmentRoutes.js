const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, 
        s.name as "serviceName", s.price as "servicePrice", s.duration as "serviceDuration",
        st.name as "staffName"
      FROM "Appointment" a
      LEFT JOIN "Service" s ON a."serviceId" = s.id
      LEFT JOIN "Staff" st ON a."staffId" = st.id
      WHERE a."salonId" = $1 
      ORDER BY a.date DESC`,
      [req.salonId]
    );
    res.json({ appointments: rows });
  } catch (err) {
    console.error("GET APPOINTMENTS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const id = uuidv4();
    const { rows } = await pool.query(
      'INSERT INTO "Appointment" (id, "customerName", "customerPhone", "serviceId", "staffId", date, time, status, notes, "salonId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *',
      [id, customer_name || "", customer_phone || null, service_id || null, staff_id || null, date ? new Date(date) : new Date(), time || null, status || "pending", notes || null, req.salonId]
    );
    res.status(201).json({ appointment: rows[0] });
  } catch (err) {
    console.error("CREATE APPOINTMENT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Appointment" SET "customerName" = $1, "customerPhone" = $2, "serviceId" = $3, "staffId" = $4, date = COALESCE($5, date), time = $6, status = $7, notes = $8 WHERE id = $9 RETURNING *',
      [customer_name, customer_phone, service_id, staff_id, date ? new Date(date) : null, time, status, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Appointment not found" });
    res.json({ appointment: rows[0] });
  } catch (err) {
    console.error("UPDATE APPOINTMENT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Appointment" WHERE id = $1', [req.params.id]);
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    console.error("DELETE APPOINTMENT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;