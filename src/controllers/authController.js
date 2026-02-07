const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

/* =========================
   REGISTER (OWNER + ORG CREATE)
========================= */
exports.register = async (req, res) => {
  try {
    const { name, email, password, organizationName } = req.body;

    if (!name || !email || !password || !organizationName) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Create organization
    const orgId = uuidv4();

    await pool.query(
      "INSERT INTO organizations (id, name) VALUES ($1, $2)",
      [orgId, organizationName]
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = uuidv4();

    // Create user (owner role)
    await pool.query(
      `INSERT INTO users (id, name, email, password, role, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, name, email, hashedPassword, "owner", orgId]
    );

    const token = jwt.sign(
      {
        userId,
        organizationId: orgId,
        role: "owner"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({
      message: "Server error"
    });
  }
};

/* =========================
   LOGIN
========================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organization_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      message: "Server error"
    });
  }
};
