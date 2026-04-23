import { Router, type Response, type NextFunction } from "express";
import { eq, ilike, and, gte, lte, sql, inArray, lower } from "drizzle-orm";
import path from "path";
import fs from "fs";
import {
  products, productSerials, inventory,
  bundleItems, saleItems, sales, purchaseItems, purchases,
  adjustments, badStocks, transferItems, productTransfers, shops,
  batches, productHistory,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, conflict } from "../lib/errors.js";
import { assertShopOwnership, resolveShopFilter } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";
import { attachBundleItems } from "../lib/attach-bundle-items.js";
import multer from "multer";

const router = Router();

// ── Upload storage ────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "products");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || `.${file.mimetype.split("/")[1] ?? "jpg"}`;
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 5 * 1024 * 1024 } });



/** Middleware: resolves :id → product row, asserts caller owns its shop.
 *  Attaches the full product to req.product. Apply after auth middleware.
 *  All /:id routes share this — no more per-handler lookup + ownership check. */
async function loadProduct(req: any, _res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) throw notFound("Product not found");
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: { category: true },
    });
    if (!product) throw notFound("Product not found");
    await assertShopOwnership(req, product.shop);
    const [withItems] = await attachBundleItems([product]);
    req.product = withItems;
    next();
  } catch (e) {
    next(e);
  }
}

router.get("/search", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    if (!q) throw badRequest("q is required");

    const requestedShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const allowedShops = await resolveShopFilter(req, requestedShopId);

    const shopCondition = allowedShops === null
      ? undefined
      : allowedShops.length === 0
        ? eq(products.id, -1) // no accessible shops → return nothing
        : allowedShops.length === 1
          ? eq(products.shop, allowedShops[0]!)
          : inArray(products.shop, allowedShops);

    const rows = await db.query.products.findMany({
      where: and(shopCondition, ilike(products.name, `%${q}%`)),
      limit: 20,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const requestedShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;

    const allowedShops = await resolveShopFilter(req, requestedShopId);

    const shopCondition = allowedShops === null
      ? undefined
      : allowedShops.length === 0
        ? eq(products.id, -1)
        : allowedShops.length === 1
          ? eq(products.shop, allowedShops[0]!)
          : inArray(products.shop, allowedShops);

    const conditions = [];
    if (shopCondition) conditions.push(shopCondition);
    if (categoryId) conditions.push(eq(products.category, categoryId));
    if (search) conditions.push(ilike(products.name, `%${search}%`));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.products.findMany({
      where,
      limit,
      offset,
      orderBy: (p, { asc }) => [asc(p.name)],
    });
    const total = await db.$count(products, where);
    return paginated(res, await attachBundleItems(rows), { total, page, limit });
  } catch (e) { next(e); }
});

/** Returns true if a product with that name already exists in the shop (case-insensitive). */
async function isDuplicateName(shopId: number, name: string, excludeId?: number): Promise<boolean> {
  const conditions = [
    eq(products.shop, shopId),
    sql`lower(${products.name}) = lower(${name})`,
    ...(excludeId !== undefined ? [sql`${products.id} <> ${excludeId}`] : []),
  ] as const;
  const existing = await db.query.products.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });
  return !!existing;
}

/** Validate that the four price tiers are internally consistent.
 *  All provided prices must be ≥ 0 and follow:
 *  sellingPrice ≥ wholesalePrice ≥ dealerPrice ≥ buyingPrice
 */
