const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

exports.register = async (req, res) => {
  try {
    const { name, email, password, businessType, organizationName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM "User" WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const salonId = uuidv4();
    const userId = uuidv4();

    // Create salon/business
    const bizType = (businessType || 'salon').toLowerCase();
    const bizName = organizationName || name;
    await pool.query(
      'INSERT INTO "Salon" (id, name, city, "businessType", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [salonId, bizName, "Unknown", bizType]
    );

    // Create user
    await pool.query(
      'INSERT INTO "User" (id, name, email, password, role, "salonId") VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, email, hashedPassword, "owner", salonId]
    );

    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: { id: userId, name, email, businessType: bizType }
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    console.log("🔐 LOGIN: Looking up user with email:", email);

    const { rows } = await pool.query(
      'SELECT u.id, u.name, u.password, u."salonId", s."businessType" FROM "User" u LEFT JOIN "Salon" s ON u."salonId" = s.id WHERE u.email = $1 LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      console.log("❌ LOGIN: User not found for email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    console.log("✅ LOGIN: User found, checking password");

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log("❌ LOGIN: Password mismatch for user:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("✅ LOGIN: Password correct, generating token");

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("✅ LOGIN: Success, token generated");

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email, businessType: user.businessType || 'salon' }
    });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
