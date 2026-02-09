const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ═══════════════════════════════════════════════
//  📋  RESTAURANT ORDER ROUTES
// ═══════════════════════════════════════════════

// ─── GET all orders (today by default, optional ?all=true) ───
router.get("/", auth, async (req, res) => {
  try {
    let query = `
      SELECT o.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'name', oi.name,
              'price', oi.price,
              'isVeg', oi."isVeg",
              'qty', oi.qty,
              'note', oi.note,
              'status', oi.status,
              'statusUpdatedAt', oi."statusUpdatedAt"
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) as items
      FROM "RestaurantOrder" o
      LEFT JOIN "RestaurantOrderItem" oi ON oi."orderId" = o.id
      WHERE o."salonId" = $1
    `;
    const values = [req.salonId];

    // By default get today's orders unless ?all=true
    if (req.query.all !== "true") {
      query += ` AND o."createdAt" >= CURRENT_DATE`;
    }

    query += ` GROUP BY o.id ORDER BY o."createdAt" DESC`;

    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error("GET ORDERS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── GET single order by ID ───
router.get("/:id", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'name', oi.name,
              'price', oi.price,
              'isVeg', oi."isVeg",
              'qty', oi.qty,
              'note', oi.note,
              'status', oi.status,
              'statusUpdatedAt', oi."statusUpdatedAt"
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) as items
       FROM "RestaurantOrder" o
       LEFT JOIN "RestaurantOrderItem" oi ON oi."orderId" = o.id
       WHERE o.id = $1 AND o."salonId" = $2
       GROUP BY o.id`,
      [req.params.id, req.salonId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Order not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("GET ORDER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST create new order ───
router.post("/", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      type,
      tableId,
      tableName,
      customerCount,
      customerName,
      customerPhone,
      items,
      total,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must have at least one item" });
    }

    const orderId = uuidv4();
    const subtotal = total || items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

    // Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO "RestaurantOrder" 
        (id, "salonId", "tableId", "tableName", "waiterId", "waiterName", type, status, 
         "customerCount", "customerName", "customerPhone", subtotal, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Created', $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        orderId,
        req.salonId,
        tableId || null,
        tableName || null,
        req.userId,
        null, // waiterName can be set later
        type || "dine_in",
        customerCount || 1,
        customerName || null,
        customerPhone || null,
        subtotal,
      ]
    );

    // Insert order items
    const insertedItems = [];
    for (const item of items) {
      const itemId = uuidv4();
      const { rows: itemRows } = await client.query(
        `INSERT INTO "RestaurantOrderItem" 
          (id, "orderId", "menuItemId", name, price, "isVeg", qty, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
         RETURNING *`,
        [
          itemId,
          orderId,
          item.menuItemId,
          item.name,
          item.price || 0,
          item.isVeg !== false,
          item.qty || 1,
          item.note || null,
        ]
      );
      insertedItems.push(itemRows[0]);
    }

    // Update table status if dine-in
    if (tableId) {
      await client.query(
        `UPDATE "RestaurantTable" 
         SET status = 'occupied', "currentOrderId" = $1, "customerName" = $2, "occupiedSince" = NOW()
         WHERE id = $3 AND "salonId" = $4`,
        [orderId, customerName || null, tableId, req.salonId]
      );
    }

    await client.query("COMMIT");

    const order = orderRows[0];
    order.items = insertedItems;
    res.status(201).json(order);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE ORDER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─── PUT update order status ───
router.put("/:id", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { status, cancelReason, discountAmount, serviceChargeRate, taxRate } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (cancelReason !== undefined) {
      fields.push(`"cancelReason" = $${idx++}`);
      values.push(cancelReason);
    }
    if (discountAmount !== undefined) {
      fields.push(`"discountAmount" = $${idx++}`);
      values.push(discountAmount);
    }
    if (serviceChargeRate !== undefined) {
      fields.push(`"serviceChargeRate" = $${idx++}`);
      values.push(serviceChargeRate);
    }
    if (taxRate !== undefined) {
      fields.push(`"taxRate" = $${idx++}`);
      values.push(taxRate);
    }

    fields.push(`"updatedAt" = NOW()`);

    if (fields.length === 1) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(req.params.id);
    values.push(req.salonId);

    const { rows } = await client.query(
      `UPDATE "RestaurantOrder" SET ${fields.join(", ")} 
       WHERE id = $${idx++} AND "salonId" = $${idx}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }

    // If status is sent to kitchen, update all pending items
    if (status === "Sent to Kitchen") {
      await client.query(
        `UPDATE "RestaurantOrderItem" SET status = 'In Kitchen', "statusUpdatedAt" = NOW()
         WHERE "orderId" = $1 AND status = 'Pending'`,
        [req.params.id]
      );
    }

    // If order completed or cancelled, free the table
    if (status === "Completed" || status === "Cancelled") {
      const order = rows[0];
      if (order.tableId) {
        await client.query(
          `UPDATE "RestaurantTable" 
           SET status = 'cleaning', "currentOrderId" = NULL, "customerName" = NULL
           WHERE id = $1 AND "salonId" = $2`,
          [order.tableId, req.salonId]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch the full order with items
    const { rows: fullOrder } = await pool.query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'name', oi.name,
              'price', oi.price,
              'isVeg', oi."isVeg",
              'qty', oi.qty,
              'note', oi.note,
              'status', oi.status,
              'statusUpdatedAt', oi."statusUpdatedAt"
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) as items
       FROM "RestaurantOrder" o
       LEFT JOIN "RestaurantOrderItem" oi ON oi."orderId" = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.params.id]
    );

    res.json(fullOrder[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPDATE ORDER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─── POST add items to existing order ───
router.post("/:id/items", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Must provide items to add" });
    }

    // Verify order exists and belongs to this salon
    const { rows: orderRows } = await client.query(
      `SELECT * FROM "RestaurantOrder" WHERE id = $1 AND "salonId" = $2`,
      [req.params.id, req.salonId]
    );
    if (orderRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderRows[0];
    // Only allow adding items to active orders
    if (order.status === "Completed" || order.status === "Cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot add items to a completed/cancelled order" });
    }

    // Insert new items
    const insertedItems = [];
    for (const item of items) {
      const itemId = uuidv4();
      const { rows: itemRows } = await client.query(
        `INSERT INTO "RestaurantOrderItem" 
          (id, "orderId", "menuItemId", name, price, "isVeg", qty, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
         RETURNING *`,
        [
          itemId,
          req.params.id,
          item.menuItemId,
          item.name,
          item.price || 0,
          item.isVeg !== false,
          item.qty || 1,
          item.note || null,
        ]
      );
      insertedItems.push(itemRows[0]);
    }

    // Recalculate subtotal
    const { rows: allItems } = await client.query(
      `SELECT price, qty FROM "RestaurantOrderItem" WHERE "orderId" = $1 AND status != 'Cancelled'`,
      [req.params.id]
    );
    const newSubtotal = allItems.reduce((s, i) => s + (i.price * i.qty), 0);

    await client.query(
      `UPDATE "RestaurantOrder" SET subtotal = $1, "updatedAt" = NOW() WHERE id = $2`,
      [newSubtotal, req.params.id]
    );

    await client.query("COMMIT");

    // Fetch full updated order
    const { rows: fullOrder } = await pool.query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menuItemId', oi."menuItemId",
              'name', oi.name,
              'price', oi.price,
              'isVeg', oi."isVeg",
              'qty', oi.qty,
              'note', oi.note,
              'status', oi.status,
              'statusUpdatedAt', oi."statusUpdatedAt"
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) as items
       FROM "RestaurantOrder" o
       LEFT JOIN "RestaurantOrderItem" oi ON oi."orderId" = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.params.id]
    );

    res.status(201).json(fullOrder[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ADD ITEMS TO ORDER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ─── PUT update individual order item status ───
router.put("/:orderId/items/:itemId", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });

    const { rows } = await pool.query(
      `UPDATE "RestaurantOrderItem" 
       SET status = $1, "statusUpdatedAt" = NOW()
       WHERE id = $2 AND "orderId" = $3
       RETURNING *`,
      [status, req.params.itemId, req.params.orderId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Order item not found" });

    // Check if all items are ready — auto-update order status
    const { rows: allItems } = await pool.query(
      `SELECT status FROM "RestaurantOrderItem" WHERE "orderId" = $1`,
      [req.params.orderId]
    );

    const allReady = allItems.every(
      (i) => i.status === "Ready" || i.status === "Served" || i.status === "Cancelled"
    );
    if (allReady) {
      await pool.query(
        `UPDATE "RestaurantOrder" SET status = 'Ready', "updatedAt" = NOW() WHERE id = $1`,
        [req.params.orderId]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("UPDATE ORDER ITEM ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE cancel order ───
router.delete("/:id", auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the order first
    const { rows: orderRows } = await client.query(
      `SELECT * FROM "RestaurantOrder" WHERE id = $1 AND "salonId" = $2`,
      [req.params.id, req.salonId]
    );

    if (orderRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderRows[0];

    // Mark as cancelled
    await client.query(
      `UPDATE "RestaurantOrder" SET status = 'Cancelled', "updatedAt" = NOW() WHERE id = $1`,
      [req.params.id]
    );

    // Free up table
    if (order.tableId) {
      await client.query(
        `UPDATE "RestaurantTable" SET status = 'cleaning', "currentOrderId" = NULL WHERE id = $1`,
        [order.tableId]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Order cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CANCEL ORDER ERROR:", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
