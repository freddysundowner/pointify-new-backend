import { Router } from "express";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { purchases, purchaseItems, purchasePayments, batches, inventory, shops, products } from "@workspace/db";
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

    // Enrich purchase items with product names
    const allProductIds = [...new Set(
      rows.flatMap((r: any) => (r.purchaseItems ?? []).map((i: any) => i.product).filter(Boolean))
    )];
    let productMap: Record<number, any> = {};
    if (allProductIds.length > 0) {
      const productRows = await db.select({ id: products.id, name: products.name, sellingPrice: products.sellingPrice })
        .from(products)
        .where(sql`${products.id} = ANY(ARRAY[${sql.join(allProductIds.map((id: any) => sql`${id}`), sql`, `)}]::int[])`);
      productMap = Object.fromEntries(productRows.map(p => [p.id, p]));
    }
    const enrichedRows = rows.map((row: any) => ({
      ...row,
      purchaseItems: (row.purchaseItems ?? []).map((item: any) => ({
        ...item,
        product: productMap[item.product] ?? { id: item.product, name: `Product #${item.product}` },
      })),
    }));

    return paginated(res, enrichedRows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { shopId, supplierId, items, amountPaid, note, paymentType, trackBatches: trackBatchesBody } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");

    const sid = Number(shopId);

    // Resolve trackBatches: use the value from the request body if present,
    // otherwise fall back to the shop's configured setting.
    let shouldTrackBatches: boolean;
    if (trackBatchesBody !== undefined) {
      shouldTrackBatches = Boolean(trackBatchesBody);
    } else {
      const shopSettings = await db.query.shops.findFirst({
        where: eq(shops.id, sid),
        columns: { trackBatches: true },
      });
      shouldTrackBatches = shopSettings?.trackBatches ?? true;
    }
    await assertShopOwnership(req, sid);
    let totalAmount = 0;
    for (const item of items) totalAmount += (item.buyingPrice ?? 0) * (item.quantity ?? 1);

    const paid = amountPaid ?? 0;
    const outstanding = Math.max(0, totalAmount - paid);

    // Generate short purchase number: PUR-YYMMDD-NNNN (sequential per shop)
    const now = new Date();
    const datePart = now.getFullYear().toString().slice(-2)
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');
    const [{ total: shopPurchaseCount }] = await db
      .select({ total: count() })
      .from(purchases)
      .where(eq(purchases.shop, sid));
    const seq = String(Number(shopPurchaseCount) + 1).padStart(4, '0');
    const purchaseNo = `PUR-${datePart}-${seq}`;

    const [purchase] = await db.insert(purchases).values({
      shop: sid,
      supplier: supplierId ? Number(supplierId) : null,
      totalAmount: String(totalAmount),
      amountPaid: String(paid),
      outstandingBalance: String(outstanding),
      paymentType: paymentType ?? "cash",
      purchaseNo,
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

        // Create a batch for this stock lot — only when batch tracking is enabled
        let batch: typeof batches.$inferSelect | undefined;
        if (shouldTrackBatches) {
          const [inserted] = await db.insert(batches).values({
            product: itemRow.product,
            shop: sid,
            buyingPrice: buyPrice,
            quantity: qty,
            totalQuantity: qty,
            expirationDate: item.expiryDate ? new Date(item.expiryDate) : null,
            batchCode: item.batchCode ?? null,
          }).onConflictDoNothing().returning();
          batch = inserted;

          // Link batch back to the purchase item (if batch was created)
          if (batch) {
            await db.update(purchaseItems)
              .set({ batch: batch.id })
              .where(eq(purchaseItems.id, itemRow.id));
          }
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
      with: {
        purchaseItems: true,
        purchasePayments: true,
      },
    });
    if (!purchase) throw notFound("Purchase not found");

    // Enrich purchase items with product names
    const productIds = [...new Set((purchase.purchaseItems ?? []).map((i: any) => i.product).filter(Boolean))];
    let productMap: Record<number, any> = {};
    if (productIds.length > 0) {
      const productRows = await db.select({ id: products.id, name: products.name, sellingPrice: products.sellingPrice })
        .from(products)
        .where(sql`${products.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
      productMap = Object.fromEntries(productRows.map(p => [p.id, p]));
    }

    const enrichedItems = (purchase.purchaseItems ?? []).map((item: any) => ({
      ...item,
      product: productMap[item.product] ?? { id: item.product, name: `Product #${item.product}` },
    }));

    return ok(res, { ...purchase, purchaseItems: enrichedItems });
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.purchases.findFirst({ where: eq(purchases.id, id), columns: { shop: true, amountPaid: true } });
    if (!existing) throw notFound("Purchase not found");
    await assertShopOwnership(req, existing.shop);

    const { supplierId, paymentType, items, notes } = req.body;

    // Recalculate totals from items
    const totalAmount = (items ?? []).reduce(
      (sum: number, it: any) => sum + parseFloat(String(it.quantity ?? 1)) * parseFloat(String(it.unitPrice ?? 0)), 0
    );
    const amountPaid = parseFloat(String(existing.amountPaid ?? 0));
    const outstandingBalance = Math.max(0, totalAmount - amountPaid);

    // Update purchase header
    const [updated] = await db.update(purchases)
      .set({
        supplier: supplierId ? Number(supplierId) : null,
        paymentType: paymentType ?? "cash",
        totalAmount: String(totalAmount),
        outstandingBalance: String(outstandingBalance),
      })
      .where(eq(purchases.id, id))
      .returning();
    if (!updated) throw notFound("Purchase not found");

    // Replace purchase items: delete old ones, insert new
    if (Array.isArray(items) && items.length > 0) {
      await db.delete(purchaseItems).where(eq(purchaseItems.purchase, id));
      await db.insert(purchaseItems).values(
        items.map((item: any) => ({
          purchase: id,
          shop: existing.shop,
          product: Number(item.productId),
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? 0),
          lineDiscount: "0",
        }))
      );
    }

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