function validatePrices(prices: {
  buyingPrice?: number | string | null;
  sellingPrice?: number | string | null;
  wholesalePrice?: number | string | null;
  dealerPrice?: number | string | null;
}): void {
  const parse = (v: number | string | null | undefined): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (isNaN(n)) return null; // treat non-numeric as absent
    return n;
  };

  const buying    = parse(prices.buyingPrice);
  const selling   = parse(prices.sellingPrice);
  const wholesale = parse(prices.wholesalePrice);
  const dealer    = parse(prices.dealerPrice);

  const fields: [string, number | null][] = [
    ["buyingPrice", buying],
    ["sellingPrice", selling],
    ["wholesalePrice", wholesale],
    ["dealerPrice", dealer],
  ];
  for (const [field, val] of fields) {
    if (val !== null && val < 0)
      throw badRequest(`${field} must be a positive number`);
  }

  if (selling !== null && wholesale !== null && wholesale > selling)
    throw badRequest("wholesalePrice must be less than or equal to sellingPrice");

  if (wholesale !== null && dealer !== null && dealer > wholesale)
    throw badRequest("dealerPrice must be less than or equal to wholesalePrice");

  if (dealer !== null && buying !== null && buying > dealer)
    throw badRequest("buyingPrice must be less than or equal to dealerPrice");

  if (selling !== null && buying !== null && buying > selling)
    throw badRequest("buyingPrice must be less than or equal to sellingPrice");
}

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, shopId, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, quantity, measureUnit, manufacturer,
      supplierId, description, alertQuantity, expiryDate, type,
      bundleItems: bundleItemsPayload,
    } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");

    validatePrices({ buyingPrice, sellingPrice, wholesalePrice, dealerPrice });

    await assertShopOwnership(req, Number(shopId));

    if (await isDuplicateName(Number(shopId), String(name)))
      throw conflict(`A product named "${name}" already exists in this shop`);

    // Validate bundle items before inserting anything
    const bundlePayload: Array<{ componentProductId: number; quantity: number }> = [];
    if (Array.isArray(bundleItemsPayload) && bundleItemsPayload.length > 0) {
      for (const item of bundleItemsPayload) {
        if (!item.componentProductId || item.quantity == null)
          throw badRequest("Each bundle item requires componentProductId and quantity");
        bundlePayload.push({
          componentProductId: Number(item.componentProductId),
          quantity: Number(item.quantity),
        });
      }

      // Verify caller owns every component product
      const componentIds = bundlePayload.map((i) => i.componentProductId);
      const componentRows = await db.query.products.findMany({
        where: inArray(products.id, componentIds),
        columns: { id: true, shop: true },
      });
      if (componentRows.length !== componentIds.length)
        throw notFound("One or more component products not found");
      for (const comp of componentRows) {
        await assertShopOwnership(req, comp.shop);
      }
    }

    const [product] = await db.insert(products).values({
      name,
      shop: Number(shopId),
      category: categoryId ? Number(categoryId) : null,
      barcode,
      serialNumber,
      buyingPrice: buyingPrice ? String(buyingPrice) : null,
      sellingPrice: sellingPrice ? String(sellingPrice) : null,
      wholesalePrice: wholesalePrice ? String(wholesalePrice) : null,
      dealerPrice: dealerPrice ? String(dealerPrice) : null,
      measureUnit: measureUnit ?? "",
      manufacturer: manufacturer ?? "",
      supplier: supplierId ? Number(supplierId) : null,
      description,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      type: bundlePayload.length > 0 ? "bundle" : (type ?? "product"),
      createdBy: req.attendant?.id ?? null,
    }).returning();

    // Seed inventory row with the opening quantity and reorder level (alert quantity)
    const openingQty = quantity != null ? String(quantity) : "0";
    const reorderLvl = alertQuantity != null ? String(alertQuantity) : "0";
    await db.insert(inventory).values({
      product: product.id,
      shop: Number(shopId),
      quantity: openingQty,
      reorderLevel: reorderLvl,
      status: Number(openingQty) <= 0 ? "out_of_stock" : "active",
    }).onConflictDoNothing();

    // Insert bundle components if provided
    let createdBundleItems: typeof bundleItems.$inferSelect[] = [];
    if (bundlePayload.length > 0) {
      createdBundleItems = await db.insert(bundleItems).values(
        bundlePayload.map((item) => ({
          product: product.id,
          componentProduct: item.componentProductId,
          quantity: String(item.quantity),
        }))
      ).returning();
    }

    return created(res, { ...product, bundleItems: createdBundleItems });
  } catch (e) { next(e); }
});

// ── Bulk import (must be registered before /:id middleware) ──────────────────

