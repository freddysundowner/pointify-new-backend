import { Router } from "express";
import { eq, and, gte, lte, ilike } from "drizzle-orm";
import {
  expenses, expenseCategories, cashflows, cashflowCategories,
  banks, paymentMethods, userPayments
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

// ── Expense Categories ────────────────────────────────────────────────────────

router.get("/expense-categories", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.query["shopId"] ?? 0);
    const rows = await db.query.expenseCategories.findMany({
      where: shopId ? eq(expenseCategories.shop, shopId) : undefined,
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/expense-categories", requireAdmin, async (req, res, next) => {
  try {
    const { name, shopId } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    const [row] = await db.insert(expenseCategories).values({ name, shop: Number(shopId) }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/expense-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    const [updated] = await db.update(expenseCategories).set({ name }).where(eq(expenseCategories.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Category not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/expense-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(expenseCategories).where(eq(expenseCategories.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Cashflow Categories ───────────────────────────────────────────────────────

router.get("/cashflow-categories", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.query["shopId"] ?? 0);
    const rows = await db.query.cashflowCategories.findMany({
      where: shopId ? eq(cashflowCategories.shop, shopId) : undefined,
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/cashflow-categories", requireAdmin, async (req, res, next) => {
  try {
    const { name, shopId, type } = req.body;
    if (!name || !shopId || !type) throw badRequest("name, shopId and type required");
    const [row] = await db.insert(cashflowCategories).values({ name, shop: Number(shopId), type }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/cashflow-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    const [updated] = await db.update(cashflowCategories).set({ name }).where(eq(cashflowCategories.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Category not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/cashflow-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(cashflowCategories).where(eq(cashflowCategories.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Expenses ──────────────────────────────────────────────────────────────────

router.get("/expenses", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(expenses.shop, shopId));
    if (from) conditions.push(gte(expenses.createdAt, from));
    if (to) conditions.push(lte(expenses.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.expenses.findMany({ where, limit, offset, orderBy: (e, { desc }) => [desc(e.createdAt)] });
    const total = await db.$count(expenses, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/expenses", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, description, amount, categoryId, isRecurring, frequency } = req.body;
    if (!shopId || !amount) throw badRequest("shopId and amount required");

    const [row] = await db.insert(expenses).values({
      shop: Number(shopId),
      description,
      amount: String(amount),
      category: categoryId ? Number(categoryId) : null,
      recordedBy: req.attendant?.id ?? undefined,
      isRecurring: Boolean(isRecurring),
      frequency,
      expenseNo: `EXP${Date.now()}`,
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/expenses/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.expenses.findFirst({ where: eq(expenses.id, Number(req.params["id"])) });
    if (!row) throw notFound("Expense not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/expenses/:id", requireAdmin, async (req, res, next) => {
  try {
    const { description, amount, categoryId } = req.body;
    const [updated] = await db.update(expenses).set({
      ...(description !== undefined && { description }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(categoryId !== undefined && { category: categoryId ? Number(categoryId) : null }),
    }).where(eq(expenses.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Expense not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/expenses/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(expenses).where(eq(expenses.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Banks ─────────────────────────────────────────────────────────────────────

router.get("/banks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.query["shopId"] ?? 0);
    const rows = await db.query.banks.findMany({
      where: shopId ? eq(banks.shop, shopId) : undefined,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/banks", requireAdmin, async (req, res, next) => {
  try {
    const { name, shopId, balance } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    const [row] = await db.insert(banks).values({
      name,
      shop: Number(shopId),
      balance: balance ? String(balance) : "0",
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/banks/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.banks.findFirst({ where: eq(banks.id, Number(req.params["id"])) });
    if (!row) throw notFound("Bank not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/banks/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, balance } = req.body;
    const [updated] = await db.update(banks).set({
      ...(name && { name }),
      ...(balance !== undefined && { balance: String(balance) }),
    }).where(eq(banks.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Bank not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/banks/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(banks).where(eq(banks.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Cashflows ─────────────────────────────────────────────────────────────────

router.get("/cashflows", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(cashflows.shop, shopId));
    if (from) conditions.push(gte(cashflows.createdAt, from));
    if (to) conditions.push(lte(cashflows.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.cashflows.findMany({ where, limit, offset, orderBy: (c, { desc }) => [desc(c.createdAt)] });
    const total = await db.$count(cashflows, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/cashflows", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, description, amount, categoryId, bankId } = req.body;
    if (!shopId || !description || !amount) throw badRequest("shopId, description and amount required");

    const [row] = await db.insert(cashflows).values({
      shop: Number(shopId),
      description,
      amount: String(amount),
      category: categoryId ? Number(categoryId) : null,
      recordedBy: req.attendant?.id ?? undefined,
      bank: bankId ? Number(bankId) : null,
      cashflowNo: `CF${Date.now()}`,
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/cashflows/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.cashflows.findFirst({ where: eq(cashflows.id, Number(req.params["id"])) });
    if (!row) throw notFound("Cashflow not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/cashflows/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(cashflows).where(eq(cashflows.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Payment Methods ───────────────────────────────────────────────────────────

router.get("/payment-methods", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.query["shopId"] ?? 0);
    const rows = await db.query.paymentMethods.findMany({
      where: shopId ? eq(paymentMethods.shop, shopId) : undefined,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/payment-methods", requireAdmin, async (req, res, next) => {
  try {
    const { name, description, shopId } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    const [row] = await db.insert(paymentMethods).values({
      name, description, shop: Number(shopId),
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/payment-methods/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    const [updated] = await db.update(paymentMethods).set({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    }).where(eq(paymentMethods.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Payment method not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/payment-methods/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── User Payments ─────────────────────────────────────────────────────────────

router.get("/user-payments", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const type = req.query["type"] ? String(req.query["type"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(userPayments.shopId, shopId));
    if (type) conditions.push(eq(userPayments.type, type));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.userPayments.findMany({ where, limit, offset, orderBy: (p, { desc }) => [desc(p.createdAt)] });
    const total = await db.$count(userPayments, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/user-payments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { shopId, amount, type, customerId, supplierId, paymentType, mpesaCode } = req.body;
    if (!shopId || !amount || !type) throw badRequest("shopId, amount and type required");

    const [row] = await db.insert(userPayments).values({
      shopId: Number(shopId),
      totalAmount: String(amount),
      balance: "0",
      type,
      paymentType,
      mpesaCode,
      customerId: customerId ? Number(customerId) : null,
      supplierId: supplierId ? Number(supplierId) : null,
      processedById: req.attendant?.id ?? undefined,
      adminId: req.admin?.id ?? undefined,
      paymentNo: `PAY${Date.now()}`,
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

export default router;
