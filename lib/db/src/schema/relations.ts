/**
 * Drizzle ORM relations — required for db.query.X.findMany({ with: {...} })
 *
 * Every "one" side needs to be defined on the parent, every "many" side
 * needs to be defined on the child. Both sides must be declared for the
 * relational API to resolve correctly.
 */
import { relations } from "drizzle-orm";
import { sales, saleItems, salePayments, saleReturns, saleReturnItems, saleItemBatches } from "./sales";
import { purchases, purchaseItems, purchasePayments, purchaseReturns, purchaseReturnItems } from "./purchases";
import { orders, orderItems } from "./orders";
import {
  inventory, products, productCategories, batches, productSerials, bundleItems,
  stockCounts, stockCountItems, stockRequests, stockRequestItems,
  adjustments, badStocks,
} from "./catalog";
import { productTransfers, transferItems } from "./transfers";
import { packages, packageFeatures, subscriptions, subscriptionShops } from "./subscriptions";
import { customers, customerWalletTransactions } from "./customers";
import { suppliers, supplierWalletTransactions } from "./suppliers";
import { shops } from "./shop";
import { admins, attendants } from "./identity";
import { affiliates, awards, affiliateTransactions } from "./affiliates";
import { banks, cashflows, expenses, userPayments, expenseCategories, cashflowCategories, paymentMethods } from "./finance";
import { communications } from "./communication";

// ─── Sales ────────────────────────────────────────────────────────────────────
export const salesRelations = relations(sales, ({ many, one }) => ({
  saleItems: many(saleItems),
  salePayments: many(salePayments),
  saleReturns: many(saleReturns),
  shop: one(shops, { fields: [sales.shop], references: [shops.id] }),
  customer: one(customers, { fields: [sales.customer], references: [customers.id] }),
  attendant: one(attendants, { fields: [sales.attendant], references: [attendants.id] }),
  order: one(orders, { fields: [sales.order], references: [orders.id] }),
}));

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, { fields: [saleItems.sale], references: [sales.id] }),
  product: one(products, { fields: [saleItems.product], references: [products.id] }),
  batches: many(saleItemBatches),
}));

export const saleItemBatchesRelations = relations(saleItemBatches, ({ one }) => ({
  saleItem: one(saleItems, { fields: [saleItemBatches.saleItem], references: [saleItems.id] }),
  batch: one(batches, { fields: [saleItemBatches.batch], references: [batches.id] }),
}));

export const salePaymentsRelations = relations(salePayments, ({ one }) => ({
  sale: one(sales, { fields: [salePayments.sale], references: [sales.id] }),
}));

export const saleReturnsRelations = relations(saleReturns, ({ one, many }) => ({
  sale: one(sales, { fields: [saleReturns.sale], references: [sales.id] }),
  shop: one(shops, { fields: [saleReturns.shop], references: [shops.id] }),
  customer: one(customers, { fields: [saleReturns.customer], references: [customers.id] }),
  processedBy: one(attendants, { fields: [saleReturns.processedBy], references: [attendants.id] }),
  saleReturnItems: many(saleReturnItems),
}));

export const saleReturnItemsRelations = relations(saleReturnItems, ({ one }) => ({
  saleReturn: one(saleReturns, { fields: [saleReturnItems.saleReturn], references: [saleReturns.id] }),
  product: one(products, { fields: [saleReturnItems.product], references: [products.id] }),
}));

// ─── Purchases ────────────────────────────────────────────────────────────────
export const purchasesRelations = relations(purchases, ({ many, one }) => ({
  purchaseItems: many(purchaseItems),
  purchasePayments: many(purchasePayments),
  purchaseReturns: many(purchaseReturns),
  shop: one(shops, { fields: [purchases.shop], references: [shops.id] }),
  supplier: one(suppliers, { fields: [purchases.supplier], references: [suppliers.id] }),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchase], references: [purchases.id] }),
  product: one(products, { fields: [purchaseItems.product], references: [products.id] }),
}));

export const purchasePaymentsRelations = relations(purchasePayments, ({ one }) => ({
  purchase: one(purchases, { fields: [purchasePayments.purchase], references: [purchases.id] }),
}));

