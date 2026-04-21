/**
 * Affiliate / referral partner tables
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

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  address: text("address"),
  country: text("country"),
  password: text("password"),
  commission: numeric("commission", { precision: 10, scale: 2 }).default("20"),
  wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
  isBlocked: boolean("is_blocked").default(false),
  isActive: boolean("is_active").default(false),
  code: text("code").unique(),
  otp: text("otp"),
  otpExpiry: bigint("otp_expiry", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

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
    shop: integer("shop_id"),                                                    // FK → shops.id
    owner: integer("owner_id").references(() => affiliates.id),                 // benefiting affiliate
    affiliate: integer("affiliate_id").references(() => affiliates.id),         // source/referring affiliate
    fromAdmin: integer("from_admin_id").references(() => admins.id),            // admin who triggered the award
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("awards_owner_id_idx").on(table.owner),
    index("awards_affiliate_id_idx").on(table.affiliate),
    index("awards_created_at_idx").on(table.createdAt),
  ]
);

export const awardShops = pgTable("award_shops", {
  id: serial("id").primaryKey(),
  award: integer("award_id").notNull().references(() => awards.id, { onDelete: "cascade" }),
  shop: integer("shop_id").notNull(),
});

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
    isCompleted: boolean("is_completed").default(false),
    affiliate: integer("affiliate_id").references(() => affiliates.id),
    admin: integer("admin_id").references(() => admins.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("affiliate_transactions_affiliate_id_idx").on(table.affiliate),
    index("affiliate_transactions_created_at_idx").on(table.createdAt),
  ]
);

export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true });
export const insertAwardSchema = createInsertSchema(awards).omit({ id: true });
export const insertAffiliateTransactionSchema = createInsertSchema(affiliateTransactions).omit({ id: true });

export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type Award = typeof awards.$inferSelect;
export type InsertAward = z.infer<typeof insertAwardSchema>;
export type AffiliateTransaction = typeof affiliateTransactions.$inferSelect;
export type InsertAffiliateTransaction = z.infer<typeof insertAffiliateTransactionSchema>;
