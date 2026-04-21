/**
 * Sales tables
 * A Sale is a completed payment transaction at the POS.
 * Related: sale line items, batch sourcing, instalment payments, and returns.
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
import { customers } from "./customers";
import { attendants } from "./identity";
import { products, batches } from "./catalog";
import { orders } from "./orders";

// ─── Sales ────────────────────────────────────────────────────────────────────
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    // Unique reference printed on customer receipts e.g. REC-123456
    receiptNo: text("receipt_no").unique(),

    // Totals
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    totalWithDiscount: numeric("total_with_discount", { precision: 14, scale: 2 }).notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }),
    // Portion of the total collected via M-Pesa (split-payment support)
    mpesaTotal: numeric("mpesa_total", { precision: 14, scale: 2 }).default("0"),
    // Portion collected via bank transfer
    bankTotal: numeric("bank_total", { precision: 14, scale: 2 }).default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
    // Discount applied at the sale header level (on top of per-line discounts)
    saleDiscount: numeric("sale_discount", { precision: 14, scale: 2 }).default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),

    // Retail | Dealer | Wholesale | Order
    saleType: text("sale_type").default("Retail"),
    // cash | credit | wallet | mpesa | later | card | bank | split
    paymentType: text("payment_type").default("cash"),
    // Granular payment identifier used in split-payment scenarios
    paymentTag: text("payment_tag").default("cash"),
    // cashed | credit | refunded | voided
    status: text("status").default("cashed"),

    // Optional free-text reference (e.g. external order number, delivery note)
    orderRef: text("order_ref"),
    saleNote: text("sale_note"),
    dueDate: timestamp("due_date"),

    shopId: integer("shop_id").notNull().references(() => shops.id),
    customerId: integer("customer_id").references(() => customers.id),
    attendantId: integer("attendant_id").references(() => attendants.id),
    // Set when this sale fulfils an existing Order
    orderId: integer("order_id").references(() => orders.id),
    // Links the sale to a production/delivery batch (manufacturing shops)
    batchId: integer("batch_id").references(() => batches.id),

    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sales_shop_id_idx").on(table.shopId),
    index("sales_shop_date_idx").on(table.shopId, table.createdAt),
    index("sales_customer_id_idx").on(table.customerId),
    index("sales_attendant_id_idx").on(table.attendantId),
    index("sales_status_idx").on(table.status),
    index("sales_created_at_idx").on(table.createdAt),
  ]
);

// ─── Sale items ───────────────────────────────────────────────────────────────
// Each product line within a sale. Denormalised saleType / paymentTag are kept
// here intentionally for offline-sync and historical reporting accuracy.
export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id),
    attendantId: integer("attendant_id").references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }),
    lineDiscount: numeric("line_discount", { precision: 14, scale: 2 }).default("0"),
    saleNote: text("sale_note"),
    status: text("status").default("cashed"),
    saleType: text("sale_type").default("Retail"),
    paymentTag: text("payment_tag").default("cash"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sale_items_sale_id_idx").on(table.saleId),
    index("sale_items_product_id_idx").on(table.productId),
    index("sale_items_shop_id_idx").on(table.shopId),
  ]
);

// ─── Sale item batches ────────────────────────────────────────────────────────
// A single sale line can deplete multiple batches (FIFO). This records which
// batches were drawn from and how much was taken from each.
export const saleItemBatches = pgTable("sale_item_batches", {
  id: serial("id").primaryKey(),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
  quantityTaken: numeric("quantity_taken", { precision: 14, scale: 4 }),
});

// ─── Sale payments ────────────────────────────────────────────────────────────
// Instalment / partial payment records for credit sales.
// Normalised from the embedded payments array in the original MongoDB model.
export const salePayments = pgTable(
  "sale_payments",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    receivedById: integer("received_by_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    paymentNo: text("payment_no"),
    mpesaCode: text("mpesa_code"),
    // cash | mpesa | bank | card …
    paymentType: text("payment_type"),
    paidAt: timestamp("paid_at").defaultNow(),
  },
  (table) => [
    index("sale_payments_sale_id_idx").on(table.saleId),
  ]
);

// ─── Sale returns ─────────────────────────────────────────────────────────────
export const saleReturns = pgTable(
  "sale_returns",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull().references(() => sales.id),
    customerId: integer("customer_id").references(() => customers.id),
    processedById: integer("processed_by_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason"),
    returnNo: text("return_no").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sale_returns_shop_id_idx").on(table.shopId),
    index("sale_returns_sale_id_idx").on(table.saleId),
  ]
);

// Products included in a sale return
export const saleReturnItems = pgTable("sale_return_items", {
  id: serial("id").primaryKey(),
  saleReturnId: integer("sale_return_id").notNull().references(() => saleReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export const insertSalePaymentSchema = createInsertSchema(salePayments).omit({ id: true });
export const insertSaleReturnSchema = createInsertSchema(saleReturns).omit({ id: true });
export const insertSaleReturnItemSchema = createInsertSchema(saleReturnItems).omit({ id: true });

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SalePayment = typeof salePayments.$inferSelect;
export type InsertSalePayment = z.infer<typeof insertSalePaymentSchema>;
export type SaleReturn = typeof saleReturns.$inferSelect;
export type InsertSaleReturn = z.infer<typeof insertSaleReturnSchema>;
export type SaleReturnItem = typeof saleReturnItems.$inferSelect;
export type InsertSaleReturnItem = z.infer<typeof insertSaleReturnItemSchema>;
