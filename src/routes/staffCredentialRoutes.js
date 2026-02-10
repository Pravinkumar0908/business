const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ═══════════════════════════════════════════════════════════════
// STAFF CREDENTIAL MANAGEMENT — Owner creates staff with email/password
// Staff can login via the same login page as owner
// Each staff belongs to exactly ONE business (owner's businessId)
// ═══════════════════════════════════════════════════════════════

// ── Ensure new columns exist (safe migration) ──
async function ensureStaffColumns() {
  try {
    await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffRole" TEXT');
    await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS permissions TEXT');
    await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true');
    await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdBy" TEXT');
  } catch (e) {
    console.log("Staff column migration note:", e.message);
  }
}
ensureStaffColumns();

// ────────────────────────────────────────────────────────
// POST /api/staff-credentials/create — Owner creates a staff user
// ────────────────────────────────────────────────────────
router.post("/create", auth, async (req, res) => {
  try {
    const { name, email, password, staffRole, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (!staffRole) {
      return res.status(400).json({ message: "Staff role is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Verify the current user is an owner
    const { rows: ownerRows } = await pool.query(
      'SELECT role, "salonId" FROM "User" WHERE id = $1',
      [req.userId]
    );
    if (ownerRows.length === 0 || ownerRows[0].role !== 'owner') {
      return res.status(403).json({ message: "Only business owners can create staff accounts" });
    }

    const ownerSalonId = ownerRows[0].salonId;

    // Check if email already exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM "User" WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const staffId = uuidv4();
    const permissionsJson = permissions ? JSON.stringify(permissions) : null;

    // Create staff user with same businessId as owner
    await pool.query(
      `INSERT INTO "User" (id, name, email, password, role, "salonId", "staffRole", permissions, "isActive", "createdBy")
       VALUES ($1, $2, $3, $4, 'staff', $5, $6, $7, true, $8)`,
      [staffId, name, email.toLowerCase().trim(), hashedPassword, ownerSalonId, staffRole, permissionsJson, req.userId]
    );

    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      staff: {
        id: staffId,
        name,
        email: email.toLowerCase().trim(),
        role: 'staff',
        staffRole,
        permissions: permissions || [],
        isActive: true,
        businessId: ownerSalonId,
      }
    });
  } catch (err) {
    console.error("CREATE STAFF CREDENTIAL ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// GET /api/staff-credentials/list — Owner gets all staff users
// ────────────────────────────────────────────────────────
router.get("/list", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, "staffRole", permissions, "isActive", "createdAt"
       FROM "User"
       WHERE "salonId" = $1 AND role = 'staff'
       ORDER BY "createdAt" DESC`,
      [req.salonId]
    );

    // Parse permissions JSON for each staff
    const staff = rows.map(s => {
      let perms = [];
      try { perms = s.permissions ? JSON.parse(s.permissions) : []; }
      catch (e) { perms = []; }
      return { ...s, permissions: perms };
    });

    res.json({ staff });
  } catch (err) {
    console.error("LIST STAFF CREDENTIALS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// PUT /api/staff-credentials/update/:id — Owner updates staff
// ────────────────────────────────────────────────────────
router.put("/update/:id", auth, async (req, res) => {
  try {
    const { name, staffRole, permissions, isActive } = req.body;
    const staffId = req.params.id;

    // Verify staff belongs to owner's business
    const { rows: staffRows } = await pool.query(
      'SELECT id, "salonId" FROM "User" WHERE id = $1 AND "salonId" = $2 AND role = \'staff\'',
      [staffId, req.salonId]
    );
    if (staffRows.length === 0) {
      return res.status(404).json({ message: "Staff not found in your business" });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (staffRole !== undefined) { updates.push(`"staffRole" = $${idx++}`); values.push(staffRole); }
    if (permissions !== undefined) { updates.push(`permissions = $${idx++}`); values.push(JSON.stringify(permissions)); }
    if (isActive !== undefined) { updates.push(`"isActive" = $${idx++}`); values.push(isActive); }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(staffId);
    const { rows } = await pool.query(
      `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, name, email, role, "staffRole", permissions, "isActive"`,
      values
    );

    const staff = rows[0];
    try { staff.permissions = staff.permissions ? JSON.parse(staff.permissions) : []; }
    catch (e) { staff.permissions = []; }

    res.json({ success: true, staff });
  } catch (err) {
    console.error("UPDATE STAFF CREDENTIAL ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// PUT /api/staff-credentials/reset-password/:id — Owner resets staff password
// ────────────────────────────────────────────────────────
router.put("/reset-password/:id", auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const staffId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Verify staff belongs to owner's business
    const { rows: staffRows } = await pool.query(
      'SELECT id FROM "User" WHERE id = $1 AND "salonId" = $2 AND role = \'staff\'',
      [staffId, req.salonId]
    );
    if (staffRows.length === 0) {
      return res.status(404).json({ message: "Staff not found in your business" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE "User" SET password = $1 WHERE id = $2',
      [hashedPassword, staffId]
    );

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("RESET STAFF PASSWORD ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// PUT /api/staff-credentials/toggle-active/:id — Owner activates/deactivates
// ────────────────────────────────────────────────────────
router.put("/toggle-active/:id", auth, async (req, res) => {
  try {
    const { isActive } = req.body;
    const staffId = req.params.id;

    const { rows } = await pool.query(
      `UPDATE "User" SET "isActive" = $1 WHERE id = $2 AND "salonId" = $3 AND role = 'staff'
       RETURNING id, name, email, "isActive"`,
      [isActive !== false, staffId, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found in your business" });
    }

    res.json({ success: true, staff: rows[0] });
  } catch (err) {
    console.error("TOGGLE STAFF ACTIVE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ────────────────────────────────────────────────────────
// DELETE /api/staff-credentials/delete/:id — Owner deletes staff
// ────────────────────────────────────────────────────────
router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const staffId = req.params.id;

    const { rows } = await pool.query(
      'DELETE FROM "User" WHERE id = $1 AND "salonId" = $2 AND role = \'staff\' RETURNING id, name',
      [staffId, req.salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Staff not found in your business" });
    }

    res.json({ success: true, message: `Staff ${rows[0].name} deleted successfully` });
  } catch (err) {
    console.error("DELETE STAFF CREDENTIAL ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
