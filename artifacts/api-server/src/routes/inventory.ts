import { Router } from "express";
import { eq, and, ilike, or, inArray, notInArray, sql, gte, lte } from "drizzle-orm";
import {
  inventory, batches, adjustments, badStocks,
  stockCounts, stockCountItems, stockRequests, stockRequestItems,
  products, shops, sales, saleItems,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { recordProductHistory } from "../lib/product-history.js";

const router = Router();

// ── Inventory ─────────────────────────────────────────────────────────────────

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const productId = req.query["productId"] ? Number(req.query["productId"]) : null;
    // Filter by inventory status: active | low | out_of_stock
    const status = req.query["status"] ? String(req.query["status"]) : null;

    // Derive shop constraint straight from the token — no guessing.
    let shopCondition;
    if (req.attendant) {
      shopCondition = eq(inventory.shop, req.attendant.shopId);
    } else if (req.admin && !req.admin.isSuperAdmin) {
      const myShops = await db.query.shops.findMany({
        where: eq(shops.admin, req.admin.id),
        columns: { id: true },
      });
      const ids = myShops.map((s) => s.id);
      shopCondition = ids.length ? inArray(inventory.shop, ids) : eq(inventory.id, -1);
    }

    const conditions = [];
    if (shopCondition) conditions.push(shopCondition);
    if (shopId) conditions.push(eq(inventory.shop, shopId));
    if (productId) conditions.push(eq(inventory.product, productId));
    if (status) conditions.push(eq(inventory.status, status));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.inventory.findMany({ where, limit, offset, with: { product: true } });
    const total = await db.$count(inventory, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Inventory movement categories ─────────────────────────────────────────────
// Returns a single response with four product movement categories:
//   out_of_stock — inventory.status = 'out_of_stock'
//   low_stock    — inventory.status = 'low' (at or below reorder level)
//   dormant      — has stock but zero sales in the last `days` days
//   fast_moving  — top `topN` products by quantity sold in the last `days` days
//   slow_moving  — products with some sales but below the period average

router.get("/movements", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const days = req.query["days"] ? Math.max(1, Number(req.query["days"])) : 30;
    const topN = req.query["topN"] ? Math.max(1, Number(req.query["topN"])) : 20;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Build shop filter from token (same pattern as GET /)
    const reqShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    let shopCond;
    if (req.attendant) {
      shopCond = eq(inventory.shop, req.attendant.shopId);
    } else if (req.admin && !req.admin.isSuperAdmin) {
      const myShops = await db.query.shops.findMany({
        where: eq(shops.admin, req.admin.id),
        columns: { id: true },
      });
      const ids = myShops.map((s) => s.id);
      shopCond = ids.length ? inArray(inventory.shop, ids) : eq(inventory.id, -1);
    }

    const baseConditions = [];
    if (shopCond) baseConditions.push(shopCond);
    if (reqShopId) baseConditions.push(eq(inventory.shop, reqShopId));
    const baseWhere = baseConditions.length > 1 ? and(...baseConditions) : baseConditions[0];

    // Out of stock
    const outOfStock = await db.query.inventory.findMany({
      where: and(baseWhere, eq(inventory.status, "out_of_stock")),
      with: { product: true },
    });

    // Low stock
    const lowStock = await db.query.inventory.findMany({
      where: and(baseWhere, eq(inventory.status, "low")),
      with: { product: true },
    });

    // Determine the shop filter for saleItems queries
    const saleShopConditions: ReturnType<typeof eq>[] = [];
    if (req.attendant) saleShopConditions.push(eq(saleItems.shop, req.attendant.shopId));
    if (reqShopId) saleShopConditions.push(eq(saleItems.shop, reqShopId));
    const saleShopWhere = saleShopConditions.length > 1 ? and(...saleShopConditions) : saleShopConditions[0];

    // Fast moving — top N products by qty sold in the period
    const fastMovingRaw = await db.select({
      productId: saleItems.product,
      shopId: saleItems.shop,
      totalQtySold: sql<string>`SUM(${saleItems.quantity}::numeric)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(and(
      saleShopWhere,
      gte(sales.createdAt, since),
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
    ))
    .groupBy(saleItems.product, saleItems.shop)
    .orderBy(sql`SUM(${saleItems.quantity}::numeric) DESC`)
    .limit(topN);

    // Enrich fast-moving with product details
    const fastProductIds = fastMovingRaw.map((r) => r.productId).filter((x): x is number => !!x);
    const fastProducts = fastProductIds.length
      ? await db.query.products.findMany({ where: inArray(products.id, fastProductIds), columns: { id: true, name: true, sellingPrice: true } })
      : [];
    const fastProductMap = new Map(fastProducts.map((p) => [p.id, p]));
    const fastMoving = fastMovingRaw.map((r) => ({
      ...r,
      product: r.productId ? fastProductMap.get(r.productId) ?? null : null,
    }));

    // Dormant — has stock but NO sales in the period
    const recentlySoldIds = fastMovingRaw.map((r) => r.productId).filter((x): x is number => !!x);
    // Also fetch ALL products that sold (not just top N) for accurate dormant filter
    const allRecentlySoldRaw = await db.selectDistinct({ productId: saleItems.product })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.sale, sales.id))
      .where(and(
        saleShopWhere,
        gte(sales.createdAt, since),
        sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
      ));
    const allSoldProductIds = allRecentlySoldRaw.map((r) => r.productId).filter((x): x is number => !!x);

    const dormant = await db.query.inventory.findMany({
      where: and(
        baseWhere,
        sql`${inventory.quantity}::numeric > 0`,
        allSoldProductIds.length ? notInArray(inventory.product, allSoldProductIds) : sql`1=1`,
      ),
      with: { product: true },
      limit: 100,
    });

    // Slow moving — has some sales in the period but below the average qty sold
    const avgQtySold = fastMovingRaw.length
      ? fastMovingRaw.reduce((s, r) => s + parseFloat(r.totalQtySold), 0) / fastMovingRaw.length
      : 0;
    const slowMoving = fastMovingRaw
      .filter((r) => parseFloat(r.totalQtySold) < avgQtySold)
      .map((r) => ({ ...r, product: r.productId ? fastProductMap.get(r.productId) ?? null : null }));

    return ok(res, {
      period: { days, since },
      outOfStock: { count: outOfStock.length, items: outOfStock },
      lowStock: { count: lowStock.length, items: lowStock },
      fastMoving: { count: fastMoving.length, items: fastMoving },
      slowMoving: { count: slowMoving.length, items: slowMoving },
      dormant: { count: dormant.length, items: dormant },
    });
  } catch (e) { next(e); }
});

router.get("/item/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.inventory.findFirst({ where: eq(inventory.id, Number(req.params["id"])) });
    if (!row) throw notFound("Inventory record not found");
    await assertShopOwnership(req, row.shop);
    return ok(res, row);
  } catch (e) { next(e); }
});

// ── Batches ───────────────────────────────────────────────────────────────────

router.get("/batches", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const productId = req.query["productId"] ? Number(req.query["productId"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(batches.shop, shopId));
    if (productId) conditions.push(eq(batches.product, productId));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.batches.findMany({ where, limit, offset, orderBy: (b, { asc }) => [asc(b.expirationDate)] });
    const total = await db.$count(batches, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Adjustments ───────────────────────────────────────────────────────────────

router.get("/adjustments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(adjustments.shop, shopId) : undefined;

    const rows = await db.query.adjustments.findMany({ where, limit, offset, orderBy: (a, { desc }) => [desc(a.createdAt)] });
    const total = await db.$count(adjustments, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/adjustments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, productId, quantityBefore, quantityAfter, quantity, reason, type } = req.body;
    if (!shopId || !productId) {
      throw badRequest("shopId and productId required");
    }
    await assertShopOwnership(req, Number(shopId));
    const qBefore = quantityBefore ?? (quantity !== undefined ? 0 : undefined);
    const qAfter = quantityAfter ?? (quantity !== undefined ? quantity : undefined);
    if (qBefore === undefined || qAfter === undefined) {
      throw badRequest("quantityBefore/quantityAfter (or quantity) required");
    }

    const diff = parseFloat(String(qAfter)) - parseFloat(String(qBefore));

    const [adj] = await db.insert(adjustments).values({
      shop: Number(shopId),
      product: Number(productId),
      type: type ?? (diff >= 0 ? "add" : "remove"),
      quantityBefore: String(qBefore),
      quantityAfter: String(qAfter),
      quantityAdjusted: String(Math.abs(diff)),
      reason,
      adjustedBy: req.attendant?.id ?? undefined,
    }).returning();
    await recordProductHistory([{
      product: adj.product,
      shop: adj.shop,
      eventType: "adjustment",
      referenceId: adj.id,
      quantity: adj.quantityAdjusted,
      quantityBefore: adj.quantityBefore,
      quantityAfter: adj.quantityAfter,
      note: adj.reason ?? undefined,
    }]);
    // Apply the adjusted quantity directly to inventory
    await db.insert(inventory)
      .values({ product: adj.product, shop: adj.shop, quantity: adj.quantityAfter })
      .onConflictDoUpdate({
        target: [inventory.product, inventory.shop],
        set: { quantity: adj.quantityAfter },
      });
    return created(res, adj);
  } catch (e) { next(e); }
});

router.delete("/adjustments/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.adjustments.findFirst({ where: eq(adjustments.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Adjustment not found");
    await assertShopOwnership(req, existing.shop);
    await db.delete(adjustments).where(eq(adjustments.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Bad Stocks ────────────────────────────────────────────────────────────────

router.get("/bad-stocks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const fromDate = req.query["startDate"] ? new Date(String(req.query["startDate"])) : null;
    const toDate = req.query["endDate"] ? new Date(String(req.query["endDate"]) + "T23:59:59") : null;

    const conditions: any[] = [];
    if (shopId) conditions.push(eq(badStocks.shop, shopId));
    if (fromDate) conditions.push(gte(badStocks.createdAt, fromDate));
    if (toDate) conditions.push(lte(badStocks.createdAt, toDate));
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db.query.badStocks.findMany({ where, limit, offset, orderBy: (b, { desc }) => [desc(b.createdAt)] });
    const total = await db.$count(badStocks, where);

    // Enrich with product names
    const productIds = [...new Set(rows.map(r => r.product))];
    const productNames: Record<number, string> = {};
    if (productIds.length) {
      const prods = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds));
      prods.forEach(p => { productNames[p.id] = p.name; });
    }

    const enriched = rows.map(r => ({ ...r, productName: productNames[r.product] ?? `Product #${r.product}` }));
    return paginated(res, enriched, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/bad-stocks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, productId, quantity, unitPrice, reason } = req.body;
    if (!shopId || !productId || quantity === undefined || !reason) {
      throw badRequest("shopId, productId, quantity and reason required");
    }
    await assertShopOwnership(req, Number(shopId));

    // Read current inventory before writing off so we can track before/after
    const badStockInv = await db.query.inventory.findFirst({
      where: and(eq(inventory.product, Number(productId)), eq(inventory.shop, Number(shopId))),
      columns: { quantity: true },
    });
    const badQtyBefore = badStockInv?.quantity ?? "0";
    const badQtyAfter = String(Math.max(0, parseFloat(badQtyBefore) - parseFloat(String(quantity))));

    const [row] = await db.insert(badStocks).values({
      shop: Number(shopId),
      product: Number(productId),
      quantity: String(quantity),
      unitPrice: String(unitPrice ?? 0),
      reason,
      writtenOffBy: req.attendant?.id ?? undefined,
    }).returning();

    // Deduct written-off quantity from inventory
    await db.update(inventory)
      .set({ quantity: badQtyAfter })
      .where(and(eq(inventory.product, Number(productId)), eq(inventory.shop, Number(shopId))));

    await recordProductHistory([{
      product: row.product,
      shop: row.shop,
      eventType: "bad_stock",
      referenceId: row.id,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      quantityBefore: badQtyBefore,
      quantityAfter: badQtyAfter,
      note: row.reason,
    }]);
    return created(res, row);
  } catch (e) { next(e); }
});

router.delete("/bad-stocks/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.badStocks.findFirst({ where: eq(badStocks.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Bad stock not found");
    await assertShopOwnership(req, existing.shop);
    await db.delete(badStocks).where(eq(badStocks.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Stock Counts ──────────────────────────────────────────────────────────────

router.get("/stock-counts", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const fromDate = req.query["fromDate"] ? new Date(String(req.query["fromDate"])) : null;
    const toDate = req.query["toDate"] ? new Date(String(req.query["toDate"]) + "T23:59:59") : null;

    const conditions = [];
    if (shopId) conditions.push(eq(stockCounts.shop, shopId));
    if (fromDate) conditions.push(gte(stockCounts.createdAt, fromDate));
    if (toDate) conditions.push(lte(stockCounts.createdAt, toDate));
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db.query.stockCounts.findMany({
      where,
      limit,
      offset,
      orderBy: (sc, { desc }) => [desc(sc.createdAt)],
      with: { stockCountItems: true },
    });

    // Enrich stockCountItems with product names
    const allProductIds = [...new Set(rows.flatMap(r => r.stockCountItems.map(i => i.product)))];
    const productNames: Record<number, string> = {};
    if (allProductIds.length) {
      const prods = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, allProductIds));
      prods.forEach(p => { productNames[p.id] = p.name; });
    }

    const enriched = rows.map(r => ({
      ...r,
      stockCountItems: r.stockCountItems.map(i => ({ ...i, productName: productNames[i.product] ?? `Product #${i.product}` })),
    }));

    const total = await db.$count(stockCounts, where);
    return paginated(res, enriched, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/stock-counts", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, items } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");
    await assertShopOwnership(req, Number(shopId));
    const shop = Number(shopId);

    // Look up current inventory quantities to use as systemCount
    const productIds = items.map((i: any) => Number(i.productId));
    const invRows = await db.select({ product: inventory.product, quantity: inventory.quantity, reorderLevel: inventory.reorderLevel })
      .from(inventory)
      .where(and(inArray(inventory.product, productIds), eq(inventory.shop, shop)));
    const invMap = new Map(invRows.map(r => [r.product, r]));

    const [count] = await db.insert(stockCounts).values({
      shop,
      conductedBy: req.attendant?.id ?? undefined,
    }).returning();

    const itemRows = await db.insert(stockCountItems).values(
      items.map((item: any) => {
        const pid = Number(item.productId);
        const sysQty = parseFloat(String(invMap.get(pid)?.quantity ?? 0));
        const physQty = parseFloat(String(item.physicalCount ?? 0));
        return {
          stockCount: count.id,
          product: pid,
          physicalCount: String(physQty),
          systemCount: String(sysQty),
          variance: String((physQty - sysQty).toFixed(4)),
        };
      })
    ).returning();

    // Update inventory quantities to match the physical count
    await Promise.all(itemRows.map(async (itemRow) => {
      const physQty = parseFloat(String(itemRow.physicalCount));
      const reorderLevel = parseFloat(String(invMap.get(itemRow.product)?.reorderLevel ?? 0));
      const newStatus = physQty === 0 ? "out_of_stock" : physQty <= reorderLevel ? "low" : "active";
      await db.insert(inventory)
        .values({ product: itemRow.product, shop, quantity: String(physQty), lastCount: String(physQty), lastCountDate: new Date(), status: newStatus })
        .onConflictDoUpdate({
          target: [inventory.product, inventory.shop],
          set: { quantity: String(physQty), lastCount: String(physQty), lastCountDate: new Date(), status: newStatus },
        });
    }));

    await recordProductHistory(
      itemRows.map((itemRow) => ({
        product: itemRow.product,
        shop: count.shop,
        eventType: "stock_count" as const,
        referenceId: itemRow.id,
        quantity: itemRow.physicalCount,
        quantityBefore: itemRow.systemCount,
        quantityAfter: itemRow.physicalCount,
        note: `variance: ${itemRow.variance}`,
      }))
    );
    return created(res, { ...count, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/stock-counts/product-search", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const q = String(req.query["q"] ?? "").trim();
    if (!shopId) throw badRequest("shopId required");
    const conditions = [eq(products.shop, shopId), eq(products.isDeleted, false)];
    if (q) {
      const like = `%${q}%`;
      const search = or(ilike(products.name, like), ilike(products.barcode, like));
      if (search) conditions.push(search);
    }
    const rows = await db.query.products.findMany({
      where: and(...conditions),
      limit: 50,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// Transfer-specific product search: returns any product that has inventory in the given shop,
// regardless of which shop originally created it.
router.get("/transfer-product-search", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const q      = String(req.query["q"] ?? "").trim();
    if (!shopId) throw badRequest("shopId required");

    const like = q ? `%${q}%` : "%";
    const rows = await db
      .select({
        id:           products.id,
        name:         products.name,
        type:         products.type,
        barcode:      products.barcode,
        sellingPrice: products.sellingPrice,
        measureUnit:  products.measureUnit,
        quantity:     inventory.quantity,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.product, products.id))
      .where(
        and(
          eq(inventory.shop, shopId),
          eq(products.isDeleted, false),
          or(ilike(products.name, like), ilike(products.barcode ?? sql`''`, like))
        )
      )
      .limit(50);

    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/stock-counts/product-filter", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    if (!shopId) throw badRequest("shopId required");
    const rows = await db.query.products.findMany({
      where: and(eq(products.shop, shopId), eq(products.isDeleted, false)),
      with: { inventoryItems: true },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/stock-counts/by-product/:productId", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["productId"]);
    const { page, limit, offset } = getPagination(req);
    const where = eq(stockCountItems.product, productId);
    const rows = await db.query.stockCountItems.findMany({
      where,
      limit,
      offset,
      orderBy: (sci, { desc }) => [desc(sci.createdAt)],
      with: { stockCount: true },
    });
    const total = await db.$count(stockCountItems, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/stock-counts/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.stockCounts.findFirst({
      where: eq(stockCounts.id, Number(req.params["id"])),
      with: { stockCountItems: true },
    });
    if (!row) throw notFound("Stock count not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/stock-counts/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.stockCounts.findFirst({ where: eq(stockCounts.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Stock count not found");
    await assertShopOwnership(req, existing.shop);
    await db.delete(stockCounts).where(eq(stockCounts.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/stock-counts/:id/items", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const stockCountId = Number(req.params["id"]);
    const items = req.body?.items ?? [];
    if (!Array.isArray(items) || items.length === 0) throw badRequest("items required");

    const count = await db.query.stockCounts.findFirst({ where: eq(stockCounts.id, stockCountId) });
    if (!count) throw notFound("Stock count not found");
    await assertShopOwnership(req, count.shop);

    const itemRows = await db.insert(stockCountItems).values(
      items.map((item: any) => ({
        stockCount: stockCountId,
        product: Number(item.productId),
        physicalCount: String(item.physicalCount ?? 0),
        systemCount: String(item.systemCount ?? 0),
        variance: String((parseFloat(String(item.physicalCount ?? 0)) - parseFloat(String(item.systemCount ?? 0))).toFixed(4)),
      }))
    ).returning();

    return created(res, itemRows);
  } catch (e) { next(e); }
});

router.post("/stock-counts/:id/apply", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const stockCountId = Number(req.params["id"]);
    const count = await db.query.stockCounts.findFirst({
      where: eq(stockCounts.id, stockCountId),
      with: { stockCountItems: true },
    });
    if (!count) throw notFound("Stock count not found");
    await assertShopOwnership(req, count.shop);

    const adjustmentRows = [];
    for (const item of count.stockCountItems) {
      const before = parseFloat(item.systemCount);
      const after = parseFloat(item.physicalCount);
      const diff = after - before;
      if (diff === 0) continue;
      const [adj] = await db.insert(adjustments).values({
        shop: count.shop,
        product: item.product,
        type: diff >= 0 ? "add" : "remove",
        quantityBefore: String(before),
        quantityAfter: String(after),
        quantityAdjusted: String(Math.abs(diff)),
        reason: `Stock count #${stockCountId} variance`,
        adjustedBy: req.attendant?.id ?? undefined,
      }).returning();
      adjustmentRows.push(adj);

      await db.update(inventory)
        .set({ quantity: String(after), lastCount: String(after), lastCountDate: new Date() })
        .where(and(eq(inventory.shop, count.shop), eq(inventory.product, item.product)));
    }

    if (adjustmentRows.length > 0) {
      await recordProductHistory(
        adjustmentRows.map((adj) => ({
          product: adj.product,
          shop: adj.shop,
          eventType: "adjustment" as const,
          referenceId: adj.id,
          quantity: adj.quantityAdjusted,
          quantityBefore: adj.quantityBefore,
          quantityAfter: adj.quantityAfter,
          note: adj.reason ?? undefined,
        }))
      );
    }
    return ok(res, { stockCountId, adjustments: adjustmentRows, applied: adjustmentRows.length });
  } catch (e) { next(e); }
});

// ── Stock Requests ────────────────────────────────────────────────────────────

router.get("/stock-requests", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(stockRequests.fromShop, shopId) : undefined;

    const rows = await db.query.stockRequests.findMany({
      where,
      limit,
      offset,
      orderBy: (sr, { desc }) => [desc(sr.createdAt)],
      with: { stockRequestItems: true },
    });
    const total = await db.$count(stockRequests, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/stock-requests", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { fromShopId, warehouseId, items } = req.body;
    if (!fromShopId || !warehouseId || !items?.length) throw badRequest("fromShopId, warehouseId and items required");

    // Verify the target shop is a designated warehouse
    const warehouseShop = await db.query.shops.findFirst({
      where: eq(shops.id, Number(warehouseId)),
      columns: { id: true, isWarehouse: true, name: true },
    });
    if (!warehouseShop) throw badRequest("Warehouse shop not found");
    if (!warehouseShop.isWarehouse) throw badRequest(`Shop "${warehouseShop.name}" is not configured as a warehouse. Enable the warehouse setting on that shop first.`);

    const invoiceNumber = `SRQ${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [request] = await db.insert(stockRequests).values({
      fromShop: Number(fromShopId),
      warehouse: Number(warehouseId),
      requestedBy: req.attendant?.id ?? undefined,
      status: "pending",
      totalValue: "0",
      invoiceNumber,
    }).returning();

    const itemRows = await db.insert(stockRequestItems).values(
      items.map((item: any) => ({
        stockRequest: request.id,
        product: Number(item.productId),
        quantityRequested: String(item.quantity ?? 1),
        quantityReceived: "0",
      }))
    ).returning();

    return created(res, { ...request, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/stock-requests/by-product/:productId", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const productId = Number(req.params["productId"]);
    const { page, limit, offset } = getPagination(req);
    const where = eq(stockRequestItems.product, productId);
    const rows = await db.query.stockRequestItems.findMany({
      where,
      limit,
      offset,
      with: { stockRequest: true },
    });
    const total = await db.$count(stockRequestItems, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/stock-requests/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.stockRequests.findFirst({
      where: eq(stockRequests.id, Number(req.params["id"])),
      with: { stockRequestItems: true },
    });
    if (!row) throw notFound("Stock request not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

async function loadStockRequest(req: any, id: number) {
  const row = await db.query.stockRequests.findFirst({ where: eq(stockRequests.id, id), columns: { fromShop: true } });
  if (!row) throw notFound("Stock request not found");
  await assertShopOwnership(req, row.fromShop);
  return row;
}

router.put("/stock-requests/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    const [updated] = await db.update(stockRequests)
      .set({ status: "processed" })
      .where(eq(stockRequests.id, id))
      .returning();
    if (!updated) throw notFound("Stock request not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.put("/stock-requests/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    const [updated] = await db.update(stockRequests)
      .set({ status: "void" })
      .where(eq(stockRequests.id, id))
      .returning();
    if (!updated) throw notFound("Stock request not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/stock-requests/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    await db.delete(stockRequests).where(eq(stockRequests.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/stock-requests/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status) throw badRequest("status required");
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    const [updated] = await db.update(stockRequests)
      .set({ status })
      .where(eq(stockRequests.id, id))
      .returning();
    if (!updated) throw notFound("Stock request not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/stock-requests/:id/accept", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    const [updated] = await db.update(stockRequests)
      .set({ status: "processed", acceptedBy: req.admin?.id ?? undefined, acceptedAt: new Date() })
      .where(eq(stockRequests.id, id))
      .returning();
    if (!updated) throw notFound("Stock request not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/stock-requests/:id/dispatch", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await loadStockRequest(req, id);
    const [updated] = await db.update(stockRequests)
      .set({ status: "completed", dispatchedAt: new Date() })
      .where(eq(stockRequests.id, id))
      .returning();
    if (!updated) throw notFound("Stock request not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/stock-requests/:id/items/:itemId", requireAdmin, async (req, res, next) => {
  try {
    const itemId = Number(req.params["itemId"]);
    const requestId = Number(req.params["id"]);
    await loadStockRequest(req, requestId);
    await db.delete(stockRequestItems)
      .where(and(eq(stockRequestItems.id, itemId), eq(stockRequestItems.stockRequest, requestId)));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
