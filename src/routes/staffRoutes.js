const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const staffController = require("../controllers/staffController");

router.use(authMiddleware);

router.post("/", staffController.createStaff);
router.get("/", staffController.getStaff);

module.exports = router;
