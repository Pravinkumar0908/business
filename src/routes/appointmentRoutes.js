const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const appointmentController = require("../controllers/appointmentController");

router.use(authMiddleware);

router.post("/", appointmentController.createAppointment);
router.get("/", appointmentController.getAppointments);

module.exports = router;
