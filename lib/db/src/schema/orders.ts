/**
 * Order tables
 * An Order is a customer's intent to purchase (online or pre-order).
 * It is separate from a Sale — a sale is recorded when payment is collected.
 * An order may eventually be converted to a sale (sales.orderId → orders.id).
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
import { products } from "./catalog";

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    // Unique human-readable reference shared with the customer e.g. ORD-123456
    receiptNo: text("receipt_no").unique(),
    // pending | processing | completed | cancelled
    status: text("status").default("pending"),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    customerId: integer("customer_id").references(() => customers.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("orders_shop_id_idx").on(table.shopId),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
  ]
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  sync: boolean("sync").default(false),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
