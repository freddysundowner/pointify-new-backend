import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  sales, saleItems, salePayments, purchases, purchaseItems, expenses,
  customers, suppliers, products, inventory, cashflows, admins,
  badStocks, stockCounts, stockCountItems, adjustments,
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

    const baseWhere = shopDate(shopId, from, to, sales);
    const where = baseWhere
      ? and(baseWhere, sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`)
      : sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`;
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
    conditions.push(sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`);

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
    conditions.push(sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`);

    const rows = await db.select({
      customerId: sales.customer,
      customerName: customers.name,
      customerPhone: customers.phone,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`SUM(${sales.totalWithDiscount}::numeric)`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customer, customers.id))
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .groupBy(sales.customer, customers.name, customers.phone)
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

    const baseSalesWhere = shopDate(shopId, from, to, sales);
    const salesWhere = baseSalesWhere
      ? and(baseSalesWhere, sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`)
      : sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`;
    const expensesWhere = shopDate(shopId, from, to, expenses);

    const [[revenueSummary], [costSummary], [expensesSummary]] = await Promise.all([
      db.select({
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      }).from(sales).where(salesWhere),
      db.select({
        cost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      }).from(saleItems)
        .innerJoin(sales, eq(saleItems.sale, sales.id))
        .where(salesWhere),
      db.select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expensesWhere),
    ]);

    const revenue = parseFloat(revenueSummary?.revenue ?? "0");
    const cost = parseFloat(costSummary?.cost ?? "0");
    const expensesTotal = parseFloat(expensesSummary?.totalExpenses ?? "0");
    const profit = revenue - cost - expensesTotal;

    return ok(res, { revenue, cost, expenses: expensesTotal, profit });
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
    const statusFilter = sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`;
    const where = shopId
      ? and(eq(sales.shop, shopId), sql`${sales.outstandingBalance}::numeric > 0`, statusFilter)
      : and(sql`${sales.outstandingBalance}::numeric > 0`, statusFilter);

    const [summary] = await db.select({
      totalCredit: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      creditCount: sql<number>`COUNT(*)`,
    }).from(sales).where(where);
    return ok(res, summary);
  } catch (e) { next(e); }
});

// ── Cross-shop analytics (super admin) ────────────────────────────────────────

// ── Monthly Product Sales ─────────────────────────────────────────────────────

router.get("/monthly-product-sales", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const year = req.query["year"] ? Number(req.query["year"]) : new Date().getFullYear();
    const productId = req.query["productId"] ? Number(req.query["productId"]) : null;

    const conditions = [
      gte(sales.createdAt, new Date(`${year}-01-01T00:00:00.000Z`)),
      lte(sales.createdAt, new Date(`${year}-12-31T23:59:59.999Z`)),
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`,
    ];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (productId) conditions.push(eq(saleItems.product, productId));

    const rows = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM ${sales.createdAt})`,
      productId: saleItems.product,
      totalQty: sql<string>`COALESCE(SUM(${saleItems.quantity}::numeric), 0)`,
      totalRevenue: sql<string>`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .where(and(...conditions))
    .groupBy(sql`EXTRACT(MONTH FROM ${sales.createdAt})`, saleItems.product)
    .orderBy(sql`EXTRACT(MONTH FROM ${sales.createdAt}) ASC`);

    return ok(res, { year, rows });
  } catch (e) { next(e); }
});

// ── Discounted Sales ──────────────────────────────────────────────────────────

router.get("/discounted-sales", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [sql`${sales.saleDiscount}::numeric > 0`];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = and(...conditions);

    const [summary] = await db.select({
      totalSales: sql<number>`COUNT(*)`,
      totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
    }).from(sales).where(where);

    const rows = await db.query.sales.findMany({
      where,
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      limit: 100,
    });

    return ok(res, { summary, rows });
  } catch (e) { next(e); }
});

// ── Stock Value ───────────────────────────────────────────────────────────────

