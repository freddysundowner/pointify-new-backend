import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shops";
import { customers } from "./customers";
import { attendants } from "./admins-attendants";
import { products } from "./products";
import { batches } from "./products";
import { orders } from "./orders";

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    // Unique human-readable reference printed on receipts (e.g. REC123456)
    receiptNo: text("receipt_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    totalWithDiscount: numeric("total_with_discount", { precision: 14, scale: 2 }).notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }),
    // Subtotal collected via M-Pesa
    mpesaNewTotal: numeric("mpesa_new_total", { precision: 14, scale: 2 }).default("0"),
    // Subtotal collected via bank transfer
    bankTotal: numeric("bank_total", { precision: 14, scale: 2 }).default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
    // Discount applied at the sale level (on top of per-item discounts)
    saleDiscount: numeric("sale_discount", { precision: 14, scale: 2 }).default("0"),
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),
    // Retail | Dealer | Wholesale | Order
    saleType: text("sale_type").default("Retail"),
    // cash | credit | wallet | mpesa | later | card | bank | split
    paymentType: text("payment_type").default("cash"),
    paymentTag: text("payment_tag").default("cash"),
    // cashed | credit | refunded | voided
    status: text("status").default("cashed"),
    // Free-text order reference string, e.g. an external order number or label
    orderRef: text("order_ref"),
    salesnote: text("salesnote"),
    dueDate: timestamp("due_date"),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    customerId: integer("customer_id").references(() => customers.id),
    attendantId: integer("attendant_id").references(() => attendants.id),
    orderId: integer("order_id").references(() => orders.id),
    // Links a sale to a production/delivery batch
    batchId: integer("batch_id").references(() => batches.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sales_shop_id_idx").on(table.shopId),
    index("sales_created_at_idx").on(table.createdAt),
    index("sales_shop_date_idx").on(table.shopId, table.createdAt),
    index("sales_customer_id_idx").on(table.customerId),
    index("sales_attendant_id_idx").on(table.attendantId),
    index("sales_status_idx").on(table.status),
  ]
);

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
    salesnote: text("salesnote"),
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

// A single sale item can be fulfilled from multiple batches (FIFO batch depletion)
export const saleItemBatches = pgTable("sale_item_batches", {
  id: serial("id").primaryKey(),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
});

// Instalment / partial payment records for a sale (normalized from MongoDB embedded array)
export const salePayments = pgTable(
  "sale_payments",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    paymentNo: text("payment_no"),
    mpesaCode: text("mpesa_code"),
    paymentType: text("payment_type"),
    paidAt: timestamp("paid_at").defaultNow(),
  },
  (table) => [
    index("sale_payments_sale_id_idx").on(table.saleId),
  ]
);

export const saleReturns = pgTable(
  "sale_returns",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull().references(() => sales.id),
    customerId: integer("customer_id").references(() => customers.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason"),
    saleReturnNo: text("sale_return_no").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("sale_returns_shop_id_idx").on(table.shopId),
    index("sale_returns_sale_id_idx").on(table.saleId),
  ]
);

export const saleReturnItems = pgTable("sale_return_items", {
  id: serial("id").primaryKey(),
  saleReturnId: integer("sale_return_id").notNull().references(() => saleReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
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
