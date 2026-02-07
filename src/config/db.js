const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
pool.connect()
  .then(() => {
    console.log("✅ PostgreSQL Connected (Supabase)");
  })
  .catch((err) => {
    console.error("❌ PostgreSQL Connection Error:", err.message);
    process.exit(1);
  });

module.exports = pool;
