import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { saleReturns, saleReturnItems, sales, inventory, admins, attendants } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifySaleRefund } from "../lib/emailEvents.js";
import { recordProductHistory } from "../lib/product-history.js";
import { autoRecordCashflow } from "../lib/auto-cashflow.js";

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
      with: {
        saleReturnItems: true,
        processedBy: { columns: { id: true, username: true } },
        customer: { columns: { id: true, name: true } },
        shop: { columns: { id: true }, with: { admin: { columns: { id: true, username: true, attendant: true } } } },
      },
    });

    // For returns where processedBy is null, inject the shop admin's username as fallback
    const enriched = rows.map((r: any) => {
      if (!r.processedBy && r.shop?.admin) {
        return { ...r, processedBy: { id: null, username: r.shop.admin.username ?? "Admin" } };
      }
      return r;
    });

    const total = await db.$count(saleReturns, where);
    return paginated(res, enriched, { total, page, limit });
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

    // Resolve who processed this return — attendant or admin's auto-attendant
    let processedById: number | undefined = req.attendant?.id;
    if (!processedById && req.admin) {
      const adminRecord = await db.query.admins.findFirst({
        where: eq(admins.id, req.admin.id),
        columns: { id: true, attendant: true, username: true },
      });
      if (adminRecord?.attendant) {
        processedById = adminRecord.attendant;
      } else if (adminRecord) {
        // Auto-create an attribution attendant for this admin
        const [newAtt] = await db.insert(attendants).values({
          username: adminRecord.username ?? "Admin",
          admin: adminRecord.id,
          shop: Number(shopId),
        }).returning({ id: attendants.id });
        await db.update(admins).set({ attendant: newAtt.id }).where(eq(admins.id, adminRecord.id));
        processedById = newAtt.id;
      }
    }

    const [saleReturn] = await db.insert(saleReturns).values({
      sale: Number(saleId),
      shop: Number(shopId),
      refundAmount: String(refundAmount),
      reason,
      refundMethod: refundMethod ?? "cash",
      processedBy: processedById,
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
    // Mark the sale as fully returned if cumulative refunds cover the original total
    const [{ cumulativeRefunds }] = await db.select({
      cumulativeRefunds: sql<string>`COALESCE(SUM(${saleReturns.refundAmount}::numeric), 0)`,
    }).from(saleReturns).where(eq(saleReturns.sale, Number(saleId)));
    if (parseFloat(cumulativeRefunds) >= parseFloat(sale.totalWithDiscount)) {
      await db.update(sales).set({ status: "returned" }).where(eq(sales.id, Number(saleId)));
    }

    void notifySaleRefund(saleReturn.id);
    void autoRecordCashflow({
      shopId: Number(shopId),
      amount: refundAmount,
      description: `Sale Return ${sale.receiptNo ?? saleId}`,
      categoryKey: "sale_return",
      recordedBy: req.attendant?.id,
    });
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

    // Re-deduct inventory that was credited when the return was created
    const items = await db.query.saleReturnItems.findMany({ where: eq(saleReturnItems.saleReturn, id) });
    if (items.length > 0) {
      const enriched = await Promise.all(
        items.map(async (item) => {
          const qty = parseFloat(item.quantity);
          const inv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, existing.shop)),
            columns: { quantity: true },
          });
          const qtyBefore = inv?.quantity ?? "0";
          const qtyAfter = String(Math.max(0, parseFloat(qtyBefore) - qty));
          await db.update(inventory)
            .set({ quantity: qtyAfter })
            .where(and(eq(inventory.product, item.product), eq(inventory.shop, existing.shop)));
          return { ...item, qtyBefore, qtyAfter };
        })
      );
      await recordProductHistory(
        enriched.map((item) => ({
          product: item.product,
          shop: existing.shop,
          eventType: "adjustment" as const,
          referenceId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityBefore: item.qtyBefore,
          quantityAfter: item.qtyAfter,
          note: "Sale return deleted",
        }))
      );
    }

    await db.delete(saleReturns).where(eq(saleReturns.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
