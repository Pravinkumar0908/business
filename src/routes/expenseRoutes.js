const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const expenseController = require("../controllers/expenseController");

router.use(authMiddleware);

router.post("/", expenseController.createExpense);
router.get("/", expenseController.getExpenses);

module.exports = router;
