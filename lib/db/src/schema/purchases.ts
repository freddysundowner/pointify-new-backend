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
import { suppliers } from "./suppliers";
import { attendants } from "./admins-attendants";
import { products } from "./products";

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  purchaseNo: text("purchase_no"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0"),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }).default("0"),
  outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).default("0"),
  paymentType: text("payment_type").notNull(), // cash | credit | mpesa | bank
  shopId: integer("shop_id").notNull().references(() => shops.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  attendantId: integer("attendant_id").references(() => attendants.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").references(() => purchases.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  shopId: integer("shop_id").references(() => shops.id),
  attendantId: integer("attendant_id").notNull().references(() => attendants.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).default("0"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  lineDiscount: numeric("line_discount", { precision: 14, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Normalized from embedded payments array in Purchase
export const purchasePayments = pgTable("purchase_payments", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  attendantId: integer("attendant_id").notNull().references(() => attendants.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  paymentNo: text("payment_no"),
  paidAt: timestamp("paid_at").defaultNow(),
});

export const purchaseReturns = pgTable("purchase_returns", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  attendantId: integer("attendant_id").notNull().references(() => attendants.id),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  paymentType: text("payment_type"), // cash | credit | mpesa | bank
  refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"),
  purchaseReturnNo: text("purchase_return_no").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const purchaseReturnItems = pgTable("purchase_return_items", {
  id: serial("id").primaryKey(),
  purchaseReturnId: integer("purchase_return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
});

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
