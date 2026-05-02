import { Router } from "express";
import { eq, and, gte, lte, sql, desc, asc, ilike, notInArray } from "drizzle-orm";
import {
  sales, saleItems, salePayments, saleReturns, purchases, purchaseItems, expenses,
  customers, suppliers, products, inventory, cashflows, admins,
  badStocks, stockCounts, stockCountItems, adjustments,
  expenseCategories, banks, shops, productCategories,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { sendRawEmail } from "../lib/email.js";

const router = Router();

function shopDate(shopId: number | null, from: Date | null, to: Date | null, table: any) {
  const conditions = [];
  if (shopId) conditions.push(eq(table.shop, shopId));
  if (from) conditions.push(gte(table.createdAt, from));
  if (to) {
    // Extend to end-of-day so that records created any time on the `to` date are included
    const endOfDay = new Date(to);
    endOfDay.setUTCHours(23, 59, 59, 999);
    conditions.push(lte(table.createdAt, endOfDay));
  }
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
      ? and(baseWhere, sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`)
      : sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`;
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
    conditions.push(sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`);

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
    conditions.push(sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`);

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
      ? and(baseSalesWhere, sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`)
      : sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`;
    const expensesWhere = shopDate(shopId, from, to, expenses);

    // Returns subquery: only subtract returns for active (non-voided/returned) sales in the same period
    const returnsWhere = shopDate(shopId, from, to, saleReturns);

    const [[revenueSummary], [costSummary], [expensesSummary], [returnsSummary]] = await Promise.all([
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
      // Subtract only returns whose original sale is active (not voided/held/refunded/returned)
      db.select({
        totalReturns: sql<string>`COALESCE(SUM(${saleReturns.refundAmount}::numeric), 0)`,
      }).from(saleReturns)
        .innerJoin(sales, and(
          eq(saleReturns.sale, sales.id),
          sql`${sales.status} NOT IN ('voided', 'held', 'refunded', 'returned')`,
        ))
        .where(returnsWhere),
    ]);

    const grossRevenue = parseFloat(revenueSummary?.revenue ?? "0");
    const totalReturns = parseFloat(returnsSummary?.totalReturns ?? "0");
    const revenue = Math.max(0, grossRevenue - totalReturns);
    const cost = parseFloat(costSummary?.cost ?? "0");
    const expensesTotal = parseFloat(expensesSummary?.totalExpenses ?? "0");
    const profit = revenue - cost - expensesTotal;

    return ok(res, { revenue, cost, expenses: expensesTotal, profit, returns: totalReturns, grossRevenue });
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
        totalstock: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric), 0)`,
        totalQuantity: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric), 0)`,
        totalValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
        totalStockValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric), 0)`,
        profitEstimate: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * (${products.sellingPrice}::numeric - ${products.buyingPrice}::numeric)), 0)`,
        outofstock: sql<number>`COUNT(*) FILTER (WHERE ${inventory.quantity}::numeric <= 0)`,
        lowstock: sql<number>`COUNT(*) FILTER (WHERE ${inventory.quantity}::numeric > 0 AND ${inventory.reorderLevel}::numeric > 0 AND ${inventory.quantity}::numeric <= ${inventory.reorderLevel}::numeric)`,
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
    const statusFilter = sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`;
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
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
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
    const page = req.query["page"] ? Math.max(1, Number(req.query["page"])) : 1;
    const limit = req.query["limit"] ? Math.min(200, Math.max(1, Number(req.query["limit"]))) : 50;
    const offset = (page - 1) * limit;
    const search = req.query["search"] ? String(req.query["search"]).trim() : null;

    const conditions: ReturnType<typeof eq>[] = [];
    if (shopId) conditions.push(eq(inventory.shop, shopId));
    if (search) conditions.push(ilike(products.name, `%${search}%`) as any);
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [globalTotals] = await db.select({
      totalAtCost: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
      totalAtSale: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric), 0)`,
      productCount: sql<number>`COUNT(*)`,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(where);

    const rows = await db.select({
      productId: inventory.product,
      productName: products.name,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      buyingPrice: products.buyingPrice,
      sellingPrice: products.sellingPrice,
      stockValueAtCost: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0)`,
      stockValueAtSale: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric, 0)`,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(where)
    .orderBy(sql`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0) DESC`)
    .limit(limit)
    .offset(offset);

    const total = Number(globalTotals?.productCount ?? 0);
    const totalPages = Math.ceil(total / limit);

    return ok(res, {
      rows,
      summary: {
        totalAtCost: parseFloat(globalTotals?.totalAtCost ?? "0"),
        totalAtSale: parseFloat(globalTotals?.totalAtSale ?? "0"),
        productCount: total,
      },
      pagination: { page, limit, total, totalPages },
    });
  } catch (e) { next(e); }
});

