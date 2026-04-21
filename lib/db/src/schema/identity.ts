/**
 * Identity tables: Admins and Attendants
 *
 * Circular dependency note:
 *   Admin.attendant → Attendant (created automatically on registration)
 *   Attendant.admin → Admin (set after the admin row is inserted)
 *
 * Both are defined in this file. The direction that would create a boot-order
 * problem is expressed as a plain integer column (no .references()) so Drizzle
 * can generate both tables independently.
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

// ─── Attendants ───────────────────────────────────────────────────────────────
// A cashier / staff account. One is created automatically for each new Admin
// so the owner can also operate the POS. Additional attendants can be added.
export const attendants = pgTable(
  "attendants",
  {
    id: serial("id").primaryKey(),
    username: text("username"),
    // 4-digit PIN used to switch cashiers at the POS screen.
    // Stored as text to preserve any leading zeros.
    pin: text("pin").notNull(),
    password: text("password").notNull(),
    // Array of permission keys e.g. ["sales", "reports", "expenses"]
    permissions: text("permissions").array(),
    lastSeen: timestamp("last_seen").defaultNow(),
    lastAppRatingDate: timestamp("last_app_rating_date"),
    // FK → admins.id — plain integer (admin is defined below)
    admin: integer("admin_id"),
    shop: integer("shop_id"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("attendants_admin_id_idx").on(table.admin),
    index("attendants_shop_id_idx").on(table.shop),
  ]
);

// ─── Admins ───────────────────────────────────────────────────────────────────
// The account owner. Manages one or more shops and their attendant staff.
export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    username: text("username"),
    password: text("password").notNull(),
    autoPrint: boolean("auto_print").default(true),
    // Serialised JSON string or single-value role (e.g. "superadmin")
    permissions: text("permissions"),
    // online | offline | hybrid
    status: text("status").default("online"),
    syncInterval: integer("sync_interval").default(0),
    // FK → attendants.id — the attendant identity auto-created for this admin
    attendant: integer("attendant_id"),
    // FK → shops.id — the admin's primary/default shop
    primaryShop: integer("primary_shop_id"),
    // OTP stored as text (numeric digits, may have leading zeros)
    otp: text("otp"),
    // Unix timestamp (ms) when the OTP expires
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
    // Self-referential: which admin referred this admin to the platform
    referralAdmin: integer("referral_admin_id"),
    // FK → affiliates.id — set if this admin registered through an affiliate link
    affiliate: integer("affiliate_id"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("admins_affiliate_id_idx").on(table.affiliate),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertAttendantSchema = createInsertSchema(attendants).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

export type Attendant = typeof attendants.$inferSelect;
export type InsertAttendant = z.infer<typeof insertAttendantSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
