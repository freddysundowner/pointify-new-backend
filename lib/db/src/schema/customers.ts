/**
 * Customer tables
 */
import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  numeric,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { attendants } from "./identity";

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),

    // Auto-incremented reference number per shop — shown at POS (e.g. #0042)
    customerNo: integer("customer_no"),

    name: text("name").notNull(),
    phone: text("phone_number"),
    email: text("email"),
    address: text("address"),

    // Only set for online customers (type = online). Hashed with bcrypt.
    password: text("password"),
    otp: text("otp"),
    otpExpiry: bigint("otp_expiry", { mode: "number" }),

    // retail | wholesale | dealer | online
    // Sets the default pricing tier when this customer is selected at the POS
    type: text("type"),

    // Maximum credit (buy-now-pay-later) allowed for this customer. NULL = no credit.
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),

    // Pre-paid store credit the customer has deposited. Always >= 0.
    wallet: numeric("wallet", { precision: 14, scale: 2 }).notNull().default("0"),

    // Cached — SUM(sales.outstanding_balance) for all credit sales by this customer.
    // Updated whenever a credit sale is created or a payment is received.
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).notNull().default("0"),

    // Loyalty points balance — earned on purchases, redeemable for discounts.
    loyaltyPoints: numeric("loyalty_points", { precision: 14, scale: 2 }).notNull().default("0"),

    shop: integer("shop_id").notNull().references(() => shops.id),
    createdBy: integer("created_by_id").references(() => attendants.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("customers_no_shop_unique").on(table.customerNo, table.shop),
    index("customers_shop_id_idx").on(table.shop),
    index("customers_phone_idx").on(table.phone),
    index("customers_outstanding_idx").on(table.outstandingBalance),
  ]
);

// ─── Customer wallet transactions ─────────────────────────────────────────────
// Audit log of every change to a customer's wallet balance.
// deposit   — customer adds money to their wallet (pre-pay)
// withdraw  — customer withdraws wallet credit
// payment   — wallet used to pay off a credit sale
// refund    — refund issued back to the customer's wallet
export const customerWalletTransactions = pgTable(
  "customer_wallet_transactions",
  {
    id: serial("id").primaryKey(),
    customer: integer("customer_id").notNull().references(() => customers.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    handledBy: integer("handled_by_id").references(() => attendants.id, { onDelete: "set null" }),

    // deposit | withdraw | payment | refund
    type: text("type").notNull(),

    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),

    // Running wallet balance after this transaction
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),

    paymentNo: text("payment_no"),
    // Transaction reference — M-Pesa code, bank ref, etc.
    paymentReference: text("payment_reference"),
    // cash | mpesa | card | bank
    paymentType: text("payment_type"),

    // Link back to the sale this transaction was created for (debt payment allocation).
    // Not a FK (to avoid circular schema imports) — used for cascade-style cleanup on sale delete.
    saleId: integer("sale_id"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("cwt_customer_id_idx").on(table.customer),
    index("cwt_shop_id_idx").on(table.shop),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertCustomerWalletTransactionSchema = createInsertSchema(customerWalletTransactions).omit({ id: true });

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerWalletTransaction = typeof customerWalletTransactions.$inferSelect;
export type InsertCustomerWalletTransaction = z.infer<typeof insertCustomerWalletTransactionSchema>;
