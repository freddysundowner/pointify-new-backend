import { Router } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { orders, orderItems, sales, saleItems, inventory, products } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifyOrderConfirmation, notifyOrderShipped, notifyOrderDelivered, notifyOrderCancelled, notifySaleReceipt } from "../lib/emailEvents.js";
import { notifySaleReceiptSms } from "../lib/smsEvents.js";
import { recordProductHistory } from "../lib/product-history.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const status = req.query["status"] ? String(req.query["status"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(orders.shop, shopId));
    if (status) conditions.push(eq(orders.status, status));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.orders.findMany({
      where,
      limit,
      offset,
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      with: { orderItems: true },
    });
    const total = await db.$count(orders, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, customerId, items, note } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const [order] = await db.insert(orders).values({
      shop: Number(shopId),
      customer: customerId ? Number(customerId) : null,
      attendant: req.attendant?.id ?? undefined,
      orderNote: note,
      orderNo: `ORD${Date.now()}`,
    }).returning();

    const itemRows = await db.insert(orderItems).values(
      items.map((item: any) => ({
        order: order.id,
        product: Number(item.productId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.price ?? 0),
      }))
    ).returning();

    void notifyOrderConfirmation(order.id);
    return created(res, { ...order, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, Number(req.params["id"])),
      with: { orderItems: true },
    });
    if (!order) throw notFound("Order not found");
    return ok(res, order);
  } catch (e) { next(e); }
});

router.put("/:id/status", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw badRequest("status required");
    const id = Number(req.params["id"]);
    const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Order not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw notFound("Order not found");
    if (status === "shipped") void notifyOrderShipped(updated.id, req.body?.shipping ?? {});
    else if (status === "delivered" || status === "completed") void notifyOrderDelivered(updated.id);
    else if (status === "cancelled") void notifyOrderCancelled(updated.id, req.body?.reason ?? "—");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/:id/fulfill", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const orderId = Number(req.params["id"]);
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { orderItems: true },
    });
    if (!order) throw notFound("Order not found");
    await assertShopOwnership(req, order.shop);
    if (order.status === "completed") throw badRequest("Order already fulfilled");

    let totalAmount = 0;
    for (const item of order.orderItems) {
      totalAmount += parseFloat(item.unitPrice) * parseFloat(item.quantity);
    }

    const receiptNo = `REC${Date.now()}`;

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values({
        shop: order.shop,
        customer: order.customer ?? null,
        attendant: req.attendant?.id ?? order.attendant ?? null,
        order: order.id,
        totalAmount: String(totalAmount.toFixed(2)),
        totalWithDiscount: String(totalAmount.toFixed(2)),
        totalTax: "0",
        saleDiscount: "0",
        amountPaid: String(totalAmount.toFixed(2)),
        outstandingBalance: "0",
        saleType: "Order",
        paymentType: "cash",
        status: "cashed",
        receiptNo,
      } as typeof sales.$inferInsert).returning();

      const productIds = order.orderItems.map((i) => i.product);
      const productRows = productIds.length
        ? await tx.query.products.findMany({
            where: inArray(products.id, productIds),
            columns: { id: true, buyingPrice: true },
          })
        : [];
      const costByProduct = new Map(productRows.map((p) => [p.id, p.buyingPrice ?? "0"]));

      const itemRows = order.orderItems.length
        ? await tx.insert(saleItems).values(
            order.orderItems.map((item) => ({
              sale: sale.id,
              shop: order.shop,
              product: item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: costByProduct.get(item.product) ?? "0",
              saleType: "Order",
              attendant: req.attendant?.id ?? undefined,
            })),
          ).returning()
        : [];

      const historyEntries: any[] = [];
      for (let idx = 0; idx < order.orderItems.length; idx++) {
        const item = order.orderItems[idx];
        const existing = await tx.query.inventory.findFirst({
          where: and(eq(inventory.shop, order.shop), eq(inventory.product, item.product)),
        });
        if (!existing) continue;
        const qtyBefore = existing.quantity ?? "0";
        const qtyAfter = String(Math.max(0, parseFloat(qtyBefore) - parseFloat(item.quantity)));
        await tx.update(inventory)
          .set({ quantity: sql`GREATEST(0, ${inventory.quantity} - ${item.quantity}::numeric)` })
          .where(and(eq(inventory.shop, order.shop), eq(inventory.product, item.product)));
        historyEntries.push({
          product: item.product,
          shop: order.shop,
          eventType: "sale" as const,
          referenceId: itemRows[idx]?.id ?? 0,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
        });
      }

      const [updated] = await tx.update(orders)
        .set({ status: "completed" })
        .where(eq(orders.id, orderId))
        .returning();

      return { order: updated, sale: { ...sale, items: itemRows }, historyEntries };
    });

    if (result.historyEntries.length > 0) {
      void recordProductHistory(result.historyEntries);
    }
    void notifySaleReceipt(result.sale.id);
    void notifySaleReceiptSms(result.sale.id);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { shop: true, status: true } });
    if (!existing) throw notFound("Order not found");
    await assertShopOwnership(req, existing.shop);

    // Restore inventory if the order was already fulfilled
    if (existing.status === "completed") {
      const orderItemRows = await db.query.orderItems.findMany({ where: eq(orderItems.order, id) });
      if (orderItemRows.length > 0) {
        const historyEntries: any[] = [];
        await Promise.all(
          orderItemRows.map(async (item) => {
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
            historyEntries.push({
              product: item.product,
              shop: existing.shop,
              eventType: "adjustment" as const,
              referenceId: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
            });
          })
        );
        await recordProductHistory(historyEntries);
      }
    }

    await db.delete(orders).where(eq(orders.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