// ── Slow / Dead Movers ────────────────────────────────────────────────────────
// Products with stock on hand but zero sales in the given period

router.get("/slow-movers", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;
    const page = req.query["page"] ? Math.max(1, Number(req.query["page"])) : 1;
    const limit = req.query["limit"] ? Math.min(200, Math.max(1, Number(req.query["limit"]))) : 50;
    const offset = (page - 1) * limit;

    const saleConditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
    if (shopId) saleConditions.push(eq(saleItems.shop, shopId));
    if (from) saleConditions.push(gte(sales.createdAt, from));
    if (to) { const eod = new Date(to); eod.setUTCHours(23, 59, 59, 999); saleConditions.push(lte(sales.createdAt, eod)); }

    const soldProductIds = await db.selectDistinct({ id: saleItems.product })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.sale, sales.id))
      .where(and(...saleConditions));

    const soldIds = soldProductIds.map(r => r.id).filter(Boolean) as number[];

    const invConditions: any[] = [sql`${inventory.quantity}::numeric > 0`];
    if (shopId) invConditions.push(eq(inventory.shop, shopId));
    if (soldIds.length > 0) invConditions.push(notInArray(inventory.product, soldIds));

    const [countRow] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(inventory)
      .leftJoin(products, eq(inventory.product, products.id))
      .where(and(...invConditions));

    const rows = await db.select({
      productId: inventory.product,
      productName: products.name,
      productType: products.type,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      buyingPrice: products.buyingPrice,
      sellingPrice: products.sellingPrice,
      stockValueAtCost: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0)`,
      stockValueAtSale: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric, 0)`,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(and(...invConditions))
    .orderBy(sql`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0) DESC`)
    .limit(limit)
    .offset(offset);

    const total = Number(countRow?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    const totalAtCost = rows.reduce((s, r) => s + parseFloat(String(r.stockValueAtCost ?? "0")), 0);
    const totalAtSale = rows.reduce((s, r) => s + parseFloat(String(r.stockValueAtSale ?? "0")), 0);

    return ok(res, {
      rows,
      summary: { total, totalAtCost: totalAtCost.toFixed(2), totalAtSale: totalAtSale.toFixed(2) },
      pagination: { page, limit, total, totalPages },
    });
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
    const conditions = [sql`${sales.outstandingBalance}::numeric > 0`, sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
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
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
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

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
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

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) { const eod = new Date(to); eod.setUTCHours(23, 59, 59, 999); conditions.push(lte(sales.createdAt, eod)); }
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
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
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

// ── Enhanced Sales by Product (with name, cost, margin) ───────────────────────

router.get("/sales/by-product/detail", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;
    const page = req.query["page"] ? Math.max(1, Number(req.query["page"])) : 1;
    const limit = req.query["limit"] ? Math.min(200, Math.max(1, Number(req.query["limit"]))) : 50;
    const offset = (page - 1) * limit;
    const sortDir = req.query["sort"] === "asc" ? "asc" : "desc";
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;
    const search = req.query["search"] ? String(req.query["search"]).trim() : null;

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
    if (shopId) conditions.push(eq(saleItems.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) { const eod = new Date(to); eod.setUTCHours(23, 59, 59, 999); conditions.push(lte(sales.createdAt, eod)); }
    if (categoryId) conditions.push(eq(products.category, categoryId));
    if (search) conditions.push(ilike(products.name, `%${search}%`));

    const [globalTotals] = await db.select({
      grandRevenue: sql<string>`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      grandCost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      grandProfit: sql<string>`COALESCE(SUM((${saleItems.unitPrice}::numeric - ${saleItems.costPrice}::numeric) * ${saleItems.quantity}::numeric), 0)`,
      productCount: sql<number>`COUNT(DISTINCT ${saleItems.product})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .leftJoin(products, eq(saleItems.product, products.id))
    .where(and(...conditions));

    const revenueExpr = sql`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0)`;
    const rows = await db.select({
      productId: saleItems.product,
      productName: products.name,
      productType: products.type,
      categoryId: products.category,
      categoryName: productCategories.name,
      totalQty: sql<string>`COALESCE(SUM(${saleItems.quantity}::numeric), 0)`,
      totalRevenue: sql<string>`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      totalCost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      grossProfit: sql<string>`COALESCE(SUM((${saleItems.unitPrice}::numeric - ${saleItems.costPrice}::numeric) * ${saleItems.quantity}::numeric), 0)`,
      averageSellingPrice: sql<string>`COALESCE(AVG(${saleItems.unitPrice}::numeric), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.sale, sales.id))
    .leftJoin(products, eq(saleItems.product, products.id))
    .leftJoin(productCategories, eq(products.category, productCategories.id))
    .where(and(...conditions))
    .groupBy(saleItems.product, products.name, products.type, products.category, productCategories.name)
    .orderBy(sortDir === "asc" ? asc(revenueExpr) : desc(revenueExpr))
    .limit(limit)
    .offset(offset);

    const enriched = rows.map((r) => {
      const revenue = parseFloat(r.totalRevenue);
      const cost = parseFloat(r.totalCost);
      const margin = revenue > 0 ? ((revenue - cost) / revenue * 100) : 0;
      return { ...r, marginPercent: margin.toFixed(2) };
    });

    const grandRevenue = parseFloat(globalTotals?.grandRevenue ?? "0");
    const grandCost = parseFloat(globalTotals?.grandCost ?? "0");
    const grandProfit = parseFloat(globalTotals?.grandProfit ?? "0");
    const total = Number(globalTotals?.productCount ?? 0);
    const totalPages = Math.ceil(total / limit);

    return ok(res, {
      rows: enriched,
      summary: {
        grandRevenue: grandRevenue.toFixed(2),
        grandCost: grandCost.toFixed(2),
        grandProfit: grandProfit.toFixed(2),
        overallMarginPercent: grandRevenue > 0 ? ((grandProfit / grandRevenue) * 100).toFixed(2) : "0.00",
        productCount: total,
      },
      pagination: { page, limit, total, totalPages },
    });
  } catch (e) { next(e); }
});

// ── Daily Sales Time Series (for charts) ──────────────────────────────────────

router.get("/sales/daily", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const days = req.query["days"] ? Math.max(1, Math.min(365, Number(req.query["days"]))) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const conditions = [
      gte(sales.createdAt, since),
      sql`${sales.status} NOT IN ('voided', 'held')`,
    ];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (req.attendant) conditions.push(eq(sales.attendant, req.attendant.id));

    const rows = await db.select({
      day: sql<string>`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
      totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
    })
    .from(sales)
    .where(and(...conditions))
    .groupBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD') ASC`);

    return ok(res, { days, since, rows });
  } catch (e) { next(e); }
});

// ── Monthly Sales (for trend charts) ─────────────────────────────────────────

router.get("/sales/monthly", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const year = req.query["year"] ? Number(req.query["year"]) : new Date().getFullYear();

    const conditions = [
      gte(sales.createdAt, new Date(`${year}-01-01`)),
      lte(sales.createdAt, new Date(`${year}-12-31T23:59:59`)),
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
    ];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (req.attendant) conditions.push(eq(sales.attendant, req.attendant.id));

    const rows = await db.select({
      month: sql<number>`EXTRACT(MONTH FROM ${sales.createdAt})`,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
      totalCost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
    })
    .from(sales)
    .leftJoin(saleItems, eq(saleItems.sale, sales.id))
    .where(and(...conditions))
    .groupBy(sql`EXTRACT(MONTH FROM ${sales.createdAt})`)
    .orderBy(sql`EXTRACT(MONTH FROM ${sales.createdAt}) ASC`);

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = rows.find((r) => Number(r.month) === m);
      const revenue = parseFloat(row?.totalRevenue ?? "0");
      const cost = parseFloat(row?.totalCost ?? "0");
      return {
        month: m,
        totalSales: row?.totalSales ?? 0,
        revenue,
        cost,
        profit: revenue - cost,
      };
    });

    return ok(res, { year, months });
  } catch (e) { next(e); }
});

