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
import { products, batches } from "./catalog";
import { orders } from "./orders";

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    receiptNo: text("receipt_no").unique(),

    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    totalWithDiscount: numeric("total_with_discount", { precision: 14, scale: 2 }).notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }),
    mpesaTotal: numeric("mpesa_total", { precision: 14, scale: 2 }).default("0"),
    bankTotal: numeric("bank_total", { precision: 14, scale: 2 }).default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
    saleDiscount: numeric("sale_discount", { precision: 14, scale: 2 }).default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),

    // Retail | Dealer | Wholesale | Order
    saleType: text("sale_type").default("Retail"),
    // cash | credit | wallet | mpesa | later | card | bank | split
    paymentType: text("payment_type").default("cash"),
    paymentTag: text("payment_tag").default("cash"),
    // cashed | credit | refunded | voided
    status: text("status").default("cashed"),

    orderRef: text("order_ref"),
    saleNote: text("sale_note"),
    dueDate: timestamp("due_date"),

    shop: integer("shop_id").notNull().references(() => shops.id),
    customer: integer("customer_id").references(() => customers.id),
    attendant: integer("attendant_id").references(() => attendants.id),
    order: integer("order_id").references(() => orders.id),
    batch: integer("batch_id").references(() => batches.id),

    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sales_shop_id_idx").on(table.shop),
    index("sales_shop_date_idx").on(table.shop, table.createdAt),
    index("sales_customer_id_idx").on(table.customer),
    index("sales_attendant_id_idx").on(table.attendant),
    index("sales_status_idx").on(table.status),
    index("sales_created_at_idx").on(table.createdAt),
  ]
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    attendant: integer("attendant_id").references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
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
    index("sale_items_sale_id_idx").on(table.sale),
    index("sale_items_product_id_idx").on(table.product),
    index("sale_items_shop_id_idx").on(table.shop),
  ]
);

export const saleItemBatches = pgTable("sale_item_batches", {
  id: serial("id").primaryKey(),
  saleItem: integer("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
  batch: integer("batch_id").notNull().references(() => batches.id),
  quantityTaken: numeric("quantity_taken", { precision: 14, scale: 4 }),
});

export const salePayments = pgTable(
  "sale_payments",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    receivedBy: integer("received_by_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    paymentNo: text("payment_no"),
    mpesaCode: text("mpesa_code"),
    paymentType: text("payment_type"),
    paidAt: timestamp("paid_at").defaultNow(),
  },
  (table) => [
    index("sale_payments_sale_id_idx").on(table.sale),
  ]
);

export const saleReturns = pgTable(
  "sale_returns",
  {
    id: serial("id").primaryKey(),
    sale: integer("sale_id").notNull().references(() => sales.id),
    customer: integer("customer_id").references(() => customers.id),
    processedBy: integer("processed_by_id").notNull().references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason"),
    returnNo: text("return_no").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sale_returns_shop_id_idx").on(table.shop),
    index("sale_returns_sale_id_idx").on(table.sale),
  ]
);

export const saleReturnItems = pgTable("sale_return_items", {
  id: serial("id").primaryKey(),
  saleReturn: integer("sale_return_id").notNull().references(() => saleReturns.id, { onDelete: "cascade" }),
  product: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
});

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