export const purchaseReturnsRelations = relations(purchaseReturns, ({ one, many }) => ({
  purchase: one(purchases, { fields: [purchaseReturns.purchase], references: [purchases.id] }),
  shop: one(shops, { fields: [purchaseReturns.shop], references: [shops.id] }),
  supplier: one(suppliers, { fields: [purchaseReturns.supplier], references: [suppliers.id] }),
  processedBy: one(attendants, { fields: [purchaseReturns.processedBy], references: [attendants.id] }),
  purchaseReturnItems: many(purchaseReturnItems),
}));

export const purchaseReturnItemsRelations = relations(purchaseReturnItems, ({ one }) => ({
  purchaseReturn: one(purchaseReturns, { fields: [purchaseReturnItems.purchaseReturn], references: [purchaseReturns.id] }),
  product: one(products, { fields: [purchaseReturnItems.product], references: [products.id] }),
}));

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersRelations = relations(orders, ({ many, one }) => ({
  orderItems: many(orderItems),
  shop: one(shops, { fields: [orders.shop], references: [shops.id] }),
  customer: one(customers, { fields: [orders.customer], references: [customers.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.order], references: [orders.id] }),
  product: one(products, { fields: [orderItems.product], references: [products.id] }),
}));

// ─── Inventory / Catalog ──────────────────────────────────────────────────────
export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.product], references: [products.id] }),
  shop: one(shops, { fields: [inventory.shop], references: [shops.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, { fields: [products.category], references: [productCategories.id] }),
  shop: one(shops, { fields: [products.shop], references: [shops.id] }),
  inventoryItems: many(inventory),
  batches: many(batches),
  serials: many(productSerials),
}));

export const productCategoriesRelations = relations(productCategories, ({ many, one }) => ({
  products: many(products),
  admin: one(admins, { fields: [productCategories.admin], references: [admins.id] }),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
  product: one(products, { fields: [batches.product], references: [products.id] }),
  shop: one(shops, { fields: [batches.shop], references: [shops.id] }),
}));

export const productSerialsRelations = relations(productSerials, ({ one }) => ({
  product: one(products, { fields: [productSerials.product], references: [products.id] }),
  shop: one(shops, { fields: [productSerials.shop], references: [shops.id] }),
}));

export const stockCountsRelations = relations(stockCounts, ({ one, many }) => ({
  stockCountItems: many(stockCountItems),
  shop: one(shops, { fields: [stockCounts.shop], references: [shops.id] }),
  conductedBy: one(attendants, { fields: [stockCounts.conductedBy], references: [attendants.id] }),
}));

export const stockCountItemsRelations = relations(stockCountItems, ({ one }) => ({
  stockCount: one(stockCounts, { fields: [stockCountItems.stockCount], references: [stockCounts.id] }),
  product: one(products, { fields: [stockCountItems.product], references: [products.id] }),
}));

export const stockRequestsRelations = relations(stockRequests, ({ one, many }) => ({
  stockRequestItems: many(stockRequestItems),
  fromShop: one(shops, { fields: [stockRequests.fromShop], references: [shops.id] }),
  warehouse: one(shops, { fields: [stockRequests.warehouse], references: [shops.id] }),
  requestedBy: one(attendants, { fields: [stockRequests.requestedBy], references: [attendants.id] }),
}));

export const stockRequestItemsRelations = relations(stockRequestItems, ({ one }) => ({
  stockRequest: one(stockRequests, { fields: [stockRequestItems.stockRequest], references: [stockRequests.id] }),
  product: one(products, { fields: [stockRequestItems.product], references: [products.id] }),
}));

// ─── Transfers ────────────────────────────────────────────────────────────────
export const productTransfersRelations = relations(productTransfers, ({ one, many }) => ({
  transferItems: many(transferItems),
  fromShop: one(shops, { fields: [productTransfers.fromShop], references: [shops.id] }),
  toShop: one(shops, { fields: [productTransfers.toShop], references: [shops.id] }),
  initiatedBy: one(attendants, { fields: [productTransfers.initiatedBy], references: [attendants.id] }),
}));

