import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shops";

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  address: text("address"),
  wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
  shopId: integer("shop_id").notNull().references(() => shops.id),
  sync: boolean("sync").default(false),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
