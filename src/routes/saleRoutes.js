const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// 👇 IMPORT PEHLE
const {
  createSale,
  getSales
} = require("../controllers/saleController");

// 👇 PHIR console agar karna ho
// console.log("createSale:", typeof createSale);
// console.log("getSales:", typeof getSales);

router.post(
  "/create",
  authMiddleware,
  roleMiddleware(["OWNER", "MANAGER"]),
  createSale
);

router.get(
  "/all",
  authMiddleware,
  roleMiddleware(["OWNER", "MANAGER"]),
  getSales
);

module.exports = router;
