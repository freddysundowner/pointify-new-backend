import { Router } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { customers, customerWalletTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
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
    return created(res, safe);
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
    const [updated] = await db.update(customers).set({
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(creditLimit !== undefined && { creditLimit: creditLimit ? String(creditLimit) : null }),
      ...(type && { type }),
    }).where(eq(customers.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Customer not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(customers).where(eq(customers.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Customer not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.get("/:id/wallet", requireAdminOrAttendant, async (req, res, next) => {
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
    const { amount, note } = req.body;
    if (!amount) throw badRequest("amount required");
    const customerId = Number(req.params["id"]);

    const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
    if (!customer) throw notFound("Customer not found");

    const newBalance = (parseFloat(customer.wallet ?? "0") + parseFloat(String(amount))).toFixed(2);

    await db.update(customers).set({ wallet: newBalance }).where(eq(customers.id, customerId));
    await db.insert(customerWalletTransactions).values({
      customer: customerId,
      shop: customer.shop,
      amount: String(amount),
      balance: newBalance,
      type: "topup",
    });

    return ok(res, { wallet: newBalance, message: "Wallet updated" });
  } catch (e) { next(e); }
});

router.put("/:id/verify", requireAdmin, async (req, res, next) => {
  try {
    const [updated] = await db.update(customers)
      .set({ type: "verified" })
      .where(eq(customers.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Customer not found");
    return ok(res, { message: "Customer verified" });
  } catch (e) { next(e); }
});

export default router;
