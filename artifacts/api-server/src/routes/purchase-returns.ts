import { Router } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import { purchaseReturns, purchaseReturnItems, purchases, inventory, products } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { recordProductHistory } from "../lib/product-history.js";
import { autoRecordCashflow } from "../lib/auto-cashflow.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(purchaseReturns.shop, shopId) : undefined;

    const rows = await db.query.purchaseReturns.findMany({
      where,
      limit,
      offset,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { purchaseReturnItems: true },
    });
    const total = await db.$count(purchaseReturns, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { purchaseId, shopId, items, reason, refundMethod } = req.body;
    if (!purchaseId || !shopId || !items?.length) throw badRequest("purchaseId, shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const purchase = await db.query.purchases.findFirst({ where: eq(purchases.id, Number(purchaseId)) });
    if (!purchase) throw notFound("Purchase not found");

    let refundAmount = 0;
    for (const item of items) refundAmount += (item.unitPrice ?? 0) * (item.quantity ?? 1);

    const [purchaseReturn] = await db.insert(purchaseReturns).values({
      purchase: Number(purchaseId),
      shop: Number(shopId),
      refundAmount: String(refundAmount),
      reason,
      refundMethod: refundMethod ?? "cash",
      processedBy: req.attendant?.id ?? undefined,
      returnNo: await (async () => {
        const now = new Date();
        const d = now.getFullYear().toString().slice(-2) + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
        const [{ total: shopReturnCount }] = await db.select({ total: count() }).from(purchaseReturns).where(eq(purchaseReturns.shop, Number(shopId)));
        const seq = String(Number(shopReturnCount) + 1).padStart(3, '0');
        return `RET-${d}-${seq}`;
      })(),
    }).returning();

    const itemRows = await db.insert(purchaseReturnItems).values(
      items.map((item: any) => ({
        purchaseReturn: purchaseReturn.id,
        product: Number(item.productId ?? item.product),
        purchaseItem: item.purchaseItemId ? Number(item.purchaseItemId) : undefined,
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
    ).returning();

    // Deduct inventory for each item being returned to the supplier and capture before/after
    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow) => {
        const qty = parseFloat(itemRow.quantity);
        const sid = purchaseReturn.shop;

        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, itemRow.product), eq(inventory.shop, sid)),
          columns: { quantity: true },
        });
        const qtyBefore = existing ? String(existing.quantity) : "0";
        const qtyAfter  = String(Math.max(0, parseFloat(qtyBefore) - qty));

        // Remove returned stock from inventory
        await db.update(inventory)
          .set({ quantity: sql`GREATEST(0, ${inventory.quantity} - ${qty}::numeric)` })
          .where(and(eq(inventory.product, itemRow.product), eq(inventory.shop, sid)));

        return { ...itemRow, qtyBefore, qtyAfter };
      })
    );

    await recordProductHistory(
      enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: purchaseReturn.shop,
        eventType: "purchase_return" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.qtyBefore,
        quantityAfter: itemRow.qtyAfter,
        note: purchaseReturn.returnNo,
      }))
    );
    void autoRecordCashflow({
      shopId: Number(shopId),
      amount: refundAmount,
      description: `Purchase Return ${purchaseReturn.returnNo}`,
      categoryKey: "purchase_return",
      recordedBy: req.attendant?.id,
    });
    return created(res, { ...purchaseReturn, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.purchaseReturns.findFirst({
      where: eq(purchaseReturns.id, Number(req.params["id"])),
      with: { purchaseReturnItems: true },
    });
    if (!row) throw notFound("Purchase return not found");

    // Enrich items with product names
    const productIds = [...new Set((row.purchaseReturnItems ?? []).map((i: any) => i.product).filter(Boolean))];
    let productMap: Record<number, string> = {};
    if (productIds.length > 0) {
      const productRows = await db.select({ id: products.id, name: products.name })
        .from(products)
        .where(sql`${products.id} = ANY(ARRAY[${sql.join(productIds.map((id: any) => sql`${id}`), sql`, `)}]::int[])`);
      productMap = Object.fromEntries(productRows.map(p => [p.id, p.name]));
    }
    const enriched = {
      ...row,
      purchaseReturnItems: (row.purchaseReturnItems ?? []).map((i: any) => ({
        ...i,
        productName: productMap[i.product] ?? `Product #${i.product}`,
      })),
    };
    return ok(res, enriched);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.purchaseReturns.findFirst({ where: eq(purchaseReturns.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Purchase return not found");
    await assertShopOwnership(req, existing.shop);

    // Restore inventory that was deducted when the return was created
    const items = await db.query.purchaseReturnItems.findMany({ where: eq(purchaseReturnItems.purchaseReturn, id) });
    if (items.length > 0) {
      const enriched = await Promise.all(
        items.map(async (item) => {
          const qty = parseFloat(item.quantity);
          const inv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, existing.shop)),
            columns: { quantity: true },
          });
          const qtyBefore = inv?.quantity ?? "0";
          const qtyAfter = String(parseFloat(qtyBefore) + qty);
          await db.insert(inventory)
            .values({ product: item.product, shop: existing.shop, quantity: item.quantity })
            .onConflictDoUpdate({
              target: [inventory.product, inventory.shop],
              set: { quantity: sql`${inventory.quantity} + ${qty}::numeric` },
            });
          return { ...item, qtyBefore, qtyAfter };
        })
      );
      await recordProductHistory(
        enriched.map((item) => ({
          product: item.product,
          shop: existing.shop,
          eventType: "purchase" as const,
          referenceId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityBefore: item.qtyBefore,
          quantityAfter: item.qtyAfter,
          note: "Purchase return deleted",
        }))
      );
    }

    await db.delete(purchaseReturns).where(eq(purchaseReturns.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
