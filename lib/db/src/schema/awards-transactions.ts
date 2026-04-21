import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { affiliates } from "./affiliates";
import { admins } from "./admins-attendants";

export const awards = pgTable("awards", {
  id: serial("id").primaryKey(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  mpesaCode: text("mpesa_code"),
  paymentNo: text("payment_no").unique(),
  currency: text("currency").default("kes"),
  type: text("type").notNull(), // earnings | usage
  awardType: text("award_type"), // open_shop | subscription
  // shop = single shop ref (plain integer → shops.id)
  shopId: integer("shop_id"),
  userId: integer("user_id").references(() => affiliates.id),
  affiliateId: integer("affiliate_id").references(() => affiliates.id),
  fromUserId: integer("from_user_id").references(() => admins.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Normalized: award.shops (array) → award_shops junction table
export const awardShops = pgTable("award_shops", {
  id: serial("id").primaryKey(),
  awardId: integer("award_id").notNull().references(() => awards.id, { onDelete: "cascade" }),
  // shopId → shops.id (plain integer)
  shopId: integer("shop_id").notNull(),
});

// Affiliate financial transactions (withdraw / subscription)
export const affiliateTransactions = pgTable("affiliate_transactions", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  affiliateAmount: numeric("affiliate_amount", { precision: 14, scale: 2 }),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  transId: text("trans_id"),
  mpesaCode: text("mpesa_code"),
  type: text("type").notNull(), // withdraw | subscription
  status: boolean("status").default(false),
  affiliateId: integer("affiliate_id").references(() => affiliates.id),
  adminId: integer("admin_id").references(() => admins.id),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export const insertAffiliateTransactionSchema = createInsertSchema(affiliateTransactions).omit({ id: true });

export type Award = typeof awards.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type AffiliateTransaction = typeof affiliateTransactions.$inferSelect;
export type InsertAffiliateTransaction = z.infer<typeof insertAffiliateTransactionSchema>;
