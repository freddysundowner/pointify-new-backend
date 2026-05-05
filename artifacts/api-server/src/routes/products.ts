import { Router, type Response, type NextFunction } from "express";
import { eq, ilike, and, gte, lte, sql, inArray, lower, or } from "drizzle-orm";
import path from "path";
import fs from "fs";
import {
  products, productSerials, inventory, productCategories,
  bundleItems, saleItems, sales, purchaseItems, purchases,
  adjustments, badStocks, transferItems, productTransfers, shops,
  batches, productHistory, admins, stockCounts, stockCountItems,
  customers, attendants, productEditLogs,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, conflict } from "../lib/errors.js";
import { assertShopOwnership, resolveShopFilter } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";
import { attachBundleItems } from "../lib/attach-bundle-items.js";
import { sendEmail } from "../lib/email.js";
import multer from "multer";

const router = Router();

// ── Audit-log helper ─────────────────────────────────────────────────────────
type FieldDiff = Record<string, { from: string | null; to: string | null }>;

const TRACKED_FIELDS: Array<keyof typeof products.$inferSelect> = [
  "name", "buyingPrice", "sellingPrice", "wholesalePrice", "dealerPrice",
  "minSellingPrice", "maxDiscount", "measureUnit", "manufacturer",
  "description", "barcode", "serialNumber", "type", "isTaxable",
  "manageByPrice", "expiryDate", "category", "supplier",
];

// loadProduct uses `with: { category: true }` so relation fields may be objects.
// Normalise them to raw IDs before diffing so we don't get "[object Object]".
function normalizeForDiff(p: Record<string, unknown>): Record<string, unknown> {
  const result = { ...p };
  if (result["category"] != null && typeof result["category"] === "object")
    result["category"] = (result["category"] as any).id;
  if (result["supplier"] != null && typeof result["supplier"] === "object")
    result["supplier"] = (result["supplier"] as any).id;
  return result;
}

function diffProducts(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff {
  const a = normalizeForDiff(before);
  const b = normalizeForDiff(after);
  const diff: FieldDiff = {};
  for (const field of TRACKED_FIELDS) {
    const from = a[field] != null ? String(a[field]) : null;
    const to   = b[field] != null ? String(b[field]) : null;
    if (from !== to) diff[field] = { from, to };
  }
  return diff;
}

async function writeEditLog(opts: {
  productId: number;
  shopId: number;
  action: "created" | "updated" | "deleted";
  changes?: FieldDiff;
  req: import("express").Request;
}) {
  const adminId: number | undefined = (opts.req as any).admin?.id;
  // AdminPayload only carries { role, id, isSuperAdmin } — look up name from DB.
  let adminName: string | undefined;
  if (adminId) {
    try {
      const adminRow = await db.query.admins.findFirst({
        where: eq(admins.id, adminId),
        columns: { username: true, email: true },
      });
      adminName = adminRow?.username ?? adminRow?.email ?? undefined;
    } catch (_) { /* ignore */ }
  }
  try {
    await db.insert(productEditLogs).values({
      product: opts.productId,
      shop: opts.shopId,
      action: opts.action,
      changes: opts.changes ?? null,
      changedById: adminId ?? null,
      changedByName: adminName ?? null,
    });
  } catch (_) { /* non-critical — never block the main response */ }
}

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

    // Enrich with inventory data (quantity + reorderLevel) so the edit form
    // can pre-fill those fields without a separate round-trip.
    const inv = await db.query.inventory.findFirst({
      where: and(eq(inventory.product, id), eq(inventory.shop, product.shop)),
      columns: { quantity: true, reorderLevel: true, status: true },
    });
    req.product = {
      ...withItems,
      quantity: inv ? Number(inv.quantity) : 0,
      reorderLevel: inv ? Number(inv.reorderLevel) : 0,
      stockStatus: inv?.status ?? "active",
    };
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

// ── CSV export (download or email) ───────────────────────────────────────────
function buildExportConditions(params: {
  shopCondition: any;
  categoryId: number | null;
  search: string | null;
  stockStatus: string;
}): any[] {
  const { shopCondition, categoryId, search, stockStatus } = params;
  const conditions: any[] = [];
  if (shopCondition) conditions.push(shopCondition);
  if (categoryId) conditions.push(eq(products.category, categoryId));
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  if (stockStatus === "outofstock") {
    conditions.push(sql`EXISTS (SELECT 1 FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ${products.shop} AND inv.quantity::numeric <= 0)`);
  } else if (stockStatus === "lowstock") {
    conditions.push(sql`EXISTS (SELECT 1 FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ${products.shop} AND inv.quantity::numeric > 0 AND inv.reorder_level::numeric > 0 AND inv.quantity::numeric <= inv.reorder_level::numeric)`);
  } else if (stockStatus === "expiring") {
    conditions.push(sql`${products.expiryDate} IS NOT NULL`);
  }
  return conditions;
}

function buildExportOrderBy(sort: string): any {
  if (sort === "qty_desc") return sql`(SELECT COALESCE(inv.quantity::numeric,0) FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ${products.shop} LIMIT 1) DESC NULLS LAST`;
  if (sort === "expiring") return sql`${products.expiryDate} ASC NULLS LAST`;
  return sql`${products.name} ASC`;
}

function buildCsv(rows: any[]): string {
  const headers = ["Name", "SKU/Barcode", "Category", "Type", "Quantity", "Reorder Level", "Buy Price", "Sell Price", "Stock Value (Cost)", "Status", "Expiry Date"];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const qty = Number(r.quantity ?? 0);
    const buy = Number(r.buyingPrice ?? 0);
    lines.push([
      r.name, r.barcode ?? r.serialNumber ?? "", r.category?.name ?? "", r.type ?? "product",
      qty, Number(r.reorderLevel ?? 0), buy.toFixed(2), Number(r.sellingPrice ?? 0).toFixed(2),
      (qty * buy).toFixed(2), r.stockStatus ?? (qty <= 0 ? "out" : "in"),
      r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : "",
    ].map(escape).join(","));
  }
  return lines.join("\r\n");
}

