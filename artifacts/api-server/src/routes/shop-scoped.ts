import { Router } from "express";
import { eq, and, or, ilike, gte, lte, sql, desc } from "drizzle-orm";
import {
  products, productCategories, customers, suppliers,
  sales, saleItems, saleReturns,
  purchases, purchaseItems, purchaseReturns,
  orders, productTransfers,
  inventory, batches, productSerials,
  banks, expenses, expenseCategories,
  cashflows, cashflowCategories, paymentMethods,
  badStocks, adjustments, stockCounts, stockRequests,
  attendants, shops,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, paginated } from "../lib/response.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";
import { attachBundleItems } from "../lib/attach-bundle-items.js";
import { extractBearer, verifyToken } from "../lib/auth.js";

const router = Router({ mergeParams: true });

function shopId(req: any): number {
  const id = Number(req.params["shopId"]);
  if (!id || isNaN(id)) throw badRequest("Invalid shopId");
  return id;
}

// ── Cross-shop ownership guard ────────────────────────────────────────────────
// Runs BEFORE per-route auth middleware. Verifies the bearer token, then ensures
// the requested :shopId belongs to the caller (admin owner OR attendant's shop).
// Super-admins bypass.
router.use(async (req, _res, next) => {
  try {
    const sid = Number(req.params["shopId"]);
    if (!sid || isNaN(sid)) return next();

    const token = extractBearer(req.headers["authorization"]);
    if (!token) return next();
    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      return next();
    }

    if (payload.role === "admin") {
      if ((payload as any).isSuperAdmin) return next();
      const shop = await db.query.shops.findFirst({
        where: and(eq(shops.id, sid), eq(shops.admin, payload.id)),
      });
      if (!shop) throw forbidden("Cross-shop access denied");
      return next();
    }

    if (payload.role === "attendant") {
      const assigned = (payload as any).shopId;
      if (assigned && Number(assigned) !== sid) {
        throw forbidden("Cross-shop access denied");
      }
      return next();
    }

    return next();
  } catch (err) {
    next(err);
  }
});

function dateRange(req: any) {
  const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
  const to = req.query["to"] ? new Date(String(req.query["to"])) : null;
  return { from, to };
}

// ── Products ──────────────────────────────────────────────────────────────────

router.get("/products", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const conditions = [eq(products.shop, sid)];
    if (search) conditions.push(ilike(products.name, `%${search}%`));
    if (req.query["category"]) conditions.push(eq(products.category, Number(req.query["category"])));
    if (req.query["barcode"]) conditions.push(eq(products.barcode, String(req.query["barcode"])));
    const where = and(...conditions);
    const rows = await db.query.products.findMany({
      where, limit, offset, orderBy: (p, { asc }) => [asc(p.name)],
    });
    const total = await db.$count(products, where);
    return paginated(res, await attachBundleItems(rows), { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/products/bulk-import", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const items = Array.isArray(req.body?.products) ? req.body.products : [];
    if (!items.length) throw badRequest("products array required");
    let created_n = 0;
    const errors: any[] = [];
    for (const p of items) {
      try {
        if (!p.name) { errors.push({ name: p.name, error: "name required" }); continue; }
        await db.insert(products).values({
          name: p.name,
          shop: sid,
          buyingPrice: p.buyingPrice ? String(p.buyingPrice) : null,
          sellingPrice: p.sellingPrice ? String(p.sellingPrice) : null,
          wholesalePrice: p.wholesalePrice ? String(p.wholesalePrice) : null,
          dealerPrice: p.dealerPrice ? String(p.dealerPrice) : null,
          category: p.category ? Number(p.category) : null,
          measureUnit: p.measureUnit ?? "",
          manufacturer: p.manufacturer ?? "",
          supplier: p.supplier ? Number(p.supplier) : null,
          description: p.description,
          barcode: p.barcode,
          serialNumber: p.sku,
          type: p.type ?? "product",
        });
        created_n++;
      } catch (err: any) {
        errors.push({ name: p.name, error: err?.message ?? "insert failed" });
      }
    }
    return ok(res, { created: created_n, skipped: errors.length, errors });
  } catch (e) { next(e); }
});