export const transferItemsRelations = relations(transferItems, ({ one }) => ({
  transfer: one(productTransfers, { fields: [transferItems.transfer], references: [productTransfers.id] }),
  product: one(products, { fields: [transferItems.product], references: [products.id] }),
}));

// ─── Subscriptions / Packages ─────────────────────────────────────────────────
export const packagesRelations = relations(packages, ({ many }) => ({
  packageFeatures: many(packageFeatures),
  subscriptions: many(subscriptions),
}));

export const packageFeaturesRelations = relations(packageFeatures, ({ one }) => ({
  package: one(packages, { fields: [packageFeatures.package], references: [packages.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  package: one(packages, { fields: [subscriptions.package], references: [packages.id] }),
  subscriptionShops: many(subscriptionShops),
  shop: one(shops, { fields: [subscriptions.shop], references: [shops.id] }),
  admin: one(admins, { fields: [subscriptions.admin], references: [admins.id] }),
}));

export const subscriptionShopsRelations = relations(subscriptionShops, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionShops.subscription], references: [subscriptions.id] }),
  shop: one(shops, { fields: [subscriptionShops.shop], references: [shops.id] }),
}));

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
  orders: many(orders),
  walletTransactions: many(customerWalletTransactions),
}));

export const customerWalletTransactionsRelations = relations(customerWalletTransactions, ({ one }) => ({
  customer: one(customers, { fields: [customerWalletTransactions.customer], references: [customers.id] }),
  shop: one(shops, { fields: [customerWalletTransactions.shop], references: [shops.id] }),
}));

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
  walletTransactions: many(supplierWalletTransactions),
}));

export const supplierWalletTransactionsRelations = relations(supplierWalletTransactions, ({ one }) => ({
  supplier: one(suppliers, { fields: [supplierWalletTransactions.supplier], references: [suppliers.id] }),
  shop: one(shops, { fields: [supplierWalletTransactions.shop], references: [shops.id] }),
}));

// ─── Shops ────────────────────────────────────────────────────────────────────
export const shopsRelations = relations(shops, ({ one, many }) => ({
  admin: one(admins, { fields: [shops.admin], references: [admins.id] }),
  inventory: many(inventory),
}));

// ─── Admins ───────────────────────────────────────────────────────────────────
export const adminsRelations = relations(admins, ({ many }) => ({
  shops: many(shops),
  attendants: many(attendants),
}));

// ─── Attendants ───────────────────────────────────────────────────────────────
export const attendantsRelations = relations(attendants, ({ one }) => ({
  shop: one(shops, { fields: [attendants.shop], references: [shops.id] }),
  admin: one(admins, { fields: [attendants.admin], references: [admins.id] }),
}));

// ─── Finance ──────────────────────────────────────────────────────────────────
export const banksRelations = relations(banks, ({ one }) => ({
  shop: one(shops, { fields: [banks.shop], references: [shops.id] }),
}));

export const cashflowsRelations = relations(cashflows, ({ one }) => ({
  shop: one(shops, { fields: [cashflows.shop], references: [shops.id] }),
  bank: one(banks, { fields: [cashflows.bank], references: [banks.id] }),
  category: one(cashflowCategories, { fields: [cashflows.category], references: [cashflowCategories.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  shop: one(shops, { fields: [expenses.shop], references: [shops.id] }),
  category: one(expenseCategories, { fields: [expenses.category], references: [expenseCategories.id] }),
}));

// ─── Affiliates ───────────────────────────────────────────────────────────────
export const affiliatesRelations = relations(affiliates, ({ many }) => ({
  awards: many(awards),
  transactions: many(affiliateTransactions),
}));

export const awardsRelations = relations(awards, ({ one }) => ({
  affiliate: one(affiliates, { fields: [awards.affiliate], references: [affiliates.id] }),
  shop: one(shops, { fields: [awards.shop], references: [shops.id] }),
}));

export const affiliateTransactionsRelations = relations(affiliateTransactions, ({ one }) => ({
  affiliate: one(affiliates, { fields: [affiliateTransactions.affiliate], references: [affiliates.id] }),
}));
