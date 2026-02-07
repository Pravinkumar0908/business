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

(async () => {
  try {
    const res = await pool.query("SELECT 1");
    console.log("✅ PostgreSQL Connected");
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
  }
})();

module.exports = pool;