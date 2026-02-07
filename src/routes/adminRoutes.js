const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const adminController = require("../controllers/adminController");

router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/stats", adminController.getPlatformStats);

module.exports = router;
