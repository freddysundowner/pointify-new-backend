import { Router } from "express";
import { eq, and, ilike, or, inArray } from "drizzle-orm";
import {
  inventory, batches, adjustments, badStocks,
  stockCounts, stockCountItems, stockRequests, stockRequestItems,
  products,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership, resolveShopFilter } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { recordProductHistory } from "../lib/product-history.js";

const router = Router();

// ── Inventory ─────────────────────────────────────────────────────────────────

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const requestedShopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const productId = req.query["productId"] ? Number(req.query["productId"]) : null;

    const allowedShops = await resolveShopFilter(req, requestedShopId);

    const shopCondition = allowedShops === null
      ? undefined
      : allowedShops.length === 0
        ? eq(inventory.id, -1)  // no access → empty result
        : allowedShops.length === 1
          ? eq(inventory.shop, allowedShops[0]!)
          : inArray(inventory.shop, allowedShops);

    const conditions = [];
    if (shopCondition) conditions.push(shopCondition);
    if (productId) conditions.push(eq(inventory.product, productId));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.inventory.findMany({ where, limit, offset, with: { product: true } });
    const total = await db.$count(inventory, where);
    return paginated(res, rows, { total, page, limit });
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
    const where = shopId ? eq(badStocks.shop, shopId) : undefined;

    const rows = await db.query.badStocks.findMany({ where, limit, offset, orderBy: (b, { desc }) => [desc(b.createdAt)] });
    const total = await db.$count(badStocks, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/bad-stocks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, productId, quantity, unitPrice, reason } = req.body;
    if (!shopId || !productId || quantity === undefined || !reason) {
      throw badRequest("shopId, productId, quantity and reason required");
    }
    await assertShopOwnership(req, Number(shopId));

    const [row] = await db.insert(badStocks).values({
      shop: Number(shopId),
      product: Number(productId),
      quantity: String(quantity),
      unitPrice: String(unitPrice ?? 0),
      reason,
      writtenOffBy: req.attendant?.id ?? undefined,
    }).returning();
    await recordProductHistory([{
      product: row.product,
      shop: row.shop,
      eventType: "bad_stock",
      referenceId: row.id,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
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
    const where = shopId ? eq(stockCounts.shop, shopId) : undefined;

    const rows = await db.query.stockCounts.findMany({
      where,
      limit,
      offset,
      orderBy: (sc, { desc }) => [desc(sc.createdAt)],
      with: { stockCountItems: true },
    });
    const total = await db.$count(stockCounts, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/stock-counts", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, items } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const [count] = await db.insert(stockCounts).values({
      shop: Number(shopId),
      conductedBy: req.attendant?.id ?? undefined,
    }).returning();

    const itemRows = await db.insert(stockCountItems).values(
      items.map((item: any) => ({
        stockCount: count.id,
        product: Number(item.productId),
        physicalCount: String(item.physicalCount ?? 0),
        systemCount: String(item.systemCount ?? 0),
        variance: String((parseFloat(String(item.physicalCount ?? 0)) - parseFloat(String(item.systemCount ?? 0))).toFixed(4)),
      }))
    ).returning();

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
