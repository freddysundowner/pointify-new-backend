/**
 * Customer table
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { attendants } from "./identity";

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number"),
    email: text("email"),
    address: text("address"),
    password: text("password"),
    // retail | wholesale | dealer
    type: text("type"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
    shop: integer("shop_id").references(() => shops.id),
    createdBy: integer("created_by_id").references(() => attendants.id),
    customerNo: integer("customer_no").unique(),
    otp: text("otp"),
    otpExpiry: bigint("otp_expiry", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("customers_shop_id_idx").on(table.shop),
    index("customers_phone_idx").on(table.phoneNumber),
  ]
);

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
