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
import { attendants, admins } from "./admins-attendants";
import { customers } from "./customers";
import { suppliers } from "./suppliers";

// UserPayment model — general-purpose payment/transaction record
export const userPayments = pgTable("user_payments", {
  id: serial("id").primaryKey(),
  paymentNo: text("payment_no"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  mpesaCode: text("mpesa_code"),
  paymentType: text("payment_type"),
  type: text("type").notNull(), // deposit | withdraw | payment | refund
  shopId: integer("shop_id").references(() => shops.id),
  attendantId: integer("attendant_id").references(() => attendants.id),
  customerId: integer("customer_id").references(() => customers.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  adminId: integer("admin_id").references(() => admins.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertUserPaymentSchema = createInsertSchema(userPayments).omit({ id: true });
export type UserPayment = typeof userPayments.$inferSelect;
export type InsertUserPayment = z.infer<typeof insertUserPaymentSchema>;
