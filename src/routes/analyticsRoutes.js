const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getStaffPerformance,
  getDailyRevenue,
  getMonthlyRevenue,
  getMonthlyNetProfit
} = require("../controllers/analyticsController");

router.get(
  "/staff-performance",
  authMiddleware,
  roleMiddleware(["OWNER", "MANAGER"]),
  getStaffPerformance
);

router.get(
  "/daily-revenue",
  authMiddleware,
  roleMiddleware(["OWNER", "MANAGER"]),
  getDailyRevenue
);

router.get(
  "/monthly-revenue",
  authMiddleware,
  roleMiddleware(["OWNER", "MANAGER"]),
  getMonthlyRevenue
);

// 🔥 Only OWNER can see net profit
router.get(
  "/monthly-net-profit",
  authMiddleware,
  roleMiddleware(["OWNER"]),
  getMonthlyNetProfit
);

module.exports = router;
