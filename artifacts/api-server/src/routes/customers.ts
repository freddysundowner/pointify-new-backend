import { Router } from "express";
import { eq, ilike, and, sql, desc, asc, gt } from "drizzle-orm";
import { customers, customerWalletTransactions, loyaltyTransactions, shops, sales, salePayments } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { notifyCustomerWelcome, notifyWalletTopup } from "../lib/emailEvents.js";
import { sendRawEmail } from "../lib/email.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(customers.shop, shopId));
    if (search) conditions.push(ilike(customers.name, `%${search}%`));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.customers.findMany({
      where,
      limit,
      offset,
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    const total = await db.$count(customers, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Analysis ─────────────────────────────────────────────────────────────────
router.get("/analysis", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    if (!shopId) throw badRequest("shopId required");

    const where = eq(customers.shop, shopId);

    const totalCustomers = await db.$count(customers, where);

    const [summary] = await db.select({
      totalWalletBalance: sql<string>`COALESCE(SUM(${customers.wallet}::numeric), 0)`,
      totalOutstanding:   sql<string>`COALESCE(SUM(${customers.outstandingBalance}::numeric), 0)`,
    }).from(customers).where(where);

    const topDebtors = await db.select({
      customerId:       customers.id,
      name:             customers.name,
      phonenumber:      customers.phone,
      totalOutstanding: sql<string>`${customers.outstandingBalance}::numeric`,
    }).from(customers)
      .where(and(where, sql`${customers.outstandingBalance}::numeric > 0`))
      .orderBy(sql`${customers.outstandingBalance}::numeric DESC`)
      .limit(5);

    return ok(res, {
      totalCustomers,
      totalWalletBalance: parseFloat(summary?.totalWalletBalance ?? "0"),
      totalOutstanding:   parseFloat(summary?.totalOutstanding ?? "0"),
      topDebtors: topDebtors.map(d => ({
        ...d,
        totalOutstanding: parseFloat(String(d.totalOutstanding)),
      })),
    });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { name, phone, email, shopId, creditLimit, type, address, wallet } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    await assertShopOwnership(req, Number(shopId));

    const [{ max }] = await db.select({ max: sql<number>`COALESCE(MAX(${customers.customerNo}), 0)` })
      .from(customers)
      .where(eq(customers.shop, Number(shopId)));
    const nextNo = (Number(max ?? 0)) + 1;

    const initialWallet = wallet ? parseFloat(String(wallet)) : 0;

    const [customer] = await db.insert(customers).values({
      name,
      phone: phone || null,
      email,
      address,
      shop: Number(shopId),
      creditLimit: creditLimit ? String(creditLimit) : null,
      type: type ?? "retail",
      customerNo: nextNo,
      wallet: initialWallet > 0 ? String(initialWallet.toFixed(2)) : "0.00",
      createdBy: req.attendant?.id ?? undefined,
    }).returning();

    const { password: _, otp: __, ...safe } = customer;
    void notifyCustomerWelcome(safe);
    return created(res, safe);
  } catch (e) { next(e); }
});

router.get("/by-number", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const customerNoRaw = req.query["customerNo"] ? String(req.query["customerNo"]).trim() : "";
    const phone = String(req.query["phone"] ?? "").trim();
    if (!customerNoRaw && !phone) throw badRequest("customerNo or phone query param required");
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const conditions = customerNoRaw
      ? [eq(customers.customerNo, Number(customerNoRaw))]
      : [eq(customers.phone, phone)];
    if (shopId) conditions.push(eq(customers.shop, shopId));
    const customer = await db.query.customers.findFirst({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
    });
    if (!customer) throw notFound("Customer not found");
    const { password: _, otp: __, ...safe } = customer;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.post("/bulk-import", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.customers) ? req.body.customers : null;
    if (!list) throw badRequest("customers array required");
    const errors: { index: number; message: string }[] = [];
    let createdCount = 0;
    let skipped = 0;

    const maxByShop = new Map<number, number>();
    async function nextNo(shopId: number): Promise<number> {
      if (!maxByShop.has(shopId)) {
        const [row] = await db
          .select({ max: sql<number>`COALESCE(MAX(${customers.customerNo}), 0)` })
          .from(customers)
          .where(eq(customers.shop, shopId));
        maxByShop.set(shopId, Number(row?.max ?? 0));
      }
      const next = (maxByShop.get(shopId) ?? 0) + 1;
      maxByShop.set(shopId, next);
      return next;
    }

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      try {
        if (!c?.name || !c?.shopId) {
          skipped++;
          errors.push({ index: i, message: "name and shopId required" });
          continue;
        }
        const shopId = Number(c.shopId);
        await db.insert(customers).values({
          name: c.name,
          phone: c.phone ?? null,
          email: c.email ?? null,
          address: c.address ?? null,
          shop: shopId,
          creditLimit: c.creditLimit ? String(c.creditLimit) : null,
          type: c.type ?? "retail",
          customerNo: await nextNo(shopId),
          createdBy: req.attendant?.id ?? undefined,
        });
        createdCount++;
      } catch (err) {
        skipped++;
        errors.push({ index: i, message: (err as Error).message });
      }
    }
    return ok(res, { created: createdCount, skipped, errors });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const customer = await db.query.customers.findFirst({ where: eq(customers.id, Number(req.params["id"])) });
    if (!customer) throw notFound("Customer not found");
    const { password: _, otp: __, ...safe } = customer;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { name, phone, email, creditLimit, type, address } = req.body;
    const id = Number(req.params["id"]);
    const existing = await db.query.customers.findFirst({ where: eq(customers.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Customer not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(customers).set({
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(creditLimit !== undefined && { creditLimit: creditLimit ? String(creditLimit) : null }),
      ...(type && { type }),
    }).where(eq(customers.id, id)).returning();
    if (!updated) throw notFound("Customer not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.customers.findFirst({ where: eq(customers.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Customer not found");
    await assertShopOwnership(req, existing.shop);
    const [deleted] = await db.delete(customers).where(eq(customers.id, id)).returning();
    if (!deleted) throw notFound("Customer not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/:id/verify", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.customers.findFirst({ where: eq(customers.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Customer not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(customers)
      .set({ type: "verified" })
      .where(eq(customers.id, id))
      .returning();
    if (!updated) throw notFound("Customer not found");
    return ok(res, { message: "Customer verified" });
  } catch (e) { next(e); }
});

router.get("/:id/wallet", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, Number(req.params["id"])),
      columns: { wallet: true },
    });
    if (!customer) throw notFound("Customer not found");
    return ok(res, { wallet: customer.wallet ?? "0.00" });
  } catch (e) { next(e); }
});