router.get("/stock-value", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(inventory.shop, shopId) : undefined;

    const rows = await db.select({
      productId: inventory.product,
      productName: products.name,
      quantity: inventory.quantity,
      buyingPrice: products.buyingPrice,
      sellingPrice: products.sellingPrice,
      stockValueAtCost: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0)`,
      stockValueAtSale: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric, 0)`,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(where)
    .orderBy(sql`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0) DESC`);

    const totalAtCost = rows.reduce((s, r) => s + parseFloat(r.stockValueAtCost ?? "0"), 0);
    const totalAtSale = rows.reduce((s, r) => s + parseFloat(r.stockValueAtSale ?? "0"), 0);

    return ok(res, { rows, summary: { totalAtCost, totalAtSale, productCount: rows.length } });
  } catch (e) { next(e); }
});

// ── Stock Count Analysis ──────────────────────────────────────────────────────

router.get("/stock-count-analysis", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(stockCounts.shop, shopId));
    if (from) conditions.push(gte(stockCounts.createdAt, from));
    if (to) conditions.push(lte(stockCounts.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      stockCountId: stockCountItems.stockCount,
      productId: stockCountItems.product,
      physicalCount: stockCountItems.physicalCount,
      systemCount: stockCountItems.systemCount,
      variance: stockCountItems.variance,
      countedAt: stockCounts.createdAt,
    })
    .from(stockCountItems)
    .innerJoin(stockCounts, eq(stockCountItems.stockCount, stockCounts.id))
    .where(where)
    .orderBy(sql`${stockCounts.createdAt} DESC`);

    const totalVariance = rows.reduce((s, r) => s + parseFloat(String(r.variance ?? "0")), 0);
    return ok(res, { rows, summary: { totalCounts: rows.length, totalVariance } });
  } catch (e) { next(e); }
});

// ── Out-of-stock export ───────────────────────────────────────────────────────

router.get("/out-of-stock/export", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const conditions = [sql`${inventory.quantity}::numeric <= 0`];
    if (shopId) conditions.push(eq(inventory.shop, shopId));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      productId: inventory.product,
      productName: products.name,
      barcode: products.barcode,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      shopId: inventory.shop,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(where);

    return ok(res, { rows, count: rows.length, format: "json", note: "JSON snapshot suitable for client-side CSV/XLSX export." });
  } catch (e) { next(e); }
});

// ── Backup snapshot ───────────────────────────────────────────────────────────

router.get("/backup", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    if (!shopId) throw badRequest("shopId required");

    const [productsRows, inventoryRows, salesRows, purchasesRows, expensesRows, cashflowsRows, badStockRows, adjustmentsRows] = await Promise.all([
      db.query.products.findMany({ where: eq(products.shop, shopId), limit: 5000 }),
      db.query.inventory.findMany({ where: eq(inventory.shop, shopId), limit: 5000 }),
      db.query.sales.findMany({ where: eq(sales.shop, shopId), limit: 5000, orderBy: (s, { desc }) => [desc(s.createdAt)] }),
      db.query.purchases.findMany({ where: eq(purchases.shop, shopId), limit: 5000, orderBy: (p, { desc }) => [desc(p.createdAt)] }),
      db.query.expenses.findMany({ where: eq(expenses.shop, shopId), limit: 5000, orderBy: (e, { desc }) => [desc(e.createdAt)] }),
      db.query.cashflows.findMany({ where: eq(cashflows.shop, shopId), limit: 5000, orderBy: (c, { desc }) => [desc(c.createdAt)] }),
      db.query.badStocks.findMany({ where: eq(badStocks.shop, shopId), limit: 5000 }),
      db.query.adjustments.findMany({ where: eq(adjustments.shop, shopId), limit: 5000 }),
    ]);

    return ok(res, {
      shopId,
      generatedAt: new Date().toISOString(),
      counts: {
        products: productsRows.length,
        inventory: inventoryRows.length,
        sales: salesRows.length,
        purchases: purchasesRows.length,
        expenses: expensesRows.length,
        cashflows: cashflowsRows.length,
        badStocks: badStockRows.length,
        adjustments: adjustmentsRows.length,
      },
      data: {
        products: productsRows,
        inventory: inventoryRows,
        sales: salesRows,
        purchases: purchasesRows,
        expenses: expensesRows,
        cashflows: cashflowsRows,
        badStocks: badStockRows,
        adjustments: adjustmentsRows,
      },
      note: "Snapshot capped at 5000 rows per table.",
    });
  } catch (e) { next(e); }
});

