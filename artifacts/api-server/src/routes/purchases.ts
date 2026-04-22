import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { purchases, purchaseItems, purchasePayments } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifyPurchaseOrderToSupplier } from "../lib/emailEvents.js";

const router = Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const supplierId = req.query["supplierId"] ? Number(req.query["supplierId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(purchases.shop, shopId));
    if (supplierId) conditions.push(eq(purchases.supplier, supplierId));
    if (from) conditions.push(gte(purchases.createdAt, from));
    if (to) conditions.push(lte(purchases.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.purchases.findMany({
      where,
      limit,
      offset,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      with: { purchaseItems: true, purchasePayments: true },
    });
    const total = await db.$count(purchases, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { shopId, supplierId, items, amountPaid, note, paymentType } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");

    let totalAmount = 0;
    for (const item of items) totalAmount += (item.buyingPrice ?? 0) * (item.quantity ?? 1);

    const paid = amountPaid ?? 0;
    const outstanding = Math.max(0, totalAmount - paid);

    const [purchase] = await db.insert(purchases).values({
      shop: Number(shopId),
      supplier: supplierId ? Number(supplierId) : null,
      totalAmount: String(totalAmount),
      amountPaid: String(paid),
      outstandingBalance: String(outstanding),
      paymentType: paymentType ?? "cash",
      purchaseNo: `PUR${Date.now()}`,
      createdBy: req.attendant?.id ?? undefined,
    } as typeof purchases.$inferInsert).returning();

    const itemRows = await db.insert(purchaseItems).values(
      items.map((item: any) => ({
        purchase: purchase.id,
        shop: Number(shopId),
        product: Number(item.productId),
        receivedBy: req.attendant?.id ?? undefined,
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.buyingPrice ?? item.unitPrice ?? 0),
        lineDiscount: String(item.discount ?? 0),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        batchCode: item.batchCode ?? null,
      }))
    ).returning();

    if (paid > 0 && req.attendant) {
      await db.insert(purchasePayments).values({
        purchase: purchase.id,
        paidBy: req.attendant.id,
        amount: String(paid),
        balance: String(outstanding),
        paymentType: paymentType ?? "cash",
      });
    }

    void notifyPurchaseOrderToSupplier(purchase.id);
    return created(res, { ...purchase, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const purchase = await db.query.purchases.findFirst({
      where: eq(purchases.id, Number(req.params["id"])),
      with: { purchaseItems: true, purchasePayments: true },
    });
    if (!purchase) throw notFound("Purchase not found");
    return ok(res, purchase);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [updated] = await db.update(purchases)
      .set({ ...(req.body.note !== undefined && { note: req.body.note }) })
      .where(eq(purchases.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Purchase not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(purchases).where(eq(purchases.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Purchase not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/:id/payments", requireAdmin, async (req, res, next) => {
  try {
    const { amount, method } = req.body;
    if (!amount || !method) throw badRequest("amount and method required");
    const purchaseId = Number(req.params["id"]);

    const purchase = await db.query.purchases.findFirst({ where: eq(purchases.id, purchaseId) });
    if (!purchase) throw notFound("Purchase not found");

    const paidById = req.attendant?.id ?? undefined;

    const newPaid = (parseFloat(purchase.amountPaid) + parseFloat(String(amount))).toFixed(2);
    const newOutstanding = Math.max(0, parseFloat(purchase.outstandingBalance) - parseFloat(String(amount)));

    const [payment] = await db.insert(purchasePayments).values({
      purchase: purchaseId,
      paidBy: paidById,
      amount: String(amount),
      balance: String(newOutstanding.toFixed(2)),
      paymentType: method ?? "cash",
    }).returning();

    await db.update(purchases).set({
      amountPaid: newPaid,
      outstandingBalance: String(newOutstanding.toFixed(2)),
    }).where(eq(purchases.id, purchaseId));

    return created(res, payment);
  } catch (e) { next(e); }
});

export default router;
