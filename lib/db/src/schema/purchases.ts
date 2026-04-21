/**
 * Purchase tables
 * A Purchase records stock bought from a supplier.
 * Related: purchase line items, instalment payments, and supplier returns.
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { suppliers } from "./suppliers";
import { attendants } from "./identity";
import { products } from "./catalog";

// ─── Purchases ────────────────────────────────────────────────────────────────
export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    // Unique human-readable reference e.g. PUR-1234567
    purchaseNo: text("purchase_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),
    // cash | credit | mpesa | bank
    paymentType: text("payment_type").notNull(),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    createdById: integer("created_by_id").references(() => attendants.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("purchases_shop_id_idx").on(table.shopId),
    index("purchases_supplier_id_idx").on(table.supplierId),
    index("purchases_created_at_idx").on(table.createdAt),
  ]
);

// ─── Purchase items ───────────────────────────────────────────────────────────
export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id").references(() => purchases.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    shopId: integer("shop_id").references(() => shops.id),
    receivedById: integer("received_by_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).default("0"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    lineDiscount: numeric("line_discount", { precision: 14, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("purchase_items_purchase_id_idx").on(table.purchaseId),
    index("purchase_items_product_id_idx").on(table.productId),
  ]
);

// ─── Purchase payments ────────────────────────────────────────────────────────
// Instalment records for credit purchases.
export const purchasePayments = pgTable(
  "purchase_payments",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
    paidById: integer("paid_by_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    paymentNo: text("payment_no"),
    paidAt: timestamp("paid_at").defaultNow(),
  },
  (table) => [
    index("purchase_payments_purchase_id_idx").on(table.purchaseId),
  ]
);

// ─── Purchase returns ─────────────────────────────────────────────────────────
export const purchaseReturns = pgTable(
  "purchase_returns",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    processedById: integer("processed_by_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    // cash | credit | mpesa | bank
    paymentType: text("payment_type"),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason"),
    returnNo: text("return_no").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("purchase_returns_shop_id_idx").on(table.shopId),
  ]
);

// Products included in a purchase return
export const purchaseReturnItems = pgTable("purchase_return_items", {
  id: serial("id").primaryKey(),
  purchaseReturnId: integer("purchase_return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true });
export const insertPurchaseItemSchema = createInsertSchema(purchaseItems).omit({ id: true });
export const insertPurchasePaymentSchema = createInsertSchema(purchasePayments).omit({ id: true });
export const insertPurchaseReturnSchema = createInsertSchema(purchaseReturns).omit({ id: true });
export const insertPurchaseReturnItemSchema = createInsertSchema(purchaseReturnItems).omit({ id: true });

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type PurchasePayment = typeof purchasePayments.$inferSelect;
export type InsertPurchasePayment = z.infer<typeof insertPurchasePaymentSchema>;
export type PurchaseReturn = typeof purchaseReturns.$inferSelect;
export type InsertPurchaseReturn = z.infer<typeof insertPurchaseReturnSchema>;
export type PurchaseReturnItem = typeof purchaseReturnItems.$inferSelect;
export type InsertPurchaseReturnItem = z.infer<typeof insertPurchaseReturnItemSchema>;