// ── Income Report (revenue breakdown by payment method + time series) ──────────

router.get("/income", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;
    const days = req.query["days"] ? Number(req.query["days"]) : 30;
    const since = from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const baseCond = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
    if (shopId) baseCond.push(eq(sales.shop, shopId));
    if (from) baseCond.push(gte(sales.createdAt, from)); else baseCond.push(gte(sales.createdAt, since));
    if (to) baseCond.push(lte(sales.createdAt, to));
    const where = and(...baseCond);

    const [totals, byPaymentMethod, byDay, cashflowSummary] = await Promise.all([
      db.select({
        totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
        saleCount: sql<number>`COUNT(*)`,
      }).from(sales).where(where),

      db.select({
        paymentType: sql<string>`LOWER(${salePayments.paymentType})`,
        totalAmount: sql<string>`COALESCE(SUM(${salePayments.amount}::numeric), 0)`,
        saleCount: sql<number>`COUNT(DISTINCT ${salePayments.sale})`,
      })
      .from(salePayments)
      .innerJoin(sales, eq(salePayments.sale, sales.id))
      .where(where)
      .groupBy(sql`LOWER(${salePayments.paymentType})`)
      .orderBy(sql`COALESCE(SUM(${salePayments.amount}::numeric), 0) DESC`),

      db.select({
        day: sql<string>`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`,
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        saleCount: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(where)
      .groupBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD') ASC`),

      shopId
        ? db.select({
            totalCashIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashflows.type} = 'cashin' THEN ${cashflows.amount}::numeric ELSE 0 END), 0)`,
            totalCashOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashflows.type} = 'cashout' THEN ${cashflows.amount}::numeric ELSE 0 END), 0)`,
          }).from(cashflows).where(eq(cashflows.shop, shopId))
        : Promise.resolve([{ totalCashIn: "0", totalCashOut: "0" }]),
    ]);

    return ok(res, {
      period: { from: since, to: to ?? new Date() },
      totals: totals[0],
      byPaymentMethod,
      dailyTimeSeries: byDay,
      cashflows: cashflowSummary[0],
    });
  } catch (e) { next(e); }
});

