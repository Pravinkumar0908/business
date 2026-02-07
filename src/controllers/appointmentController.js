const pool = require("../config/db");

// CREATE APPOINTMENT
exports.createAppointment = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      service_id,
      staff_id,
      start_time,
      end_time
    } = req.body;

    const organizationId = req.user.organizationId;

    // 🔥 Double booking check
    const conflict = await pool.query(
      `
      SELECT * FROM appointments
      WHERE staff_id = $1
      AND organization_id = $2
      AND status = 'booked'
      AND (
        (start_time < $4 AND end_time > $3)
      )
      `,
      [staff_id, organizationId, start_time, end_time]
    );

    if (conflict.rows.length > 0) {
      return res.status(400).json({
        message: "Time slot already booked for this staff"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO appointments
      (customer_name, customer_phone, service_id, staff_id, start_time, end_time, organization_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        customer_name,
        customer_phone,
        service_id,
        staff_id,
        start_time,
        end_time,
        organizationId
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE APPOINTMENT ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


// GET APPOINTMENTS
exports.getAppointments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `
      SELECT a.*, s.name as service_name, st.name as staff_name
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN staff st ON a.staff_id = st.id
      WHERE a.organization_id = $1
      ORDER BY a.start_time DESC
      `,
      [organizationId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET APPOINTMENT ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
