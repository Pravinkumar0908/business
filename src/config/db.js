const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  family: 4 // FORCE IPV4
});

/* =========================
   INITIAL CONNECTION TEST
========================= */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL Connected (Supabase)");
  } catch (err) {
    console.error("❌ PostgreSQL Connection Error:", err.message);
  }
})();

/* =========================
   GLOBAL POOL ERROR HANDLER
========================= */
pool.on("error", (err) => {
  console.error("Unexpected PG Pool Error:", err.message);
});

module.exports = pool;
