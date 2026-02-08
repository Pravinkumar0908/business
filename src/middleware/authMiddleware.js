// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    const userId = decoded.id || decoded.userId;

    // Use raw SQL to avoid PgBouncer prepared statement issues
    let users;
    try {
      users = await prisma.$queryRaw`
        SELECT id, "salonId" FROM "User" WHERE id = ${userId} LIMIT 1
      `;
    } catch (err) {
      console.error("❌ AUTH: Database query failed:", err.message);
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = users[0];
    req.userId = user.id;
    req.salonId = user.salonId;
    next();
  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;