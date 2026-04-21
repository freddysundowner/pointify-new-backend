import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { admins } from "./admins-attendants";
import { shops } from "./shops";

export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  sync: boolean("sync").default(false),
});

export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shopId: integer("shop_id").references(() => shops.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const cashflowCategories = pgTable("cashflow_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shopId: integer("shop_id").references(() => shops.id),
  type: text("type").notNull(), // cashin | cashout
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true });
export const insertCashflowCategorySchema = createInsertSchema(cashflowCategories).omit({ id: true });

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type CashflowCategory = typeof cashflowCategories.$inferSelect;
export type InsertCashflowCategory = z.infer<typeof insertCashflowCategorySchema>;
