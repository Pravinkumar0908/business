const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ═══════════════════════════════════════════════════════════════
// STAFF PIN-BASED AUTH — single device, quick staff switching
// ═══════════════════════════════════════════════════════════════

// ── Ensure role/pin columns exist (safe migration) ──
async function ensureColumns() {
  try {
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'staff\'');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pinHash" TEXT');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS permissions TEXT');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "failedAttempts" INT DEFAULT 0');
    await pool.query('ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ');
  } catch (e) {
    console.log("Column migration note:", e.message);
  }
}
ensureColumns();

// ─────────────────────────────────────────────────────────
// GET /api/staff-auth/staff-list
// Returns active staff for PIN login screen (no auth required — uses salonId from owner token)
// ─────────────────────────────────────────────────────────
router.get("/staff-list", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, role, "isActive", 
              CASE WHEN "pinHash" IS NOT NULL THEN true ELSE false END as "hasPin"
       FROM "Staff" 
       WHERE "salonId" = $1 AND "isActive" = true 
       ORDER BY name ASC`,
      [req.salonId]
    );
    res.json({ staff: rows });
  } catch (err) {
    console.error("STAFF LIST ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/staff-auth/pin-login
// Staff logs in with PIN — returns staff session token
// ─────────────────────────────────────────────────────────
router.post("/pin-login", auth, async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) {
      return res.status(400).json({ message: "staffId and pin are required" });
    }

    // Get staff
    const { rows } = await pool.query(
      `SELECT id, name, role, "pinHash", permissions, "isActive", 
              "failedAttempts", "lockedUntil", "salonId"
       FROM "Staff" 
       WHERE id = $1 AND "salonId" = $2`,
      [staffId, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const staff = rows[0];

    // Check if active
    if (!staff.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Check if locked
    if (staff.lockedUntil && new Date(staff.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(staff.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ 
        message: `Account locked. Try again in ${mins} minute(s)`,
        lockedUntil: staff.lockedUntil
      });
    }

    // Check if PIN is set
    if (!staff.pinHash) {
      return res.status(400).json({ message: "PIN not set. Ask owner to set your PIN." });
    }

    // Verify PIN
    const valid = await bcrypt.compare(pin, staff.pinHash);
    if (!valid) {
      // Increment failed attempts
      let newAttempts = (staff.failedAttempts || 0) + 1;
      let lockUntil = null;

      // Lock after 5 failed attempts for 15 minutes
      if (newAttempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        newAttempts = 0; // Reset counter
      }

      await pool.query(
        `UPDATE "Staff" SET "failedAttempts" = $1, "lockedUntil" = $2 WHERE id = $3`,
        [newAttempts, lockUntil, staffId]
      );

      const remaining = 5 - newAttempts;
      return res.status(401).json({ 
        message: lockUntil 
          ? "Too many attempts. Account locked for 15 minutes." 
          : `Wrong PIN. ${remaining} attempt(s) remaining.`,
        attemptsRemaining: remaining
      });
    }

    // PIN is correct — reset failed attempts, update last login
    await pool.query(
      `UPDATE "Staff" SET "failedAttempts" = 0, "lockedUntil" = NULL, "lastLoginAt" = NOW() WHERE id = $1`,
      [staffId]
    );

    // Parse permissions
    let permissions = [];
    try {
      permissions = staff.permissions ? JSON.parse(staff.permissions) : [];
    } catch (e) {
      permissions = [];
    }

    res.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        permissions: permissions,
        salonId: staff.salonId,
      }
    });
  } catch (err) {
    console.error("PIN LOGIN ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/staff-auth/set-pin
// Owner sets/resets PIN for a staff member
// ─────────────────────────────────────────────────────────
router.post("/set-pin", auth, async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) {
      return res.status(400).json({ message: "staffId and pin are required" });
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }

    // Hash the PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    await pool.query(
      `UPDATE "Staff" SET "pinHash" = $1, "failedAttempts" = 0, "lockedUntil" = NULL WHERE id = $2 AND "salonId" = $3`,
      [pinHash, staffId, req.salonId]
    );

    res.json({ success: true, message: "PIN set successfully" });
  } catch (err) {
    console.error("SET PIN ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/staff-auth/update-role
// Owner updates staff role + permissions
// ─────────────────────────────────────────────────────────
router.put("/update-role", auth, async (req, res) => {
  try {
    const { staffId, role, permissions } = req.body;
    if (!staffId) {
      return res.status(400).json({ message: "staffId is required" });
    }

    const permissionsJson = permissions ? JSON.stringify(permissions) : null;

    const { rows } = await pool.query(
      `UPDATE "Staff" SET role = $1, permissions = $2 WHERE id = $3 AND "salonId" = $4 RETURNING 
        id, name, role, permissions, "isActive"`,
      [role || 'staff', permissionsJson, staffId, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Parse permissions back
    const staff = rows[0];
    try {
      staff.permissions = staff.permissions ? JSON.parse(staff.permissions) : [];
    } catch (e) {
      staff.permissions = [];
    }

    res.json({ success: true, staff });
  } catch (err) {
    console.error("UPDATE ROLE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/staff-auth/toggle-active
// Owner activates/deactivates a staff member
// ─────────────────────────────────────────────────────────
router.put("/toggle-active", auth, async (req, res) => {
  try {
    const { staffId, isActive } = req.body;
    if (!staffId) {
      return res.status(400).json({ message: "staffId is required" });
    }

    const { rows } = await pool.query(
      `UPDATE "Staff" SET "isActive" = $1 WHERE id = $2 AND "salonId" = $3 RETURNING id, name, "isActive"`,
      [isActive !== false, staffId, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.json({ success: true, staff: rows[0] });
  } catch (err) {
    console.error("TOGGLE ACTIVE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/staff-auth/staff-detail/:id
// Get full staff detail with role/permissions (owner only)
// ─────────────────────────────────────────────────────────
router.get("/staff-detail/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone, role, permissions, "isActive", "commissionType", "commissionValue", "baseSalary",
              CASE WHEN "pinHash" IS NOT NULL THEN true ELSE false END as "hasPin",
              "lastLoginAt", "failedAttempts"
       FROM "Staff" 
       WHERE id = $1 AND "salonId" = $2`,
      [req.params.id, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const staff = rows[0];
    try {
      staff.permissions = staff.permissions ? JSON.parse(staff.permissions) : [];
    } catch (e) {
      staff.permissions = [];
    }

    res.json({ staff });
  } catch (err) {
    console.error("STAFF DETAIL ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
