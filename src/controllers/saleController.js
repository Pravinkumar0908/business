const prisma = require("../lib/prisma");

exports.createSale = async (req, res) => {
  try {
    const salonId = req.user.salonId;
    const {
      invoiceNo,
      items,
      paymentMode = "cash",
      subtotal,
      taxAmount = 0,
      discount = 0,
      totalAmount,
      paymentStatus = "paid",
      date
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    const computedSubtotal =
      Number(subtotal) ||
      items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);

    const computedTotal = Number(totalAmount) || computedSubtotal + Number(taxAmount || 0) - Number(discount || 0);

    const saleData = {
      invoiceNo: invoiceNo || `INV-${Date.now()}`,
      salonId,
      subtotal: computedSubtotal,
      taxAmount: Number(taxAmount || 0),
      discount: Number(discount || 0),
      totalAmount: computedTotal,
      paymentMode,
      paymentStatus,
      items: {
        create: items.map((it) => ({
          serviceId: it.serviceId,
          staffId: it.staffId,
          price: Number(it.price) || 0,
          commission: Number(it.commission) || 0,
          quantity: Number(it.quantity) || 1
        }))
      }
    };

    if (date) {
      saleData.date = new Date(date);
    }

    const sale = await prisma.sale.create({ data: saleData });

    res.status(201).json(sale);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const salonId = req.user.salonId;

    const {
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    let whereClause = { salonId };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        include: { items: true },
        orderBy: { date: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.sale.count({ where: whereClause })
    ]);

    res.json({
      page: Number(page),
      totalPages: Math.ceil(totalCount / limit),
      totalRecords: totalCount,
      data: sales
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
