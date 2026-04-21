/**
 * Order tables
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
    receiptNo: text("receipt_no").unique(),
    // pending | processing | completed | cancelled
    status: text("status").default("pending"),
    shop: integer("shop_id").notNull().references(() => shops.id),
    customer: integer("customer_id").references(() => customers.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("orders_shop_id_idx").on(table.shop),
    index("orders_customer_id_idx").on(table.customer),
    index("orders_status_idx").on(table.status),
  ]
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  product: integer("product_id").notNull().references(() => products.id),
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