router.post("/bulk-import", requireAdmin, async (req, res, next) => {
  try {
    const { products: payload, shopId } = req.body ?? {};
    if (!Array.isArray(payload) || payload.length === 0) throw badRequest("products array required");
    if (!shopId) throw badRequest("shopId required");

    const sid = Number(shopId);
    await assertShopOwnership(req, sid);

    const existingRows = await db.query.products.findMany({
      where: eq(products.shop, sid),
      columns: { name: true },
    });
    const existingNames = new Set(existingRows.map((r) => r.name.toLowerCase()));

    const toInsert: typeof payload = [];
    const skipped: Array<{ index: number; name: string; reason: string }> = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < payload.length; i++) {
      const p = payload[i];
      const rawName = p.name ? String(p.name).trim() : "";
      if (!rawName) { skipped.push({ index: i, name: "", reason: "name is required" }); continue; }
      const key = rawName.toLowerCase();
      if (seenInBatch.has(key)) { skipped.push({ index: i, name: rawName, reason: "duplicate name in the submitted list" }); continue; }
      if (existingNames.has(key)) { skipped.push({ index: i, name: rawName, reason: `"${rawName}" already exists in this shop` }); continue; }
      try { validatePrices({ buyingPrice: p.buyingPrice, sellingPrice: p.sellingPrice, wholesalePrice: p.wholesalePrice, dealerPrice: p.dealerPrice }); }
      catch (err: any) { skipped.push({ index: i, name: rawName, reason: err?.message ?? "invalid price" }); continue; }
      seenInBatch.add(key);
      toInsert.push(p);
    }

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      inserted = await db.insert(products).values(
        toInsert.map((p: any) => ({
          name: String(p.name).trim(), shop: sid,
          category: p.categoryId ? Number(p.categoryId) : null,
          barcode: p.barcode ?? null, serialNumber: p.serialNumber ?? null,
          buyingPrice: p.buyingPrice != null ? String(p.buyingPrice) : null,
          sellingPrice: p.sellingPrice != null ? String(p.sellingPrice) : null,
          wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : null,
          dealerPrice: p.dealerPrice != null ? String(p.dealerPrice) : null,
          measureUnit: p.measureUnit ?? "", manufacturer: p.manufacturer ?? "",
          supplier: p.supplierId ? Number(p.supplierId) : null,
          description: p.description ?? null, type: p.type ?? "product",
        }))
      ).returning();
      if (inserted.length > 0) {
        await db.insert(inventory).values(
          inserted.map((p) => ({ product: p.id, shop: sid, quantity: "0" }))
        ).onConflictDoNothing();
      }
    }
    return ok(res, { created: inserted.length, skipped: skipped.length, skippedProducts: skipped, products: inserted });
  } catch (e) { next(e); }
});

// ── Per-product middleware — runs for every /:id and /:id/* route ─────────────
// Registered here so specific paths above (/search, /, /bulk-import) are matched
// first by Express before this catch-all fires.

router.use("/:id", requireAdminOrAttendant, loadProduct);

// ── Product by ID ─────────────────────────────────────────────────────────────

