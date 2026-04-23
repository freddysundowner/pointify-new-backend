import { Router } from "express";
import { eq, ilike, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
  products, productSerials, inventory, attributes, attributeVariants,
  bundleItems, saleItems, sales, purchaseItems, purchases,
  adjustments, badStocks, transferItems, productTransfers, shops,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** Resolve which shop IDs the caller is allowed to see.
 *  - attendant  → only their assigned shop
 *  - admin      → all shops they own (or a specific one if shopId query param given)
 *  - superAdmin → unrestricted (returns null = no shop filter)
 */
async function resolveShopFilter(req: any, requestedShopId: number | null): Promise<number[] | null> {
  if (req.attendant) {
    const sid = req.attendant.shopId as number;
    if (requestedShopId && requestedShopId !== sid) return []; // cross-shop blocked → empty
    return [sid];
  }
  if (req.admin) {
    if (req.admin.isSuperAdmin) return null; // super admin: no restriction
    if (requestedShopId) {
      // verify admin owns this shop
      const owned = await db.query.shops.findFirst({
        where: and(eq(shops.id, requestedShopId), eq(shops.admin, req.admin.id)),
        columns: { id: true },
      });
      return owned ? [requestedShopId] : []; // empty list → 0 results if they don't own it
    }
    // no specific shop → return all shops this admin owns
    const ownedShops = await db.query.shops.findMany({
      where: eq(shops.admin, req.admin.id),
      columns: { id: true },
    });
    return ownedShops.map((s) => s.id);
  }
  return [];
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
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, shopId, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, quantity, measureUnit, manufacturer,
      supplierId, description, alertQuantity, expiryDate, type,
    } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");

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
      productType: type ?? "product",
      createdBy: req.attendant?.id ?? null,
    }).returning();

    return created(res, product);
  } catch (e) { next(e); }
});

// ── Attributes (must come before /:id to avoid conflict) ─────────────────────

router.get("/attributes", requireAdminOrAttendant, async (_req, res, next) => {
  try {
    const rows = await db.select().from(attributes);
    const variants = await db.select().from(attributeVariants);
    const enriched = rows.map((attr) => ({
      ...attr,
      variants: variants.filter((v) => v.attributeId === attr.id),
    }));
    return ok(res, enriched);
  } catch (e) { next(e); }
});

router.post("/attributes", requireAdmin, async (req, res, next) => {
  try {
    const { title, name, inputType, type, status } = req.body;
    if (!title || !name) throw badRequest("title and name are required");
    const [row] = await db.insert(attributes).values({ title, name, inputType, type, status }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/attributes/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const attr = await db.select().from(attributes).where(eq(attributes.id, Number(req.params["id"])));
    if (!attr.length) throw notFound("Attribute not found");
    const variants = await db.select().from(attributeVariants).where(eq(attributeVariants.attributeId, Number(req.params["id"])));
    return ok(res, { ...attr[0], variants });
  } catch (e) { next(e); }
});

router.post("/attributes/:id/variants", requireAdmin, async (req, res, next) => {
  try {
    const attrId = Number(req.params["id"]);
    const { name, status } = req.body;
    if (!name) throw badRequest("name is required");
    const [row] = await db.insert(attributeVariants).values({ attributeId: attrId, name, status }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

// ── Product by ID ─────────────────────────────────────────────────────────────

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, Number(req.params["id"])),
      with: { category: true },
    });
    if (!product) throw notFound("Product not found");
    return ok(res, product);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, measureUnit, manufacturer,
      supplierId, description, alertQuantity, type,
    } = req.body;

    const [updated] = await db.update(products).set({
      ...(name && { name }),
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
      ...(type && { productType: type }),
    }).where(eq(products.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Product not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(products).where(eq(products.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Product not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/:id/image", requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    const file = (req as any).file;
    if (!file) throw badRequest("image file required");
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const [updated] = await db.update(products)
      .set({ thumbnailUrl: imageUrl })
      .where(eq(products.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Product not found");
    return ok(res, { imageUrl: updated.thumbnailUrl });
  } catch (e) { next(e); }
});

router.get("/:id/serials", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const rows = await db.query.productSerials.findMany({
      where: eq(productSerials.product, Number(req.params["id"])),
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/:id/serials", requireAdmin, async (req, res, next) => {
  try {
    const { serials } = req.body;
    if (!Array.isArray(serials) || serials.length === 0) throw badRequest("serials array required");
    const productId = Number(req.params["id"]);

    const { shopId } = req.body;
    if (!shopId) throw badRequest("shopId required");

    const rows = await db.insert(productSerials).values(
      serials.map((serialNumber: string) => ({ product: productId, shop: Number(shopId), serialNumber }))
    ).returning();
    return created(res, rows);
  } catch (e) { next(e); }
});

// ── Product history endpoints ────────────────────────────────────────────────

router.get("/:id/sales-history", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
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

router.get("/:id/purchases-history", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
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

router.get("/:id/stock-history", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
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

router.get("/:id/transfer-history", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
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

router.get("/:id/summary", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    if (!product) throw notFound("Product not found");

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
    const files = ((req as any).files ?? []) as Array<{ mimetype: string; buffer: Buffer }>;
    if (!files.length) throw badRequest("at least one image file required");

    const newUrls = files.map((f) => `data:${f.mimetype};base64,${f.buffer.toString("base64")}`);

    const existing = await db.query.products.findFirst({
      where: eq(products.id, Number(req.params["id"])),
    });
    if (!existing) throw notFound("Product not found");

    const merged = [...(existing.images ?? []), ...newUrls];
    const [updated] = await db.update(products)
      .set({ images: merged })
      .where(eq(products.id, Number(req.params["id"])))
      .returning();

    return ok(res, { images: updated?.images ?? [], note: "images stored as data URLs (stub)" });
  } catch (e) { next(e); }
});

// ── Bulk import ──────────────────────────────────────────────────────────────

router.post("/bulk-import", requireAdmin, async (req, res, next) => {
  try {
    const { products: payload, shopId } = req.body ?? {};
    if (!Array.isArray(payload) || payload.length === 0) throw badRequest("products array required");
    if (!shopId) throw badRequest("shopId required");

    const values = payload.map((p: any) => ({
      name: String(p.name),
      shop: Number(shopId),
      category: p.categoryId ? Number(p.categoryId) : null,
      barcode: p.barcode ?? null,
      serialNumber: p.serialNumber ?? null,
      buyingPrice: p.buyingPrice != null ? String(p.buyingPrice) : null,
      sellingPrice: p.sellingPrice != null ? String(p.sellingPrice) : null,
      wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : null,
      dealerPrice: p.dealerPrice != null ? String(p.dealerPrice) : null,
      measureUnit: p.measureUnit ?? "",
      manufacturer: p.manufacturer ?? "",
      supplier: p.supplierId ? Number(p.supplierId) : null,
      description: p.description ?? null,
      type: p.type ?? "product",
    }));

    const inserted = await db.insert(products).values(values).returning();
    return ok(res, { created: inserted.length, skipped: 0, errors: [], products: inserted });
  } catch (e) { next(e); }
});

// ── Bundle items (read endpoint scoped under product) ────────────────────────

router.get("/:id/bundle-items", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["id"]);
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
    const productId = Number(req.params["id"]);
    const { componentProductId, quantity } = req.body ?? {};
    if (!componentProductId || quantity == null) {
      throw badRequest("componentProductId and quantity required");
    }
    const [row] = await db.insert(bundleItems).values({
      product: productId,
      componentProduct: Number(componentProductId),
      quantity: String(quantity),
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

export default router;
