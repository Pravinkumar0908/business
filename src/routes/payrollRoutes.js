const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  generatePayroll
} = require("../controllers/payrollController");

router.post(
  "/generate",
  authMiddleware,
  roleMiddleware(["OWNER"]),
  generatePayroll
);

module.exports = router;
