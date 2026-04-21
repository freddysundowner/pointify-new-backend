/**
 * Supplier table
 * Suppliers are per-shop vendors from whom products are purchased.
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

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number"),
    email: text("email"),
    address: text("address"),
    // Running credit balance (positive = shop owes supplier, negative = supplier owes shop)
    wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("suppliers_shop_id_idx").on(table.shopId),
  ]
);

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