// ── Categories (alias for product-categories — admin scoped) ──────────────────

router.get("/categories", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const shop = await db.query.shops.findFirst({ where: eq(shops.id, sid) });
    const adminId = shop?.admin;
    const rows = adminId
      ? await db.query.productCategories.findMany({
          where: eq(productCategories.admin, adminId),
          orderBy: (c, { asc }) => [asc(c.name)],
        })
      : [];
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Customers ─────────────────────────────────────────────────────────────────

router.get("/customers", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const conditions = [eq(customers.shop, sid)];
    if (search) conditions.push(ilike(customers.name, `%${search}%`));
    const where = and(...conditions);
    const rows = await db.query.customers.findMany({
      where, limit, offset, orderBy: (c, { asc }) => [asc(c.name)],
    });
    const total = await db.$count(customers, where);
    return paginated(res, rows.map(({ password: _, otp: __, ...c }) => c), { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/customers/overdue", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(customers.shop, sid), sql`${customers.outstandingBalance}::numeric > 0`);
    const rows = await db.query.customers.findMany({
      where, orderBy: (c, { desc }) => [desc(c.outstandingBalance)],
    });
    return ok(res, rows.map(({ password: _, otp: __, ...c }) => c));
  } catch (e) { next(e); }
});

router.get("/customers/analysis", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const [stats] = await db.select({
      totalCustomers: sql<number>`COUNT(*)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${customers.outstandingBalance}::numeric), 0)`,
      totalWallet: sql<string>`COALESCE(SUM(${customers.wallet}::numeric), 0)`,
    }).from(customers).where(eq(customers.shop, sid));
    return ok(res, stats);
  } catch (e) { next(e); }
});

router.get("/customers/debtors/export", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(customers.shop, sid), sql`${customers.outstandingBalance}::numeric > 0`);
    const rows = await db.query.customers.findMany({ where });
    return ok(res, { format: "csv", note: "client should render CSV", rows: rows.map(({ password: _, otp: __, ...c }) => c) });
  } catch (e) { next(e); }
});

router.post("/customers/bulk-import", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const items = Array.isArray(req.body?.customers) ? req.body.customers : [];
    if (!items.length) throw badRequest("customers array required");
    let created_n = 0;
    const errors: any[] = [];
    const startNo = (await db.$count(customers, eq(customers.shop, sid))) + 1;
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      try {
        if (!c.name) { errors.push({ row: i, error: "name required" }); continue; }
        await db.insert(customers).values({
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          shop: sid,
          customerNo: startNo + created_n,
          type: c.type ?? "retail",
          creditLimit: c.creditLimit ? String(c.creditLimit) : null,
        });
        created_n++;
      } catch (err: any) {
        errors.push({ row: i, error: err?.message ?? "insert failed" });
      }
    }
    return ok(res, { created: created_n, skipped: errors.length, errors });
  } catch (e) { next(e); }
});

// ── Suppliers ─────────────────────────────────────────────────────────────────

router.get("/suppliers", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const conditions = [eq(suppliers.shop, sid)];
    if (search) conditions.push(ilike(suppliers.name, `%${search}%`));
    const where = and(...conditions);
    const rows = await db.query.suppliers.findMany({
      where, limit, offset, orderBy: (s, { asc }) => [asc(s.name)],
    });
    const total = await db.$count(suppliers, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/suppliers/bulk-import", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const items = Array.isArray(req.body?.suppliers) ? req.body.suppliers : [];
    if (!items.length) throw badRequest("suppliers array required");
    let created_n = 0;
    const errors: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      try {
        if (!s.name) { errors.push({ row: i, error: "name required" }); continue; }
        await db.insert(suppliers).values({
          name: s.name, phone: s.phone, email: s.email, address: s.address, shop: sid,
        });
        created_n++;
      } catch (err: any) {
        errors.push({ row: i, error: err?.message ?? "insert failed" });
      }
    }
    return ok(res, { created: created_n, skipped: errors.length, errors });
  } catch (e) { next(e); }
});

