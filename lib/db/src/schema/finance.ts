/**
 * Finance tables
 * Expenses, cashflow (cashin/cashout), bank accounts, and the general-purpose
 * payment ledger for customer/supplier wallet movements.
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
    shopId: integer("shop_id").references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("expense_categories_shop_id_idx").on(table.shopId),
  ]
);

// ─── Cashflow categories ──────────────────────────────────────────────────────
export const cashflowCategories = pgTable(
  "cashflow_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shopId: integer("shop_id").references(() => shops.id),
    // cashin | cashout
    type: text("type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("cashflow_categories_shop_id_idx").on(table.shopId),
  ]
);

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    shopId: integer("shop_id").references(() => shops.id),
    recordedById: integer("recorded_by_id").notNull().references(() => attendants.id),
    categoryId: integer("category_id").references(() => expenseCategories.id),
    // Whether this is a recurring expense auto-saved on a schedule
    isRecurring: boolean("is_recurring").default(false),
    // daily | weekly | monthly
    frequency: text("frequency"),
    nextOccurrenceAt: timestamp("next_occurrence_at"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("expenses_shop_id_idx").on(table.shopId),
    index("expenses_shop_date_idx").on(table.shopId, table.createdAt),
    index("expenses_category_id_idx").on(table.categoryId),
  ]
);

// ─── Banks ────────────────────────────────────────────────────────────────────
// Bank / mobile-money accounts whose balances the shop tracks manually.
export const banks = pgTable(
  "banks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Current tracked balance of this account
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("banks_shop_id_idx").on(table.shopId),
  ]
);

// ─── Cashflows ────────────────────────────────────────────────────────────────
// Individual cashin / cashout transaction records.
export const cashflows = pgTable(
  "cashflows",
  {
    id: serial("id").primaryKey(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    categoryId: integer("category_id").references(() => cashflowCategories.id),
    recordedById: integer("recorded_by_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    // Optional: which bank account this cashflow is associated with
    bankId: integer("bank_id").references(() => banks.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("cashflows_shop_id_idx").on(table.shopId),
    index("cashflows_shop_date_idx").on(table.shopId, table.createdAt),
    index("cashflows_category_id_idx").on(table.categoryId),
  ]
);

// ─── User payments ────────────────────────────────────────────────────────────
// General-purpose ledger entry for customer wallet top-ups, supplier payments,
// refunds, and other manual financial transactions not tied to a specific sale.
export const userPayments = pgTable(
  "user_payments",
  {
    id: serial("id").primaryKey(),
    // Unique auto-generated payment reference code
    paymentNo: text("payment_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    mpesaCode: text("mpesa_code"),
    // cash | mpesa | bank | card …
    paymentType: text("payment_type"),
    // deposit | withdraw | payment | refund
    type: text("type").notNull(),
    shopId: integer("shop_id").references(() => shops.id),
    processedById: integer("processed_by_id").references(() => attendants.id),
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

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true });
export const insertCashflowCategorySchema = createInsertSchema(cashflowCategories).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertBankSchema = createInsertSchema(banks).omit({ id: true });
export const insertCashflowSchema = createInsertSchema(cashflows).omit({ id: true });
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
export type UserPayment = typeof userPayments.$inferSelect;
export type InsertUserPayment = z.infer<typeof insertUserPaymentSchema>;
