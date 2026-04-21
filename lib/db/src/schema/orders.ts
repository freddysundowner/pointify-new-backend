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
import { products } from "./products";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  receiptNo: text("receipt_no"),
  status: text("status").default("pending"), // pending | completed | cancelled
  shopId: integer("shop_id").notNull().references(() => shops.id),
  customerId: integer("customer_id").references(() => customers.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull(),
  sync: boolean("sync").default(false),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
