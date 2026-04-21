import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { admins } from "./admins-attendants";
import { shops } from "./shops";

// Product categories are scoped per admin (not per shop) since an admin
// manages categories across all their shops
export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    adminId: integer("admin_id").notNull().references(() => admins.id),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("product_categories_admin_id_idx").on(table.adminId),
  ]
);

// Expense categories are scoped per shop
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

// Cashflow categories are scoped per shop (cashin/cashout buckets)
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

export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true });
export const insertCashflowCategorySchema = createInsertSchema(cashflowCategories).omit({ id: true });

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type CashflowCategory = typeof cashflowCategories.$inferSelect;
export type InsertCashflowCategory = z.infer<typeof insertCashflowCategorySchema>;
