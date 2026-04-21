import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shops";
import { customers } from "./customers";
import { attendants } from "./admins-attendants";
import { products } from "./products";
import { batches } from "./products";
import { orders } from "./orders";

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  receiptNo: text("receipt_no"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  totalWithDiscount: numeric("total_with_discount", { precision: 14, scale: 2 }).notNull(),
  totalTax: numeric("total_tax", { precision: 14, scale: 2 }),
  mpesaNewTotal: numeric("mpesa_new_total", { precision: 14, scale: 2 }).default("0"),
  bankTotal: numeric("bank_total", { precision: 14, scale: 2 }).default("0"),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
  saleDiscount: numeric("sale_discount", { precision: 14, scale: 2 }).default("0"),
  outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),
  saleType: text("sale_type").default("Retail"), // Retail | Dealer | Wholesale | Order
  paymentType: text("payment_type").default("cash"), // cash | credit | wallet | mpesa | later | card | bank | split
  paymentTag: text("payment_tag").default("cash"),
  status: text("status").default("cashed"),
  order: text("order"),
  salesnote: text("salesnote"),
  dueDate: timestamp("due_date"),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  customerId: integer("customer_id").references(() => customers.id),
  attendantId: integer("attendant_id").references(() => attendants.id),
  orderId: integer("order_id").references(() => orders.id),
  // batchId references batches.id
  batchId: integer("batch_id").references(() => batches.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const saleItems = pgTable("sale_items", {
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
  saleType: text("sale_type").default("Retail"), // Retail | Dealer | Wholesale | Order
  paymentTag: text("payment_tag").default("cash"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Junction: sale_items.batch (array of batch refs)
export const saleItemBatches = pgTable("sale_item_batches", {
  id: serial("id").primaryKey(),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id),
});

// Normalized from embedded payments array in Sale
export const salePayments = pgTable("sale_payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  attendantId: integer("attendant_id").notNull().references(() => attendants.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  paymentNo: text("payment_no"),
  mpesaCode: text("mpesa_code"),
  paymentType: text("payment_type"),
  paidAt: timestamp("paid_at").defaultNow(),
});

export const saleReturns = pgTable("sale_returns", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  customerId: integer("customer_id").references(() => customers.id),
  attendantId: integer("attendant_id").notNull().references(() => attendants.id),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"),
  saleReturnNo: text("sale_return_no"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

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