// ── Sales ─────────────────────────────────────────────────────────────────────

router.get("/sales", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(sales.shop, sid)];
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = and(...conditions);
    const rows = await db.query.sales.findMany({
      where, limit, offset, orderBy: (s, { desc }) => [desc(s.createdAt)],
      with: { saleItems: true, salePayments: true },
    });
    const total = await db.$count(sales, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/sales/cross-shop", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(sales.shop, sid)];
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = and(...conditions);
    const [summary] = await db.select({
      shopId: sales.shop,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
    }).from(sales).where(where).groupBy(sales.shop);
    return ok(res, summary ?? { shopId: sid, totalSales: 0, totalRevenue: "0" });
  } catch (e) { next(e); }
});

router.get("/sales/statement", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(sales.shop, sid)];
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = and(...conditions);
    const rows = await db.query.sales.findMany({
      where, orderBy: (s, { desc }) => [desc(s.createdAt)], limit: 500,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/sales/email-report", requireAdminOrAttendant, async (_req, res, next) => {
  try {
    return ok(res, { message: "Sales report queued", note: "email integration stub" });
  } catch (e) { next(e); }
});

router.get("/sale-returns", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(saleReturns.shop, sid);
    const rows = await db.query.saleReturns.findMany({
      where, limit, offset, orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { saleReturnItems: true },
    });
    const total = await db.$count(saleReturns, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Purchases ─────────────────────────────────────────────────────────────────

router.get("/purchases", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(purchases.shop, sid)];
    if (from) conditions.push(gte(purchases.createdAt, from));
    if (to) conditions.push(lte(purchases.createdAt, to));
    const where = and(...conditions);
    const rows = await db.query.purchases.findMany({
      where, limit, offset, orderBy: (p, { desc }) => [desc(p.createdAt)],
      with: { purchaseItems: true, purchasePayments: true },
    });
    const total = await db.$count(purchases, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/purchases/monthly-analysis", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      month: sql<string>`to_char(${purchases.createdAt}, 'YYYY-MM')`,
      total: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(purchases)
    .where(eq(purchases.shop, sid))
    .groupBy(sql`to_char(${purchases.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${purchases.createdAt}, 'YYYY-MM') DESC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/purchases/email-report", requireAdmin, async (_req, res, next) => {
  try {
    return ok(res, { message: "Purchases report queued", note: "email integration stub" });
  } catch (e) { next(e); }
});

router.get("/purchase-returns", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(purchaseReturns.shop, sid);
    const rows = await db.query.purchaseReturns.findMany({
      where, limit, offset, orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { purchaseReturnItems: true },
    });
    const total = await db.$count(purchaseReturns, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Orders ────────────────────────────────────────────────────────────────────

router.get("/orders", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(orders.shop, sid);
    const rows = await db.query.orders.findMany({
      where, limit, offset, orderBy: (o, { desc }) => [desc(o.createdAt)],
      with: { orderItems: true },
    });
    const total = await db.$count(orders, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Transfers ─────────────────────────────────────────────────────────────────

router.get("/transfers", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = or(eq(productTransfers.fromShop, sid), eq(productTransfers.toShop, sid));
    const rows = await db.query.productTransfers.findMany({
      where, limit, offset, orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: { transferItems: true },
    });
    const total = await db.$count(productTransfers, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Inventory / Batches / Serials ─────────────────────────────────────────────

router.get("/inventory", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(inventory.shop, sid);
    const rows = await db.query.inventory.findMany({
      where, limit, offset, with: { product: true },
    });
    const total = await db.$count(inventory, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/batches", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(batches.shop, sid);
    const rows = await db.query.batches.findMany({
      where, limit, offset, orderBy: (b, { asc }) => [asc(b.expirationDate)],
    });
    const total = await db.$count(batches, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/serials", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(productSerials.shop, sid);
    const rows = await db.query.productSerials.findMany({ where, limit, offset });
    const total = await db.$count(productSerials, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Banks ─────────────────────────────────────────────────────────────────────

router.get("/banks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.banks.findMany({ where: eq(banks.shop, sid) });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Expenses ──────────────────────────────────────────────────────────────────

router.get("/expenses", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(expenses.shop, sid)];
    if (from) conditions.push(gte(expenses.createdAt, from));
    if (to) conditions.push(lte(expenses.createdAt, to));
    const where = and(...conditions);
    const rows = await db.query.expenses.findMany({
      where, limit, offset, orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    const total = await db.$count(expenses, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/expenses/stats", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const [stats] = await db.select({
      totalExpenses: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    }).from(expenses).where(eq(expenses.shop, sid));
    return ok(res, stats);
  } catch (e) { next(e); }
});

router.get("/expense-categories", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.expenseCategories.findMany({
      where: eq(expenseCategories.shop, sid),
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Cashflows ─────────────────────────────────────────────────────────────────

router.get("/cashflows", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(cashflows.shop, sid)];
    if (from) conditions.push(gte(cashflows.createdAt, from));
    if (to) conditions.push(lte(cashflows.createdAt, to));
    const where = and(...conditions);
    const rows = await db.query.cashflows.findMany({
      where, limit, offset, orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
    const total = await db.$count(cashflows, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/cashflows/total-by-category", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      categoryId: cashflows.category,
      total: sql<string>`COALESCE(SUM(${cashflows.amount}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(cashflows).where(eq(cashflows.shop, sid)).groupBy(cashflows.category);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/cashflow-categories", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.cashflowCategories.findMany({
      where: eq(cashflowCategories.shop, sid),
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/payment-methods", requireAdminOrAttendant, async (_req, res, next) => {
  try {
    // Payment methods are global (super-admin controlled), not shop-scoped.
    const rows = await db.query.paymentMethods.findMany({
      orderBy: (m, { asc }) => [asc(m.sortOrder), asc(m.id)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Bad Stocks ────────────────────────────────────────────────────────────────

router.get("/bad-stocks", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(badStocks.shop, sid);
    const rows = await db.query.badStocks.findMany({
      where, limit, offset, orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
    const total = await db.$count(badStocks, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/bad-stocks/analysis", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      productId: badStocks.product,
      totalQuantity: sql<string>`COALESCE(SUM(${badStocks.quantity}::numeric), 0)`,
      totalValue: sql<string>`COALESCE(SUM(${badStocks.quantity}::numeric * ${badStocks.unitPrice}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(badStocks).where(eq(badStocks.shop, sid)).groupBy(badStocks.product);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/bad-stocks/summary", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const [summary] = await db.select({
      totalEntries: sql<number>`COUNT(*)`,
      totalQuantity: sql<string>`COALESCE(SUM(${badStocks.quantity}::numeric), 0)`,
      totalValue: sql<string>`COALESCE(SUM(${badStocks.quantity}::numeric * ${badStocks.unitPrice}::numeric), 0)`,
    }).from(badStocks).where(eq(badStocks.shop, sid));
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/adjustments", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(adjustments.shop, sid);
    const rows = await db.query.adjustments.findMany({
      where, limit, offset, orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(adjustments, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Stock Counts / Requests ───────────────────────────────────────────────────

router.get("/stock-counts", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = eq(stockCounts.shop, sid);
    const rows = await db.query.stockCounts.findMany({
      where, limit, offset, orderBy: (sc, { desc }) => [desc(sc.createdAt)],
      with: { stockCountItems: true },
    });
    const total = await db.$count(stockCounts, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/stock-counts/product-search", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const q = String(req.query["q"] ?? "").trim();
    const conditions = [eq(products.shop, sid)];
    if (q) conditions.push(ilike(products.name, `%${q}%`));
    const rows = await db.query.products.findMany({
      where: and(...conditions), limit: 50, orderBy: (p, { asc }) => [asc(p.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/stock-counts/product-filter", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.products.findMany({
      where: and(eq(products.shop, sid), eq(products.isDeleted, false)),
      limit: 200, orderBy: (p, { asc }) => [asc(p.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/stock-requests", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { page, limit, offset } = getPagination(req);
    const where = or(eq(stockRequests.fromShop, sid), eq(stockRequests.warehouse, sid));
    const rows = await db.query.stockRequests.findMany({
      where, limit, offset, orderBy: (sr, { desc }) => [desc(sr.createdAt)],
      with: { stockRequestItems: true },
    });
    const total = await db.$count(stockRequests, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Attendants ────────────────────────────────────────────────────────────────

router.get("/attendants", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(attendants.admin, req.admin!.id), eq(attendants.shop, sid));
    const rows = await db.query.attendants.findMany({ where });
    return ok(res, rows.map(({ pin: _, password: __, ...a }) => a));
  } catch (e) { next(e); }
});

// ── Activities (synthetic union of recent events) ─────────────────────────────

router.get("/activities", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { limit } = getPagination(req);
    const recentSales = await db.query.sales.findMany({
      where: eq(sales.shop, sid),
      limit, orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    const recentPurchases = await db.query.purchases.findMany({
      where: eq(purchases.shop, sid),
      limit, orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    const recentExpenses = await db.query.expenses.findMany({
      where: eq(expenses.shop, sid),
      limit, orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    const events = [
      ...recentSales.map((s) => ({ type: "sale", id: s.id, ref: s.receiptNo, amount: s.totalWithDiscount, at: s.createdAt })),
      ...recentPurchases.map((p) => ({ type: "purchase", id: p.id, ref: p.purchaseNo, amount: p.totalAmount, at: p.createdAt })),
      ...recentExpenses.map((e) => ({ type: "expense", id: e.id, ref: e.expenseNo, amount: e.amount, at: e.createdAt })),
    ].sort((a, b) => (new Date(b.at as any).getTime()) - (new Date(a.at as any).getTime())).slice(0, limit);
    return ok(res, events);
  } catch (e) { next(e); }
});

// ── Reports (shop-scoped) ─────────────────────────────────────────────────────

function shopDateWhere(sid: number, from: Date | null, to: Date | null, table: any) {
  const conditions = [eq(table.shop, sid)];
  if (from) conditions.push(gte(table.createdAt, from));
  if (to) conditions.push(lte(table.createdAt, to));
  return and(...conditions);
}

router.get("/reports/sales", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const where = shopDateWhere(sid, from, to, sales);
    const [summary] = await db.select({
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
    }).from(sales).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/reports/profit", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const salesWhere = shopDateWhere(sid, from, to, sales);
    const expensesWhere = shopDateWhere(sid, from, to, expenses);
    const [[s], [e]] = await Promise.all([
      db.select({
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        cost: sql<string>`COALESCE(SUM(${sales.totalAmount}::numeric * 0.7), 0)`,
      }).from(sales).where(salesWhere),
      db.select({
        total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expensesWhere),
    ]);
    const revenue = parseFloat(s?.revenue ?? "0");
    const expensesTotal = parseFloat(e?.total ?? "0");
    return ok(res, { revenue, expenses: expensesTotal, profit: revenue - expensesTotal });
  } catch (e) { next(e); }
});

router.get("/reports/profit-analysis", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      month: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM')`,
      revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
    })
    .from(sales).where(eq(sales.shop, sid))
    .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM') DESC`);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/product-sales", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const conditions = [eq(sales.shop, sid)];
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const rows = await db.select({
      productId: saleItems.product,
      totalQty: sql<string>`SUM(${saleItems.quantity}::numeric)`,
      totalRevenue: sql<string>`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(and(...conditions))
    .groupBy(saleItems.product)
    .orderBy(sql`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric) DESC`)
    .limit(50);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/top-products", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      productId: saleItems.product,
      totalQty: sql<string>`SUM(${saleItems.quantity}::numeric)`,
      totalRevenue: sql<string>`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(eq(sales.shop, sid))
    .groupBy(saleItems.product)
    .orderBy(sql`SUM(${saleItems.quantity}::numeric) DESC`)
    .limit(20);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/monthly-product-sales", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.select({
      productId: saleItems.product,
      month: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM')`,
      totalQty: sql<string>`SUM(${saleItems.quantity}::numeric)`,
      totalRevenue: sql<string>`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(eq(sales.shop, sid))
    .groupBy(saleItems.product, sql`to_char(${sales.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM') DESC`)
    .limit(200);
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/discounted-sales", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(sales.shop, sid), sql`${sales.saleDiscount}::numeric > 0`);
    const rows = await db.query.sales.findMany({
      where, limit: 200, orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/purchases", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const where = shopDateWhere(sid, from, to, purchases);
    const [summary] = await db.select({
      totalPurchases: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${purchases.amountPaid}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
    }).from(purchases).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/reports/expenses", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const { from, to } = dateRange(req);
    const where = shopDateWhere(sid, from, to, expenses);
    const [summary] = await db.select({
      totalExpenses: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    }).from(expenses).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/reports/stock", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const [summary] = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        totalQuantity: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric), 0)`,
        totalValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.product, products.id))
      .where(eq(inventory.shop, sid));
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/reports/stock-movement", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.adjustments.findMany({
      where: eq(adjustments.shop, sid),
      limit: 200, orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/debtors", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(customers.shop, sid), sql`${customers.outstandingBalance}::numeric > 0`);
    const rows = await db.query.customers.findMany({
      where, orderBy: (c, { desc }) => [desc(c.outstandingBalance)],
    });
    return ok(res, rows.map(({ password: _, otp: __, ...c }) => c));
  } catch (e) { next(e); }
});

router.get("/reports/dues", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const where = and(eq(sales.shop, sid), sql`${sales.outstandingBalance}::numeric > 0`);
    const rows = await db.query.sales.findMany({
      where, limit: 200, orderBy: (s, { desc }) => [desc(s.dueDate)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/profit/yearly/:year", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const year = Number(req.params["year"]);
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const salesWhere = and(eq(sales.shop, sid), gte(sales.createdAt, from), lte(sales.createdAt, to));
    const expensesWhere = and(eq(expenses.shop, sid), gte(expenses.createdAt, from), lte(expenses.createdAt, to));
    const [[s], [e]] = await Promise.all([
      db.select({
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      }).from(sales).where(salesWhere),
      db.select({
        total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expensesWhere),
    ]);
    const revenue = parseFloat(s?.revenue ?? "0");
    const expensesTotal = parseFloat(e?.total ?? "0");
    return ok(res, { year, revenue, expenses: expensesTotal, profit: revenue - expensesTotal });
  } catch (e) { next(e); }
});

router.get("/reports/stock-value", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const [summary] = await db
      .select({
        totalValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
        totalRetailValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric), 0)`,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.product, products.id))
      .where(eq(inventory.shop, sid));
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/reports/stock-count-analysis", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.stockCounts.findMany({
      where: eq(stockCounts.shop, sid),
      with: { stockCountItems: true },
      limit: 50, orderBy: (sc, { desc }) => [desc(sc.createdAt)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/reports/out-of-stock/export", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    const rows = await db.query.inventory.findMany({
      where: and(eq(inventory.shop, sid), eq(inventory.status, "out_of_stock")),
      with: { product: true },
    });
    return ok(res, { format: "csv", note: "client should render CSV", rows });
  } catch (e) { next(e); }
});

router.get("/reports/backup", requireAdmin, async (req, res, next) => {
  try {
    const sid = shopId(req);
    return ok(res, { shopId: sid, generatedAt: new Date().toISOString(), note: "backup snapshot stub" });
  } catch (e) { next(e); }
});

export default router;
