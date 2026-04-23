import { Router } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { customers, customerWalletTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { notifyCustomerWelcome, notifyWalletTopup } from "../lib/emailEvents.js";
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

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { name, phone, email, shopId, creditLimit, type, address } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    if (!phone) throw badRequest("phone required");
    await assertShopOwnership(req, Number(shopId));

    const existing = await db.query.customers.findMany({ where: eq(customers.shop, Number(shopId)) });
    const nextNo = existing.length + 1;

    const [customer] = await db.insert(customers).values({
      name,
      phone,
      email,
      address,
      shop: Number(shopId),
      creditLimit: creditLimit ? String(creditLimit) : null,
      type: type ?? "retail",
      customerNo: nextNo,
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

    const newBalance = (parseFloat(customer.wallet ?? "0") + parseFloat(String(amount))).toFixed(2);

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

  await db.update(customers).set({ wallet: newBalance }).where(eq(customers.id, customerId));
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
    const result = await applyWalletChange(req, "payment", (n) => -n);
    return ok(res, { ...result, note: "Wallet applied to outstanding balance (stub)" });
  } catch (e) { next(e); }
});

export default router;
