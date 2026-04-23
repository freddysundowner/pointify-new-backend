/**
 * Loyalty points tables
 * Customers earn points on purchases and redeem them for discounts.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customers } from "./customers";
import { shops } from "./shop";

// ─── Loyalty transactions ─────────────────────────────────────────────────────
// Every points change is recorded here for a full audit trail.
export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: serial("id").primaryKey(),
    customer: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    shop: integer("shop_id").notNull().references(() => shops.id),
    // earn | redeem | adjust | expire
    type: text("type").notNull(),
    // Points added (earn/adjust) or subtracted (redeem, negative sign)
    points: numeric("points", { precision: 14, scale: 2 }).notNull(),
    // Customer's loyalty points balance after this transaction
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
    // Sale ID that triggered this transaction (null for manual adjustments)
    referenceId: integer("reference_id"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("loyalty_tx_customer_idx").on(table.customer),
    index("loyalty_tx_shop_idx").on(table.shop),
    index("loyalty_tx_created_at_idx").on(table.createdAt),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactions).omit({ id: true });
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
