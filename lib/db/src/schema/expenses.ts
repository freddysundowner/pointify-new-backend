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
import { attendants } from "./admins-attendants";
import { expenseCategories } from "./categories";

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    description: text("description"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    shopId: integer("shop_id").references(() => shops.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    categoryId: integer("category_id").references(() => expenseCategories.id),
    // Whether this is a recurring auto-saved expense
    autoSave: boolean("auto_save").default(false),
    // daily | weekly | monthly
    frequency: text("frequency"),
    nextOccurrence: timestamp("next_occurrence"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("expenses_shop_id_idx").on(table.shopId),
    index("expenses_shop_date_idx").on(table.shopId, table.createdAt),
    index("expenses_category_id_idx").on(table.categoryId),
  ]
);

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