const FILTER_LABELS: Record<string, string> = {
  all: "All Stock", outofstock: "Out of Stock", lowstock: "Running Low",
  highstock: "Highest Stock", expiring: "Expiring",
};

router.get("/export", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const action = String(req.query["action"] ?? "download"); // download | email
    const search = req.query["search"] ? String(req.query["search"]).trim() : null;
    const requestedShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;
    const stockStatus = String(req.query["stockStatus"] ?? "").trim();
    const sort = String(req.query["sort"] ?? "name").trim();
    const filterKey = String(req.query["filterKey"] ?? "all");

    const allowedShops = await resolveShopFilter(req, requestedShopId);
    const shopCondition = allowedShops === null ? undefined
      : allowedShops.length === 0 ? eq(products.id, -1)
      : allowedShops.length === 1 ? eq(products.shop, allowedShops[0]!)
      : inArray(products.shop, allowedShops);

    const conditions = buildExportConditions({ shopCondition, categoryId, search, stockStatus });
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];
    const orderByClause = buildExportOrderBy(sort);

    // Fetch ALL rows — no pagination limit
    const rows = await db.query.products.findMany({
      where,
      orderBy: () => [orderByClause],
      with: { category: true },
    });

    // Enrich with inventory quantities
    if (rows.length > 0) {
      const productIds = rows.map((p: any) => p.id).filter(Boolean);
      const invRows = await db.select({ product: inventory.product, shop: inventory.shop, quantity: inventory.quantity, reorderLevel: inventory.reorderLevel, status: inventory.status })
        .from(inventory).where(inArray(inventory.product, productIds));
      const invMap = new Map(invRows.map((inv) => [`${inv.product}-${inv.shop}`, inv]));
      for (const p of rows as any[]) {
        const inv = invMap.get(`${p.id}-${p.shop}`);
        p.quantity = inv ? Number(inv.quantity) : 0;
        p.reorderLevel = inv ? Number(inv.reorderLevel) : 0;
        p.stockStatus = inv?.status ?? "active";
      }
    }

    const csv = buildCsv(rows);
    const filterLabel = FILTER_LABELS[filterKey] ?? "All Stock";

    if (action === "email") {
      // Determine recipient: warehouseEmail > receiptEmail > admin email
      const shopRow = requestedShopId
        ? await db.query.shops.findFirst({ where: eq(shops.id, requestedShopId) })
        : null;
      const adminRow = await db.query.admins.findFirst({ where: eq(admins.id, (req as any).admin.id) });
      const to = shopRow?.warehouseEmail || shopRow?.receiptEmail || adminRow?.email;
      if (!to) return badRequest(res, "No email address configured for this shop");

      const result = await sendEmail({
        key: "stock_export",
        to,
        vars: {
          adminName: adminRow?.username ?? "there",
          shopName: shopRow?.name ?? "your shop",
          filterLabel,
          totalProducts: rows.length,
          generatedAt: new Date().toLocaleString(),
        },
        attachments: [{ name: `stock-report-${filterKey}-${Date.now()}.csv`, content: Buffer.from(csv).toString("base64") }],
      });

      if (!result.ok) return ok(res, { sent: false, reason: result.skipped ?? result.error });
      return ok(res, { sent: true, to });
    }

    // Download
    const filename = `stock-report-${filterKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (e) { next(e); }
});

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const requestedShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;
    const stockStatus = String(req.query["stockStatus"] ?? "").trim();
    const sort = String(req.query["sort"] ?? "name").trim();

    const allowedShops = await resolveShopFilter(req, requestedShopId);

    // Build shop condition: match products owned by the shop OR products that
    // have inventory records for the shop (shared/transferred stock scenario)
    const buildShopCondition = (shopIds: number[]) => {
      if (shopIds.length === 0) return eq(products.id, -1);
      const ownedBy = shopIds.length === 1 ? eq(products.shop, shopIds[0]!) : inArray(products.shop, shopIds);
      const inInventory = shopIds.length === 1
        ? sql`EXISTS (SELECT 1 FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ${shopIds[0]!})`
        : sql`EXISTS (SELECT 1 FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ANY(ARRAY[${sql.join(shopIds.map(id => sql`${id}`), sql`, `)}]::int[]))`;
      return or(ownedBy, inInventory);
    };

    const shopCondition = allowedShops === null
      ? undefined
      : buildShopCondition(allowedShops);

    // For stock-status filters, use the requested shopId for the inventory subquery
    const invShopFilter = requestedShopId
      ? sql`inv.shop_id = ${requestedShopId}`
      : allowedShops !== null && allowedShops.length === 1
        ? sql`inv.shop_id = ${allowedShops[0]!}`
        : sql`TRUE`;

    const conditions: any[] = [eq(products.isDeleted, false)];
    if (shopCondition) conditions.push(shopCondition);
    if (categoryId) conditions.push(eq(products.category, categoryId));
    if (search) conditions.push(ilike(products.name, `%${search}%`));

    if (stockStatus === "outofstock") {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM inventory inv
        WHERE inv.product_id = ${products.id}
        AND ${invShopFilter}
        AND inv.quantity::numeric <= 0
      )`);
    } else if (stockStatus === "lowstock") {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM inventory inv
        WHERE inv.product_id = ${products.id}
        AND ${invShopFilter}
        AND inv.quantity::numeric > 0
        AND inv.reorder_level::numeric > 0
        AND inv.quantity::numeric <= inv.reorder_level::numeric
      )`);
    } else if (stockStatus === "expiring") {
      conditions.push(sql`${products.expiryDate} IS NOT NULL`);
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Build order-by: qty_desc uses a subquery into inventory
    const orderByClause = sort === "qty_desc"
      ? sql`(SELECT COALESCE(inv.quantity::numeric, 0) FROM inventory inv WHERE inv.product_id = ${products.id} AND inv.shop_id = ${products.shop} LIMIT 1) DESC NULLS LAST`
      : sort === "expiring"
        ? sql`${products.expiryDate} ASC NULLS LAST`
        : sql`${products.name} ASC`;

    const rows = await db.query.products.findMany({
      where,
      limit,
      offset,
      orderBy: () => [orderByClause],
      with: { category: true },
    });
    const total = await db.$count(products, where);

    const withBundles = await attachBundleItems(rows);

    if (withBundles.length > 0) {
      const productIds = withBundles.map((p: any) => p.id).filter(Boolean);
      // Fetch inventory for all relevant products; if a specific shop is requested
      // prefer that shop's inventory row so stock quantities are correct
      const invWhere = requestedShopId
        ? and(inArray(inventory.product, productIds), eq(inventory.shop, requestedShopId))
        : inArray(inventory.product, productIds);
      const invRows = await db
        .select({
          product: inventory.product,
          shop: inventory.shop,
          quantity: inventory.quantity,
          reorderLevel: inventory.reorderLevel,
          status: inventory.status,
        })
        .from(inventory)
        .where(invWhere);

      // Key by product id (shop-specific lookup already narrowed above)
      const invMap = new Map(invRows.map((inv) => [inv.product, inv]));

      const enriched = withBundles.map((p: any) => {
        const inv = invMap.get(p.id);
        return {
          ...p,
          quantity: inv ? Number(inv.quantity) : 0,
          reorderLevel: inv ? Number(inv.reorderLevel) : 0,
          stockStatus: inv?.status ?? "active",
        };
      });

      return paginated(res, enriched, { total, page, limit });
    }

    return paginated(res, withBundles, { total, page, limit });
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
 *  sellingPrice and buyingPrice are required when provided and must be ≥ 0.
 *  wholesalePrice and dealerPrice are optional — when absent or 0 they are skipped.
 *  When present: sellingPrice ≥ wholesalePrice ≥ dealerPrice ≥ buyingPrice
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
    if (isNaN(n)) return null;
    return n;
  };

  // Optional prices: treat 0 as "not provided"
  const parseOptional = (v: number | string | null | undefined): number | null => {
    const n = parse(v);
    return n === null || n === 0 ? null : n;
  };

  const buying    = parse(prices.buyingPrice);
  const selling   = parse(prices.sellingPrice);
  const wholesale = parseOptional(prices.wholesalePrice);
  const dealer    = parseOptional(prices.dealerPrice);

  if (buying !== null && buying < 0)
    throw badRequest("buyingPrice must be a positive number");
  if (selling !== null && selling < 0)
    throw badRequest("sellingPrice must be a positive number");
  if (wholesale !== null && wholesale < 0)
    throw badRequest("wholesalePrice must be a positive number");
  if (dealer !== null && dealer < 0)
    throw badRequest("dealerPrice must be a positive number");

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
      wholesalePrice, dealerPrice, minSellingPrice, maxDiscount,
      quantity, measureUnit, manufacturer,
      supplierId, description, alertQuantity, expiryDate, type,
      isTaxable, manageByPrice,
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
      buyingPrice: buyingPrice != null ? String(buyingPrice) : null,
      sellingPrice: sellingPrice != null ? String(sellingPrice) : null,
      wholesalePrice: wholesalePrice != null ? String(wholesalePrice) : null,
      dealerPrice: dealerPrice != null ? String(dealerPrice) : null,
      minSellingPrice: minSellingPrice != null ? String(minSellingPrice) : null,
      maxDiscount: maxDiscount != null ? String(maxDiscount) : null,
      measureUnit: measureUnit ?? "",
      manufacturer: manufacturer ?? "",
      supplier: supplierId ? Number(supplierId) : null,
      description,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      type: bundlePayload.length > 0 ? "bundle" : (type ?? "product"),
      isTaxable: isTaxable != null ? Boolean(isTaxable) : false,
      manageByPrice: manageByPrice != null ? Boolean(manageByPrice) : false,
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

    await writeEditLog({ productId: product.id, shopId: Number(shopId), action: "created", req });

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
      name, categoryId, barcode, serialNumber,
      buyingPrice, sellingPrice, wholesalePrice, dealerPrice,
      minSellingPrice, maxDiscount,
      measureUnit, manufacturer,
      supplierId, description, type,
      isTaxable, manageByPrice, expiryDate,
      alertQuantity, reorderLevel,
      bundleItems: bundleItemsPayload,
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

    const productFields: Record<string, unknown> = {
      ...(trimmedName !== undefined      && { name: trimmedName }),
      ...(categoryId !== undefined       && { category: categoryId ? Number(categoryId) : null }),
      ...(barcode !== undefined          && { barcode }),
      ...(serialNumber !== undefined     && { serialNumber }),
      ...(buyingPrice !== undefined      && { buyingPrice: String(buyingPrice) }),
      ...(sellingPrice !== undefined     && { sellingPrice: String(sellingPrice) }),
      ...(wholesalePrice !== undefined   && { wholesalePrice: String(wholesalePrice) }),
      ...(dealerPrice !== undefined      && { dealerPrice: String(dealerPrice) }),
      ...(minSellingPrice !== undefined  && { minSellingPrice: minSellingPrice != null ? String(minSellingPrice) : null }),
      ...(maxDiscount !== undefined      && { maxDiscount: maxDiscount != null ? String(maxDiscount) : null }),
      ...(measureUnit !== undefined      && { measureUnit }),
      ...(manufacturer !== undefined     && { manufacturer }),
      ...(supplierId !== undefined       && { supplier: supplierId ? Number(supplierId) : null }),
      ...(description !== undefined      && { description }),
      ...(type !== undefined             && { type }),
      ...(isTaxable !== undefined        && { isTaxable: Boolean(isTaxable) }),
      ...(manageByPrice !== undefined    && { manageByPrice: Boolean(manageByPrice) }),
      ...(expiryDate !== undefined       && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
    };

    let updated = existing;

    if (Object.keys(productFields).length > 0) {
      const [row] = await db.update(products).set(productFields).where(eq(products.id, existing.id)).returning();
      if (!row) throw notFound("Product not found");
      updated = row;
    }

    // alertQuantity / reorderLevel both map to inventory.reorderLevel
    const newReorderLevel = alertQuantity !== undefined ? alertQuantity : reorderLevel;
    if (newReorderLevel !== undefined) {
      await db.update(inventory)
        .set({ reorderLevel: String(newReorderLevel) })
        .where(and(eq(inventory.product, existing.id), eq(inventory.shop, existing.shop)));
    }

    // Bundle items replacement — if caller sends the array, wipe & re-insert
    if (Array.isArray(bundleItemsPayload)) {
      // Validate each item
      const bundlePayload: Array<{ componentProductId: number; quantity: number }> = [];
      for (const item of bundleItemsPayload) {
        if (!item.componentProductId || item.quantity == null)
          throw badRequest("Each bundle item requires componentProductId and quantity");
        bundlePayload.push({
          componentProductId: Number(item.componentProductId),
          quantity: Number(item.quantity),
        });
      }

      // Verify caller owns every component product
      if (bundlePayload.length > 0) {
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

      // Replace: delete all existing bundle items, then insert the new set
      await db.delete(bundleItems).where(eq(bundleItems.product, existing.id));

      if (bundlePayload.length > 0) {
        await db.insert(bundleItems).values(
          bundlePayload.map((item) => ({
            product: existing.id,
            componentProduct: item.componentProductId,
            quantity: String(item.quantity),
          }))
        );
        // Ensure product type reflects bundle
        const [bundleRow] = await db.update(products)
          .set({ type: "bundle" })
          .where(eq(products.id, existing.id))
          .returning();
        if (bundleRow) updated = bundleRow;
      }
    }

    const diff = diffProducts(existing as any, updated as any);
    if (Object.keys(diff).length > 0) {
      await writeEditLog({ productId: existing.id, shopId: existing.shop, action: "updated", changes: diff, req });
    }

    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id, shop } = (req as any).product;
    await writeEditLog({ productId: id, shopId: shop, action: "deleted", req });
    await db.update(products).set({ isDeleted: true }).where(eq(products.id, id));
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

    const shopCondition = shopId
      ? or(eq(productTransfers.fromShop, shopId), eq(productTransfers.toShop, shopId))
      : undefined;
    const where = shopCondition
      ? and(eq(transferItems.product, productId), shopCondition)
      : eq(transferItems.product, productId);

    const rows = await db.select({
      id: transferItems.id,
      transferId: transferItems.transfer,
      quantity: transferItems.quantity,
      unitPrice: transferItems.unitPrice,
      transferNo: productTransfers.transferNo,
      transferNote: productTransfers.transferNote,
      fromShop: productTransfers.fromShop,
      fromShopName: sql<string>`(SELECT name FROM shops WHERE id = ${productTransfers.fromShop})`,
      toShop: productTransfers.toShop,
      toShopName: sql<string>`(SELECT name FROM shops WHERE id = ${productTransfers.toShop})`,
      createdAt: productTransfers.createdAt,
    }).from(transferItems)
      .leftJoin(productTransfers, eq(transferItems.transfer, productTransfers.id))
      .where(where)
      .limit(limit).offset(offset)
      .orderBy(sql`${productTransfers.createdAt} DESC`);

    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(transferItems)
      .leftJoin(productTransfers, eq(transferItems.transfer, productTransfers.id))
      .where(where);
    return paginated(res, rows, { total: Number(count ?? 0), page, limit });
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

// ── Stock count history for a product ────────────────────────────────────────
router.get("/:id/stock-count-history", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions: any[] = [eq(stockCountItems.product, productId)];
    if (shopId) conditions.push(eq(stockCounts.shop, shopId));
    if (from) conditions.push(gte(stockCountItems.createdAt, from));
    if (to) conditions.push(lte(stockCountItems.createdAt, new Date(to.getTime() + 86399999)));
    const where = and(...conditions);

    const rows = await db.select({
      id: stockCountItems.id,
      stockCountId: stockCounts.id,
      physicalCount: stockCountItems.physicalCount,
      systemCount: stockCountItems.systemCount,
      variance: stockCountItems.variance,
      createdAt: stockCountItems.createdAt,
      conductedBy: stockCounts.conductedBy,
    }).from(stockCountItems)
      .leftJoin(stockCounts, eq(stockCountItems.stockCount, stockCounts.id))
      .where(where)
      .orderBy(sql`${stockCountItems.createdAt} DESC`)
      .limit(limit).offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(stockCountItems)
      .leftJoin(stockCounts, eq(stockCountItems.stockCount, stockCounts.id))
      .where(where);

    return paginated(res, rows, { total: Number(count ?? 0), page, limit });
  } catch (e) { next(e); }
});

// ── Product edit log (dedicated, paginated) ───────────────────────────────────
router.get("/:id/edit-logs", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const from   = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const toRaw  = req.query["to"]   ? new Date(String(req.query["to"]))   : null;
    const to     = toRaw ? new Date(toRaw.getTime() + 86_399_999) : null;

    const conditions: ReturnType<typeof eq>[] = [eq(productEditLogs.product, productId)];
    if (from) conditions.push(gte(productEditLogs.createdAt, from) as any);
    if (to)   conditions.push(lte(productEditLogs.createdAt, to)   as any);
    const where = and(...conditions);

    const [rows, total] = await Promise.all([
      db.select().from(productEditLogs)
        .where(where)
        .orderBy(sql`${productEditLogs.createdAt} DESC`)
        .limit(limit).offset(offset),
      db.$count(productEditLogs, where),
    ]);

    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Unified audit trail ───────────────────────────────────────────────────────
router.get("/:id/audit-trail", async (req, res, next) => {
  try {
    const productId = (req as any).product.id;
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const toRaw = req.query["to"] ? new Date(String(req.query["to"])) : null;
    const to = toRaw ? new Date(toRaw.getTime() + 86399999) : null;

    const dc = (col: any) => [
      ...(from ? [gte(col, from)] : []),
      ...(to   ? [lte(col, to)]   : []),
    ];

    const [salesRows, purchaseRows, adjRows, badRows, countRows, xferRows, editRows] = await Promise.all([
      db.select({
        id: saleItems.id,
        date: saleItems.createdAt,
        qty: saleItems.quantity,
        price: saleItems.unitPrice,
        refNo: sales.receiptNo,
        note: saleItems.saleType,
        customerName: customers.name,
        b: sql<string>`null`,
        a: sql<string>`null`,
        variance: sql<string>`null`,
        fromShop: sql<number>`null`,
        toShop: sql<number>`null`,
        adjType: sql<string>`null`,
      }).from(saleItems)
        .leftJoin(sales, eq(saleItems.sale, sales.id))
        .leftJoin(customers, eq(sales.customer, customers.id))
        .where(and(eq(saleItems.product, productId), ...(shopId ? [eq(saleItems.shop, shopId)] : []), ...dc(saleItems.createdAt)))
        .limit(500),

      db.select({
        id: purchaseItems.id,
        date: purchaseItems.createdAt,
        qty: purchaseItems.quantity,
        price: purchaseItems.unitPrice,
        refNo: purchases.purchaseNo,
        note: sql<string>`null`,
        customerName: sql<string>`null`,
        b: sql<string>`null`,
        a: sql<string>`null`,
        variance: sql<string>`null`,
        fromShop: sql<number>`null`,
        toShop: sql<number>`null`,
        adjType: sql<string>`null`,
      }).from(purchaseItems)
        .leftJoin(purchases, eq(purchaseItems.purchase, purchases.id))
        .where(and(eq(purchaseItems.product, productId), ...(shopId ? [eq(purchaseItems.shop, shopId)] : []), ...dc(purchaseItems.createdAt)))
        .limit(500),

      db.select({
        id: adjustments.id,
        date: adjustments.createdAt,
        qty: adjustments.quantityAdjusted,
        price: sql<string>`null`,
        refNo: sql<string>`null`,
        note: adjustments.reason,
        customerName: sql<string>`null`,
        b: adjustments.quantityBefore,
        a: adjustments.quantityAfter,
        variance: sql<string>`null`,
        fromShop: sql<number>`null`,
        toShop: sql<number>`null`,
        adjType: adjustments.type,
      }).from(adjustments)
        .where(and(eq(adjustments.product, productId), ...(shopId ? [eq(adjustments.shop, shopId)] : []), ...dc(adjustments.createdAt)))
        .limit(500),

      db.select({
        id: badStocks.id,
        date: badStocks.createdAt,
        qty: badStocks.quantity,
        price: badStocks.unitPrice,
        refNo: sql<string>`null`,
        note: badStocks.reason,
        customerName: sql<string>`null`,
        b: sql<string>`null`,
        a: sql<string>`null`,
        variance: sql<string>`null`,
        fromShop: sql<number>`null`,
        toShop: sql<number>`null`,
        adjType: sql<string>`null`,
      }).from(badStocks)
        .where(and(eq(badStocks.product, productId), ...(shopId ? [eq(badStocks.shop, shopId)] : []), ...dc(badStocks.createdAt)))
        .limit(500),

      db.select({
        id: stockCountItems.id,
        date: stockCountItems.createdAt,
        qty: stockCountItems.physicalCount,
        price: sql<string>`null`,
        refNo: sql<string>`null`,
        note: sql<string>`null`,
        customerName: sql<string>`null`,
        b: stockCountItems.systemCount,
        a: stockCountItems.physicalCount,
        variance: stockCountItems.variance,
        fromShop: sql<number>`null`,
        toShop: sql<number>`null`,
        adjType: sql<string>`null`,
      }).from(stockCountItems)
        .leftJoin(stockCounts, eq(stockCountItems.stockCount, stockCounts.id))
        .where(and(eq(stockCountItems.product, productId), ...(shopId ? [eq(stockCounts.shop, shopId)] : []), ...dc(stockCountItems.createdAt)))
        .limit(500),

      db.select({
        id: transferItems.id,
        date: productTransfers.createdAt,
        qty: transferItems.quantity,
        price: transferItems.unitPrice,
        refNo: productTransfers.transferNo,
        note: productTransfers.transferNote,
        customerName: sql<string>`null`,
        b: sql<string>`null`,
        a: sql<string>`null`,
        variance: sql<string>`null`,
        fromShop: productTransfers.fromShop,
        toShop: productTransfers.toShop,
        adjType: sql<string>`null`,
      }).from(transferItems)
        .leftJoin(productTransfers, eq(transferItems.transfer, productTransfers.id))
        .where(and(eq(transferItems.product, productId), ...(shopId ? [or(eq(productTransfers.fromShop, shopId), eq(productTransfers.toShop, shopId))] : []), ...dc(productTransfers.createdAt)))
        .limit(500),

      db.select({
        id: productEditLogs.id,
        date: productEditLogs.createdAt,
        action: productEditLogs.action,
        changes: productEditLogs.changes,
        changedByName: productEditLogs.changedByName,
      }).from(productEditLogs)
        .where(and(eq(productEditLogs.product, productId), ...dc(productEditLogs.createdAt)))
        .limit(500),
    ]);

    const allEvents: any[] = [
      ...salesRows.map(r => ({ ...r, eventType: 'sale' })),
      ...purchaseRows.map(r => ({ ...r, eventType: 'purchase' })),
      ...adjRows.map(r => ({ ...r, eventType: r.adjType === 'add' ? 'adjustment_add' : 'adjustment_remove' })),
      ...badRows.map(r => ({ ...r, eventType: 'bad_stock' })),
      ...countRows.map(r => ({ ...r, eventType: 'stock_count' })),
      ...xferRows.map(r => ({
        ...r,
        eventType: shopId
          ? (r.fromShop === shopId ? 'transfer_out' : 'transfer_in')
          : 'transfer',
      })),
      ...editRows.map(r => ({
        id: r.id,
        date: r.date,
        qty: null,
        price: null,
        refNo: null,
        note: r.changedByName ? `by ${r.changedByName}` : null,
        customerName: null,
        b: null,
        a: null,
        variance: null,
        fromShop: null,
        toShop: null,
        adjType: null,
        changes: r.changes,
        changedByName: r.changedByName,
        eventType: r.action === 'created' ? 'product_create'
                 : r.action === 'deleted' ? 'product_delete'
                 : 'product_update',
      })),
    ].sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime());

    const total = allEvents.length;
    const sliced = allEvents.slice(offset, offset + limit);
    return paginated(res, sliced, { total, page, limit });
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