router.get("/:id", async (req, res, next) => {
  try {
    return ok(res, (req as any).product);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = (req as any).product;
    const {
      name, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, measureUnit, manufacturer,
      supplierId, description, alertQuantity, type,
    } = req.body;

    const trimmedName = name !== undefined ? String(name).trim() : undefined;
    if (trimmedName !== undefined && trimmedName === "")
      throw badRequest("name cannot be empty");

    validatePrices({
      buyingPrice:    buyingPrice    !== undefined ? buyingPrice    : existing.buyingPrice,
      sellingPrice:   sellingPrice   !== undefined ? sellingPrice   : existing.sellingPrice,
      wholesalePrice: wholesalePrice !== undefined ? wholesalePrice : existing.wholesalePrice,
      dealerPrice:    dealerPrice    !== undefined ? dealerPrice    : existing.dealerPrice,
    });

    const [updated] = await db.update(products).set({
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(categoryId !== undefined && { category: categoryId ? Number(categoryId) : null }),
      ...(barcode !== undefined && { barcode }),
      ...(serialNumber !== undefined && { serialNumber }),
      ...(buyingPrice !== undefined && { buyingPrice: String(buyingPrice) }),
      ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
      ...(wholesalePrice !== undefined && { wholesalePrice: String(wholesalePrice) }),
      ...(dealerPrice !== undefined && { dealerPrice: String(dealerPrice) }),
      ...(measureUnit !== undefined && { measureUnit }),
      ...(manufacturer !== undefined && { manufacturer }),
      ...(supplierId !== undefined && { supplier: supplierId ? Number(supplierId) : null }),
      ...(description !== undefined && { description }),
      ...(alertQuantity !== undefined && { alertQuantity: Number(alertQuantity) }),
      ...(type && { type }),
    }).where(eq(products.id, existing.id)).returning();
    if (!updated) throw notFound("Product not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = (req as any).product;
    await db.delete(products).where(eq(products.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});


router.get("/:id/serials", async (req, res, next) => {
  try {
    const rows = await db.query.productSerials.findMany({
      where: eq(productSerials.product, (req as any).product.id),
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/:id/serials", requireAdmin, async (req, res, next) => {
  try {
    const { serials } = req.body;
    if (!Array.isArray(serials) || serials.length === 0) throw badRequest("serials array required");
    const { id: productId, shop } = (req as any).product;
    const rows = await db.insert(productSerials).values(
      serials.map((serialNumber: string) => ({ product: productId, shop, serialNumber }))
    ).returning();
    return created(res, rows);
  } catch (e) { next(e); }
});

// ── Product history endpoints ────────────────────────────────────────────────

router.get("/:id/sales-history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [eq(saleItems.product, productId)];
    if (shopId) conditions.push(eq(saleItems.shop, shopId));
    if (from) conditions.push(gte(saleItems.createdAt, from));
    if (to) conditions.push(lte(saleItems.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      id: saleItems.id,
      saleId: saleItems.sale,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      lineDiscount: saleItems.lineDiscount,
      saleType: saleItems.saleType,
      createdAt: saleItems.createdAt,
      receiptNo: sales.receiptNo,
      saleDate: sales.createdAt,
      customerId: sales.customer,
      attendantId: sales.attendant,
    }).from(saleItems)
      .leftJoin(sales, eq(saleItems.sale, sales.id))
      .where(where)
      .limit(limit).offset(offset)
      .orderBy(sql`${saleItems.createdAt} DESC`);

    const total = await db.$count(saleItems, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id/purchases-history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [eq(purchaseItems.product, productId)];
    if (shopId) conditions.push(eq(purchaseItems.shop, shopId));
    if (from) conditions.push(gte(purchaseItems.createdAt, from));
    if (to) conditions.push(lte(purchaseItems.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchase,
      quantity: purchaseItems.quantity,
      unitPrice: purchaseItems.unitPrice,
      batchCode: purchaseItems.batchCode,
      expiryDate: purchaseItems.expiryDate,
      createdAt: purchaseItems.createdAt,
      purchaseNo: purchases.purchaseNo,
      purchaseDate: purchases.createdAt,
      supplierId: purchases.supplier,
    }).from(purchaseItems)
      .leftJoin(purchases, eq(purchaseItems.purchase, purchases.id))
      .where(where)
      .limit(limit).offset(offset)
      .orderBy(sql`${purchaseItems.createdAt} DESC`);

    const total = await db.$count(purchaseItems, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id/stock-history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const adjConds = [eq(adjustments.product, productId)];
    if (shopId) adjConds.push(eq(adjustments.shop, shopId));
    const adjWhere = adjConds.length > 1 ? and(...adjConds) : adjConds[0];

    const badConds = [eq(badStocks.product, productId)];
    if (shopId) badConds.push(eq(badStocks.shop, shopId));
    const badWhere = badConds.length > 1 ? and(...badConds) : badConds[0];

    const [adjRows, badRows] = await Promise.all([
      db.select().from(adjustments).where(adjWhere).orderBy(sql`${adjustments.createdAt} DESC`).limit(200),
      db.select().from(badStocks).where(badWhere).orderBy(sql`${badStocks.createdAt} DESC`).limit(200),
    ]);

    const events = [
      ...adjRows.map((r) => ({ kind: "adjustment", ...r })),
      ...badRows.map((r) => ({ kind: "bad_stock", ...r })),
    ].sort((a: any, b: any) =>
      new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    );

    return ok(res, events);
  } catch (e) { next(e); }
});

router.get("/:id/transfer-history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const where = eq(transferItems.product, productId);

    const rows = await db.select({
      id: transferItems.id,
      transferId: transferItems.transfer,
      quantity: transferItems.quantity,
      unitPrice: transferItems.unitPrice,
      transferNo: productTransfers.transferNo,
      transferNote: productTransfers.transferNote,
      fromShop: productTransfers.fromShop,
      toShop: productTransfers.toShop,
      createdAt: productTransfers.createdAt,
    }).from(transferItems)
      .leftJoin(productTransfers, eq(transferItems.transfer, productTransfers.id))
      .where(where)
      .limit(limit).offset(offset)
      .orderBy(sql`${productTransfers.createdAt} DESC`);

    const filtered = shopId
      ? rows.filter((r) => r.fromShop === shopId || r.toShop === shopId)
      : rows;

    const total = await db.$count(transferItems, where);
    return paginated(res, filtered, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id/summary", async (req, res, next) => {
  try {
    const product = (req as any).product;
    const productId = product.id;
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const saleConds = [eq(saleItems.product, productId)];
    if (shopId) saleConds.push(eq(saleItems.shop, shopId));
    const saleWhere = saleConds.length > 1 ? and(...saleConds) : saleConds[0];

    const purchaseConds = [eq(purchaseItems.product, productId)];
    if (shopId) purchaseConds.push(eq(purchaseItems.shop, shopId));
    const purchaseWhere = purchaseConds.length > 1 ? and(...purchaseConds) : purchaseConds[0];

    const invConds = [eq(inventory.product, productId)];
    if (shopId) invConds.push(eq(inventory.shop, shopId));
    const invWhere = invConds.length > 1 ? and(...invConds) : invConds[0];

    const [salesAgg] = await db.select({
      totalSoldQty: sql<string>`COALESCE(SUM(${saleItems.quantity}), 0)`,
      totalSoldValue: sql<string>`COALESCE(SUM(${saleItems.quantity} * ${saleItems.unitPrice}), 0)`,
      saleCount: sql<number>`COUNT(*)`,
    }).from(saleItems).where(saleWhere);

    const [purchaseAgg] = await db.select({
      totalPurchasedQty: sql<string>`COALESCE(SUM(${purchaseItems.quantity}), 0)`,
      totalPurchasedValue: sql<string>`COALESCE(SUM(${purchaseItems.quantity} * ${purchaseItems.unitPrice}), 0)`,
      purchaseCount: sql<number>`COUNT(*)`,
    }).from(purchaseItems).where(purchaseWhere);

    const [invAgg] = await db.select({
      currentStock: sql<string>`COALESCE(SUM(${inventory.quantity}), 0)`,
    }).from(inventory).where(invWhere);

    return ok(res, {
      product,
      sales: salesAgg ?? { totalSoldQty: "0", totalSoldValue: "0", saleCount: 0 },
      purchases: purchaseAgg ?? { totalPurchasedQty: "0", totalPurchasedValue: "0", purchaseCount: 0 },
      currentStock: invAgg?.currentStock ?? "0",
      stockValue: String(
        Number(invAgg?.currentStock ?? 0) * Number(product.buyingPrice ?? 0)
      ),
    });
  } catch (e) { next(e); }
});

// ── Product images (multipart) ───────────────────────────────────────────────

router.post("/:id/images", requireAdmin, upload.array("images", 10), async (req, res, next) => {
  try {
    const files = ((req as any).files ?? []) as Express.Multer.File[];
    if (!files.length) throw badRequest("at least one image file required");
    const existing = (req as any).product;
    const newUrls = files.map((f) => `/uploads/products/${f.filename}`);
    const merged = [...(existing.images ?? []), ...newUrls];
    const thumbnailUrl = merged[0] ?? existing.thumbnailUrl;
    const [updated] = await db.update(products)
      .set({ images: merged, thumbnailUrl })
      .where(eq(products.id, existing.id))
      .returning();
    return ok(res, { images: updated?.images ?? [], thumbnailUrl: updated?.thumbnailUrl ?? null });
  } catch (e) { next(e); }
});

router.put("/:id/images", requireAdmin, upload.array("images", 10), async (req, res, next) => {
  try {
    const files = ((req as any).files ?? []) as Express.Multer.File[];
    if (!files.length) throw badRequest("at least one image file required");
    const existing = (req as any).product;
    for (const url of existing.images ?? []) {
      if (url.startsWith("/uploads/")) fs.unlink(path.join(process.cwd(), url), () => {});
    }
    const newUrls = files.map((f) => `/uploads/products/${f.filename}`);
    const [updated] = await db.update(products)
      .set({ images: newUrls, thumbnailUrl: newUrls[0]! })
      .where(eq(products.id, existing.id))
      .returning();
    return ok(res, { images: updated?.images ?? [], thumbnailUrl: updated?.thumbnailUrl ?? null });
  } catch (e) { next(e); }
});

router.delete("/:id/images", requireAdmin, async (req, res, next) => {
  try {
    const existing = (req as any).product;
    const { urls, all } = req.body ?? {};
    if (!all && (!Array.isArray(urls) || urls.length === 0))
      throw badRequest("Provide urls array of images to remove, or { all: true } to clear all");
    const current = existing.images ?? [];
    let remaining: string[];
    if (all) {
      for (const url of current) {
        if (url.startsWith("/uploads/")) fs.unlink(path.join(process.cwd(), url), () => {});
      }
      remaining = [];
    } else {
      const toRemove = new Set<string>(urls);
      remaining = current.filter((u: string) => !toRemove.has(u));
      for (const url of toRemove) {
        if (url.startsWith("/uploads/")) fs.unlink(path.join(process.cwd(), url), () => {});
      }
    }
    const thumbnailUrl = remaining[0] ?? null;
    const [updated] = await db.update(products)
      .set({ images: remaining, thumbnailUrl })
      .where(eq(products.id, existing.id))
      .returning();
    return ok(res, { images: updated?.images ?? [], thumbnailUrl: updated?.thumbnailUrl ?? null });
  } catch (e) { next(e); }
});

// ── Bundle items ─────────────────────────────────────────────────────────────

router.get("/:id/history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const eventType = req.query["eventType"] ? String(req.query["eventType"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [eq(productHistory.product, productId)];
    if (shopId) conditions.push(eq(productHistory.shop, shopId));
    if (eventType) conditions.push(eq(productHistory.eventType, eventType));
    if (from) conditions.push(gte(productHistory.createdAt, from));
    if (to) conditions.push(lte(productHistory.createdAt, to));
    const where = and(...conditions);

    const rows = await db.select().from(productHistory)
      .where(where)
      .orderBy(sql`${productHistory.createdAt} DESC`)
      .limit(limit).offset(offset);

    const total = await db.$count(productHistory, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id/bundle-items", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const rows = await db.select({
      id: bundleItems.id,
      product: bundleItems.product,
      componentProduct: bundleItems.componentProduct,
      quantity: bundleItems.quantity,
      createdAt: bundleItems.createdAt,
      componentName: products.name,
      componentSellingPrice: products.sellingPrice,
    }).from(bundleItems)
      .leftJoin(products, eq(bundleItems.componentProduct, products.id))
      .where(eq(bundleItems.product, productId));
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/:id/bundle-items", requireAdmin, async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { componentProductId, quantity } = req.body ?? {};
    if (!componentProductId || quantity == null)
      throw badRequest("componentProductId and quantity required");
    const [row] = await db.insert(bundleItems).values({
      product: productId,
      componentProduct: Number(componentProductId),
      quantity: String(quantity),
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

export default router;
