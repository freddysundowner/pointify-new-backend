/**
 * Finance tables — business money ledger
 *
 * cashflows    : every money event (cashin / cashout), optionally linked to a bank account
 * banks        : the business's bank accounts with running balances
 * expenses     : operational outgoings (rent, salaries, utilities) with optional recurrence
 *
 * expense_categories  : labels for grouping expenses
 * cashflow_categories : labels for grouping cashflow entries (cashin | cashout)
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
import { attendants, admins } from "./identity";
import { customers } from "./customers";
import { suppliers } from "./suppliers";

// ─── Expense categories ───────────────────────────────────────────────────────
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shop: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("expense_categories_shop_id_idx").on(table.shop),
  ]
);

// ─── Cashflow categories ──────────────────────────────────────────────────────
export const cashflowCategories = pgTable(
  "cashflow_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shop: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    // cashin | cashout
    type: text("type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("cashflow_categories_shop_id_idx").on(table.shop),
  ]
);

// ─── Expenses ─────────────────────────────────────────────────────────────────
// Operational outgoings (rent, salaries, utilities, etc.).
// Supports recurring entries — when is_recurring = true, the system auto-creates
// the next entry at next_occurrence_at based on frequency.
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    // Auto-generated reference (e.g. EXP12345)
    expenseNo: text("expense_no").unique(),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    shop: integer("shop_id").notNull().references(() => shops.id),
    recordedBy: integer("recorded_by_id").references(() => attendants.id),
    category: integer("category_id").references(() => expenseCategories.id, { onDelete: "set null" }),
    isRecurring: boolean("is_recurring").notNull().default(false),
    // daily | weekly | monthly
    frequency: text("frequency"),
    nextOccurrenceAt: timestamp("next_occurrence_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("expenses_shop_id_idx").on(table.shop),
    index("expenses_shop_date_idx").on(table.shop, table.createdAt),
    index("expenses_category_id_idx").on(table.category),
  ]
);

// ─── Banks ────────────────────────────────────────────────────────────────────
// The business's bank accounts. Balance is a running total updated by
// cashflow entries that reference this bank.
export const banks = pgTable(
  "banks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    shop: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("banks_shop_id_idx").on(table.shop),
  ]
);

// ─── Cashflows ────────────────────────────────────────────────────────────────
// The main money ledger. Every money event — cash received, paid out, deposited
// to a bank, or withdrawn from a bank — is a row here.
// type is determined by the linked cashflow_category.type (cashin | cashout).
// When bank_id is set, banks.balance is updated in the same transaction.
export const cashflows = pgTable(
  "cashflows",
  {
    id: serial("id").primaryKey(),
    // Auto-generated reference (e.g. CF12345)
    cashflowNo: text("cashflow_no").unique(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    category: integer("category_id").references(() => cashflowCategories.id, { onDelete: "set null" }),
    recordedBy: integer("recorded_by_id").references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    // When set, this cashflow affects the linked bank account's balance
    bank: integer("bank_id").references(() => banks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("cashflows_shop_id_idx").on(table.shop),
    index("cashflows_shop_date_idx").on(table.shop, table.createdAt),
    index("cashflows_category_id_idx").on(table.category),
    index("cashflows_bank_id_idx").on(table.bank),
  ]
);

// ─── Custom Payment Methods ───────────────────────────────────────────────────
// Shop-defined payment methods shown in the POS checkout screen, beyond the
// standard enum (cash, mpesa, card, bank, credit, split).
// Examples: "Equity Bank Paybill", "Till 123456", "M-Pesa Lipa Number".
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    shop: integer("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("payment_methods_shop_id_idx").on(table.shop),
  ]
);

// ─── User payments (customer / supplier account payments) ────────────────────
export const userPayments = pgTable(
  "user_payments",
  {
    id: serial("id").primaryKey(),
    paymentNo: text("payment_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    mpesaCode: text("mpesa_code"),
    paymentType: text("payment_type"),
    // "customer" | "supplier"
    type: text("type").notNull(),
    shopId: integer("shop_id").references(() => shops.id),
    processedById: integer("processed_by_id").references(() => attendants.id),
    customerId: integer("customer_id").references(() => customers.id),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    adminId: integer("admin_id").references(() => admins.id),
    sync: boolean("sync").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("user_payments_shop_id_idx").on(table.shopId),
    index("user_payments_customer_id_idx").on(table.customerId),
    index("user_payments_supplier_id_idx").on(table.supplierId),
    index("user_payments_shop_date_idx").on(table.shopId, table.createdAt),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true });
export const insertCashflowCategorySchema = createInsertSchema(cashflowCategories).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertBankSchema = createInsertSchema(banks).omit({ id: true });
export const insertCashflowSchema = createInsertSchema(cashflows).omit({ id: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ id: true });
export const insertUserPaymentSchema = createInsertSchema(userPayments).omit({ id: true });

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type CashflowCategory = typeof cashflowCategories.$inferSelect;
export type InsertCashflowCategory = z.infer<typeof insertCashflowCategorySchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Bank = typeof banks.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;
export type Cashflow = typeof cashflows.$inferSelect;
export type InsertCashflow = z.infer<typeof insertCashflowSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type UserPayment = typeof userPayments.$inferSelect;
export type InsertUserPayment = z.infer<typeof insertUserPaymentSchema>;
