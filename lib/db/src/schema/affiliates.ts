/**
 * Affiliate / referral partner tables
 *
 * Affiliates are external marketers who refer admins to the platform.
 * When a referred admin pays a subscription, the affiliate earns a commission
 * (affiliate.commission %) credited to their wallet.
 *
 * Chain:
 *   affiliates.code
 *     → used at admin signup → admins.affiliate_id (FK → affiliates.id)
 *     → admin pays subscription → awards record created
 *     → affiliates.wallet += awards.commission_amount
 *     → affiliate_transactions row written (type = subscription)
 *     → affiliate requests payout → affiliate_transactions row (type = withdraw, is_completed = false)
 *                                  → affiliates.wallet UNCHANGED at this point
 *       → admin approves withdrawal → is_completed = true
 *                                   → affiliates.wallet -= amount
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { admins } from "./identity";
import { subscriptions } from "./subscriptions";
import { shops } from "./shop";

// ─── Affiliates ───────────────────────────────────────────────────────────────
// The marketer/referral partner. Earns commission on every subscription paid
// by an admin they referred.
export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  // Required — used as login credential
  email: text("email").notNull().unique(),
  address: text("address"),
  country: text("country"),
  // Hashed with bcrypt — required for portal login
  password: text("password").notNull(),
  // Commission percentage earned on each subscription payment (e.g. 20 = 20%)
  commission: numeric("commission", { precision: 10, scale: 2 }).notNull().default("20"),
  // Running wallet balance — incremented on each award, decremented on withdrawals
  wallet: numeric("wallet", { precision: 14, scale: 2 }).notNull().default("0"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  isActive: boolean("is_active").notNull().default(false),
  // Unique referral code — auto-generated at registration, shared with admins during signup
  code: text("code").notNull().unique(),
  otp: text("otp"),
  otpExpiry: bigint("otp_expiry", { mode: "number" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Awards ───────────────────────────────────────────────────────────────────
// One row per commission earning event. Created when a referred admin pays a
// subscription or when an admin opens their first shop.
//
// subscription_id is the hard link from payment → affiliate earning.
// The API: when subscriptions.is_paid is set to true, look up
// admins.affiliate_id, calculate commission_amount, insert this row,
// and increment affiliates.wallet.
export const awards = pgTable(
  "awards",
  {
    id: serial("id").primaryKey(),

    // The subscription payment that triggered this award (nullable for manual awards)
    subscription: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),

    // The affiliate who earns this commission
    affiliate: integer("affiliate_id").notNull().references(() => affiliates.id),

    // The shop whose subscription triggered this (for reporting)
    shop: integer("shop_id").references(() => shops.id, { onDelete: "set null" }),

    // Admin who manually triggered a non-subscription award (e.g. bonus)
    fromAdmin: integer("from_admin_id").references(() => admins.id, { onDelete: "set null" }),

    // Snapshot of the subscription amount at time of award
    amount: numeric("amount", { precision: 14, scale: 2 }),
    // affiliate.commission% × amount — what the affiliate actually receives
    commissionAmount: numeric("commission_amount", { precision: 14, scale: 2 }),

    paymentNo: text("payment_no").unique(),
    paymentReference: text("payment_reference"),
    currency: text("currency").notNull().default("kes"),

    // earnings = credit to wallet | usage = debit from wallet
    type: text("type").notNull(),
    // open_shop = one-time bonus on first shop | subscription = recurring commission
    awardType: text("award_type"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("awards_affiliate_id_idx").on(table.affiliate),
    index("awards_subscription_id_idx").on(table.subscription),
    index("awards_shop_id_idx").on(table.shop),
    index("awards_created_at_idx").on(table.createdAt),
  ]
);

// ─── Affiliate transactions ───────────────────────────────────────────────────
// Wallet ledger for each affiliate. Every credit and debit is recorded here.
// affiliates.wallet must always equal SUM of all transactions for that affiliate.
export const affiliateTransactions = pgTable(
  "affiliate_transactions",
  {
    id: serial("id").primaryKey(),
    // Total amount involved in the transaction
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    // Affiliate's cut (same as amount for withdrawals; commission_amount for earnings)
    affiliateAmount: numeric("affiliate_amount", { precision: 14, scale: 2 }),
    // Wallet balance after this transaction
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    transId: text("trans_id"),
    paymentReference: text("payment_reference"),
    // withdraw = payout to affiliate | subscription = commission earned
    type: text("type").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    affiliate: integer("affiliate_id").notNull().references(() => affiliates.id),
    // Admin who processed/approved the transaction
    admin: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("affiliate_transactions_affiliate_id_idx").on(table.affiliate),
    index("affiliate_transactions_created_at_idx").on(table.createdAt),
  ]
);

// ─── Award shops (shops linked to an affiliate award record) ─────────────────
export const awardShops = pgTable("award_shops", {
  id: serial("id").primaryKey(),
  awardId: integer("award_id").notNull().references(() => awards.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true });
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export const insertAwardShopSchema = createInsertSchema(awardShops).omit({ id: true });
export const insertAffiliateTransactionSchema = createInsertSchema(affiliateTransactions).omit({ id: true });

export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Award = typeof awards.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type AffiliateTransaction = typeof affiliateTransactions.$inferSelect;
export type InsertAffiliateTransaction = z.infer<typeof insertAffiliateTransactionSchema>;
export type AwardShop = typeof awardShops.$inferSelect;
export type InsertAwardShop = z.infer<typeof insertAwardShopSchema>;
