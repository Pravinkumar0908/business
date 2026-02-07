const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL Connected");
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
})();

module.exports = pool;
