const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM appointments WHERE user_id = $1 ORDER BY date DESC, time DESC",
      [req.userId]
    );
    res.json({ appointments: result.rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const result = await pool.query(
      "INSERT INTO appointments (user_id, customer_name, customer_phone, service_id, staff_id, date, time, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [req.userId, customer_name, customer_phone, service_id, staff_id, date, time, status || 'pending', notes]
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_id, staff_id, date, time, status, notes } = req.body;
    const result = await pool.query(
      "UPDATE appointments SET customer_name=$1, customer_phone=$2, service_id=$3, staff_id=$4, date=$5, time=$6, status=$7, notes=$8 WHERE id=$9 AND user_id=$10 RETURNING *",
      [customer_name, customer_phone, service_id, staff_id, date, time, status, notes, req.params.id, req.userId]
    );
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM appointments WHERE id=$1 AND user_id=$2",
      [req.params.id, req.userId]
    );
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;