/**
 * Supplier tables
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
import { attendants } from "./identity";

// ─── Suppliers ────────────────────────────────────────────────────────────────
export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone_number"),
    email: text("email"),
    address: text("address"),

    // Advance payment balance — money pre-paid to this supplier.
    // Used to offset future purchase payments. Always >= 0.
    wallet: numeric("wallet", { precision: 14, scale: 2 }).notNull().default("0"),

    // Cached — total unpaid balance across all credit purchases from this supplier.
    // Decremented when a purchase payment is made.
    outstandingBalance: numeric("outstanding_balance", { precision: 14, scale: 2 }).notNull().default("0"),

    shop: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("suppliers_shop_id_idx").on(table.shop),
    index("suppliers_outstanding_idx").on(table.outstandingBalance),
  ]
);

// ─── Supplier wallet transactions ─────────────────────────────────────────────
// Audit log of every payment made to or from a supplier.
// payment  — business pays supplier (reduces outstanding balance)
// deposit  — advance payment credited to supplier wallet
// withdraw — advance payment reclaimed from supplier
// refund   — supplier refunds money back to the business
export const supplierWalletTransactions = pgTable(
  "supplier_wallet_transactions",
  {
    id: serial("id").primaryKey(),
    supplier: integer("supplier_id").notNull().references(() => suppliers.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    handledBy: integer("handled_by_id").references(() => attendants.id, { onDelete: "set null" }),

    // payment | deposit | withdraw | refund
    type: text("type").notNull(),

    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),

    // Running wallet balance after this transaction
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),

    paymentNo: text("payment_no"),
    // External transaction ref — M-Pesa code, bank transfer ref, cheque number
    paymentReference: text("payment_reference"),
    // cash | mpesa | card | bank | cheque
    paymentType: text("payment_type"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("swt_supplier_id_idx").on(table.supplier),
    index("swt_shop_id_idx").on(table.shop),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertSupplierWalletTransactionSchema = createInsertSchema(supplierWalletTransactions).omit({ id: true });

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type SupplierWalletTransaction = typeof supplierWalletTransactions.$inferSelect;
export type InsertSupplierWalletTransaction = z.infer<typeof insertSupplierWalletTransactionSchema>;
