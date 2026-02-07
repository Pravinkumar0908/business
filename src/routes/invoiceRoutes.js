const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const invoiceController = require("../controllers/invoiceController");

router.use(authMiddleware);

router.post("/", invoiceController.createInvoice);
router.get("/", invoiceController.getInvoices);

module.exports = router;
