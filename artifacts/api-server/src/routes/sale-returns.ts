import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { saleReturns, saleReturnItems, sales, inventory } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifySaleRefund } from "../lib/emailEvents.js";
import { recordProductHistory } from "../lib/product-history.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(saleReturns.shop, shopId) : undefined;

    const rows = await db.query.saleReturns.findMany({
      where,
      limit,
      offset,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { saleReturnItems: true },
    });
    const total = await db.$count(saleReturns, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { saleId, shopId, items, reason, refundMethod } = req.body;
    if (!saleId || !shopId || !items?.length) throw badRequest("saleId, shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const sale = await db.query.sales.findFirst({ where: eq(sales.id, Number(saleId)) });
    if (!sale) throw notFound("Sale not found");

    let refundAmount = 0;
    for (const item of items) refundAmount += (item.unitPrice ?? 0) * (item.quantity ?? 1);

    const [saleReturn] = await db.insert(saleReturns).values({
      sale: Number(saleId),
      shop: Number(shopId),
      refundAmount: String(refundAmount),
      reason,
      refundMethod: refundMethod ?? "cash",
      processedBy: req.attendant?.id ?? undefined,
      returnNo: `RET${Date.now()}`,
    }).returning();

    const itemRows = await db.insert(saleReturnItems).values(
      items.map((item: any) => ({
        saleReturn: saleReturn.id,
        product: Number(item.productId),
        saleItem: Number(item.saleItemId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
    ).returning();

    // Restore inventory for each returned item and capture before/after quantities
    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow) => {
        const qty = parseFloat(itemRow.quantity);
        const sid = saleReturn.shop;

        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, itemRow.product), eq(inventory.shop, sid)),
          columns: { quantity: true },
        });
        const qtyBefore = existing ? String(existing.quantity) : "0";
        const qtyAfter  = String(parseFloat(qtyBefore) + qty);

        // Add returned stock back to inventory
        await db.insert(inventory)
          .values({ product: itemRow.product, shop: sid, quantity: itemRow.quantity })
          .onConflictDoUpdate({
            target: [inventory.product, inventory.shop],
            set: { quantity: sql`${inventory.quantity} + ${qty}::numeric` },
          });

        return { ...itemRow, qtyBefore, qtyAfter };
      })
    );

    await recordProductHistory(
      enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: saleReturn.shop,
        eventType: "sale_return" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.qtyBefore,
        quantityAfter: itemRow.qtyAfter,
        note: saleReturn.returnNo,
      }))
    );
    void notifySaleRefund(saleReturn.id);
    return created(res, { ...saleReturn, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.saleReturns.findFirst({
      where: eq(saleReturns.id, Number(req.params["id"])),
      with: { saleReturnItems: true },
    });
    if (!row) throw notFound("Sale return not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.saleReturns.findFirst({ where: eq(saleReturns.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Sale return not found");
    await assertShopOwnership(req, existing.shop);
    await db.delete(saleReturns).where(eq(saleReturns.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
