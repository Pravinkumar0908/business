// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    const userId = decoded.id || decoded.userId;

    const { rows } = await pool.query(
      'SELECT id, "salonId" FROM "User" WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    req.userId = rows[0].id;
    req.salonId = rows[0].salonId;
    next();
  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;