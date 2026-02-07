const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,                 // safe pool size for free tier
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
    // DO NOT process.exit in production
  }
})();

/* =========================
   GLOBAL ERROR HANDLING
========================= */
pool.on("error", (err) => {
  console.error("Unexpected PG Pool Error:", err.message);
});

module.exports = pool;