// ── Expenses by Category ──────────────────────────────────────────────────────

router.get("/expenses/by-category", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions: ReturnType<typeof eq>[] = [];
    if (shopId) conditions.push(eq(expenses.shop, shopId));
    if (from) conditions.push(gte(expenses.createdAt, from));
    if (to) conditions.push(lte(expenses.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      categoryId: expenses.category,
      categoryName: expenseCategories.name,
      totalExpenses: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.category, expenseCategories.id))
    .where(where)
    .groupBy(expenses.category, expenseCategories.name)
    .orderBy(sql`COALESCE(SUM(${expenses.amount}::numeric), 0) DESC`);

    const grandTotal = rows.reduce((s, r) => s + parseFloat(r.totalAmount ?? "0"), 0);

    const recentExpenses = await db.query.expenses.findMany({
      where,
      orderBy: [desc(expenses.createdAt)],
      limit: 50,
    });

    return ok(res, {
      rows,
      grandTotal: grandTotal.toFixed(2),
      recentExpenses,
    });
  } catch (e) { next(e); }
});

// ── Accounts Summary (cash position) ─────────────────────────────────────────
// Returns: bank balances, total receivables, total payables, net position

router.get("/accounts", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const salesWhere = shopId
      ? and(eq(sales.shop, shopId), sql`${sales.outstandingBalance}::numeric > 0`, sql`${sales.status} NOT IN ('voided','refunded','held')`)
      : and(sql`${sales.outstandingBalance}::numeric > 0`, sql`${sales.status} NOT IN ('voided','refunded','held')`);

    const purchasesWhere = shopId
      ? and(eq(purchases.shop, shopId), sql`${purchases.outstandingBalance}::numeric > 0`)
      : sql`${purchases.outstandingBalance}::numeric > 0`;

    const [
      receivables,
      payables,
      cashflowTotals,
      bankList,
      expensesThisMonth,
    ] = await Promise.all([
      db.select({
        totalReceivables: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(sales).where(salesWhere),

      db.select({
        totalPayables: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(purchases).where(purchasesWhere),

      shopId
        ? db.select({
            totalCashIn: sql<string>`COALESCE(SUM(CASE WHEN ${cashflows.type} = 'cashin' THEN ${cashflows.amount}::numeric ELSE 0 END), 0)`,
            totalCashOut: sql<string>`COALESCE(SUM(CASE WHEN ${cashflows.type} = 'cashout' THEN ${cashflows.amount}::numeric ELSE 0 END), 0)`,
          }).from(cashflows).where(eq(cashflows.shop, shopId))
        : [{ totalCashIn: "0", totalCashOut: "0" }],

      shopId
        ? db.query.banks.findMany({ where: eq(banks.shop, shopId), columns: { id: true, name: true, balance: true, currency: true } })
        : [],

      (() => {
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const expCond = shopId ? and(eq(expenses.shop, shopId), gte(expenses.createdAt, startOfMonth)) : gte(expenses.createdAt, startOfMonth);
        return db.select({ total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)` }).from(expenses).where(expCond);
      })(),
    ]);

    const totalReceivables = parseFloat(receivables[0]?.totalReceivables ?? "0");
    const totalPayables = parseFloat(payables[0]?.totalPayables ?? "0");
    const cashIn = parseFloat((cashflowTotals as any)[0]?.totalCashIn ?? "0");
    const cashOut = parseFloat((cashflowTotals as any)[0]?.totalCashOut ?? "0");
    const bankTotal = bankList.reduce((s, b) => s + parseFloat(String(b.balance ?? 0)), 0);

    return ok(res, {
      receivables: {
        total: totalReceivables.toFixed(2),
        count: receivables[0]?.count ?? 0,
      },
      payables: {
        total: totalPayables.toFixed(2),
        count: payables[0]?.count ?? 0,
      },
      cashflows: {
        totalCashIn: cashIn.toFixed(2),
        totalCashOut: cashOut.toFixed(2),
        net: (cashIn - cashOut).toFixed(2),
      },
      banks: bankList,
      bankTotal: bankTotal.toFixed(2),
      expensesThisMonth: (expensesThisMonth as any)[0]?.total ?? "0",
      netPosition: (totalReceivables - totalPayables + bankTotal).toFixed(2),
    });
  } catch (e) { next(e); }
});

// ── Debt Aging (AR Aging Analysis) ────────────────────────────────────────────
// Buckets: current (not yet due) | 1-30 | 31-60 | 61-90 | 90+ days overdue

router.get("/debts/aging", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const now = new Date();

    const conditions = [
      sql`${sales.outstandingBalance}::numeric > 0`,
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
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
      daysOverdue: sql<number>`GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(${sales.dueDate}, ${sales.createdAt})))`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customer, customers.id))
    .where(where)
    .orderBy(sql`GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(${sales.dueDate}, ${sales.createdAt}))) DESC`)
    .limit(1000);

    // Bucket rows
    const buckets = {
      current: rows.filter((r) => Number(r.daysOverdue) === 0),
      days1to30: rows.filter((r) => Number(r.daysOverdue) >= 1 && Number(r.daysOverdue) <= 30),
      days31to60: rows.filter((r) => Number(r.daysOverdue) >= 31 && Number(r.daysOverdue) <= 60),
      days61to90: rows.filter((r) => Number(r.daysOverdue) >= 61 && Number(r.daysOverdue) <= 90),
      days90plus: rows.filter((r) => Number(r.daysOverdue) > 90),
    };

    const bucketSummary = Object.entries(buckets).reduce((acc, [key, items]) => ({
      ...acc,
      [key]: {
        count: items.length,
        total: items.reduce((s, r) => s + parseFloat(String(r.outstandingBalance ?? 0)), 0).toFixed(2),
        items,
      },
    }), {} as Record<string, unknown>);

    const grandTotal = rows.reduce((s, r) => s + parseFloat(String(r.outstandingBalance ?? 0)), 0);

    return ok(res, {
      asOf: now.toISOString(),
      grandTotal: grandTotal.toFixed(2),
      totalDebts: rows.length,
      buckets: bucketSummary,
    });
  } catch (e) { next(e); }
});

// ── Enhanced Dues with customer name ─────────────────────────────────────────

router.get("/dues/detail", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const overdue = req.query["overdue"] === "true";
    const now = new Date();

    const conditions = [
      sql`${sales.outstandingBalance}::numeric > 0`,
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
    ];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (overdue) {
      conditions.push(sql`${sales.dueDate} IS NOT NULL`);
      conditions.push(lte(sales.dueDate, now));
    }
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
      saleType: sales.saleType,
      paymentType: sales.paymentType,
      createdAt: sales.createdAt,
      daysOverdue: sql<number>`GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(${sales.dueDate}, ${sales.createdAt})))`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customer, customers.id))
    .where(where)
    .orderBy(sql`${sales.dueDate} ASC NULLS LAST`)
    .limit(1000);

    const [summary] = await db.select({
      totalDues: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
      saleCount: sql<number>`COUNT(*)`,
    }).from(sales).where(where);

    return ok(res, { rows, summary });
  } catch (e) { next(e); }
});

// ── Comprehensive Stock Take Report ───────────────────────────────────────────
// Full per-product snapshot: qty, cost, sale value, status, last adjustment,
// variance from last stock count

router.get("/stock-take", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const status = req.query["status"] ? String(req.query["status"]) : null;

    const conditions: ReturnType<typeof eq>[] = [];
    if (shopId) conditions.push(eq(inventory.shop, shopId));
    if (status) conditions.push(eq(inventory.status, status));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.select({
      productId: inventory.product,
      shopId: inventory.shop,
      productName: products.name,
      productType: products.type,
      barcode: products.barcode,
      status: inventory.status,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      buyingPrice: products.buyingPrice,
      sellingPrice: products.sellingPrice,
      stockValueAtCost: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0)`,
      stockValueAtSale: sql<string>`COALESCE(${inventory.quantity}::numeric * ${products.sellingPrice}::numeric, 0)`,
      potentialProfit: sql<string>`COALESCE(${inventory.quantity}::numeric * (${products.sellingPrice}::numeric - ${products.buyingPrice}::numeric), 0)`,
      updatedAt: inventory.createdAt,
    })
    .from(inventory)
    .leftJoin(products, eq(inventory.product, products.id))
    .where(where)
    .orderBy(sql`COALESCE(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric, 0) DESC`);

    const summary = {
      totalProducts: rows.length,
      totalUnits: rows.reduce((s, r) => s + parseFloat(String(r.quantity ?? 0)), 0),
      totalValueAtCost: rows.reduce((s, r) => s + parseFloat(String(r.stockValueAtCost ?? 0)), 0).toFixed(2),
      totalValueAtSale: rows.reduce((s, r) => s + parseFloat(String(r.stockValueAtSale ?? 0)), 0).toFixed(2),
      potentialProfit: rows.reduce((s, r) => s + parseFloat(String(r.potentialProfit ?? 0)), 0).toFixed(2),
      outOfStock: rows.filter((r) => r.status === "out_of_stock").length,
      lowStock: rows.filter((r) => r.status === "low").length,
      healthy: rows.filter((r) => r.status === "active").length,
    };

    return ok(res, { rows, summary });
  } catch (e) { next(e); }
});

