const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await pool.query(
      "SELECT id, role, organization_id FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const user = userResult.rows[0];

    req.user = {
      userId: user.id,
      role: user.role,
      organizationId: user.organization_id
    };

    next();

  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
