const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");

router.post("/register", authController.register);
router.post("/login", authController.login);

// PUT /api/auth/profile — Update owner profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, email, phone, businessName, address } = req.body;
    const userId = req.userId;
    const salonId = req.salonId;

    // Ensure columns exist (safe migration)
    try {
      await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone TEXT');
      await pool.query('ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS address TEXT');
    } catch (e) { /* ignore if already exists */ }

    // Update user name, email, phone
    if (name || email || phone) {
      const fields = [];
      const values = [];
      let idx = 1;
      if (name) { fields.push(`name=$${idx++}`); values.push(name); }
      if (email) { fields.push(`email=$${idx++}`); values.push(email); }
      if (phone) { fields.push(`phone=$${idx++}`); values.push(phone); }
      values.push(userId);
      if (fields.length > 0) {
        await pool.query(
          `UPDATE "User" SET ${fields.join(', ')} WHERE id=$${idx}`,
          values
        );
      }
    }

    // Update business/salon name & address
    if (businessName || address) {
      const fields = [];
      const values = [];
      let idx = 1;
      if (businessName) { fields.push(`name=$${idx++}`); values.push(businessName); }
      if (address) { fields.push(`address=$${idx++}`); values.push(address); }
      values.push(salonId);
      if (fields.length > 0) {
        await pool.query(
          `UPDATE "Salon" SET ${fields.join(', ')} WHERE id=$${idx}`,
          values
        );
      }
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
