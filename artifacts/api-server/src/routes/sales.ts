import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { sales, saleItems, salePayments, products, inventory, customers } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

router.get("/cross-shop", requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const conditions: ReturnType<typeof eq>[] = [];
    if (from) conditions.push(gte(sales.createdAt, new Date(String(from))));
    if (to) conditions.push(lte(sales.createdAt, new Date(String(to))));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const result = await db.select({
      shopId: sales.shop,
      total: sql<string>`SUM(${sales.totalAmount})`,
      count: sql<number>`COUNT(*)`,
    }).from(sales).where(where).groupBy(sales.shop);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const customerId = req.query["customerId"] ? Number(req.query["customerId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (customerId) conditions.push(eq(sales.customer, customerId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.sales.findMany({
      where,
      limit,
      offset,
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      with: { saleItems: true, salePayments: true },
    });
    const total = await db.$count(sales, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const {
      shopId, customerId, items, paymentMethod, amountPaid, discount, note, saleType,
    } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.price ?? 0) * (item.quantity ?? 1);
    }
    const saleDiscount = discount ?? 0;
    const totalWithDiscount = totalAmount - saleDiscount;
    const paid = amountPaid ?? totalWithDiscount;
    const outstanding = Math.max(0, totalWithDiscount - paid);

    const receiptNo = `REC${Date.now()}`;

    const [sale] = await db.insert(sales).values({
      shop: Number(shopId),
      customer: customerId ? Number(customerId) : null,
      totalAmount: String(totalAmount),
      totalWithDiscount: String(totalWithDiscount),
      totalTax: "0",
      saleDiscount: String(saleDiscount),
      amountPaid: String(paid),
      outstandingBalance: String(outstanding),
      saleType: saleType ?? "Retail",
      paymentType: paymentMethod ?? "cash",
      status: outstanding > 0 ? "credit" : "cashed",
      saleNote: note,
      receiptNo,
      attendant: req.attendant?.id ?? undefined,
    } as typeof sales.$inferInsert).returning();

    const itemRows = await db.insert(saleItems).values(
      items.map((item: any) => ({
        sale: sale.id,
        shop: Number(shopId),
        product: Number(item.productId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? item.price ?? 0),
        costPrice: String(item.costPrice ?? 0),
        lineDiscount: String(item.discount ?? 0),
        saleType: item.saleType ?? saleType ?? "Retail",
        attendant: req.attendant?.id ?? undefined,
      }))
    ).returning();

    if (paid > 0 && req.attendant) {
      await db.insert(salePayments).values({
        sale: sale.id,
        receivedBy: req.attendant.id,
        amount: String(paid),
        balance: String(outstanding),
        paymentType: paymentMethod ?? "cash",
      });
    }

    return created(res, { ...sale, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, Number(req.params["id"])),
      with: { saleItems: true, salePayments: true },
    });
    if (!sale) throw notFound("Sale not found");
    return ok(res, sale);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { note, discount } = req.body;
    const [updated] = await db.update(sales).set({
      ...(note !== undefined && { saleNote: note }),
      ...(discount !== undefined && { saleDiscount: String(discount) }),
    }).where(eq(sales.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Sale not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [updated] = await db.update(sales)
      .set({ status: "voided" })
      .where(eq(sales.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Sale not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/:id/void", requireAdmin, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const [updated] = await db.update(sales)
      .set({ status: "voided" })
      .where(eq(sales.id, saleId))
      .returning();
    if (!updated) throw notFound("Sale not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/:id/refund", requireAdmin, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!sale) throw notFound("Sale not found");

    const [updated] = await db.update(sales)
      .set({ status: "refunded" })
      .where(eq(sales.id, saleId))
      .returning();
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/:id/payments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { amount, method, reference } = req.body;
    if (!amount || !method) throw badRequest("amount and method required");
    const saleId = Number(req.params["id"]);

    const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!sale) throw notFound("Sale not found");

    const payerId = req.attendant?.id ?? undefined;

    const newPaid = (parseFloat(sale.amountPaid) + parseFloat(String(amount))).toFixed(2);
    const newOutstanding = Math.max(0, parseFloat(sale.outstandingBalance) - parseFloat(String(amount)));

    const [payment] = await db.insert(salePayments).values({
      sale: saleId,
      receivedBy: payerId,
      amount: String(amount),
      balance: String(newOutstanding.toFixed(2)),
      paymentType: method,
      paymentReference: reference,
    }).returning();

    await db.update(sales).set({
      amountPaid: newPaid,
      outstandingBalance: String(newOutstanding.toFixed(2)),
      status: newOutstanding <= 0 ? "cashed" : "credit",
    }).where(eq(sales.id, saleId));

    return created(res, payment);
  } catch (e) { next(e); }
});

export default router;