// ── Comprehensive Purchases Report ────────────────────────────────────────────

router.get("/purchases/detail", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const supplierId = req.query["supplierId"] ? Number(req.query["supplierId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions: ReturnType<typeof eq>[] = [];
    if (shopId) conditions.push(eq(purchases.shop, shopId));
    if (supplierId) conditions.push(eq(purchases.supplier, supplierId));
    if (from) conditions.push(gte(purchases.createdAt, from));
    if (to) conditions.push(lte(purchases.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [summary, bySupplier, topProducts] = await Promise.all([
      db.select({
        totalPurchases: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${purchases.amountPaid}::numeric), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
      }).from(purchases).where(where),

      db.select({
        supplierId: purchases.supplier,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
        purchaseCount: sql<number>`COUNT(*)`,
        totalAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${purchases.amountPaid}::numeric), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
      })
      .from(purchases)
      .leftJoin(suppliers, eq(purchases.supplier, suppliers.id))
      .where(where)
      .groupBy(purchases.supplier, suppliers.name, suppliers.phone)
      .orderBy(sql`COALESCE(SUM(${purchases.totalAmount}::numeric), 0) DESC`),

      db.select({
        productId: purchaseItems.product,
        productName: products.name,
        totalQty: sql<string>`COALESCE(SUM(${purchaseItems.quantity}::numeric), 0)`,
        totalCost: sql<string>`COALESCE(SUM(${purchaseItems.unitPrice}::numeric * ${purchaseItems.quantity}::numeric), 0)`,
      })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchaseItems.purchase, purchases.id))
      .leftJoin(products, eq(purchaseItems.product, products.id))
      .where(where)
      .groupBy(purchaseItems.product, products.name)
      .orderBy(sql`COALESCE(SUM(${purchaseItems.unitPrice}::numeric * ${purchaseItems.quantity}::numeric), 0) DESC`)
      .limit(50),
    ]);

    return ok(res, { summary: summary[0], bySupplier, topProducts });
  } catch (e) { next(e); }
});

