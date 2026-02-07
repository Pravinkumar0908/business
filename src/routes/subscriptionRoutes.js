const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

router.use(authMiddleware);

router.post("/", subscriptionController.subscribe);
router.get("/me", subscriptionController.getMySubscription);

module.exports = router;
