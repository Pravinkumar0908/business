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
    
    // Fetch user with salonId from database
    const result = await pool.query(
      "SELECT id, name, email, \"salonId\" FROM \"User\" WHERE id = $1",
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.userId = userId;
    req.user = result.rows[0];
    req.salonId = result.rows[0].salonId;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;