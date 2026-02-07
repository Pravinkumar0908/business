const prisma = require("../lib/prisma");
const bcrypt = require("bcrypt");

exports.createManager = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const manager = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "MANAGER",
        salonId
      }
    });

    res.status(201).json({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