router.get("/:id/wallet-transactions", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const customerId = Number(req.params["id"]);
    const rows = await db.query.customerWalletTransactions.findMany({
      where: eq(customerWalletTransactions.customer, customerId),
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(customerWalletTransactions, eq(customerWalletTransactions.customer, customerId));
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/:id/wallet", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) throw badRequest("amount required");
    const customerId = Number(req.params["id"]);

    const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
    if (!customer) throw notFound("Customer not found");
    await assertShopOwnership(req, customer.shop);

    const numAmount = parseFloat(String(amount));
    if (Number.isNaN(numAmount) || numAmount <= 0) throw badRequest("amount must be positive");
    const newBalance = (parseFloat(customer.wallet ?? "0") + numAmount).toFixed(2);

    await db.update(customers).set({ wallet: newBalance }).where(eq(customers.id, customerId));
    await db.insert(customerWalletTransactions).values({
      customer: customerId,
      shop: customer.shop,
      amount: String(amount),
      balance: newBalance,
      type: "deposit",
    });

    if (Number(amount) > 0) void notifyWalletTopup(customerId, String(amount), newBalance);
    return ok(res, { wallet: newBalance, message: "Wallet updated" });
  } catch (e) { next(e); }
});

async function applyWalletChange(
  req: any,
  type: "deposit" | "withdraw" | "payment" | "refund",
  signedAmount: (n: number) => number,
) {
  const { amount, paymentNo, paymentReference, paymentType } = req.body ?? {};
  if (!amount) throw badRequest("amount required");
  const customerId = Number(req.params["id"]);
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
  if (!customer) throw notFound("Customer not found");
  await assertShopOwnership(req, customer.shop);

  const numAmount = parseFloat(String(amount));
  if (Number.isNaN(numAmount) || numAmount <= 0) throw badRequest("amount must be positive");
  const delta = signedAmount(numAmount);
  const current = parseFloat(customer.wallet ?? "0");
  const newBalance = (current + delta).toFixed(2);

  if (type === "withdraw" && current + delta < 0) throw badRequest("insufficient wallet balance");

  const updateFields: Record<string, string> = { wallet: newBalance };
  if (type === "payment") {
    const currentOutstanding = parseFloat(customer.outstandingBalance ?? "0");
    const newOutstanding = Math.max(0, currentOutstanding - numAmount).toFixed(2);
    updateFields.outstandingBalance = newOutstanding;
  }
  await db.update(customers).set(updateFields as any).where(eq(customers.id, customerId));
  const [tx] = await db.insert(customerWalletTransactions).values({
    customer: customerId,
    shop: customer.shop,
    amount: String(numAmount.toFixed(2)),
    balance: newBalance,
    type,
    paymentNo: paymentNo ?? null,
    paymentReference: paymentReference ?? null,
    paymentType: paymentType ?? null,
    handledBy: req.attendant?.id ?? undefined,
  }).returning();

  return { wallet: newBalance, transaction: tx };
}

