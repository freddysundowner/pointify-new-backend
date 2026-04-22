/**
 * Sales tables
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
import { products, batches, productSerials } from "./catalog";
import { orders } from "./orders";

// ─── Sales ────────────────────────────────────────────────────────────────────
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    receiptNo: text("receipt_no").unique(),

    // Totals (cached for fast reporting — derivable from sale_items + sale_payments)
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    totalWithDiscount: numeric("total_with_discount", { precision: 14, scale: 2 }).notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }).notNull().default("0"),
    saleDiscount: numeric("sale_discount", { precision: 14, scale: 2 }).notNull().default("0"),

    // Payment totals (cached per method — derivable from sale_payments)
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    mpesaTotal: numeric("mpesa_total", { precision: 14, scale: 2 }).notNull().default("0"),
    bankTotal: numeric("bank_total", { precision: 14, scale: 2 }).notNull().default("0"),
    cardTotal: numeric("card_total", { precision: 14, scale: 2 }).notNull().default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).notNull().default("0"),

    // Retail | Dealer | Wholesale | Order
    saleType: text("sale_type").notNull().default("Retail"),
    // cash | credit | mpesa | card | bank | split
    paymentType: text("payment_type").notNull().default("cash"),
    // cashed | credit | refunded | voided
    status: text("status").notNull().default("cashed"),

    saleNote: text("sale_note"),
    dueDate: timestamp("due_date"),   // for credit sales

    shop: integer("shop_id").notNull().references(() => shops.id),
    customer: integer("customer_id").references(() => customers.id),
    attendant: integer("attendant_id").references(() => attendants.id),
    order: integer("order_id").references(() => orders.id),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sales_shop_id_idx").on(table.shop),
    index("sales_shop_date_idx").on(table.shop, table.createdAt),
    index("sales_customer_id_idx").on(table.customer),
    index("sales_attendant_id_idx").on(table.attendant),
    index("sales_order_id_idx").on(table.order),
    index("sales_status_idx").on(table.status),
    index("sales_created_at_idx").on(table.createdAt),
  ]
);

// ─── Sale items ───────────────────────────────────────────────────────────────
// One row per product sold. Prices are recorded at time of sale (not product.selling_price
// which can change). Each item can have its own pricing tier and attendant for commission.
export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),

    // Attendant who sold this item — for per-item commission tracking
    attendant: integer("attendant_id").references(() => attendants.id),

    // Serial number for serialised products (phones, laptops, etc.)
    serial: integer("serial_id").references(() => productSerials.id),

    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }).default("0"),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull().default("0"),
    lineDiscount: numeric("line_discount", { precision: 14, scale: 2 }).notNull().default("0"),
    saleNote: text("sale_note"),

    // Retail | Dealer | Wholesale — which pricing tier was applied to this item
    saleType: text("sale_type").notNull().default("Retail"),
    // cashed | returned — item-level status for tracking partial returns
    status: text("status").notNull().default("cashed"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sale_items_sale_id_idx").on(table.sale),
    index("sale_items_product_id_idx").on(table.product),
    index("sale_items_serial_id_idx").on(table.serial),
  ]
);

// ─── Sale item batches ────────────────────────────────────────────────────────
// When batch tracking is on, records which batch(es) a sale item was pulled from.
// One sale item can span multiple batches (FEFO — first expiry first out).
export const saleItemBatches = pgTable(
  "sale_item_batches",
  {
    id: serial("id").primaryKey(),
    saleItem: integer("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
    batch: integer("batch_id").notNull().references(() => batches.id),
    quantityTaken: numeric("quantity_taken", { precision: 14, scale: 4 }).notNull(),
  },
  (table) => [
    index("sale_item_batches_sale_item_idx").on(table.saleItem),
    index("sale_item_batches_batch_id_idx").on(table.batch),
  ]
);

// ─── Sale payments ────────────────────────────────────────────────────────────
// One row per payment instalment. A split payment (cash + M-Pesa) = 2 rows.
// Credit sales get a payment row each time the customer makes a partial payment.
export const salePayments = pgTable(
  "sale_payments",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    receivedBy: integer("received_by_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentNo: text("payment_no"),
    paymentReference: text("payment_reference"),
    // cash | mpesa | card | bank | wallet
    paymentType: text("payment_type").notNull(),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
  },
  (table) => [
    index("sale_payments_sale_id_idx").on(table.sale),
  ]
);

// ─── Sale returns ─────────────────────────────────────────────────────────────
// Header for a return/refund against a completed sale.
export const saleReturns = pgTable(
  "sale_returns",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").notNull().references(() => sales.id),
    customer: integer("customer_id").references(() => customers.id),
    processedBy: integer("processed_by_id").notNull().references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    // cash | mpesa | card | bank | store_credit
    refundMethod: text("refund_method").notNull(),
    refundReference: text("refund_reference"),
    reason: text("reason"),
    returnNo: text("return_no").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sale_returns_shop_id_idx").on(table.shop),
    index("sale_returns_sale_id_idx").on(table.sale),
  ]
);

// ─── Sale return items ────────────────────────────────────────────────────────
// Line items for a return — which products were returned and how many.
export const saleReturnItems = pgTable(
  "sale_return_items",
  {
    id: serial("id").primaryKey(),
    saleReturn: integer("sale_return_id").notNull().references(() => saleReturns.id, { onDelete: "cascade" }),
    saleItem: integer("sale_item_id").notNull().references(() => saleItems.id),
    product: integer("product_id").notNull().references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index("sale_return_items_return_idx").on(table.saleReturn),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true });
export const insertSaleItemBatchSchema = createInsertSchema(saleItemBatches).omit({ id: true });
export const insertSalePaymentSchema = createInsertSchema(salePayments).omit({ id: true });
export const insertSaleReturnSchema = createInsertSchema(saleReturns).omit({ id: true });
export const insertSaleReturnItemSchema = createInsertSchema(saleReturnItems).omit({ id: true });

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItemBatch = typeof saleItemBatches.$inferSelect;
export type InsertSaleItemBatch = z.infer<typeof insertSaleItemBatchSchema>;
export type SalePayment = typeof salePayments.$inferSelect;
export type InsertSalePayment = z.infer<typeof insertSalePaymentSchema>;
export type SaleReturn = typeof saleReturns.$inferSelect;
export type InsertSaleReturn = z.infer<typeof insertSaleReturnSchema>;
export type SaleReturnItem = typeof saleReturnItems.$inferSelect;
export type InsertSaleReturnItem = z.infer<typeof insertSaleReturnItemSchema>;
