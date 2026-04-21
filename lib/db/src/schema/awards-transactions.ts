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
import { affiliates } from "./affiliates";
import { admins } from "./admins-attendants";

// Financial award records for affiliate commissions
// Both affiliateId and ownerId reference affiliates — this mirrors the original MongoDB
// design where "user" (the beneficiary affiliate) and "affliate" (the referring affiliate)
// were both affiliate refs.
export const awards = pgTable(
  "awards",
  {
    id: serial("id").primaryKey(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    mpesaCode: text("mpesa_code"),
    paymentNo: text("payment_no").unique(),
    currency: text("currency").default("kes"),
    // earnings | usage
    type: text("type").notNull(),
    // open_shop | subscription
    awardType: text("award_type"),
    // FK → shops.id (plain integer — shops imports affiliates transitively)
    shopId: integer("shop_id"),
    // The affiliate who benefited from this award
    ownerId: integer("owner_id").references(() => affiliates.id),
    // The referring affiliate (commission chain source)
    affiliateId: integer("affiliate_id").references(() => affiliates.id),
    // The admin whose action triggered this award
    fromUserId: integer("from_user_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("awards_owner_id_idx").on(table.ownerId),
    index("awards_affiliate_id_idx").on(table.affiliateId),
    index("awards_created_at_idx").on(table.createdAt),
  ]
);

// Shops covered by a single award (award.shops array in MongoDB)
export const awardShops = pgTable("award_shops", {
  id: serial("id").primaryKey(),
  awardId: integer("award_id").notNull().references(() => awards.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull(),
});

// Affiliate financial transactions (withdrawals and subscription payments)
export const affiliateTransactions = pgTable(
  "affiliate_transactions",
  {
    id: serial("id").primaryKey(),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    affiliateAmount: numeric("affiliate_amount", { precision: 14, scale: 2 }),
    balance: numeric("balance", { precision: 14, scale: 2 }),
    transId: text("trans_id"),
    mpesaCode: text("mpesa_code"),
    // withdraw | subscription
    type: text("type").notNull(),
    // false = pending, true = completed
    status: boolean("status").default(false),
    affiliateId: integer("affiliate_id").references(() => affiliates.id),
    adminId: integer("admin_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("affiliate_transactions_affiliate_id_idx").on(table.affiliateId),
    index("affiliate_transactions_created_at_idx").on(table.createdAt),
  ]
);

export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export const insertAffiliateTransactionSchema = createInsertSchema(affiliateTransactions).omit({ id: true });

export type Award = typeof awards.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type AffiliateTransaction = typeof affiliateTransactions.$inferSelect;
export type InsertAffiliateTransaction = z.infer<typeof insertAffiliateTransactionSchema>;
