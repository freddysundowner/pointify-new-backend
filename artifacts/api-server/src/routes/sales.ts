import { Router } from "express";
import { eq, and, gte, lte, sql, inArray, ilike, or, asc } from "drizzle-orm";
import { sales, saleItems, salePayments, saleReturns, saleReturnItems, products, inventory, customers, customerWalletTransactions, paymentMethods, batches, saleItemBatches, shops, loyaltyTransactions, cashflows, bundleItems } from "@workspace/db";
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
import { autoRecordCashflow } from "../lib/auto-cashflow.js";

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

router.get("/stats", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["start"] ? new Date(String(req.query["start"])) : null;
    const to = req.query["end"] ? new Date(String(req.query["end"])) : null;
    const attendantId = req.query["attendantId"] ? Number(req.query["attendantId"]) : null;

    const conditions: any[] = [];
    if (req.attendant) {
      conditions.push(eq(sales.attendant, req.attendant.id));
      conditions.push(eq(sales.shop, req.attendant.shopId));
    } else {
      if (shopId) conditions.push(eq(sales.shop, shopId));
      if (attendantId) conditions.push(eq(sales.attendant, attendantId));
    }
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) {
      const endOfDay = new Date(to);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(sales.createdAt, endOfDay));
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Build parallel returns-subtraction query for the same shop/period
    const returnsConditions: any[] = [];
    if (req.attendant) {
      returnsConditions.push(eq(saleReturns.shop, req.attendant.shopId));
    } else {
      if (shopId) returnsConditions.push(eq(saleReturns.shop, shopId));
    }
    if (from) returnsConditions.push(gte(saleReturns.createdAt, from));
    if (to) {
      const endOfDay2 = new Date(to);
      endOfDay2.setHours(23, 59, 59, 999);
      returnsConditions.push(lte(saleReturns.createdAt, endOfDay2));
    }
    const returnsWhere = returnsConditions.length > 1 ? and(...returnsConditions) : (returnsConditions[0] ?? sql`1=1`);

    // Debt collection query: salePayments inserted >5 min after the sale was created
    // (the initial payment is inserted in the same transaction as the sale).
    // This correctly captures partial + full repayments even after status flips to "cashed".
    const endOfDay3 = to ? new Date(to) : null;
    if (endOfDay3) endOfDay3.setHours(23, 59, 59, 999);
    const effectiveShopId = req.attendant ? req.attendant.shopId : shopId;

    const [[result], [returnsResult], creditCollectedRows] = await Promise.all([
      db.select({
        grossSales: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} NOT IN ('voided','held') THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        totalCount: sql<number>`COUNT(CASE WHEN ${sales.status} NOT IN ('voided','held') THEN 1 END)`,
        cash: sql<string>`COALESCE(SUM(CASE WHEN lower(${sales.paymentType}) IN ('cash') AND ${sales.status} = 'cashed' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        mpesa: sql<string>`COALESCE(SUM(CASE WHEN lower(${sales.paymentType}) SIMILAR TO '%(mpesa|m-pesa)%' AND ${sales.status} = 'cashed' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        credit: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} = 'credit' AND ${sales.outstandingBalance}::numeric > 0 THEN ${sales.outstandingBalance}::numeric ELSE 0 END), 0)`,
        wallet: sql<string>`COALESCE(SUM(CASE WHEN lower(${sales.paymentType}) = 'wallet' AND ${sales.status} = 'cashed' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        hold: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} = 'held' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        bank: sql<string>`COALESCE(SUM(CASE WHEN lower(${sales.paymentType}) = 'bank' AND ${sales.status} = 'cashed' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
      }).from(sales).where(where ?? sql`1=1`),
      db.select({
        totalReturns: sql<string>`COALESCE(SUM(${saleReturns.refundAmount}::numeric), 0)`,
      }).from(saleReturns)
        .innerJoin(sales, and(
          eq(saleReturns.sale, sales.id),
          sql`${sales.status} NOT IN ('voided', 'held')`,
        ))
        .where(returnsWhere),
      // Raw SQL for debt collections — payments recorded via POST /:id/payments are
      // tagged with payment_no = 'DEBT' to distinguish them from initial sale payments.
      db.execute(sql`
        SELECT COALESCE(SUM(sp.amount::numeric), 0) AS collected
        FROM sale_payments sp
        INNER JOIN sales s ON sp.sale_id = s.id
        WHERE sp.payment_no = 'DEBT'
        ${effectiveShopId ? sql`AND s.shop_id = ${effectiveShopId}` : sql``}
        ${from ? sql`AND sp.paid_at >= ${from}` : sql``}
        ${endOfDay3 ? sql`AND sp.paid_at <= ${endOfDay3}` : sql``}
      `),
    ]);

    const grossSales = Number(result.grossSales);
    const totalReturns = Number(returnsResult.totalReturns);

    return ok(res, {
      totalSales: Math.max(0, grossSales - totalReturns),
      totalCount: Number(result.totalCount),
      returns: totalReturns,
      grossSales,
      cashtransactions: Number(result.cash),
      mpesa: Number(result.mpesa),
      credit: Number(result.credit),
      wallet: Number(result.wallet),
      hold: Number(result.hold),
      bank: Number(result.bank),
      creditCollected: Number((creditCollectedRows.rows[0] as any)?.collected ?? 0),
    });
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
    // Also support start/end as aliases (sent by client)
    const start = req.query["start"] ? new Date(String(req.query["start"])) : from;
    const end = req.query["end"] ? new Date(String(req.query["end"])) : to;
    const receiptNo = req.query["receiptNo"] ? String(req.query["receiptNo"]) : null;
    const search = req.query["search"] ? String(req.query["search"]) : null;
    const paymentTag = req.query["paymentTag"] ? String(req.query["paymentTag"]) : null;
    const attendantId = req.query["attendantId"] ? Number(req.query["attendantId"]) : null;

    const conditions: any[] = [];
    // Attendants can only see their own sales — admins see all.
    if (req.attendant) {
      conditions.push(eq(sales.attendant, req.attendant.id));
      conditions.push(eq(sales.shop, req.attendant.shopId));
    } else {
      if (shopId) conditions.push(eq(sales.shop, shopId));
      if (attendantId) conditions.push(eq(sales.attendant, attendantId));
    }
    if (customerId) conditions.push(eq(sales.customer, customerId));
    if (status) conditions.push(eq(sales.status, status));
    if (receiptNo) conditions.push(ilike(sales.receiptNo, `%${receiptNo}%`));
    if (search) {
      const matchingCustomers = await db.select({ id: customers.id }).from(customers).where(ilike(customers.name, `%${search}%`));
      const customerIds = matchingCustomers.map((c) => c.id);
      if (customerIds.length > 0) {
        conditions.push(or(ilike(sales.receiptNo, `%${search}%`), inArray(sales.customer, customerIds)));
      } else {
        conditions.push(ilike(sales.receiptNo, `%${search}%`));
      }
    }
    if (paymentTag) conditions.push(ilike(sales.paymentType, `%${paymentTag}%`));
    if (start) conditions.push(gte(sales.createdAt, start));
    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(sales.createdAt, endOfDay));
    }
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.sales.findMany({
      where,
      limit,
      offset,
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      with: { saleItems: { with: { product: { columns: { id: true, name: true } } } }, salePayments: true, customer: true, attendant: true },
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
        columns: { loyaltyEnabled: true, loyaltyRedemptionEnabled: true, pointsValue: true },
      });
      if (shop?.loyaltyEnabled && shop?.loyaltyRedemptionEnabled && parseFloat(String(shop.pointsValue ?? 0)) > 0) {
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
            sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
          )
        );
        const totalAfter = parseFloat(existingDebt ?? "0") + outstanding;
        if (totalAfter > limit)
          throw badRequest(`Credit limit of ${limit} exceeded. Current debt: ${existingDebt}, this sale adds: ${outstanding.toFixed(2)}`);
      }
    }

    // ── Wallet payment validation ────────────────────────────────────────────
    const walletAmt = !held
      ? resolvedPayments.filter(p => /wallet/i.test(p.methodName)).reduce((s, p) => s + p.amount, 0)
      : 0;
    if (!held && walletAmt > 0) {
      if (!customerId) throw badRequest("Wallet payment requires a customer");
      const walletCust = await db.query.customers.findFirst({
        where: eq(customers.id, Number(customerId)),
        columns: { wallet: true },
      });
      const walletBalance = parseFloat(String(walletCust?.wallet ?? "0"));
      if (walletBalance < walletAmt)
        throw badRequest("customer has no enough balance in the wallet");
    }

    // ── Negative-selling guard ───────────────────────────────────────────────
    // Fetch the shop setting once and validate stock before any DB writes.
    if (!held) {
      const shopSettings = await db.query.shops.findFirst({
        where: eq(shops.id, Number(shopId)),
        columns: { allowNegativeSelling: true },
      });

      if (!shopSettings?.allowNegativeSelling) {
        // Identify physical products (service/virtual skip inventory)
        const physicalItems = items.filter((item: any) => {
          // We'll check type after fetching — default to physical for the guard
          return true;
        });

        const itemProductIds = physicalItems.map((item: any) => Number(item.productId));
        const [productTypeRows, inventoryRows] = await Promise.all([
          itemProductIds.length
            ? db.query.products.findMany({ where: inArray(products.id, itemProductIds), columns: { id: true, type: true } })
            : [],
          itemProductIds.length
            ? db.query.inventory.findMany({ where: and(inArray(inventory.product, itemProductIds), eq(inventory.shop, Number(shopId))), columns: { product: true, quantity: true } })
            : [],
        ]);
        const typeMap = new Map(productTypeRows.map((p) => [p.id, p.type ?? "product"]));
        const stockMap = new Map(inventoryRows.map((r) => [r.product!, parseFloat(String(r.quantity ?? "0"))]));

        const shortages: string[] = [];
        for (const item of physicalItems) {
          const pid = Number(item.productId);
          const pType = typeMap.get(pid) ?? "product";
          if (pType === "service" || pType === "virtual") continue;
          const available = stockMap.get(pid) ?? 0;
          const needed = Number(item.quantity ?? 1);
          if (available < needed) {
            shortages.push(`Product #${pid}: need ${needed}, have ${available}`);
          }
        }
        if (shortages.length) {
          throw badRequest(`Insufficient stock (negative selling is disabled for this shop): ${shortages.join("; ")}`);
        }
      }
    }

    // ── Bundle component stock pre-flight (always enforced, before any DB writes) ──
    if (!held) {
      const allSaleProductIds = items.map((item: any) => Number(item.productId));
      if (allSaleProductIds.length) {
        const bundleTypeRows = await db.query.products.findMany({
          where: and(inArray(products.id, allSaleProductIds), eq(products.type as any, 'bundle')),
          columns: { id: true },
        });
        const bundleIds = bundleTypeRows.map((p) => p.id);
        if (bundleIds.length) {
          const compRows = await db.select({
            product: bundleItems.product,
            componentProduct: bundleItems.componentProduct,
            quantity: bundleItems.quantity,
            componentName: products.name,
          }).from(bundleItems)
            .leftJoin(products, eq(bundleItems.componentProduct, products.id))
            .where(inArray(bundleItems.product, bundleIds));

          // Collect all unique component product IDs and fetch their inventory in one query
          const compProductIds = [...new Set(compRows.map((r) => r.componentProduct!).filter(Boolean))];
          const compInventory = compProductIds.length
            ? await db.query.inventory.findMany({
                where: and(inArray(inventory.product, compProductIds), eq(inventory.shop, Number(shopId))),
                columns: { product: true, quantity: true },
              })
            : [];
          const compStockMap = new Map(compInventory.map((r) => [r.product!, parseFloat(String(r.quantity ?? "0"))]));

          // Group components by bundle product
          const compByBundle = new Map<number, typeof compRows>();
          for (const row of compRows) {
            if (!compByBundle.has(row.product!)) compByBundle.set(row.product!, []);
            compByBundle.get(row.product!)!.push(row);
          }

          const bundleShortages: string[] = [];
          for (const item of items) {
            const pid = Number(item.productId);
            if (!bundleIds.includes(pid)) continue;
            const soldQty = Number(item.quantity ?? 1);
            const components = compByBundle.get(pid) ?? [];
            for (const comp of components) {
              const needed = soldQty * Number(comp.quantity);
              const available = compStockMap.get(comp.componentProduct!) ?? 0;
              if (available < needed) {
                bundleShortages.push(`"${comp.componentName ?? comp.componentProduct}" (need ${needed}, have ${available})`);
              }
            }
          }
          if (bundleShortages.length) {
            throw badRequest(`Insufficient bundle component stock: ${bundleShortages.join('; ')}`);
          }
        }
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
    const receiptNo = `REC${String(sale.id).padStart(5, "0")}`;
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

      // Pre-fetch bundle component definitions for any bundle products being sold
      const bundleProductIds = allProductIds.filter((id) => productTypeMap.get(id) === "bundle");
      const bundleComponentMap = new Map<number, Array<{ componentProduct: number; quantity: string }>>();
      if (bundleProductIds.length) {
        const bundleRows = await db.select({
          product: bundleItems.product,
          componentProduct: bundleItems.componentProduct,
          quantity: bundleItems.quantity,
        }).from(bundleItems).where(inArray(bundleItems.product, bundleProductIds));
        for (const row of bundleRows) {
          if (!bundleComponentMap.has(row.product!)) bundleComponentMap.set(row.product!, []);
          bundleComponentMap.get(row.product!)!.push({ componentProduct: row.componentProduct!, quantity: String(row.quantity) });
        }
      }

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

          // If this is a bundle, also deduct each component product's inventory
          if (pType === "bundle") {
            const components = bundleComponentMap.get(productId) ?? [];
            for (const comp of components) {
              const compQty = soldQty * Number(comp.quantity);
              await db.update(inventory)
                .set({
                  quantity: sql`GREATEST(0, ${inventory.quantity} - ${compQty}::numeric)`,
                  status: sql`CASE
                    WHEN GREATEST(0, ${inventory.quantity} - ${compQty}::numeric) <= 0 THEN 'out_of_stock'
                    WHEN GREATEST(0, ${inventory.quantity} - ${compQty}::numeric) <= ${inventory.reorderLevel} THEN 'low'
                    ELSE 'active'
                  END`,
                })
                .where(and(eq(inventory.product, comp.componentProduct), eq(inventory.shop, sid)));
            }
          }

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
        if (p.amount > 0) {
          await db.insert(salePayments).values({
            sale: sale.id,
            receivedBy: req.attendant?.id ?? undefined,
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

      // ── Wallet deduction ──────────────────────────────────────────────────
      if (walletAmt > 0 && customerId) {
        const [updatedCust] = await db.update(customers)
          .set({ wallet: sql`${customers.wallet}::numeric - ${walletAmt}::numeric` })
          .where(eq(customers.id, Number(customerId)))
          .returning({ wallet: customers.wallet });
        await db.insert(customerWalletTransactions).values({
          customer: Number(customerId),
          shop: Number(shopId),
          type: "payment",
          amount: String(walletAmt.toFixed(2)),
          balance: String(parseFloat(String(updatedCust?.wallet ?? "0")).toFixed(2)),
          saleId: sale.id,
          handledBy: req.attendant?.id ?? null,
        });
      }

      void notifySaleReceipt(sale.id);
      void notifySaleReceiptSms(sale.id);
      void autoRecordCashflow({
        shopId: Number(shopId),
        amount: paid,
        description: `Sale ${receiptNo}`,
        categoryKey: "sales",
        recordedBy: req.attendant?.id,
      });
    }

    return created(res, { ...sale, items: itemRows });
  } catch (e) { next(e); }
});

// List debt collection payments — payments tagged payment_no = 'DEBT'
router.get("/collected-payments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const start = req.query["start"] ? new Date(String(req.query["start"])) : null;
    const end   = req.query["end"]   ? new Date(String(req.query["end"]))   : null;
    if (end) end.setHours(23, 59, 59, 999);
    const effectiveShopId = req.attendant ? req.attendant.shopId : shopId;

    const shopClause  = effectiveShopId ? `AND s.shop_id = ${Number(effectiveShopId)}` : "";
    const startClause = start ? `AND sp.paid_at >= '${start.toISOString()}'` : "";
    const endClause   = end   ? `AND sp.paid_at <= '${end.toISOString()}'`   : "";
    const baseWhere   = `sp.payment_no = 'DEBT' ${shopClause} ${startClause} ${endClause}`;

    const [rows, countRows] = await Promise.all([
      db.execute(sql.raw(`
        SELECT
          sp.id, sp.paid_at, sp.amount, sp.balance, sp.payment_type,
          sp.payment_reference, sp.payment_no,
          s.id AS sale_id, s.receipt_no, s.total_with_discount,
          s.outstanding_balance, s.status AS sale_status,
          c.id AS customer_id, c.name AS customer_name, c.phone_number AS customer_phone
        FROM sale_payments sp
        INNER JOIN sales s ON sp.sale_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE ${baseWhere}
        ORDER BY sp.paid_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total
        FROM sale_payments sp
        INNER JOIN sales s ON sp.sale_id = s.id
        WHERE ${baseWhere}
      `)),
    ]);

    const total = Number((countRows.rows[0] as any)?.total ?? 0);
    return paginated(res, rows.rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, Number(req.params["id"])),
      with: { saleItems: { with: { product: true } }, salePayments: true, customer: true, attendant: true, saleReturns: { with: { saleReturnItems: true } } },
    });
    if (!sale) throw notFound("Sale not found");
    res.setHeader("Cache-Control", "no-store");
    // Normalize saleItems to include productName explicitly
    const normalized = {
      ...sale,
      saleItems: (sale.saleItems ?? []).map((item: any) => ({
        ...item,
        productName: item.product?.name ?? item.productName ?? "Unknown Product",
      })),
    };
    return ok(res, normalized);
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
          and(eq(sales.customer, existing.customer), sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`)
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
      if (p.amount > 0) {
        await db.insert(salePayments).values({
          sale: saleId,
          receivedBy: req.attendant?.id ?? undefined,
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

    // ── Award loyalty points on held-sale checkout ────────────────────────
    // Redemption is not allowed for held sales (points can't be locked in
    // advance), but earning must happen at checkout when payment is collected.
    if (existing.customer) {
      const shopSettings = await db.query.shops.findFirst({
        where: eq(shops.id, existing.shop),
        columns: { loyaltyEnabled: true, pointsPerAmount: true },
      });
      if (shopSettings?.loyaltyEnabled) {
        const perAmount = parseFloat(String(shopSettings.pointsPerAmount ?? 0));
        if (perAmount > 0) {
          const earned = Math.floor(parseFloat(existing.totalWithDiscount) / perAmount);
          if (earned > 0) {
            const custRow = await db.query.customers.findFirst({
              where: eq(customers.id, existing.customer),
              columns: { loyaltyPoints: true },
            });
            const newPoints = parseFloat(String(custRow?.loyaltyPoints ?? 0)) + earned;
            await db.update(customers)
              .set({ loyaltyPoints: String(newPoints.toFixed(2)) })
              .where(eq(customers.id, existing.customer));
            await db.insert(loyaltyTransactions).values({
              customer: existing.customer,
              shop: existing.shop,
              type: "earn",
              points: String(earned.toFixed(2)),
              balanceAfter: String(newPoints.toFixed(2)),
              referenceId: saleId,
              note: `Earned for ${existing.receiptNo ?? saleId} (checkout)`,
            });
          }
        }
      }
    }

    void notifySaleReceipt(saleId);
    void notifySaleReceiptSms(saleId);
    // Only record cashflow for the cash actually collected at checkout.
    // If checked out on credit (paid < total), only the paid portion is cash-in.
    if (paid > 0) {
      void autoRecordCashflow({
        shopId: existing.shop,
        amount: paid,
        description: `Sale ${existing.receiptNo ?? saleId}`,
        categoryKey: "sales",
        recordedBy: req.attendant?.id,
      });
    }
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

// Restore inventory for every item in a sale (idempotency: guarded by caller's status check).
// If any quantity was already restored by a sale return, only the remaining un-returned
// portion is added back so inventory is never double-counted.
async function restoreSaleInventory(saleId: number): Promise<void> {
  const items = await db.query.saleItems.findMany({ where: eq(saleItems.sale, saleId) });
  if (!items.length) return;

  // Build a map of already-returned quantities per saleItem id
  const returnedRows = await db
    .select({
      saleItem: saleReturnItems.saleItem,
      returned: sql<string>`COALESCE(SUM(${saleReturnItems.quantity}::numeric), 0)`,
    })
    .from(saleReturnItems)
    .where(inArray(saleReturnItems.saleItem, items.map(i => i.id)))
    .groupBy(saleReturnItems.saleItem);
  const returnedMap = new Map(returnedRows.map(r => [r.saleItem, parseFloat(r.returned)]));

  // Fetch product types so we know which are bundles
  const productIds = [...new Set(items.map(i => i.product).filter((x): x is number => !!x))];
  const productTypeRows = productIds.length
    ? await db.query.products.findMany({ where: inArray(products.id, productIds), columns: { id: true, type: true } })
    : [];
  const productTypeMap = new Map(productTypeRows.map(p => [p.id, p.type ?? "product"]));

  // Pre-fetch bundle component definitions for any bundle products
  const bundleProductIds = productIds.filter(id => productTypeMap.get(id) === "bundle");
  const bundleComponentMap = new Map<number, Array<{ componentProduct: number; quantity: string }>>();
  if (bundleProductIds.length) {
    const bundleRows = await db.select({
      product: bundleItems.product,
      componentProduct: bundleItems.componentProduct,
      quantity: bundleItems.quantity,
    }).from(bundleItems).where(inArray(bundleItems.product, bundleProductIds));
    for (const row of bundleRows) {
      if (!bundleComponentMap.has(row.product!)) bundleComponentMap.set(row.product!, []);
      bundleComponentMap.get(row.product!)!.push({ componentProduct: row.componentProduct!, quantity: String(row.quantity) });
    }
  }

  // Helper: compute inventory status after restoring qty to an existing row
  const restoredStatus = (currentQty: string, addQty: number, reorderLevel: string) => {
    const newQty = parseFloat(currentQty) + addQty;
    if (newQty <= 0) return "out_of_stock";
    if (newQty <= parseFloat(reorderLevel)) return "low";
    return "active";
  };

  const enriched: Array<typeof items[number] & { netQty: number; qtyBefore: string; qtyAfter: string }> = [];
  await Promise.all(
    items.map(async (item) => {
      const soldQty = parseFloat(item.quantity);
      const alreadyReturned = returnedMap.get(item.id) ?? 0;
      const netQty = soldQty - alreadyReturned; // quantity not yet restored by a return
      if (netQty <= 0) return; // already fully restored — skip

      const existing = await db.query.inventory.findFirst({
        where: and(eq(inventory.product, item.product), eq(inventory.shop, item.shop)),
        columns: { quantity: true, reorderLevel: true },
      });
      const qtyBefore = existing?.quantity ?? "0";
      const qtyAfter = String(parseFloat(qtyBefore) + netQty);
      const newStatus = restoredStatus(qtyBefore, netQty, existing?.reorderLevel ?? "0");
      await db.insert(inventory)
        .values({ product: item.product, shop: item.shop, quantity: String(netQty) })
        .onConflictDoUpdate({
          target: [inventory.product, inventory.shop],
          set: {
            quantity: sql`${inventory.quantity} + ${netQty}::numeric`,
            status: newStatus,
          },
        });
      enriched.push({ ...item, netQty, qtyBefore, qtyAfter });

      // If this is a bundle, also restore each component product's inventory
      if (productTypeMap.get(item.product) === "bundle") {
        const components = bundleComponentMap.get(item.product) ?? [];
        for (const comp of components) {
          const compRestoreQty = netQty * Number(comp.quantity);
          const compExisting = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, comp.componentProduct), eq(inventory.shop, item.shop)),
            columns: { quantity: true, reorderLevel: true },
          });
          const compStatus = restoredStatus(compExisting?.quantity ?? "0", compRestoreQty, compExisting?.reorderLevel ?? "0");
          await db.insert(inventory)
            .values({ product: comp.componentProduct, shop: item.shop, quantity: String(compRestoreQty) })
            .onConflictDoUpdate({
              target: [inventory.product, inventory.shop],
              set: {
                quantity: sql`${inventory.quantity} + ${compRestoreQty}::numeric`,
                status: compStatus,
              },
            });
        }
      }
    })
  );
  if (enriched.length) {
    await recordProductHistory(
      enriched.map((item) => ({
        product: item.product,
        shop: item.shop,
        eventType: "sale_return" as const,
        referenceId: item.id,
        quantity: String(item.netQty),
        unitPrice: item.unitPrice,
        quantityBefore: item.qtyBefore,
        quantityAfter: item.qtyAfter,
      }))
    );
  }
}

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      columns: { shop: true, status: true, customer: true, outstandingBalance: true, totalAmount: true, totalWithDiscount: true, amountPaid: true, saleNo: true, receiptNo: true },
    });
    if (!existing) throw notFound("Sale not found");
    await assertShopOwnership(req, existing.shop);

    // Fetch all returns for this sale BEFORE deleting (needed for side-effect reversal)
    const existingReturns = await db.query.saleReturns.findMany({
      where: eq(saleReturns.sale, id),
      columns: { returnNo: true, refundAmount: true },
    });

    // ── Inventory ──────────────────────────────────────────────────────────────
    // If the sale was returned, the return already restored inventory — don't
    // double-restore. Only restore if it wasn't voided or returned.
    if (existing.status !== "voided" && existing.status !== "returned") {
      await restoreSaleInventory(id);
    }

    // ── Customer outstanding ───────────────────────────────────────────────────
    // Reduce customer outstanding by whatever remained on this sale (0 if returned).
    if (existing.customer && parseFloat(String(existing.outstandingBalance ?? "0")) > 0) {
      const prev = parseFloat(String(existing.outstandingBalance));
      await db.update(customers)
        .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${prev}::numeric)` })
        .where(eq(customers.id, existing.customer));
    }

    // ── Reverse return side-effects on other sales ─────────────────────────────
    // When a return was processed, any paid credit (amountPaid on this sale) was
    // transferred to reduce OTHER credit sales' outstandingBalance. We must reverse
    // those offsets so the other sales are correct after this sale is deleted.
    if (existingReturns.length > 0 && existing.customer) {
      const totalRefunded = existingReturns.reduce((s, r) => s + parseFloat(String(r.refundAmount ?? "0")), 0);
      const saleTotal = parseFloat(String(existing.totalWithDiscount || existing.totalAmount || "0"));
      // Outstanding that was directly cancelled by returns (capped at sale total)
      const totalOutstandingCancelled = Math.min(totalRefunded, saleTotal);
      // Credit transferred to other sales = the paid portion re-routed during returns
      const totalCreditTransferred = Math.max(0, totalRefunded - totalOutstandingCancelled);

      if (totalCreditTransferred > 0) {
        // Find other credit/cashed sales for this customer that had amountPaid incremented
        // by this return's creditToApply, and reverse those adjustments.
        const otherSales = await db.query.sales.findMany({
          where: and(
            eq(sales.customer, existing.customer),
            inArray(sales.status, ["credit", "cashed"]),
          ),
          columns: { id: true, outstandingBalance: true, amountPaid: true, status: true },
          orderBy: [asc(sales.createdAt)],
        });

        let remaining = totalCreditTransferred;
        for (const other of otherSales) {
          if (other.id === id || remaining <= 0) continue;
          const paid = parseFloat(String(other.amountPaid ?? "0"));
          if (paid <= 0) continue;
          const reversal = Math.min(remaining, paid);
          const newOutstanding = parseFloat(String(other.outstandingBalance ?? "0")) + reversal;
          const newAmountPaid = Math.max(0, paid - reversal);
          await db.update(sales).set({
            outstandingBalance: String(newOutstanding.toFixed(2)),
            amountPaid: String(newAmountPaid.toFixed(2)),
            // Restore 'credit' status if this sale was marked 'cashed' by the offset
            ...(other.status === "cashed" && newOutstanding > 0 ? { status: "credit" } : {}),
          }).where(eq(sales.id, other.id));
          // Restore customer aggregate outstanding for the reversed amount
          await db.update(customers)
            .set({ outstandingBalance: sql`${customers.outstandingBalance}::numeric + ${reversal}::numeric` })
            .where(eq(customers.id, existing.customer));
          remaining -= reversal;
        }
      }

      // Delete return ledger entries (type='return', paymentNo = returnNo)
      // These have no saleId so they aren't caught by the saleId-based delete below.
      const returnNos = existingReturns.map(r => r.returnNo).filter((n): n is string => !!n);
      if (returnNos.length > 0) {
        await db.delete(customerWalletTransactions).where(
          and(
            inArray(customerWalletTransactions.paymentNo, returnNos),
            eq(customerWalletTransactions.type, "return"),
          )
        );
      }
    }

    // ── Delete return records ──────────────────────────────────────────────────
    // saleReturnItems reference saleItem rows (no cascade), delete those first
    const itemRows = await db.select({ id: saleItems.id }).from(saleItems).where(eq(saleItems.sale, id));
    if (itemRows.length > 0) {
      await db.delete(saleReturnItems).where(inArray(saleReturnItems.saleItem, itemRows.map(r => r.id)));
    }
    await db.delete(saleReturns).where(eq(saleReturns.sale, id));

    // Delete customer wallet statement entries linked to this sale (debt payments, etc.)
    await db.delete(customerWalletTransactions).where(eq(customerWalletTransactions.saleId, id));

    // ── Hard-delete the sale (saleItems + salePayments cascade automatically) ──
    const [deleted] = await db.delete(sales).where(eq(sales.id, id)).returning();
    if (!deleted) throw notFound("Sale not found");

    // Remove auto-recorded cashflow entries so the cashflow page stays clean
    if (existing.receiptNo) {
      await db.delete(cashflows).where(
        or(
          eq(cashflows.description, `Sale ${existing.receiptNo}`),
          eq(cashflows.description, `Sale Return ${existing.receiptNo}`)
        )
      );
    }

    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/:id/void", requireAdmin, async (req, res, next) => {
  try {
    const saleId = Number(req.params["id"]);
    const existing = await db.query.sales.findFirst({ where: eq(sales.id, saleId), columns: { shop: true, status: true, customer: true, outstandingBalance: true, totalAmount: true, saleNo: true } });
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
    if (existing.status !== "voided") {
      const saleTotal = parseFloat(String(existing.totalAmount ?? "0"));
      void autoRecordCashflow({
        shopId: existing.shop,
        amount: saleTotal,
        description: `Sale Voided ${existing.saleNo ?? saleId}`,
        categoryKey: "sale_reversal",
        recordedBy: (req as any).attendant?.id,
      });
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
    if (sale.status !== "refunded" && sale.status !== "voided") {
      const saleTotal = parseFloat(String(sale.totalAmount ?? "0"));
      void autoRecordCashflow({
        shopId: sale.shop,
        amount: saleTotal,
        description: `Sale Refunded ${sale.saleNo ?? saleId}`,
        categoryKey: "sale_reversal",
        recordedBy: (req as any).attendant?.id,
      });
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
      paymentNo: "DEBT",
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

    // Record cashflow for the cash collected on this debt payment
    void autoRecordCashflow({
      shopId: Number(sale.shop),
      amount: parseFloat(String(amount)),
      description: `Collected Debt ${sale.receiptNo ?? saleId}`,
      categoryKey: "sales",
      recordedBy: req.attendant?.id,
    });

    return created(res, payment);
  } catch (e) { next(e); }
});

export default router;
