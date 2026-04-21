/**
 * Affiliate / referral partner tables
 * Affiliates earn commission when they refer new shops/admins to the platform.
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

// ─── Affiliates ───────────────────────────────────────────────────────────────
export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  address: text("address"),
  country: text("country"),
  password: text("password"),
  // Commission percentage earned per referral
  commission: numeric("commission", { precision: 10, scale: 2 }).default("20"),
  // Running wallet balance (earns from commissions, depletes on withdrawal)
  wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
  isBlocked: boolean("is_blocked").default(false),
  isActive: boolean("is_active").default(false),
  // Unique promo/referral code shared with prospects
  code: text("code").unique(),
  // OTP for affiliate login verification
  otp: text("otp"),
  otpExpiry: bigint("otp_expiry", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// ─── Awards ───────────────────────────────────────────────────────────────────
// Financial award records: commission earnings or usage deductions.
// Both ownerId and affiliateId are affiliate references — this mirrors the
// original design where "user" (the benefiting affiliate) and "affliate"
// (the referring/source affiliate) could be different parties in a chain.
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
    // FK → shops.id (plain integer — shops.ts would create a cycle)
    shopId: integer("shop_id"),
    // The affiliate who benefits from this award
    ownerId: integer("owner_id").references(() => affiliates.id),
    // The source/referring affiliate in the commission chain
    affiliateId: integer("affiliate_id").references(() => affiliates.id),
    // The admin whose action triggered this award (e.g. opened a new shop)
    fromAdminId: integer("from_admin_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("awards_owner_id_idx").on(table.ownerId),
    index("awards_affiliate_id_idx").on(table.affiliateId),
    index("awards_created_at_idx").on(table.createdAt),
  ]
);

// Shops associated with a single award (award.shops[] in MongoDB)
export const awardShops = pgTable("award_shops", {
  id: serial("id").primaryKey(),
  awardId: integer("award_id").notNull().references(() => awards.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").notNull(),
});

// ─── Affiliate transactions ───────────────────────────────────────────────────
// Financial ledger for affiliate withdrawals and subscription commission payments.
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
    isCompleted: boolean("is_completed").default(false),
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

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true });
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export const insertAffiliateTransactionSchema = createInsertSchema(affiliateTransactions).omit({ id: true });

export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Award = typeof awards.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type AffiliateTransaction = typeof affiliateTransactions.$inferSelect;
export type InsertAffiliateTransaction = z.infer<typeof insertAffiliateTransactionSchema>;
