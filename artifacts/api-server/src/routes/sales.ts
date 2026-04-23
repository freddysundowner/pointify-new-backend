import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { sales, saleItems, salePayments, products, inventory, customers, paymentMethods, batches, saleItemBatches } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifySaleReceipt } from "../lib/emailEvents.js";
import { notifySaleReceiptSms } from "../lib/smsEvents.js";

const router = Router();

// Resolve a free-form payment-method label to a row in the global
// payment_methods catalog. Case-insensitive match on `name`. Throws 400
// if the method is unknown or inactive — keeps sales.paymentType /
// sale_payments.paymentType honest and consistent across reports.
async function resolvePaymentMethodName(input: string | undefined | null): Promise<string> {
  const wanted = (input ?? "Cash").trim();
  if (!wanted) throw badRequest("paymentMethod required");
  const row = await db.query.paymentMethods.findFirst({
    where: and(eq(sql`lower(${paymentMethods.name})`, wanted.toLowerCase()), eq(paymentMethods.isActive, true)),
  });
  if (!row) {
    const active = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.isActive, true),
      columns: { name: true },
    });
    throw badRequest(`unknown payment method "${wanted}". allowed: ${active.map((m) => m.name).join(", ")}`);
  }
  return row.name;
}

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
    await assertShopOwnership(req, Number(shopId));

    const methodName = await resolvePaymentMethodName(paymentMethod);

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
      paymentType: methodName,
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

    // Deduct inventory and consume batches (FEFO) for each sold item
    await Promise.all(
      itemRows.map(async (itemRow, i) => {
        const item = items[i];
        const soldQty = Number(item.quantity ?? 1);
        const productId = Number(item.productId);
        const sid = Number(shopId);

        // Deduct from inventory (floor at 0 to avoid negative stock)
        await db.update(inventory)
          .set({
            quantity: sql`GREATEST(0, ${inventory.quantity} - ${soldQty}::numeric)`,
            status: sql`CASE
              WHEN GREATEST(0, ${inventory.quantity} - ${soldQty}::numeric) <= 0 THEN 'out_of_stock'
              WHEN GREATEST(0, ${inventory.quantity} - ${soldQty}::numeric) <= ${inventory.reorderLevel} THEN 'low'
              ELSE 'active'
            END`,
          })
          .where(and(eq(inventory.product, productId), eq(inventory.shop, sid)));

        // Consume batches FEFO (earliest expiry first, then oldest by created_at)
        const availableBatches = await db.query.batches.findMany({
          where: and(eq(batches.product, productId), eq(batches.shop, sid)),
          orderBy: (b, { asc }) => [
            sql`${b.expirationDate} IS NULL`,   // nulls last
            asc(b.expirationDate),
            asc(b.createdAt),
          ],
        });

        let remaining = soldQty;
        for (const batch of availableBatches) {
          if (remaining <= 0) break;
          const available = Number(batch.quantity);
          if (available <= 0) continue;
          const taken = Math.min(remaining, available);
          remaining -= taken;

          await db.update(batches)
            .set({ quantity: sql`GREATEST(0, ${batches.quantity} - ${taken}::numeric)` })
            .where(eq(batches.id, batch.id));

          await db.insert(saleItemBatches).values({
            saleItem: itemRow.id,
            batch: batch.id,
            quantityTaken: String(taken),
          });
        }
      })
    );

    if (paid > 0 && req.attendant) {
      await db.insert(salePayments).values({
        sale: sale.id,
        receivedBy: req.attendant.id,
        amount: String(paid),
        balance: String(outstanding),
        paymentType: methodName,
      });
    }

    void notifySaleReceipt(sale.id);
    void notifySaleReceiptSms(sale.id);
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

    const methodName = await resolvePaymentMethodName(method);
    const payerId = req.attendant?.id ?? undefined;

    const newPaid = (parseFloat(sale.amountPaid) + parseFloat(String(amount))).toFixed(2);
    const newOutstanding = Math.max(0, parseFloat(sale.outstandingBalance) - parseFloat(String(amount)));

    const [payment] = await db.insert(salePayments).values({
      sale: saleId,
      receivedBy: payerId,
      amount: String(amount),
      balance: String(newOutstanding.toFixed(2)),
      paymentType: methodName,
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
