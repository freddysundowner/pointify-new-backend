/**
 * Purchase tables
 */
import {
  pgTable,
  serial,
  text,
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
import { products, batches } from "./catalog";

// ─── Purchases ────────────────────────────────────────────────────────────────
// Records stock received from a supplier. The financial mirror of a sale —
// money goes OUT, stock comes IN.
export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),

    // Auto-generated reference (e.g. PUR1234567)
    purchaseNo: text("purchase_no").unique(),

    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).notNull().default("0"),

    // cash | credit | mpesa | bank
    paymentType: text("payment_type").notNull(),

    shop: integer("shop_id").notNull().references(() => shops.id),
    supplier: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    createdBy: integer("created_by_id").references(() => attendants.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchases_shop_id_idx").on(table.shop),
    index("purchases_supplier_id_idx").on(table.supplier),
    index("purchases_created_at_idx").on(table.createdAt),
  ]
);

// ─── Purchase items ───────────────────────────────────────────────────────────
// One row per product received. When shop.track_batches = true, each item
// creates a new batch using batch_code and expiry_date.
export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: serial("id").primaryKey(),
    purchase: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").references(() => shops.id),
    receivedBy: integer("received_by_id").references(() => attendants.id),

    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    lineDiscount: numeric("line_discount", { precision: 14, scale: 2 }).notNull().default("0"),

    batchCode: text("batch_code"),
    expiryDate: timestamp("expiry_date"),
    batch: integer("batch_id").references(() => batches.id),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_items_purchase_id_idx").on(table.purchase),
    index("purchase_items_product_id_idx").on(table.product),
    index("purchase_items_batch_id_idx").on(table.batch),
  ]
);

// ─── Purchase payments ────────────────────────────────────────────────────────
// One row per payment instalment to the supplier.
export const purchasePayments = pgTable(
  "purchase_payments",
  {
    id: serial("id").primaryKey(),
    purchase: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
    paidBy: integer("paid_by_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentNo: text("payment_no"),
    // External transaction ref — M-Pesa code, bank ref, cheque number
    paymentReference: text("payment_reference"),
    // cash | mpesa | bank | cheque
    paymentType: text("payment_type").notNull(),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_payments_purchase_id_idx").on(table.purchase),
  ]
);

// ─── Purchase returns ─────────────────────────────────────────────────────────
// Header for returning goods back to a supplier.
export const purchaseReturns = pgTable(
  "purchase_returns",
  {
    id: serial("id").primaryKey(),
    purchase: integer("purchase_id").notNull().references(() => purchases.id),
    supplier: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    processedBy: integer("processed_by_id").references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    // cash | mpesa | bank | cheque | credit_note
    refundMethod: text("refund_method").notNull(),
    refundReference: text("refund_reference"),
    reason: text("reason"),
    returnNo: text("return_no").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("purchase_returns_shop_id_idx").on(table.shop),
    index("purchase_returns_purchase_id_idx").on(table.purchase),
  ]
);

// ─── Purchase return items ────────────────────────────────────────────────────
export const purchaseReturnItems = pgTable(
  "purchase_return_items",
  {
    id: serial("id").primaryKey(),
    purchaseReturn: integer("purchase_return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
    purchaseItem: integer("purchase_item_id").notNull().references(() => purchaseItems.id),
    product: integer("product_id").notNull().references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index("purchase_return_items_return_idx").on(table.purchaseReturn),
  ]
);

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
