const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { createManager } = require("../controllers/userController");

router.post(
  "/create-manager",
  authMiddleware,
  roleMiddleware(["OWNER"]),
  createManager
);

module.exports = router;
