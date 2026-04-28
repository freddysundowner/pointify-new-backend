import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { purchases, purchaseItems, purchasePayments, batches, inventory } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifyPurchaseOrderToSupplier } from "../lib/emailEvents.js";
import { recordProductHistory } from "../lib/product-history.js";
import { autoRecordCashflow } from "../lib/auto-cashflow.js";

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

    const sid = Number(shopId);
    await assertShopOwnership(req, sid);
    let totalAmount = 0;
    for (const item of items) totalAmount += (item.buyingPrice ?? 0) * (item.quantity ?? 1);

    const paid = amountPaid ?? 0;
    const outstanding = Math.max(0, totalAmount - paid);

    const [purchase] = await db.insert(purchases).values({
      shop: sid,
      supplier: supplierId ? Number(supplierId) : null,
      totalAmount: String(totalAmount),
      amountPaid: String(paid),
      outstandingBalance: String(outstanding),
      paymentType: paymentType ?? "cash",
      purchaseNo: `PUR${Date.now()}`,
      createdBy: req.attendant?.id ?? undefined,
    } as typeof purchases.$inferInsert).returning();

    // Insert purchase items (without batch link yet)
    const itemRows = await db.insert(purchaseItems).values(
      items.map((item: any) => ({
        purchase: purchase.id,
        shop: sid,
        product: Number(item.productId),
        receivedBy: req.attendant?.id ?? undefined,
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.buyingPrice ?? item.unitPrice ?? 0),
        lineDiscount: String(item.discount ?? 0),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        batchCode: item.batchCode ?? null,
      }))
    ).returning();

    // For each item: create a batch row and upsert inventory
    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow, i) => {
        const item = items[i];
        const qty = String(item.quantity ?? 1);
        const buyPrice = String(item.buyingPrice ?? item.unitPrice ?? 0);

        // Read existing inventory quantity BEFORE the upsert so we can record before/after
        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, itemRow.product), eq(inventory.shop, sid)),
          columns: { quantity: true },
        });
        const qtyBefore = existing ? String(existing.quantity) : "0";
        const qtyAfter  = String(parseFloat(qtyBefore) + parseFloat(qty));

        // Create a batch for this stock lot
        const [batch] = await db.insert(batches).values({
          product: itemRow.product,
          shop: sid,
          buyingPrice: buyPrice,
          quantity: qty,
          totalQuantity: qty,
          expirationDate: item.expiryDate ? new Date(item.expiryDate) : null,
          batchCode: item.batchCode ?? null,
        }).onConflictDoNothing().returning();

        // Link batch back to the purchase item (if batch was created)
        if (batch) {
          await db.update(purchaseItems)
            .set({ batch: batch.id })
            .where(eq(purchaseItems.id, itemRow.id));
        }

        // Upsert inventory: add received quantity (create row with qty if new)
        await db.insert(inventory)
          .values({ product: itemRow.product, shop: sid, quantity: qty })
          .onConflictDoUpdate({
            target: [inventory.product, inventory.shop],
            set: {
              quantity: sql`${inventory.quantity} + ${qty}::numeric`,
              status: sql`CASE
                WHEN ${inventory.quantity} + ${qty}::numeric <= 0 THEN 'out_of_stock'
                WHEN ${inventory.quantity} + ${qty}::numeric <= ${inventory.reorderLevel} THEN 'low'
                ELSE 'active'
              END`,
            },
          });

        return { ...itemRow, batchId: batch?.id ?? null, qtyBefore, qtyAfter };
      })
    );

    if (paid > 0 && req.attendant) {
      await db.insert(purchasePayments).values({
        purchase: purchase.id,
        paidBy: req.attendant.id,
        amount: String(paid),
        balance: String(outstanding),
        paymentType: paymentType ?? "cash",
      });
    }

    await recordProductHistory(
      enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: sid,
        eventType: "purchase" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.qtyBefore,
        quantityAfter: itemRow.qtyAfter,
        note: purchase.purchaseNo,
      }))
    );
    void notifyPurchaseOrderToSupplier(purchase.id);
    void autoRecordCashflow({
      shopId: sid,
      amount: totalAmount,
      description: `Purchase ${purchase.purchaseNo}`,
      categoryKey: "purchase",
      recordedBy: req.attendant?.id,
    });
    return created(res, { ...purchase, items: enrichedItems });
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
    const id = Number(req.params["id"]);
    const existing = await db.query.purchases.findFirst({ where: eq(purchases.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Purchase not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(purchases)
      .set({ ...(req.body.note !== undefined && { note: req.body.note }) })
      .where(eq(purchases.id, id))
      .returning();
    if (!updated) throw notFound("Purchase not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.purchases.findFirst({ where: eq(purchases.id, id), columns: { shop: true, totalAmount: true, purchaseNo: true } });
    if (!existing) throw notFound("Purchase not found");
    await assertShopOwnership(req, existing.shop);

    // Reverse inventory for all items received in this purchase
    const purchItems = await db.query.purchaseItems.findMany({ where: eq(purchaseItems.purchase, id) });
    if (purchItems.length > 0) {
      const enriched = await Promise.all(
        purchItems.map(async (item) => {
          const qty = parseFloat(item.quantity);
          const inv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, item.shop)),
            columns: { quantity: true },
          });
          const qtyBefore = inv?.quantity ?? "0";
          const qtyAfter = String(Math.max(0, parseFloat(qtyBefore) - qty));
          await db.update(inventory)
            .set({ quantity: qtyAfter })
            .where(and(eq(inventory.product, item.product), eq(inventory.shop, item.shop)));
          return { ...item, qtyBefore, qtyAfter };
        })
      );
      await recordProductHistory(
        enriched.map((item) => ({
          product: item.product,
          shop: item.shop,
          eventType: "purchase_return" as const,
          referenceId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityBefore: item.qtyBefore,
          quantityAfter: item.qtyAfter,
          note: "Purchase deleted",
        }))
      );
    }

    const [deleted] = await db.delete(purchases).where(eq(purchases.id, id)).returning();
    if (!deleted) throw notFound("Purchase not found");

    const purchTotal = parseFloat(String(existing.totalAmount ?? "0"));
    void autoRecordCashflow({
      shopId: existing.shop,
      amount: purchTotal,
      description: `Purchase Deleted ${existing.purchaseNo ?? id}`,
      categoryKey: "purchase_reversal",
      recordedBy: (req as any).attendant?.id,
    });

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
    await assertShopOwnership(req, purchase.shop);

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
