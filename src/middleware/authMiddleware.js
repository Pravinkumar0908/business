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

    // Fetch user from DB to get salonId
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.userId = user.id;
    req.salonId = user.salonId;
    req.user = user;
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;