// ── Dues (outstanding sales credit) ───────────────────────────────────────────

router.get("/dues", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const conditions = [sql`${sales.outstandingBalance}::numeric > 0`, sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    const where = and(...conditions);

    const rows = await db.select({
      saleId: sales.id,
      receiptNo: sales.receiptNo,
      customerId: sales.customer,
      totalAmount: sales.totalWithDiscount,
      amountPaid: sales.amountPaid,
      outstandingBalance: sales.outstandingBalance,
      dueDate: sales.dueDate,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(where)
    .orderBy(sql`${sales.dueDate} ASC NULLS LAST`)
    .limit(500);

    const [summary] = await db.select({
      totalDues: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      saleCount: sql<number>`COUNT(*)`,
    }).from(sales).where(where);

    return ok(res, { rows, summary });
  } catch (e) { next(e); }
});

// ── Yearly Profit ─────────────────────────────────────────────────────────────

router.get("/profit/yearly/:year", requireAdmin, async (req, res, next) => {
  try {
    const year = Number(req.params["year"]);
    if (!year) throw badRequest("year required");
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    const salesConditions = [
      gte(sales.createdAt, yearStart),
      lte(sales.createdAt, yearEnd),
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`,
    ];
    if (shopId) salesConditions.push(eq(sales.shop, shopId));
    const expConditions = [gte(expenses.createdAt, yearStart), lte(expenses.createdAt, yearEnd)];
    if (shopId) expConditions.push(eq(expenses.shop, shopId));

    const salesRows = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM ${sales.createdAt})`,
      revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      cost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
    }).from(sales)
      .leftJoin(saleItems, eq(saleItems.sale, sales.id))
      .where(and(...salesConditions))
      .groupBy(sql`EXTRACT(MONTH FROM ${sales.createdAt})`);

    const expRows = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM ${expenses.createdAt})`,
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    }).from(expenses).where(and(...expConditions)).groupBy(sql`EXTRACT(MONTH FROM ${expenses.createdAt})`);

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = salesRows.find((r) => Number(r.month) === m);
      const revenue = parseFloat(row?.revenue ?? "0");
      const cost = parseFloat(row?.cost ?? "0");
      const exp = parseFloat(expRows.find((r) => Number(r.month) === m)?.total ?? "0");
      return { month: m, revenue, cost, expenses: exp, profit: revenue - cost - exp };
    });

    const totals = months.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        cost: acc.cost + m.cost,
        expenses: acc.expenses + m.expenses,
        profit: acc.profit + m.profit,
      }),
      { revenue: 0, cost: 0, expenses: 0, profit: 0 },
    );

    return ok(res, { year, months, totals });
  } catch (e) { next(e); }
});

router.get("/cross-shop", requireAdmin, async (req, res, next) => {
  try {
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`];
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

// ── Sales by payment method ────────────────────────────────────────────────────
// Breaks revenue down by cash / mpesa / bank / card / split — uses actual
// sale_payments rows so split sales appear correctly across multiple methods.

router.get("/sales/by-payment-method", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));
    const where = and(...conditions);

    const rows = await db.select({
      paymentType: salePayments.paymentType,
      saleCount: sql<number>`COUNT(DISTINCT ${salePayments.sale})`,
      totalAmount: sql<string>`COALESCE(SUM(${salePayments.amount}::numeric), 0)`,
    })
    .from(salePayments)
    .innerJoin(sales, eq(salePayments.sale, sales.id))
    .where(where)
    .groupBy(salePayments.paymentType)
    .orderBy(sql`COALESCE(SUM(${salePayments.amount}::numeric), 0) DESC`);

    const grandTotal = rows.reduce((s, r) => s + parseFloat(r.totalAmount ?? "0"), 0);
    return ok(res, { rows, grandTotal: grandTotal.toFixed(2) });
  } catch (e) { next(e); }
});

