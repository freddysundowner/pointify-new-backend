import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { orders, orderItems } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

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
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(orders).where(eq(orders.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
