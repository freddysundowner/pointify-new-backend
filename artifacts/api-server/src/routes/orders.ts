import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { orders, orderItems, sales, saleItems, inventory } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifyOrderConfirmation, notifyOrderShipped, notifyOrderDelivered, notifyOrderCancelled, notifySaleReceipt } from "../lib/emailEvents.js";

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
    const [updated] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, Number(req.params["id"])))
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

      const itemRows = order.orderItems.length
        ? await tx.insert(saleItems).values(
            order.orderItems.map((item) => ({
              sale: sale.id,
              shop: order.shop,
              product: item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: "0",
              saleType: "Order",
              attendant: req.attendant?.id ?? undefined,
            })),
          ).returning()
        : [];

      for (const item of order.orderItems) {
        const existing = await tx.query.inventory.findFirst({
          where: and(eq(inventory.shop, order.shop), eq(inventory.product, item.product)),
        });
        if (!existing) continue;
        const newQty = parseFloat(existing.quantity ?? "0") - parseFloat(item.quantity);
        if (newQty < 0) {
          // eslint-disable-next-line no-console
          console.warn(`[orders.fulfill] inventory went negative for product=${item.product} shop=${order.shop} newQty=${newQty}`);
        }
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${item.quantity}` })
          .where(and(eq(inventory.shop, order.shop), eq(inventory.product, item.product)));
      }

      const [updated] = await tx.update(orders)
        .set({ status: "completed" })
        .where(eq(orders.id, orderId))
        .returning();

      return { order: updated, sale: { ...sale, items: itemRows } };
    });

    void notifySaleReceipt(result.sale.id);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(orders).where(eq(orders.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
