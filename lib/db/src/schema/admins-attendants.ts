import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Admins and Attendants live in the same file to resolve the circular
// reference: Admin.attendantId → Attendant, Attendant.adminId → Admin.
// The Admin is the account owner; an Attendant is the staff/cashier identity
// automatically created when an Admin registers.

export const attendants = pgTable(
  "attendants",
  {
    id: serial("id").primaryKey(),
    username: text("username"),
    // 4-digit PIN used to switch cashiers at the POS screen
    uniqueDigits: integer("unique_digits").notNull().unique(),
    password: text("password").notNull(),
    // Array of permission strings e.g. ["sales", "reports"]
    permissions: text("permissions").array(),
    lastSeen: timestamp("last_seen").defaultNow(),
    lastAppRatingDate: timestamp("last_app_rating_date"),
    // FK → admins.id — plain integer here because admin table is defined below
    adminId: integer("admin_id"),
    shopId: integer("shop_id"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("attendants_admin_id_idx").on(table.adminId),
    index("attendants_shop_id_idx").on(table.shopId),
  ]
);

export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    username: text("username"),
    password: text("password").notNull(),
    autoPrint: boolean("auto_print").default(true),
    // Serialized JSON string or a single role string
    permissions: text("permissions"),
    // online | offline | hybrid
    status: text("status").default("online"),
    syncInterval: integer("sync_interval").default(0),
    // FK → attendants.id — created automatically on admin registration
    attendantId: integer("attendant_id"),
    // FK → shops.id — the shop the admin mainly operates from
    primaryShopId: integer("primary_shop_id"),
    // OTP is always numeric digits; stored as text to preserve leading zeros
    otp: text("otp"),
    // Unix timestamp in ms when OTP expires
    otpExpiry: bigint("otp_expiry", { mode: "number" }),
    referralCredit: numeric("referral_credit", { precision: 14, scale: 2 }),
    emailVerified: boolean("email_verified").default(false),
    phoneVerified: boolean("phone_verified").default(false),
    emailVerificationDate: timestamp("email_verification_date"),
    lastSeen: timestamp("last_seen").defaultNow(),
    platform: text("platform"),
    appVersion: text("app_version"),
    lastAppRatingDate: timestamp("last_app_rating_date"),
    lastSubscriptionReminder: timestamp("last_subscription_reminder").defaultNow(),
    lastSubscriptionReminderCount: integer("last_subscription_reminder_count").default(0),
    // Self-referential: which admin referred this admin
    referralAdminId: integer("referral_admin_id"),
    // FK → affiliates.id — set if this admin came through an affiliate
    affiliateId: integer("affiliate_id"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("admins_affiliate_id_idx").on(table.affiliateId),
  ]
);

export const insertAttendantSchema = createInsertSchema(attendants).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

export type Attendant = typeof attendants.$inferSelect;
export type InsertAttendant = z.infer<typeof insertAttendantSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
