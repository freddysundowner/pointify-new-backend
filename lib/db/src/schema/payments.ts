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
import { shops } from "./shops";
import { attendants, admins } from "./admins-attendants";
import { customers } from "./customers";
import { suppliers } from "./suppliers";

// General-purpose payment/transaction ledger record.
// Covers customer wallet deposits, supplier payments, refunds etc.
export const userPayments = pgTable(
  "user_payments",
  {
    id: serial("id").primaryKey(),
    // Unique human-readable payment reference code
    paymentNo: text("payment_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    mpesaCode: text("mpesa_code"),
    paymentType: text("payment_type"),
    // deposit | withdraw | payment | refund
    type: text("type").notNull(),
    shopId: integer("shop_id").references(() => shops.id),
    attendantId: integer("attendant_id").references(() => attendants.id),
    customerId: integer("customer_id").references(() => customers.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    adminId: integer("admin_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("user_payments_shop_id_idx").on(table.shopId),
    index("user_payments_customer_id_idx").on(table.customerId),
    index("user_payments_supplier_id_idx").on(table.supplierId),
    index("user_payments_shop_date_idx").on(table.shopId, table.createdAt),
  ]
);

export const insertUserPaymentSchema = createInsertSchema(userPayments).omit({ id: true });
export type UserPayment = typeof userPayments.$inferSelect;
export type InsertUserPayment = z.infer<typeof insertUserPaymentSchema>;