// ── Purchases not paid (list of individual unpaid purchases) ──────────────────

router.get("/purchases/unpaid", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const supplierId = req.query["supplierId"] ? Number(req.query["supplierId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [sql`${purchases.outstandingBalance}::numeric > 0`];
    if (shopId) conditions.push(eq(purchases.shop, shopId));
    if (supplierId) conditions.push(eq(purchases.supplier, supplierId));
    if (from) conditions.push(gte(purchases.createdAt, from));
    if (to) conditions.push(lte(purchases.createdAt, to));
    const where = and(...conditions);

    const rows = await db.select({
      purchaseId: purchases.id,
      purchaseNo: purchases.purchaseNo,
      supplierId: purchases.supplier,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
      totalAmount: purchases.totalAmount,
      amountPaid: purchases.amountPaid,
      outstandingBalance: purchases.outstandingBalance,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplier, suppliers.id))
    .where(where)
    .orderBy(sql`${purchases.createdAt} DESC`)
    .limit(500);

    const [summary] = await db.select({
      totalUnpaid: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
      purchaseCount: sql<number>`COUNT(*)`,
    }).from(purchases).where(where);

    return ok(res, { rows, summary });
  } catch (e) { next(e); }
});

// ── Purchases by supplier (outstanding debt per supplier) ─────────────────────

router.get("/purchases/by-supplier", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions: ReturnType<typeof eq>[] = [];
    if (shopId) conditions.push(eq(purchases.shop, shopId));
    if (from) conditions.push(gte(purchases.createdAt, from));
    if (to) conditions.push(lte(purchases.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      supplierId: purchases.supplier,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
      totalPurchases: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${purchases.amountPaid}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplier, suppliers.id))
    .where(where)
    .groupBy(purchases.supplier, suppliers.name, suppliers.phone)
    .orderBy(sql`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0) DESC`);

    const grandOutstanding = rows.reduce((s, r) => s + parseFloat(r.totalOutstanding ?? "0"), 0);
    return ok(res, { rows, grandOutstanding: grandOutstanding.toFixed(2) });
  } catch (e) { next(e); }
});

// ── Overdue credit sales (dueDate passed, still outstanding) ──────────────────

router.get("/dues/overdue", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const now = new Date();

    const conditions = [
      sql`${sales.outstandingBalance}::numeric > 0`,
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held')`,
      sql`${sales.dueDate} IS NOT NULL`,
      lte(sales.dueDate, now),
    ];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    const where = and(...conditions);

    const rows = await db.select({
      saleId: sales.id,
      receiptNo: sales.receiptNo,
      customerId: sales.customer,
      customerName: customers.name,
      customerPhone: customers.phone,
      totalAmount: sales.totalWithDiscount,
      amountPaid: sales.amountPaid,
      outstandingBalance: sales.outstandingBalance,
      dueDate: sales.dueDate,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customer, customers.id))
    .where(where)
    .orderBy(sql`${sales.dueDate} ASC`)
    .limit(500);

    const [summary] = await db.select({
      totalOverdue: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      overdueCount: sql<number>`COUNT(*)`,
    }).from(sales).where(where);

    return ok(res, { rows, summary });
  } catch (e) { next(e); }
});

export default router;
