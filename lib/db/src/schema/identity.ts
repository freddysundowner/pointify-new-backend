/**
 * Identity tables: Admins and Attendants
 *
 * Circular FK note:
 *   admins.attendant → attendants.id  (the attendant auto-created for this admin)
 *   attendants.admin → admins.id      (which admin owns this attendant)
 *
 * Both FKs are plain integers (no .references()) to avoid a boot-order conflict
 * since both tables live in the same file.
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
// so the owner can also operate the POS. Additional attendants can be added later.
export const attendants = pgTable(
  "attendants",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    // 4-digit PIN used together with the password to log in to the POS.
    // Stored as text to preserve leading zeros.
    pin: text("pin").notNull(),
    password: text("password").notNull(),
    // Array of permission keys e.g. ["sales", "reports", "expenses"]
    permissions: text("permissions").array(),
    lastSeen: timestamp("last_seen").defaultNow(),
    // FK → admins.id (plain integer — admins is defined below)
    admin: integer("admin_id"),
    // FK → shops.id — attendants are tied to one shop
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
// The account owner. Has full access — no permission restrictions.
// Manages one or more shops and their attendant staff.
export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    username: text("username"),
    password: text("password").notNull(),

    // online | offline | hybrid
    operatingMode: text("operating_mode").default("online"),

    // FK → attendants.id — attendant identity auto-created for this admin
    attendant: integer("attendant_id"),
    // FK → shops.id — admin's primary/default shop
    primaryShop: integer("primary_shop_id"),
    // FK → affiliates.id — set if registered through an affiliate link
    affiliate: integer("affiliate_id"),
    // Self-referential — which admin referred this admin
    referredBy: integer("referred_by_id"),

    referralCredit: numeric("referral_credit", { precision: 14, scale: 2 }).default("0"),

    otp: text("otp"),
    otpExpiry: bigint("otp_expiry", { mode: "number" }),
    emailVerified: boolean("email_verified").default(false),
    phoneVerified: boolean("phone_verified").default(false),
    emailVerificationDate: timestamp("email_verification_date"),

    // Device / app metadata kept on the admin row
    autoPrint: boolean("auto_print").default(true),
    syncInterval: integer("sync_interval").default(0),
    platform: text("platform"),
    appVersion: text("app_version"),
    lastAppRatingDate: timestamp("last_app_rating_date"),
    lastSubscriptionReminder: timestamp("last_subscription_reminder").defaultNow(),
    lastSubscriptionReminderCount: integer("last_subscription_reminder_count").default(0),

    lastSeen: timestamp("last_seen").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("admins_affiliate_id_idx").on(table.affiliate),
    index("admins_referred_by_id_idx").on(table.referredBy),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertAttendantSchema = createInsertSchema(attendants).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

export type Attendant = typeof attendants.$inferSelect;
export type InsertAttendant = z.infer<typeof insertAttendantSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
