import { Router } from "express";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { sales, saleItems, salePayments, products, inventory, customers, paymentMethods, batches, saleItemBatches, shops, loyaltyTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifySaleReceipt } from "../lib/emailEvents.js";
import { notifySaleReceiptSms } from "../lib/smsEvents.js";
import { sendRawEmail } from "../lib/email.js";
import { recordProductHistory } from "../lib/product-history.js";

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

router.post("/email-receipt", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { toEmail, receiptHtml, receiptNo, shopName, shopEmail, customerName, pdfBase64 } = req.body;
    if (!toEmail || !receiptHtml) {
      return res.status(400).json({ success: false, error: "toEmail and receiptHtml are required" });
    }
    const attachments = pdfBase64
      ? [{ content: pdfBase64, name: `receipt-${receiptNo || "sale"}.pdf`, type: "application/pdf" }]
      : [];
    const subject = shopName
      ? `Your receipt from ${shopName}${receiptNo ? ` — #${receiptNo}` : ""}`
      : `Your receipt${receiptNo ? ` — #${receiptNo}` : ""}`;
    const result = await sendRawEmail({
      to: toEmail,
      name: customerName || undefined,
      subject,
      html: receiptHtml,
      attachments,
    });
    if (result.ok) {
      return res.json({ success: true });
    }
    return res.status(500).json({ success: false, error: result.error || result.skipped || "Failed to send email" });
  } catch (e) { next(e); }
});

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
    const status = req.query["status"] ? String(req.query["status"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    // Attendants can only see their own sales — admins see all.
    if (req.attendant) {
      conditions.push(eq(sales.attendant, req.attendant.id));
      conditions.push(eq(sales.shop, req.attendant.shopId));
    } else {
      if (shopId) conditions.push(eq(sales.shop, shopId));
    }
    if (customerId) conditions.push(eq(sales.customer, customerId));
    if (status) conditions.push(eq(sales.status, status));
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
      dueDate,       // when the credit payment is expected (ISO string)
      saleDate,      // backdate the sale to this date (ISO string)
      payments,      // [{method, amount}] for split payment — overrides paymentMethod/amountPaid
      held,          // true → create a held/tab sale (inventory NOT deducted yet)
      redeemPoints,  // number of loyalty points to redeem as a discount on this sale
    } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    // ── Resolve payment details ─────────────────────────────────────────────
    type ResolvedPayment = { methodName: string; amount: number };
    let resolvedPayments: ResolvedPayment[] = [];

    if (!held && (!Array.isArray(payments) || payments.length === 0)) {
      // Single-method path (backward compat)
      const mn = await resolvePaymentMethodName(paymentMethod);
      resolvedPayments = [{ methodName: mn, amount: -1 }]; // placeholder, resolved below
    } else if (!held && Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        const mn = await resolvePaymentMethodName(p.method);
        const amt = parseFloat(String(p.amount ?? 0));
        if (amt < 0) throw badRequest("Payment amount cannot be negative");
        resolvedPayments.push({ methodName: mn, amount: amt });
      }
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.price ?? 0) * (item.quantity ?? 1);
    }
    const saleDiscount = discount ?? 0;
    let totalWithDiscount = totalAmount - saleDiscount;

    // ── Loyalty point redemption ────────────────────────────────────────────
    let pointsRedeemed = 0;
    let loyaltyDiscount = 0;
    if (!held && redeemPoints && redeemPoints > 0 && customerId) {
      const shop = await db.query.shops.findFirst({
        where: eq(shops.id, Number(shopId)),
        columns: { loyaltyEnabled: true, pointsValue: true },
      });
      if (shop?.loyaltyEnabled && parseFloat(String(shop.pointsValue ?? 0)) > 0) {
        const cust = await db.query.customers.findFirst({
          where: eq(customers.id, Number(customerId)),
          columns: { loyaltyPoints: true },
        });
        const availablePoints = parseFloat(String(cust?.loyaltyPoints ?? 0));
        if (redeemPoints > availablePoints) throw badRequest(`Insufficient loyalty points. Available: ${availablePoints}`);
        pointsRedeemed = redeemPoints;
        loyaltyDiscount = pointsRedeemed * parseFloat(String(shop.pointsValue));
        totalWithDiscount = Math.max(0, totalWithDiscount - loyaltyDiscount);
      }
    }

    // Finalise "paid" amount
    let paid = 0;
    if (held) {
      paid = 0; // held sales collect payment on checkout
    } else if (resolvedPayments.length === 1 && resolvedPayments[0]!.amount === -1) {
      // Single-method: use amountPaid or default to full
      paid = amountPaid !== undefined ? Math.max(0, parseFloat(String(amountPaid))) : totalWithDiscount;
      resolvedPayments[0]!.amount = paid;
    } else {
      paid = resolvedPayments.reduce((s, p) => s + p.amount, 0);
    }
    const outstanding = held ? totalWithDiscount : Math.max(0, totalWithDiscount - paid);

    // ── Credit sale validation ──────────────────────────────────────────────
    if (!held && outstanding > 0) {
      if (!customerId) throw badRequest("Credit sales require a customer");

      const cust = await db.query.customers.findFirst({
        where: eq(customers.id, Number(customerId)),
        columns: { creditLimit: true },
      });
      if (cust?.creditLimit) {
        const limit = parseFloat(String(cust.creditLimit));
        const [{ existingDebt }] = await db.select({
          existingDebt: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        }).from(sales).where(
          and(
            eq(sales.customer, Number(customerId)),
            sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`,
          )
        );
        const totalAfter = parseFloat(existingDebt ?? "0") + outstanding;
        if (totalAfter > limit)
          throw badRequest(`Credit limit of ${limit} exceeded. Current debt: ${existingDebt}, this sale adds: ${outstanding.toFixed(2)}`);
      }
    }

    // ── Payment type label and cached method totals ─────────────────────────
    const paymentTypeLabel = held ? "cash"
      : resolvedPayments.length > 1 ? "split"
      : resolvedPayments[0]?.methodName ?? "cash";

    const mpesaAmt = resolvedPayments.filter(p => /mpesa|m-pesa/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);
    const bankAmt  = resolvedPayments.filter(p => /bank|transfer/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);
    const cardAmt  = resolvedPayments.filter(p => /card/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);

    const saleStatus = held ? "held" : outstanding > 0 ? "credit" : "cashed";

    const [sale] = await db.insert(sales).values({
      shop: Number(shopId),
      customer: customerId ? Number(customerId) : null,
      totalAmount: String(totalAmount),
      totalWithDiscount: String(totalWithDiscount),
      totalTax: "0",
      saleDiscount: String(saleDiscount),
      amountPaid: String(paid.toFixed(2)),
      mpesaTotal: String(mpesaAmt.toFixed(2)),
      bankTotal:  String(bankAmt.toFixed(2)),
      cardTotal:  String(cardAmt.toFixed(2)),
      outstandingBalance: String(outstanding.toFixed(2)),
      saleType: saleType ?? "Retail",
      paymentType: paymentTypeLabel,
      status: saleStatus,
      saleNote: note,
      dueDate: !held && outstanding > 0 && dueDate ? new Date(dueDate) : null,
      attendant: req.attendant?.id ?? undefined,
      ...(saleDate ? { createdAt: new Date(saleDate) } : {}),
    } as typeof sales.$inferInsert).returning();

    // Generate a short, human-readable receipt number from the real DB ID
    const receiptNo = `S-${String(sale.id).padStart(5, "0")}`;
    await db.update(sales).set({ receiptNo }).where(eq(sales.id, sale.id));
    sale.receiptNo = receiptNo;

    // Keep customer.outstandingBalance in sync when a credit sale is created
    if (!held && outstanding > 0 && customerId) {
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric + ${outstanding}::numeric)` })
        .where(eq(customers.id, Number(customerId)));
    }

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

    // Held sales skip inventory deduction — items are reserved when checking out
    if (!held) {
      // Fetch product types so service/virtual items skip inventory
      const allProductIds = itemRows.map((r) => r.product).filter((x): x is number => !!x);
      const productTypeRows = allProductIds.length
        ? await db.query.products.findMany({ where: inArray(products.id, allProductIds), columns: { id: true, type: true } })
        : [];
      const productTypeMap = new Map(productTypeRows.map((p) => [p.id, p.type ?? "product"]));

      const invSnapshots = new Map<number, string>();
      await Promise.all(
        itemRows.map(async (itemRow, i) => {
          const item = items[i];
          const soldQty = Number(item.quantity ?? 1);
          const productId = Number(item.productId);
          const sid = Number(shopId);

          // Service and virtual products have no physical stock — skip inventory
          const pType = productTypeMap.get(productId) ?? "product";
          if (pType === "service" || pType === "virtual") return;

          const existingInv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, productId), eq(inventory.shop, sid)),
            columns: { quantity: true },
          });
          invSnapshots.set(productId, existingInv ? String(existingInv.quantity) : "0");

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

          const availableBatches = await db.query.batches.findMany({
            where: and(eq(batches.product, productId), eq(batches.shop, sid)),
            orderBy: (b, { asc }) => [
              sql`${b.expirationDate} IS NULL`,
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

      // Insert a salePayments row for each payment method
      for (const p of resolvedPayments) {
        if (p.amount > 0 && req.attendant) {
          await db.insert(salePayments).values({
            sale: sale.id,
            receivedBy: req.attendant.id,
            amount: String(p.amount.toFixed(2)),
            balance: String(outstanding.toFixed(2)),
            paymentType: p.methodName,
          });
        }
      }

      await recordProductHistory(
        itemRows
          .filter((itemRow) => {
            const pType = productTypeMap.get(itemRow.product) ?? "product";
            return pType !== "service" && pType !== "virtual";
          })
          .map((itemRow) => {
            const qtyBefore = invSnapshots.get(itemRow.product) ?? "0";
            const qtyAfter  = String(Math.max(0, parseFloat(qtyBefore) - parseFloat(itemRow.quantity)));
            return {
              product: itemRow.product,
              shop: itemRow.shop,
              eventType: "sale" as const,
              referenceId: itemRow.id,
              quantity: itemRow.quantity,
              unitPrice: itemRow.unitPrice,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              note: receiptNo,
            };
          })
      );

      // ── Loyalty points: redeem and earn ───────────────────────────────────
      if (customerId) {
        const shopSettings = await db.query.shops.findFirst({
          where: eq(shops.id, Number(shopId)),
          columns: { loyaltyEnabled: true, pointsPerAmount: true, pointsValue: true },
        });
        if (shopSettings?.loyaltyEnabled) {
          const perAmount = parseFloat(String(shopSettings.pointsPerAmount ?? 0));
          const custRow = await db.query.customers.findFirst({
            where: eq(customers.id, Number(customerId)),
            columns: { loyaltyPoints: true },
          });
          let currentPoints = parseFloat(String(custRow?.loyaltyPoints ?? 0));

          // Deduct redeemed points
          if (pointsRedeemed > 0) {
            currentPoints = Math.max(0, currentPoints - pointsRedeemed);
            await db.update(customers).set({ loyaltyPoints: String(currentPoints.toFixed(2)) }).where(eq(customers.id, Number(customerId)));
            await db.insert(loyaltyTransactions).values({
              customer: Number(customerId),
              shop: Number(shopId),
              type: "redeem",
              points: String((-pointsRedeemed).toFixed(2)),
              balanceAfter: String(currentPoints.toFixed(2)),
              referenceId: sale.id,
              note: `Redeemed for ${receiptNo}`,
            });
          }

          // Earn points on this sale (only if perAmount > 0)
          if (perAmount > 0) {
            const earned = Math.floor(totalWithDiscount / perAmount);
            if (earned > 0) {
              currentPoints += earned;
              await db.update(customers).set({ loyaltyPoints: String(currentPoints.toFixed(2)) }).where(eq(customers.id, Number(customerId)));
              await db.insert(loyaltyTransactions).values({
                customer: Number(customerId),
                shop: Number(shopId),
                type: "earn",
                points: String(earned.toFixed(2)),
                balanceAfter: String(currentPoints.toFixed(2)),
                referenceId: sale.id,
                note: `Earned for ${receiptNo}`,
              });
            }
          }
        }
      }

      void notifySaleReceipt(sale.id);
      void notifySaleReceiptSms(sale.id);
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

// ── Hold / unhold a sale (tab) ────────────────────────────────────────────────

router.post("/:id/hold", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({ where: eq(sales.id, id), columns: { shop: true, status: true } });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    if (!["cashed", "credit"].includes(existing.status))
      throw badRequest(`Cannot hold a sale with status "${existing.status}"`);
    const [updated] = await db.update(sales).set({ status: "held" }).where(eq(sales.id, id)).returning();
    if (!updated) throw notFound("Sale not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

// Add items to a held sale (e.g. customer keeps ordering at a bar tab)
router.post("/:id/items", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const { items } = req.body;
    if (!items?.length) throw badRequest("items required");

    const existing = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    if (existing.status !== "held") throw badRequest("Can only add items to a held sale");

    let addedAmount = 0;
    for (const item of items) addedAmount += (item.price ?? 0) * (item.quantity ?? 1);

    const newTotal = (parseFloat(existing.totalAmount) + addedAmount).toFixed(2);
    const newTotalWithDiscount = (parseFloat(existing.totalWithDiscount) + addedAmount).toFixed(2);
    const newOutstanding = (parseFloat(existing.outstandingBalance) + addedAmount).toFixed(2);

    const itemRows = await db.insert(saleItems).values(
      items.map((item: any) => ({
        sale: saleId,
        shop: existing.shop,
        product: Number(item.productId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? item.price ?? 0),
        costPrice: String(item.costPrice ?? 0),
        lineDiscount: String(item.discount ?? 0),
        saleType: item.saleType ?? existing.saleType ?? "Retail",
        attendant: req.attendant?.id ?? undefined,
      }))
    ).returning();

    const [updated] = await db.update(sales).set({
      totalAmount: newTotal,
      totalWithDiscount: newTotalWithDiscount,
      outstandingBalance: newOutstanding,
    }).where(eq(sales.id, saleId)).returning();

    return ok(res, { ...updated, addedItems: itemRows });
  } catch (e) { next(e); }
});

// Finalize (checkout) a held sale — deducts inventory and applies payment
router.post("/:id/checkout", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const { paymentMethod, amountPaid, payments, dueDate } = req.body;

    const existing = await db.query.sales.findFirst({
      where: eq(sales.id, saleId),
      with: { saleItems: true },
    });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    if (existing.status !== "held") throw badRequest("Sale is not held");

    // ── Resolve payments ────────────────────────────────────────────────────
    type RP = { methodName: string; amount: number };
    let resolvedPayments: RP[] = [];
    const totalWithDiscount = parseFloat(existing.totalWithDiscount);

    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        const mn = await resolvePaymentMethodName(p.method);
        const amt = parseFloat(String(p.amount ?? 0));
        if (amt < 0) throw badRequest("Payment amount cannot be negative");
        resolvedPayments.push({ methodName: mn, amount: amt });
      }
    } else {
      const mn = await resolvePaymentMethodName(paymentMethod);
      const amt = amountPaid !== undefined ? Math.max(0, parseFloat(String(amountPaid))) : totalWithDiscount;
      resolvedPayments = [{ methodName: mn, amount: amt }];
    }

    const paid = resolvedPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, totalWithDiscount - paid);

    // Credit validation
    if (outstanding > 0) {
      if (!existing.customer) throw badRequest("Credit checkout requires a customer");
      const cust = await db.query.customers.findFirst({
        where: eq(customers.id, existing.customer),
        columns: { creditLimit: true },
      });
      if (cust?.creditLimit) {
        const limit = parseFloat(String(cust.creditLimit));
        const [{ existingDebt }] = await db.select({
          existingDebt: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        }).from(sales).where(
          and(eq(sales.customer, existing.customer), sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`)
        );
        const totalAfter = parseFloat(existingDebt ?? "0") + outstanding;
        if (totalAfter > limit)
          throw badRequest(`Credit limit of ${limit} exceeded. Debt: ${existingDebt}, this checkout adds: ${outstanding.toFixed(2)}`);
      }
    }

    const paymentTypeLabel = resolvedPayments.length > 1 ? "split" : resolvedPayments[0]?.methodName ?? "cash";
    const mpesaAmt = resolvedPayments.filter(p => /mpesa|m-pesa/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);
    const bankAmt  = resolvedPayments.filter(p => /bank|transfer/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);
    const cardAmt  = resolvedPayments.filter(p => /card/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0);

    // ── Deduct inventory (FEFO) ─────────────────────────────────────────────
    const allItems = (existing as any).saleItems as typeof saleItems.$inferSelect[];
    const invSnapshots = new Map<number, string>();
    await Promise.all(
      allItems.map(async (itemRow) => {
        const soldQty = parseFloat(itemRow.quantity);
        const productId = itemRow.product;
        const sid = existing.shop;

        const existingInv = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, productId), eq(inventory.shop, sid)),
          columns: { quantity: true },
        });
        invSnapshots.set(productId, existingInv ? String(existingInv.quantity) : "0");

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

        const availableBatches = await db.query.batches.findMany({
          where: and(eq(batches.product, productId), eq(batches.shop, sid)),
          orderBy: (b, { asc }) => [sql`${b.expirationDate} IS NULL`, asc(b.expirationDate), asc(b.createdAt)],
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
          await db.insert(saleItemBatches).values({ saleItem: itemRow.id, batch: batch.id, quantityTaken: String(taken) });
        }
      })
    );

    await recordProductHistory(
      allItems.map((itemRow) => {
        const qtyBefore = invSnapshots.get(itemRow.product) ?? "0";
        const qtyAfter  = String(Math.max(0, parseFloat(qtyBefore) - parseFloat(itemRow.quantity)));
        return {
          product: itemRow.product,
          shop: existing.shop,
          eventType: "sale" as const,
          referenceId: itemRow.id,
          quantity: itemRow.quantity,
          unitPrice: itemRow.unitPrice,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          note: existing.receiptNo ?? String(saleId),
        };
      })
    );

    for (const p of resolvedPayments) {
      if (p.amount > 0 && req.attendant) {
        await db.insert(salePayments).values({
          sale: saleId,
          receivedBy: req.attendant.id,
          amount: String(p.amount.toFixed(2)),
          balance: String(outstanding.toFixed(2)),
          paymentType: p.methodName,
        });
      }
    }

    const [updated] = await db.update(sales).set({
      status: outstanding > 0 ? "credit" : "cashed",
      amountPaid: String(paid.toFixed(2)),
      mpesaTotal: String(mpesaAmt.toFixed(2)),
      bankTotal:  String(bankAmt.toFixed(2)),
      cardTotal:  String(cardAmt.toFixed(2)),
      outstandingBalance: String(outstanding.toFixed(2)),
      paymentType: paymentTypeLabel,
      dueDate: outstanding > 0 && dueDate ? new Date(dueDate) : null,
    }).where(eq(sales.id, saleId)).returning();
    if (!updated) throw notFound("Sale not found");

    void notifySaleReceipt(saleId);
    void notifySaleReceiptSms(saleId);
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { note, discount } = req.body;
    const id = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({ where: eq(sales.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(sales).set({
      ...(note !== undefined && { saleNote: note }),
      ...(discount !== undefined && { saleDiscount: String(discount) }),
    }).where(eq(sales.id, id)).returning();
    if (!updated) throw notFound("Sale not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

// Restore inventory for every item in a sale (idempotency: guarded by caller's status check)
async function restoreSaleInventory(saleId: number): Promise<void> {
  const items = await db.query.saleItems.findMany({ where: eq(saleItems.sale, saleId) });
  if (!items.length) return;
  const enriched = await Promise.all(
    items.map(async (item) => {
      const qty = parseFloat(item.quantity);
      const existing = await db.query.inventory.findFirst({
        where: and(eq(inventory.product, item.product), eq(inventory.shop, item.shop)),
        columns: { quantity: true },
      });
      const qtyBefore = existing?.quantity ?? "0";
      const qtyAfter = String(parseFloat(qtyBefore) + qty);
      await db.insert(inventory)
        .values({ product: item.product, shop: item.shop, quantity: item.quantity })
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
      shop: item.shop,
      eventType: "sale_return" as const,
      referenceId: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      quantityBefore: item.qtyBefore,
      quantityAfter: item.qtyAfter,
    }))
  );
}

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({ where: eq(sales.id, id), columns: { shop: true, status: true, customer: true, outstandingBalance: true } });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    if (existing.status !== "voided") await restoreSaleInventory(id);
    const [updated] = await db.update(sales)
      .set({ status: "voided", outstandingBalance: "0" })
      .where(eq(sales.id, id))
      .returning();
    if (!updated) throw notFound("Sale not found");
    // Reduce customer outstanding by whatever was remaining
    if (existing.customer && parseFloat(String(existing.outstandingBalance ?? "0")) > 0) {
      const prev = parseFloat(String(existing.outstandingBalance));
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${prev}::numeric)` })
        .where(eq(customers.id, existing.customer));
    }
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/:id/void", requireAdmin, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({ where: eq(sales.id, saleId), columns: { shop: true, status: true, customer: true, outstandingBalance: true } });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);
    if (existing.status !== "voided") await restoreSaleInventory(saleId);
    const [updated] = await db.update(sales)
      .set({ status: "voided", outstandingBalance: "0" })
      .where(eq(sales.id, saleId))
      .returning();
    if (!updated) throw notFound("Sale not found");
    if (existing.customer && parseFloat(String(existing.outstandingBalance ?? "0")) > 0) {
      const prev = parseFloat(String(existing.outstandingBalance));
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${prev}::numeric)` })
        .where(eq(customers.id, existing.customer));
    }
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.post("/:id/refund", requireAdmin, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!sale) throw notFound("Sale not found");
    await assertShopOwnership(req, sale.shop);
    if (sale.status !== "refunded" && sale.status !== "voided") await restoreSaleInventory(saleId);
    const [updated] = await db.update(sales)
      .set({ status: "refunded", outstandingBalance: "0" })
      .where(eq(sales.id, saleId))
      .returning();
    // Reduce customer outstanding by whatever was remaining before refund
    if (sale.customer && parseFloat(String(sale.outstandingBalance ?? "0")) > 0) {
      const prev = parseFloat(String(sale.outstandingBalance));
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${prev}::numeric)` })
        .where(eq(customers.id, sale.customer));
    }
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
    await assertShopOwnership(req, sale.shop);

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

    // Decrement customer's cached outstanding balance
    if (sale.customer) {
      const amountPaid = parseFloat(String(amount));
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${amountPaid}::numeric)` })
        .where(eq(customers.id, sale.customer));
    }

    return created(res, payment);
  } catch (e) { next(e); }
});

export default router;
