const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Test connection
(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database Connected");
    console.log("✅ Tables Ready");
  } catch (error) {
    console.error("❌ Database Error:", error);
  }
})();

module.exports = prisma;