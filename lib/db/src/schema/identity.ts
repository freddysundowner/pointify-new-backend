/**
 * Identity domain: Admins and Attendants
 *
 * Admin = shop owner. Logs in with email + password. Has full access.
 * Attendant = cashier / staff. Logs in with PIN + password at the POS.
 *
 * Every admin gets one attendant auto-created on registration. That attendant
 * is not a login account — it is purely an attribution identity so that when
 * the admin makes a sale themselves, it is recorded under their attendant ID.
 * These auto-attendants have no PIN or password.
 *
 * Circular FK note:
 *   admins.attendant → attendants.id  (the auto-created attendant for this admin)
 *   attendants.admin → admins.id      (which admin owns this attendant)
 * Both sides are plain integers (no .references()) to avoid boot-order conflicts.
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
export const attendants = pgTable(
  "attendants",
  {
    id: serial("id").primaryKey(),
    // Display name shown on receipts and reports
    username: text("username").notNull(),
    // PIN + password used together to log in to the POS.
    // Null on admin-owned attendants (they are attribution-only, not login accounts).
    pin: text("pin"),
    password: text("password"),
    // Permission keys e.g. ["sales", "reports", "expenses"].
    // Null on admin-owned attendants (they inherit full access via the admin).
    permissions: text("permissions").array(),
    // FK → admins.id — which admin owns / created this attendant
    admin: integer("admin_id"),
    // FK → shops.id — one attendant is always tied to one shop
    shop: integer("shop_id"),
    lastSeen: timestamp("last_seen").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("attendants_admin_id_idx").on(table.admin),
    index("attendants_shop_id_idx").on(table.shop),
  ]
);

// ─── Admins ───────────────────────────────────────────────────────────────────
export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),

    // ── Credentials ──────────────────────────────────────────────────────────
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    // Display name shown in the app UI
    username: text("username"),
    password: text("password").notNull(),

    // ── Relationships ─────────────────────────────────────────────────────────
    // The attendant auto-created for this admin on registration
    attendant: integer("attendant_id"),
    // The admin's default shop
    shop: integer("primary_shop_id"),
    // Set if this admin registered through an affiliate link
    affiliate: integer("affiliate_id"),
    // Which admin referred this admin to the platform (self-referential)
    referredBy: integer("referred_by_id"),

    // ── Referral credit ───────────────────────────────────────────────────────
    // Accumulated credit earned by referring other admins.
    // Applied to offset subscription payments.
    referralCredit: numeric("referral_credit", { precision: 14, scale: 2 }).notNull().default("0"),

    // ── Verification ──────────────────────────────────────────────────────────
    otp: text("otp"),
    otpExpiry: bigint("otp_expiry", { mode: "number" }),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    emailVerificationDate: timestamp("email_verification_date"),

    // ── Device / app metadata ─────────────────────────────────────────────────
    autoPrint: boolean("auto_print").notNull().default(true),
    platform: text("platform"),
    appVersion: text("app_version"),

    lastSeen: timestamp("last_seen").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
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