// ── Comprehensive Profit & Loss ───────────────────────────────────────────────

router.get("/profit-loss/detail", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const baseSalesWhere = shopDate(shopId, from, to, sales);
    const salesWhere = baseSalesWhere
      ? and(baseSalesWhere, sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`)
      : sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`;
    const expensesWhere = shopDate(shopId, from, to, expenses);
    const purchasesWhere = shopDate(shopId, from, to, purchases);

    const returnsWhere = shopDate(shopId, from, to, saleReturns);

    const [
      [revenueSummary],
      [costSummary],
      [expensesSummary],
      [purchasesSummary],
      [discountSummary],
      [shrinkageSummary],
      [saleReturnsSummary],
      expenseByCategory,
      byPaymentMethod,
    ] = await Promise.all([
      db.select({
        revenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        saleCount: sql<number>`COUNT(*)`,
        totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
      }).from(sales).where(salesWhere),

      db.select({
        cost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      }).from(saleItems).innerJoin(sales, eq(saleItems.sale, sales.id)).where(salesWhere),

      db.select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expensesWhere),

      db.select({
        totalPurchases: sql<string>`COALESCE(SUM(${purchases.totalAmount}::numeric), 0)`,
      }).from(purchases).where(purchasesWhere),

      db.select({
        totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
      }).from(sales).where(salesWhere),

      // Voided/refunded totals to show shrinkage
      db.select({
        voidedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} = 'voided' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
        refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${sales.status} = 'refunded' THEN ${sales.totalWithDiscount}::numeric ELSE 0 END), 0)`,
      }).from(sales).where(shopDate(shopId, from, to, sales) ?? sql`1=1`),

      // Sale returns (partial & full) — subtract from gross revenue
      db.select({
        totalReturns: sql<string>`COALESCE(SUM(${saleReturns.refundAmount}::numeric), 0)`,
      }).from(saleReturns)
        .innerJoin(sales, and(
          eq(saleReturns.sale, sales.id),
          sql`${sales.status} NOT IN ('voided', 'held', 'refunded', 'returned')`,
        ))
        .where(returnsWhere),

      db.select({
        categoryName: expenseCategories.name,
        total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.category, expenseCategories.id))
      .where(expensesWhere)
      .groupBy(expenseCategories.name)
      .orderBy(sql`COALESCE(SUM(${expenses.amount}::numeric), 0) DESC`),

      db.select({
        paymentType: sql<string>`LOWER(${salePayments.paymentType})`,
        total: sql<string>`COALESCE(SUM(${salePayments.amount}::numeric), 0)`,
      })
      .from(salePayments)
      .innerJoin(sales, eq(salePayments.sale, sales.id))
      .where(salesWhere)
      .groupBy(sql`LOWER(${salePayments.paymentType})`)
      .orderBy(sql`COALESCE(SUM(${salePayments.amount}::numeric), 0) DESC`),
    ]);

    const grossRevenue = parseFloat(revenueSummary?.revenue ?? "0");
    const totalReturns = parseFloat(saleReturnsSummary?.totalReturns ?? "0");
    const revenue = Math.max(0, grossRevenue - totalReturns);
    const cost = parseFloat(costSummary?.cost ?? "0");
    const expensesTotal = parseFloat(expensesSummary?.totalExpenses ?? "0");
    const grossProfit = revenue - cost;
    const grossMargin = revenue > 0 ? (grossProfit / revenue * 100) : 0;
    const netProfit = grossProfit - expensesTotal;
    const netMargin = revenue > 0 ? (netProfit / revenue * 100) : 0;

    return ok(res, {
      period: { from, to },
      income: {
        revenue: revenue.toFixed(2),
        grossRevenue: grossRevenue.toFixed(2),
        returnsAmount: totalReturns.toFixed(2),
        saleCount: revenueSummary?.saleCount ?? 0,
        totalDiscount: discountSummary?.totalDiscount ?? "0",
        voidedAmount: shrinkageSummary?.voidedAmount ?? "0",
        refundedAmount: shrinkageSummary?.refundedAmount ?? "0",
      },
      cogs: {
        cost: cost.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: grossMargin.toFixed(2),
      },
      expenses: {
        total: expensesTotal.toFixed(2),
        byCategory: expenseByCategory,
      },
      purchases: {
        total: purchasesSummary?.totalPurchases ?? "0",
      },
      netProfit: netProfit.toFixed(2),
      netMarginPercent: netMargin.toFixed(2),
      byPaymentMethod,
    });
  } catch (e) { next(e); }
});

// ── Business Summary Dashboard ─────────────────────────────────────────────────
// Single call that returns all key KPIs for a dashboard view.

router.get("/business-summary", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const days = req.query["days"] ? Number(req.query["days"]) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const salesWhere = and(
      shopId ? eq(sales.shop, shopId) : sql`1=1`,
      gte(sales.createdAt, since),
      sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`,
    );
    const expWhere = and(
      shopId ? eq(expenses.shop, shopId) : sql`1=1`,
      gte(expenses.createdAt, since),
    );
    const purchasesWhere = and(
      shopId ? eq(purchases.shop, shopId) : sql`1=1`,
      gte(purchases.createdAt, since),
    );

    const [
      salesSummary,
      costSummary,
      expensesSummary,
      receivables,
      payables,
      topProducts,
      topCustomers,
      inventorySummary,
      recentSales,
    ] = await Promise.all([
      db.select({
        totalSales: sql<number>`COUNT(*)`,
        totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${sales.amountPaid}::numeric), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
      }).from(sales).where(salesWhere),

      db.select({
        totalCost: sql<string>`COALESCE(SUM(${saleItems.costPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      }).from(saleItems).innerJoin(sales, eq(saleItems.sale, sales.id)).where(salesWhere),

      db.select({
        totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      }).from(expenses).where(expWhere),

      db.select({
        totalReceivables: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(sales).where(
        and(
          shopId ? eq(sales.shop, shopId) : sql`1=1`,
          sql`${sales.outstandingBalance}::numeric > 0`,
          sql`${sales.status} NOT IN ('voided','refunded','held')`,
        )
      ),

      db.select({
        totalPayables: sql<string>`COALESCE(SUM(${purchases.outstandingBalance}::numeric), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(purchases).where(
        and(
          shopId ? eq(purchases.shop, shopId) : sql`1=1`,
          sql`${purchases.outstandingBalance}::numeric > 0`,
        )
      ),

      db.select({
        productId: saleItems.product,
        productName: products.name,
        totalQty: sql<string>`COALESCE(SUM(${saleItems.quantity}::numeric), 0)`,
        totalRevenue: sql<string>`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.sale, sales.id))
      .leftJoin(products, eq(saleItems.product, products.id))
      .where(salesWhere)
      .groupBy(saleItems.product, products.name)
      .orderBy(sql`COALESCE(SUM(${saleItems.unitPrice}::numeric * ${saleItems.quantity}::numeric), 0) DESC`)
      .limit(5),

      db.select({
        customerId: sales.customer,
        customerName: customers.name,
        totalSales: sql<number>`COUNT(*)`,
        totalSpent: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer, customers.id))
      .where(and(salesWhere, sql`${sales.customer} IS NOT NULL`))
      .groupBy(sales.customer, customers.name)
      .orderBy(sql`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0) DESC`)
      .limit(5),

      db.select({
        totalProducts: sql<number>`COUNT(*)`,
        totalValue: sql<string>`COALESCE(SUM(${inventory.quantity}::numeric * ${products.buyingPrice}::numeric), 0)`,
        outOfStock: sql<number>`COUNT(CASE WHEN ${inventory.status} = 'out_of_stock' THEN 1 END)`,
        lowStock: sql<number>`COUNT(CASE WHEN ${inventory.status} = 'low' THEN 1 END)`,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.product, products.id))
      .where(shopId ? eq(inventory.shop, shopId) : undefined),

      db.query.sales.findMany({
        where: shopId ? and(eq(sales.shop, shopId), sql`${sales.status} NOT IN ('voided','refunded')`) : sql`${sales.status} NOT IN ('voided','refunded')`,
        orderBy: [desc(sales.createdAt)],
        limit: 10,
      }),
    ]);

    const revenue = parseFloat(salesSummary[0]?.totalRevenue ?? "0");
    const cost = parseFloat(costSummary[0]?.totalCost ?? "0");
    const expensesTotal = parseFloat(expensesSummary[0]?.totalExpenses ?? "0");
    const grossProfit = revenue - cost;
    const netProfit = grossProfit - expensesTotal;

    return ok(res, {
      period: { days, since },
      sales: {
        ...salesSummary[0],
        averageOrderValue: (salesSummary[0]?.totalSales ?? 0) > 0
          ? (revenue / Number(salesSummary[0]?.totalSales ?? 1)).toFixed(2)
          : "0.00",
      },
      profitability: {
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: revenue > 0 ? (grossProfit / revenue * 100).toFixed(2) : "0.00",
        netProfit: netProfit.toFixed(2),
        netMarginPercent: revenue > 0 ? (netProfit / revenue * 100).toFixed(2) : "0.00",
        totalExpenses: expensesTotal.toFixed(2),
        totalCost: cost.toFixed(2),
      },
      receivables: receivables[0],
      payables: payables[0],
      inventory: inventorySummary[0],
      topProducts,
      topCustomers,
      recentSales,
    });
  } catch (e) { next(e); }
});

// ── Attendant Sales Summary ────────────────────────────────────────────────────

router.get("/sales/by-attendant", requireAdmin, async (req, res, next) => {
  try {
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [sql`${sales.status} NOT IN ('voided', 'refunded', 'held', 'returned')`];
    if (shopId) conditions.push(eq(sales.shop, shopId));
    if (from) conditions.push(gte(sales.createdAt, from));
    if (to) conditions.push(lte(sales.createdAt, to));

    const rows = await db.select({
      attendantId: sales.attendant,
      totalSales: sql<number>`COUNT(*)`,
      totalRevenue: sql<string>`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0)`,
      totalDiscount: sql<string>`COALESCE(SUM(${sales.saleDiscount}::numeric), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${sales.outstandingBalance}::numeric), 0)`,
    })
    .from(sales)
    .where(and(...conditions))
    .groupBy(sales.attendant)
    .orderBy(sql`COALESCE(SUM(${sales.totalWithDiscount}::numeric), 0) DESC`);

    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Email Profit & Loss PDF ────────────────────────────────────────────────────
router.post("/profit-loss/email", requireAdmin, async (req, res, next) => {
  try {
    const { to, subject, pdfBase64, filename, from, toDate, shopName } = req.body;
    if (!to) throw badRequest("Recipient email required");
    if (!pdfBase64) throw badRequest("PDF content required");

    const period = (from && toDate)
      ? ` for ${new Date(from).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} – ${new Date(toDate).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`
      : "";

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 4px">Profit &amp; Loss Report</h2>
        ${shopName ? `<p style="font-size:14px;color:#6b7280;margin:0 0 16px">${shopName}</p>` : ""}
        <p style="font-size:14px;color:#374151;margin:0 0 24px">
          Please find attached the Profit &amp; Loss statement${period}.
        </p>
        <p style="font-size:13px;color:#9ca3af">Generated by Pointify POS</p>
      </div>`;

    const result = await sendRawEmail({
      to,
      subject: subject || `Profit & Loss Report${period}`,
      html,
      attachments: [{ content: pdfBase64, name: filename || "profit-loss.pdf", type: "application/pdf" }],
    });

    if (!result.ok) {
      if (result.skipped) return ok(res, { ok: false, message: result.skipped });
      throw new Error(result.error ?? "Failed to send email");
    }
    return ok(res, { ok: true, messageId: result.messageId });
  } catch (e) { next(e); }
});

export default router;
