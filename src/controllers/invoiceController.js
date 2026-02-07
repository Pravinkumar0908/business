const pool = require("../config/db");

exports.createInvoice = async (req, res) => {
  try {
    const { customer_name, items, payment_method, staff_id } = req.body;
    const organizationId = req.user.organizationId;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ message: "Invalid invoice data" });
    }

    let total = 0;

    for (let item of items) {
      total += parseFloat(item.price) * (item.quantity || 1);
    }

    // 1️⃣ Create Invoice
    const invoiceResult = await pool.query(
      `INSERT INTO invoices 
       (customer_name, total_amount, payment_method, organization_id)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [customer_name, total, payment_method, organizationId]
    );

    const invoice = invoiceResult.rows[0];

    // 2️⃣ Insert Items
    for (let item of items) {
      await pool.query(
        `INSERT INTO invoice_items 
         (invoice_id, service_id, price, quantity)
         VALUES ($1,$2,$3,$4)`,
        [
          invoice.id,
          item.service_id,
          item.price,
          item.quantity || 1
        ]
      );
    }

    // 3️⃣ Commission Auto Calculation
    if (staff_id) {
      const staffResult = await pool.query(
        `SELECT commission_rate 
         FROM staff 
         WHERE id = $1 AND organization_id = $2`,
        [staff_id, organizationId]
      );

      if (staffResult.rows.length > 0) {
        const commissionRate = parseFloat(staffResult.rows[0].commission_rate);
        const commissionAmount = (total * commissionRate) / 100;

        await pool.query(
          `INSERT INTO staff_commissions 
           (staff_id, invoice_id, commission_amount, organization_id)
           VALUES ($1,$2,$3,$4)`,
          [staff_id, invoice.id, commissionAmount, organizationId]
        );
      }
    }

    res.status(201).json(invoice);

  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT * FROM invoices
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET INVOICE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
