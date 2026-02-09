const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ═══════════════════════════════════════════════
//  🍔  RESTAURANT MENU ROUTES
// ═══════════════════════════════════════════════

// GET all menu items for this salon
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "MenuItem" WHERE "salonId" = $1 ORDER BY category ASC, name ASC`,
      [req.salonId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET MENU ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create menu item
router.post("/", auth, async (req, res) => {
  try {
    const { name, category, price, isVeg, isAvailable, description } = req.body;
    if (!name) return res.status(400).json({ message: "Item name is required" });

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO "MenuItem" (id, "salonId", name, category, price, "isVeg", "isAvailable", description, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        id,
        req.salonId,
        name,
        category || "Uncategorized",
        price || 0,
        isVeg !== false,
        isAvailable !== false,
        description || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("CREATE MENU ITEM ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update menu item
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, category, price, isVeg, isAvailable, description } = req.body;
    const { rows } = await pool.query(
      `UPDATE "MenuItem"
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           price = COALESCE($3, price),
           "isVeg" = COALESCE($4, "isVeg"),
           "isAvailable" = COALESCE($5, "isAvailable"),
           description = COALESCE($6, description)
       WHERE id = $7 AND "salonId" = $8
       RETURNING *`,
      [name, category, price, isVeg, isAvailable, description, req.params.id, req.salonId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Menu item not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("UPDATE MENU ITEM ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE menu item
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM "MenuItem" WHERE id = $1 AND "salonId" = $2`,
      [req.params.id, req.salonId]
    );
    res.json({ message: "Menu item deleted" });
  } catch (err) {
    console.error("DELETE MENU ITEM ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