router.post("/:id/wallet/deposit", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const result = await applyWalletChange(req, "deposit", (n) => n);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/wallet/withdraw", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const result = await applyWalletChange(req, "withdraw", (n) => -n);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/wallet/payment", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { amount, paymentNo, paymentReference, paymentType } = req.body ?? {};
    if (!amount) throw badRequest("amount required");
    const customerId = Number(req.params["id"]);

    const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
    if (!customer) throw notFound("Customer not found");
    await assertShopOwnership(req, customer.shop);

    const numAmount = parseFloat(String(amount));
    if (Number.isNaN(numAmount) || numAmount <= 0) throw badRequest("amount must be positive");

    // 1. Reduce customer's aggregate outstanding balance
    const currentOutstanding = parseFloat(customer.outstandingBalance ?? "0");
    const newOutstanding = Math.max(0, currentOutstanding - numAmount).toFixed(2);
    await db.update(customers)
      .set({ outstandingBalance: newOutstanding })
      .where(eq(customers.id, customerId));

    // 2. Allocate payment against unpaid credit sales — oldest first
    const creditSales = await db.query.sales.findMany({
      where: and(
        eq(sales.customer, customerId),
        eq(sales.status, "credit"),
        gt(sales.outstandingBalance, "0"),
      ),
      orderBy: [asc(sales.createdAt)],
    });

    const currentWallet = parseFloat(customer.wallet ?? "0");
    let remaining = numAmount;
    const updatedSales: number[] = [];
    const insertedTxs: any[] = [];

    for (const sale of creditSales) {
      if (remaining <= 0) break;

      const saleOwed = parseFloat(sale.outstandingBalance);
      const applied = Math.min(remaining, saleOwed);
      const newSaleOutstanding = Math.max(0, saleOwed - applied).toFixed(2);
      const newSalePaid = (parseFloat(sale.amountPaid) + applied).toFixed(2);

      // Preserve the original paymentType — it reflects how the sale was made.
      // If the sale is now fully settled, promote status to "cashed".
      const isFullyPaid = parseFloat(newSaleOutstanding) === 0;
      await db.update(sales).set({
        amountPaid: newSalePaid,
        outstandingBalance: newSaleOutstanding,
        ...(isFullyPaid ? { status: "cashed" } : {}),
      }).where(eq(sales.id, sale.id));

      // Record a salePayments entry for traceability — tagged DEBT so the
      // collected-debt report can identify it reliably.
      await db.insert(salePayments).values({
        sale: sale.id,
        amount: String(applied.toFixed(2)),
        balance: newSaleOutstanding,
        paymentType: paymentType ?? "cash",
        paymentReference: paymentReference ?? null,
        receivedBy: req.attendant?.id ?? undefined,
        paymentNo: "DEBT",
      });

      // Record a wallet transaction per sale — linked via saleId so it is cleaned up if the sale is deleted
      const [tx] = await db.insert(customerWalletTransactions).values({
        customer: customerId,
        shop: customer.shop,
        amount: String(applied.toFixed(2)),
        balance: currentWallet.toFixed(2),
        type: "payment",
        paymentNo: sale.receiptNo ?? paymentNo ?? null,
        paymentReference: paymentReference ?? null,
        paymentType: paymentType ?? null,
        handledBy: req.attendant?.id ?? undefined,
        saleId: sale.id,
      }).returning();
      insertedTxs.push(tx);

      updatedSales.push(sale.id);
      remaining -= applied;
    }

    // If any amount was unallocated (no credit sales to absorb it), record a generic payment entry
    if (remaining > 0) {
      const [tx] = await db.insert(customerWalletTransactions).values({
        customer: customerId,
        shop: customer.shop,
        amount: String(remaining.toFixed(2)),
        balance: currentWallet.toFixed(2),
        type: "payment",
        paymentNo: paymentNo ?? null,
        paymentReference: paymentReference ?? null,
        paymentType: paymentType ?? null,
        handledBy: req.attendant?.id ?? undefined,
      }).returning();
      insertedTxs.push(tx);
    }

    return ok(res, {
      transaction: insertedTxs[0] ?? null,
      customerOutstanding: newOutstanding,
      salesUpdated: updatedSales.length,
      amountAllocated: (numAmount - remaining).toFixed(2),
      amountUnallocated: remaining > 0 ? remaining.toFixed(2) : "0.00",
    });
  } catch (e) { next(e); }
});

