/**
 * Order tables
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
import { customers } from "./customers";
import { attendants } from "./identity";
import { products } from "./catalog";

// ─── Orders ───────────────────────────────────────────────────────────────────
// A customer-facing order placed before fulfillment. Converted to a sale when
// fulfilled — at which point sales.order_id is set and status becomes completed.
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),

    // Auto-generated reference number (e.g. ORD12345)
    orderNo: text("order_no").unique(),

    // pending | completed | cancelled
    status: text("status").notNull().default("pending"),

    orderNote: text("order_note"),

    shop: integer("shop_id").notNull().references(() => shops.id),
    customer: integer("customer_id").references(() => customers.id),
    attendant: integer("attendant_id").references(() => attendants.id),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("orders_shop_id_idx").on(table.shop),
    index("orders_customer_id_idx").on(table.customer),
    index("orders_status_idx").on(table.status),
  ]
);

// ─── Order items ──────────────────────────────────────────────────────────────
// Line items for an order. Prices are recorded at time of order placement.
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    order: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.order),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
