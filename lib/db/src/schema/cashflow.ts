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
import { cashflowCategories } from "./categories";

// Represents a bank/mobile-money account balance tracked for a shop
export const banks = pgTable(
  "banks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Current tracked balance of this account
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("banks_shop_id_idx").on(table.shopId),
  ]
);

// Cashin / cashout transaction records
export const cashflows = pgTable(
  "cashflows",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    categoryId: integer("category_id").references(() => cashflowCategories.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
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

export const insertBankSchema = createInsertSchema(banks).omit({ id: true });
export const insertCashflowSchema = createInsertSchema(cashflows).omit({ id: true });

export type Bank = typeof banks.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;
export type Cashflow = typeof cashflows.$inferSelect;
export type InsertCashflow = z.infer<typeof insertCashflowSchema>;
