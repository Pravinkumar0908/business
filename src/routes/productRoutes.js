const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const https = require("https");

// ── Helper: https GET with promise ──
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ── Fetch product image via DuckDuckGo Image Search (real images) ──
async function fetchProductImage(productName) {
  try {
    const query = encodeURIComponent(productName + " product image");
    // Step 1: Get vqd token from DuckDuckGo
    const searchPage = await httpsGet(
      `https://duckduckgo.com/?q=${query}&iax=images&ia=images`,
      { "User-Agent": "Mozilla/5.0 (compatible; ProductBot/1.0)" }
    );
    const vqdMatch = searchPage.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) {
      console.log("DDG: vqd token not found, trying fallback...");
      return await fetchImageFallback(productName);
    }
    const vqd = vqdMatch[1];

    // Step 2: Fetch actual image results
    const imgJson = await httpsGet(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${query}&vqd=${vqd}&f=,,,,,&p=1`,
      { "User-Agent": "Mozilla/5.0 (compatible; ProductBot/1.0)" }
    );
    const parsed = JSON.parse(imgJson);
    if (parsed.results && parsed.results.length > 0) {
      // Pick the first image that's a real URL (https)
      const img = parsed.results.find(r => r.image && r.image.startsWith("https"));
      if (img) return img.image;
      // Fallback to thumbnail
      const thumb = parsed.results.find(r => r.thumbnail && r.thumbnail.startsWith("https"));
      if (thumb) return thumb.thumbnail;
    }
    return await fetchImageFallback(productName);
  } catch (e) {
    console.log("DDG Image Search error:", e.message);
    return await fetchImageFallback(productName);
  }
}

// ── Fallback: DuckDuckGo Instant Answer ──
async function fetchImageFallback(productName) {
  try {
    const query = encodeURIComponent(productName);
    const data = await httpsGet(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`);
    const json = JSON.parse(data);
    let img = json.Image || "";
    if (img && !img.startsWith("http")) img = `https://duckduckgo.com${img}`;
    return img || "";
  } catch {
    return "";
  }
}

// ── Auto-create table if not exists ──────────────────────
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Product" (
      id TEXT PRIMARY KEY,
      "salonId" TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      price DOUBLE PRECISION DEFAULT 0,
      "costPrice" DOUBLE PRECISION DEFAULT 0,
      stock DOUBLE PRECISION DEFAULT 0,
      "lowStockAlert" DOUBLE PRECISION DEFAULT 5,
      barcode TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      "productType" TEXT DEFAULT 'fixed',
      "unitType" TEXT DEFAULT 'piece',
      "trackInventory" BOOLEAN DEFAULT true,
      description TEXT DEFAULT '',
      "imageUrl" TEXT DEFAULT '',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add new columns if table existed before this update
  const cols = [
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" TEXT DEFAULT \'fixed\'',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitType" TEXT DEFAULT \'piece\'',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackInventory" BOOLEAN DEFAULT true',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT DEFAULT \'\'',
  ];
  for (const sql of cols) {
    try { await pool.query(sql); } catch (e) { /* column exists */ }
  }
  // Migrate stock to DOUBLE PRECISION if it was INTEGER
  try {
    await pool.query('ALTER TABLE "Product" ALTER COLUMN stock TYPE DOUBLE PRECISION');
    await pool.query('ALTER TABLE "Product" ALTER COLUMN "lowStockAlert" TYPE DOUBLE PRECISION');
  } catch (e) { /* already correct */ }
};
ensureTable().catch(console.error);

// GET all products
router.get("/", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "Product" WHERE "salonId" = $1 ORDER BY name ASC',
      [req.salonId]
    );
    res.json({ products: rows });
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST create product
router.post("/", auth, async (req, res) => {
  try {
    const {
      name, category, price, costPrice, stock, lowStockAlert,
      barcode, unit, productType, unitType, trackInventory, description, imageUrl
    } = req.body;
    const id = uuidv4();

    // Auto-fetch product image if not provided
    let finalImageUrl = imageUrl || '';
    if (!finalImageUrl && name) {
      try {
        finalImageUrl = await fetchProductImage(name);
      } catch (e) {
        console.log("Image fetch skipped:", e.message);
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO "Product"
        (id, "salonId", name, category, price, "costPrice", stock, "lowStockAlert",
         barcode, unit, "productType", "unitType", "trackInventory", description, "imageUrl")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        id, req.salonId, name, category || '', price || 0, costPrice || 0,
        stock || 0, lowStockAlert || 5, barcode || '', unit || 'pcs',
        productType || 'fixed', unitType || 'piece',
        trackInventory !== undefined ? trackInventory : true,
        description || '', finalImageUrl
      ]
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT update product
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name, category, price, costPrice, stock, lowStockAlert,
      barcode, unit, productType, unitType, trackInventory, description, imageUrl
    } = req.body;
    const { rows } = await pool.query(
      `UPDATE "Product" SET
        name=$1, category=$2, price=$3, "costPrice"=$4, stock=$5,
        "lowStockAlert"=$6, barcode=$7, unit=$8, "productType"=$9,
        "unitType"=$10, "trackInventory"=$11, description=$12, "imageUrl"=$13
       WHERE id=$14 AND "salonId"=$15 RETURNING *`,
      [
        name, category, price, costPrice, stock, lowStockAlert,
        barcode, unit, productType || 'fixed', unitType || 'piece',
        trackInventory !== undefined ? trackInventory : true,
        description, imageUrl || '', req.params.id, req.salonId
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error("UPDATE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH update stock only (supports decimal for measured products)
router.patch("/:id/stock", auth, async (req, res) => {
  try {
    const { stock } = req.body;
    const { rows } = await pool.query(
      'UPDATE "Product" SET stock=$1 WHERE id=$2 AND "salonId"=$3 RETURNING *',
      [parseFloat(stock) || 0, req.params.id, req.salonId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error("UPDATE STOCK ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH deduct stock after sale (array of items)
router.patch("/deduct-stock", auth, async (req, res) => {
  try {
    const { items } = req.body; // [{ id, qty }]
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "items array required" });
    }
    for (const item of items) {
      await pool.query(
        `UPDATE "Product" SET stock = GREATEST(stock - $1, 0)
         WHERE id = $2 AND "salonId" = $3 AND "trackInventory" = true`,
        [parseFloat(item.qty) || 0, item.id, req.salonId]
      );
    }
    res.json({ message: "Stock deducted", count: items.length });
  } catch (err) {
    console.error("DEDUCT STOCK ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE product
router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM "Product" WHERE id=$1 AND "salonId"=$2', [req.params.id, req.salonId]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