// ── Loyalty ─────────────────────────────────────────────────────────────────

// GET /customers/:id/loyalty — balance + recent transaction history
router.get("/:id/loyalty", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const cust = await db.query.customers.findFirst({
      where: eq(customers.id, Number(req.params["id"])),
      columns: { id: true, name: true, loyaltyPoints: true, shop: true },
    });
    if (!cust) throw notFound("Customer");
    await assertShopOwnership(req, cust.shop);

    const shopSettings = await db.query.shops.findFirst({
      where: eq(shops.id, cust.shop),
      columns: { loyaltyEnabled: true, loyaltyRedemptionEnabled: true, pointsPerAmount: true, pointsValue: true },
    });

    const transactions = await db.query.loyaltyTransactions.findMany({
      where: and(
        eq(loyaltyTransactions.customer, cust.id),
        eq(loyaltyTransactions.shop, cust.shop),
      ),
      orderBy: [desc(loyaltyTransactions.createdAt)],
      limit: 50,
    });

    return ok(res, {
      customerId: cust.id,
      customerName: cust.name,
      loyaltyPoints: parseFloat(String(cust.loyaltyPoints ?? 0)),
      shopSettings,
      transactions,
    });
  } catch (e) { next(e); }
});

// POST /customers/:id/loyalty/adjust — manually add or deduct points (admin only)
router.post("/:id/loyalty/adjust", requireAdmin, async (req, res, next) => {
  try {
    const { points, note } = req.body as { points: number; note?: string };
    if (!points || isNaN(Number(points))) throw badRequest("points (number) is required");

    const cust = await db.query.customers.findFirst({
      where: eq(customers.id, Number(req.params["id"])),
      columns: { id: true, name: true, loyaltyPoints: true, shop: true },
    });
    if (!cust) throw notFound("Customer");
    await assertShopOwnership(req, cust.shop);

    const current = parseFloat(String(cust.loyaltyPoints ?? 0));
    const delta = Number(points);
    const newBalance = Math.max(0, current + delta);

    await db.update(customers)
      .set({ loyaltyPoints: String(newBalance.toFixed(2)) })
      .where(eq(customers.id, cust.id));

    const [tx] = await db.insert(loyaltyTransactions).values({
      customer: cust.id,
      shop: cust.shop,
      type: delta >= 0 ? "earn" : "redeem",
      points: String(delta.toFixed(2)),
      balanceAfter: String(newBalance.toFixed(2)),
      note: note ?? "Manual adjustment",
    }).returning();

    return ok(res, { loyaltyPoints: newBalance, transaction: tx });
  } catch (e) { next(e); }
});

// ── Email statement ───────────────────────────────────────────────────────────
router.post("/:id/email-statement", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const customerId = Number(req.params["id"]);
    const { subject, html, toEmail } = req.body ?? {};
    if (!html) throw badRequest("html body required");

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
      columns: { id: true, name: true, email: true, shop: true },
    });
    if (!customer) throw notFound("Customer");
    await assertShopOwnership(req, customer.shop);

    const recipientEmail = toEmail || customer.email;
    if (!recipientEmail) throw badRequest("Customer has no email address. Please add one first.");

    const result = await sendRawEmail({
      to: recipientEmail,
      name: customer.name,
      subject: subject || `Account Statement — ${customer.name}`,
      html,
    });

    if (!result.ok) {
      if (result.skipped) return ok(res, { sent: false, reason: result.skipped });
      throw new Error(result.error || "Email failed to send");
    }
    return ok(res, { sent: true, to: recipientEmail });
  } catch (e) { next(e); }
});

export default router;
