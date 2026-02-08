const prisma = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

// Retry mechanism for PgBouncer transient errors
async function retryPrismaOp(operation, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      // Check if it's a transient PgBouncer error
      if (err.code === "P2025" || err.message?.includes("prepared statement")) {
        console.log(`PgBouncer error, retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100)); // Exponential backoff
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Use raw SQL to avoid PgBouncer prepared statement issues
    const existing = await prisma.$queryRaw`
      SELECT * FROM "User" WHERE email = ${email} LIMIT 1
    `;

    if (existing && existing.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const salonId = uuidv4();
    const userId = uuidv4();

    // Create salon
    await prisma.$executeRaw`
      INSERT INTO "Salon" (id, name, city, "createdAt") 
      VALUES (${salonId}, ${name}, 'Unknown', NOW())
    `;

    // Create user
    await prisma.$executeRaw`
      INSERT INTO "User" (id, name, email, password, role, "salonId") 
      VALUES (${userId}, ${name}, ${email}, ${hashedPassword}, 'owner', ${salonId})
    `;

    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token
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

    // Use raw SQL query with retry mechanism for PgBouncer compatibility
    let user;
    try {
      const users = await retryPrismaOp(async () => {
        return await prisma.$queryRaw`
          SELECT id, password FROM "User" WHERE email = ${email} LIMIT 1
        `;
      });
      
      if (users && users.length > 0) {
        user = users[0];
      }
    } catch (err) {
      console.error("❌ LOGIN: Database query failed:", err.message);
      return res.status(500).json({ message: "Server error" });
    }

    if (!user) {
      console.log("❌ LOGIN: User not found for email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

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
      user: { id: user.id }
    });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
