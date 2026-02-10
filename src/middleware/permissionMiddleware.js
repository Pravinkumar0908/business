const pool = require("../config/db");

// ═══════════════════════════════════════════════════════════════
// PERMISSION MIDDLEWARE — validates staff permissions server-side
// Backend must never trust frontend-only checks for sensitive ops
// ═══════════════════════════════════════════════════════════════

/**
 * Factory: creates middleware that checks if the current user has a specific permission.
 * 
 * Usage in routes:
 *   router.post("/create-order", auth, requirePermission("createOrder"), async (req, res) => { ... });
 *   router.post("/apply-discount", auth, requirePermission("addDiscount"), async (req, res) => { ... });
 * 
 * How it works:
 * - If req.userType === "owner" → always allowed (owner has all permissions)
 * - If req.userType === "staff" → checks staff's permissions array in DB
 * - If no staffId header is provided → treats as owner (backward compatible)
 * 
 * The frontend should send:
 *   Headers: { "x-staff-id": "staff-uuid" }
 * when a staff member is performing the action.
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const staffId = req.headers["x-staff-id"];

      // No staff ID = owner request → always allowed
      if (!staffId) {
        req.userType = "owner";
        return next();
      }

      // Lookup staff permissions from DB (never trust frontend)
      const { rows } = await pool.query(
        `SELECT id, name, role, permissions, "isActive", "lockedUntil"
         FROM "Staff" 
         WHERE id = $1 AND "salonId" = $2`,
        [staffId, req.salonId]
      );

      if (rows.length === 0) {
        return res.status(403).json({
          message: "Staff not found or not authorized",
          code: "STAFF_NOT_FOUND",
        });
      }

      const staff = rows[0];

      // Check if active
      if (!staff.isActive) {
        return res.status(403).json({
          message: "Your account is deactivated",
          code: "ACCOUNT_DEACTIVATED",
        });
      }

      // Check if locked
      if (staff.lockedUntil && new Date(staff.lockedUntil) > new Date()) {
        return res.status(423).json({
          message: "Your account is temporarily locked",
          code: "ACCOUNT_LOCKED",
        });
      }

      // Owner role staff → all permissions
      if (staff.role === "owner" || staff.role === "manager") {
        // Manager has near-full access, treat as allowed for most ops
        // For truly owner-only ops, use requireOwnerOnly() instead
      }

      // Parse permissions
      let permissions = [];
      try {
        permissions = staff.permissions ? JSON.parse(staff.permissions) : [];
      } catch (e) {
        permissions = [];
      }

      // Check the specific permission
      if (!permissions.includes(permission)) {
        return res.status(403).json({
          message: `You don't have '${permission}' permission. Ask the owner to grant access.`,
          code: "PERMISSION_DENIED",
          requiredPermission: permission,
        });
      }

      // Attach staff info to request for downstream use
      req.userType = "staff";
      req.staffId = staff.id;
      req.staffName = staff.name;
      req.staffRole = staff.role;
      req.staffPermissions = permissions;

      next();
    } catch (err) {
      console.error("PERMISSION CHECK ERROR:", err.message);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Middleware: only owner can access (no staff allowed)
 * Use for: manage_subscription, manage_settings, manage_staff roles
 */
function requireOwnerOnly() {
  return (req, res, next) => {
    const staffId = req.headers["x-staff-id"];
    if (staffId) {
      return res.status(403).json({
        message: "Only the business owner can perform this action",
        code: "OWNER_ONLY",
      });
    }
    req.userType = "owner";
    next();
  };
}

/**
 * Middleware: checks multiple permissions (user needs ANY of them)
 * Usage: requireAnyPermission(["createOrder", "editOrder"])
 */
function requireAnyPermission(permissionList) {
  return async (req, res, next) => {
    try {
      const staffId = req.headers["x-staff-id"];

      if (!staffId) {
        req.userType = "owner";
        return next();
      }

      const { rows } = await pool.query(
        `SELECT id, name, role, permissions, "isActive"
         FROM "Staff" 
         WHERE id = $1 AND "salonId" = $2`,
        [staffId, req.salonId]
      );

      if (rows.length === 0 || !rows[0].isActive) {
        return res.status(403).json({
          message: "Staff not found or not active",
          code: "STAFF_NOT_FOUND",
        });
      }

      let permissions = [];
      try {
        permissions = rows[0].permissions
          ? JSON.parse(rows[0].permissions)
          : [];
      } catch (e) {
        permissions = [];
      }

      const hasAny = permissionList.some((p) => permissions.includes(p));
      if (!hasAny) {
        return res.status(403).json({
          message: `You need one of these permissions: ${permissionList.join(", ")}`,
          code: "PERMISSION_DENIED",
          requiredPermissions: permissionList,
        });
      }

      req.userType = "staff";
      req.staffId = rows[0].id;
      req.staffName = rows[0].name;
      req.staffRole = rows[0].role;
      req.staffPermissions = permissions;

      next();
    } catch (err) {
      console.error("PERMISSION CHECK ERROR:", err.message);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

module.exports = {
  requirePermission,
  requireOwnerOnly,
  requireAnyPermission,
};
