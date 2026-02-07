const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/summary", dashboardController.getDashboardSummary);

module.exports = router;
