const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const subscriptionMiddleware = require("../middleware/subscriptionMiddleware");
const serviceController = require("../controllers/serviceController");

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.post("/", serviceController.createService);
router.get("/", serviceController.getServices);

module.exports = router;
