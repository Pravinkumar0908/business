const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

router.get("/data", async (req, res) => {
  const salons = await prisma.salon.findMany();
  const staff = await prisma.staff.findMany();
  const services = await prisma.service.findMany();

  res.json({ salons, staff, services });
});

module.exports = router;
