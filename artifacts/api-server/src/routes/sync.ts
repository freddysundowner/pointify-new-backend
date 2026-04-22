import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  shops,
  products,
  inventory,
  productCategories,
  customers,
  suppliers,
  sales,
  saleItems,
  salePayments,
  purchases,
  purchaseItems,
  purchasePayments,
  expenses,
  cashflows,
  banks,
  paymentMethods,
  attendants,
  adjustments,
  badStocks,
  batches,
  productSerials,
  productTransfers,
  orders,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, noContent } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/database/init", requireAdminOrAttendant, (_req, res) => {
  const ddl = `-- Pointify offline SQLite DDL (stub)
CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY, name TEXT, currency TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, shop_id INTEGER, name TEXT, buying_price TEXT, selling_price TEXT, barcode TEXT, sku TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, product_id INTEGER, shop_id INTEGER, quantity TEXT, status TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS product_categories (id INTEGER PRIMARY KEY, name TEXT, admin_id INTEGER);
CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, shop_id INTEGER, name TEXT, phone TEXT, email TEXT);
CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY, shop_id INTEGER, name TEXT, phone TEXT, email TEXT);
CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY, shop_id INTEGER, customer_id INTEGER, total_amount TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY, sale_id INTEGER, product_id INTEGER, quantity TEXT, price TEXT);
CREATE TABLE IF NOT EXISTS sale_payments (id INTEGER PRIMARY KEY, sale_id INTEGER, amount TEXT, method TEXT);
CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY, shop_id INTEGER, supplier_id INTEGER, total_amount TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS purchase_items (id INTEGER PRIMARY KEY, purchase_id INTEGER, product_id INTEGER, quantity TEXT, buying_price TEXT);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, shop_id INTEGER, amount TEXT, description TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS cashflows (id INTEGER PRIMARY KEY, shop_id INTEGER, amount TEXT, type TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY, shop_id INTEGER, name TEXT, balance TEXT);
CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, shop_id INTEGER, name TEXT);
CREATE TABLE IF NOT EXISTS attendants (id INTEGER PRIMARY KEY, shop_id INTEGER, username TEXT);
CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT);
`;
  return ok(res, { ddl, version: "2.0.0" });
});

router.get("/checkupdate/desktop", (_req, res) => {
  return ok(res, { version: "2.0.0", url: null, mandatory: false });
});

router.post("/dump", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) counts[key] = value.length;
    }
    return ok(res, {
      received: true,
      counts,
      note: "Stub: payload acknowledged, no upsert performed",
    });
  } catch (e) {
    next(e);
  }
});

router.post("/dump/online", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) counts[key] = value.length;
    }
    return ok(res, {
      received: true,
      online: true,
      counts,
      note: "Stub: online payload acknowledged",
    });
  } catch (e) {
    next(e);
  }
});

router.get("/:shopId", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    if (!shopId) throw badRequest("shopId required");

    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId),
    });
    if (!shop) throw notFound("Shop not found");

    const [
      productsRows,
      inventoryRows,
      categoriesRows,
      customersRows,
      suppliersRows,
      salesRows,
      saleItemsRows,
      salePaymentsRows,
      purchasesRows,
      purchaseItemsRows,
      purchasePaymentsRows,
      expensesRows,
      cashflowsRows,
      banksRows,
      paymentMethodsRows,
      attendantsRows,
      adjustmentsRows,
      badStocksRows,
      batchesRows,
      productSerialsRows,
      transfersRows,
      ordersRows,
    ] = await Promise.all([
      db.select().from(products).where(eq(products.shop, shopId)),
      db.select().from(inventory).where(eq(inventory.shop, shopId)),
      db.select().from(productCategories),
      db.select().from(customers).where(eq(customers.shop, shopId)),
      db.select().from(suppliers).where(eq(suppliers.shop, shopId)),
      db.select().from(sales).where(eq(sales.shop, shopId)),
      db.select().from(saleItems),
      db.select().from(salePayments),
      db.select().from(purchases).where(eq(purchases.shop, shopId)),
      db.select().from(purchaseItems),
      db.select().from(purchasePayments),
      db.select().from(expenses).where(eq(expenses.shop, shopId)),
      db.select().from(cashflows).where(eq(cashflows.shop, shopId)),
      db.select().from(banks).where(eq(banks.shop, shopId)),
      db.select().from(paymentMethods).where(eq(paymentMethods.shop, shopId)),
      db.select().from(attendants).where(eq(attendants.shop, shopId)),
      db.select().from(adjustments).where(eq(adjustments.shop, shopId)),
      db.select().from(badStocks).where(eq(badStocks.shop, shopId)),
      db.select().from(batches),
      db.select().from(productSerials),
      db.select().from(productTransfers),
      db.select().from(orders).where(eq(orders.shop, shopId)),
    ]);

    return ok(res, {
      shop,
      generatedAt: new Date().toISOString(),
      products: productsRows,
      inventory: inventoryRows,
      productCategories: categoriesRows,
      customers: customersRows,
      suppliers: suppliersRows,
      sales: salesRows,
      saleItems: saleItemsRows,
      salePayments: salePaymentsRows,
      purchases: purchasesRows,
      purchaseItems: purchaseItemsRows,
      purchasePayments: purchasePaymentsRows,
      expenses: expensesRows,
      cashflows: cashflowsRows,
      banks: banksRows,
      paymentMethods: paymentMethodsRows,
      attendants: attendantsRows,
      adjustments: adjustmentsRows,
      badStocks: badStocksRows,
      batches: batchesRows,
      productSerials: productSerialsRows,
      transfers: transfersRows,
      orders: ordersRows,
    });
  } catch (e) {
    next(e);
  }
});

router.delete("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    if (!shopId) throw badRequest("shopId required");
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId),
    });
    if (!shop) throw notFound("Shop not found");
    return noContent(res);
  } catch (e) {
    next(e);
  }
});

export default router;
