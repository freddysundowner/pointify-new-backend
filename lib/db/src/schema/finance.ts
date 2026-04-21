/**
 * Finance tables
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

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shop: integer("shop_id").references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("expense_categories_shop_id_idx").on(table.shop),
  ]
);

export const cashflowCategories = pgTable(
  "cashflow_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shop: integer("shop_id").references(() => shops.id),
    // cashin | cashout
    type: text("type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("cashflow_categories_shop_id_idx").on(table.shop),
  ]
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    shop: integer("shop_id").references(() => shops.id),
    recordedBy: integer("recorded_by_id").notNull().references(() => attendants.id),
    category: integer("category_id").references(() => expenseCategories.id),
    isRecurring: boolean("is_recurring").default(false),
    // daily | weekly | monthly
    frequency: text("frequency"),
    nextOccurrenceAt: timestamp("next_occurrence_at"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("expenses_shop_id_idx").on(table.shop),
    index("expenses_shop_date_idx").on(table.shop, table.createdAt),
    index("expenses_category_id_idx").on(table.category),
  ]
);

export const banks = pgTable(
  "banks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    shop: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("banks_shop_id_idx").on(table.shop),
  ]
);

export const cashflows = pgTable(
  "cashflows",
  {
    id: serial("id").primaryKey(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    category: integer("category_id").references(() => cashflowCategories.id),
    recordedBy: integer("recorded_by_id").notNull().references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    bank: integer("bank_id").references(() => banks.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("cashflows_shop_id_idx").on(table.shop),
    index("cashflows_shop_date_idx").on(table.shop, table.createdAt),
    index("cashflows_category_id_idx").on(table.category),
  ]
);

export const userPayments = pgTable(
  "user_payments",
  {
    id: serial("id").primaryKey(),
    paymentNo: text("payment_no").unique(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    mpesaCode: text("mpesa_code"),
    paymentType: text("payment_type"),
    // deposit | withdraw | payment | refund
    type: text("type").notNull(),
    shop: integer("shop_id").references(() => shops.id),
    processedBy: integer("processed_by_id").references(() => attendants.id),
    customer: integer("customer_id").references(() => customers.id),
    supplier: integer("supplier_id").references(() => suppliers.id),
    admin: integer("admin_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("user_payments_shop_id_idx").on(table.shop),
    index("user_payments_customer_id_idx").on(table.customer),
    index("user_payments_supplier_id_idx").on(table.supplier),
    index("user_payments_shop_date_idx").on(table.shop, table.createdAt),
  ]
);

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
