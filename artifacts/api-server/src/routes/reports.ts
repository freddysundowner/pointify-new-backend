import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  sales, saleItems, purchases, purchaseItems, expenses,
  customers, suppliers, products, inventory, cashflows, admins
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

function shopDate(shopId: number | null, from: Date | null, to: Date | null, table: any) {
  const conditions = [];
  if (shopId) conditions.push(eq(table.shop, shopId));
  if (from) conditions.push(gte(table.createdAt, from));
  if (to) conditions.push(lte(table.createdAt, to));
  return conditions.length > 1 ? and(...conditions) : conditions[0];
}

// ── Sales Summary ─────────────────────────────────────────────────────────────

router.get("/sales", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const where = shopDate(shopId, from, to, sales);
    const [summary] = await db.select({
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
    }).from(sales).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

router.get("/sales/by-product", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));

    const rows = await db.select({
      productId: saleItems.product,
      totalQty: sql<string>`SUM(${saleItems.quantity}::numeric)`,
      totalRevenue: sql<string>`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .groupBy(saleItems.product)
    .orderBy(sql`SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric) DESC`)
    .limit(20);

    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/sales/by-customer", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));

    const rows = await db.select({
      customerId: sales.customer,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`SUM(${sales.totalWithDiscount}::numeric)`,
    })
    .from(sales)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .groupBy(sales.customer)
    .orderBy(sql`SUM(${sales.totalWithDiscount}::numeric) DESC`)
    .limit(20);

    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Purchases Summary ──────────────────────────────────────────────────────────

router.get("/purchases", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const where = shopDate(shopId, from, to, purchases);
    const [summary] = await db.select({
      totalPurchases: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${purchases.amountPaid}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
    }).from(purchases).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

// ── Expenses Summary ───────────────────────────────────────────────────────────

router.get("/expenses", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const where = shopDate(shopId, from, to, expenses);
    const [summary] = await db.select({
      totalExpenses: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    }).from(expenses).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

// ── Profit and Loss ────────────────────────────────────────────────────────────

router.get("/profit-loss", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const salesWhere = shopDate(shopId, from, to, sales);
    const expensesWhere = shopDate(shopId, from, to, expenses);

    const [[salesSummary], [expensesSummary]] = await Promise.all([
      db.select({
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        cost: sql<string>`COALESCE(SUM(${sales.totalAmount}::numeric * 0.7), 0)`,
      }).from(sales).where(salesWhere),
      db.select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expensesWhere),
    ]);

    const revenue = parseFloat(salesSummary?.revenue ?? "0");
    const expensesTotal = parseFloat(expensesSummary?.totalExpenses ?? "0");
    const profit = revenue - expensesTotal;

    return ok(res, { revenue, expenses: expensesTotal, profit });
  } catch (e) { next(e); }
});

// ── Inventory Valuation ────────────────────────────────────────────────────────

router.get("/inventory", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(inventory.shop, shopId) : undefined;

    const [summary] = await db
      .select({
        totalProducts: sql<number>`COUNT(*)`,
        totalQuantity: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric), 0)`,
        totalValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.product, products.id))
      .where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

// ── Credit / Debt ─────────────────────────────────────────────────────────────

router.get("/credit", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? and(eq(sales.shop, shopId), sql`${sales.outstandingBalance}::numeric > 0`) : sql`${sales.outstandingBalance}::numeric > 0`;

    const [summary] = await db.select({
      totalCredit: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      creditCount: sql<number>`COUNT(*)`,
    }).from(sales).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

// ── Cross-shop analytics (super admin) ────────────────────────────────────────

router.get("/cross-shop", requireAdmin, async (req, res, next) => {
  try {
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      shopId: sales.shop,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`SUM(${sales.totalWithDiscount}::numeric)`,
    }).from(sales).where(where).groupBy(sales.shop).orderBy(sql`SUM(${sales.totalWithDiscount}::numeric) DESC`);

    return ok(res, rows);
  } catch (e) { next(e); }
});

export default router;
