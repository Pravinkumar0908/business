// src/config/db.js
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Connection test
(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected at:", res.rows[0].now);
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
  }
})();

// Log pool errors
pool.on("error", (err) => {
  console.error("❌ Unexpected pool error:", err.message);
});

module.exports = pool;