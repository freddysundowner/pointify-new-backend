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
import { shops } from "./shops";
import { attendants } from "./admins-attendants";

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number"),
    email: text("email"),
    address: text("address"),
    // Hashed password for customers who have app/online access
    password: text("password"),
    type: text("type"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
    shopId: integer("shop_id").references(() => shops.id),
    attendantId: integer("attendant_id").references(() => attendants.id),
    // Auto-incremented display number per shop (handled in application layer)
    customerNo: integer("customer_no").unique(),
    otp: text("otp"),
    otpExpiry: bigint("otp_expiry", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("customers_shop_id_idx").on(table.shopId),
    index("customers_phone_idx").on(table.phoneNumber),
  ]
);

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
