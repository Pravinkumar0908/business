// ✅ PURE pg Pool — NO Prisma for queries
// Prisma uses prepared statements which PgBouncer kills.
// pg Pool with { name: undefined } uses UNNAMED statements → PgBouncer safe.
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection
pool.query("SELECT 1")
  .then(() => console.log("✅ Database Connected (pg Pool — PgBouncer safe)"))
  .catch((err) => console.error("❌ Database Error:", err.message));

module.exports = pool;