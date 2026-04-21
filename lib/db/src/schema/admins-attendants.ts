import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Admins and Attendants are in the same file to resolve the circular
// reference: Admin.attendantId → Attendant, Attendant.adminId → Admin.

export const attendants = pgTable("attendants", {
  id: serial("id").primaryKey(),
  username: text("username"),
  uniqueDigits: integer("unique_digits").notNull().unique(),
  password: text("password").notNull(),
  permissions: text("permissions").array(),
  lastSeen: timestamp("last_seen").defaultNow(),
  lastAppRatingDate: timestamp("last_app_rating_date"),
  // adminId is set after admin is inserted; added as plain integer to avoid boot-order issues
  adminId: integer("admin_id"),
  // shopId is set when assigned to a shop
  shopId: integer("shop_id"),
  sync: boolean("sync").default(false),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  username: text("username"),
  password: text("password").notNull(),
  autoPrint: boolean("auto_print").default(true),
  permissions: text("permissions"),
  status: text("status").default("online"),
  syncInterval: integer("sync_interval").default(0),
  // attendantId FK → attendants.id (logical; plain integer to avoid circular)
  attendantId: integer("attendant_id"),
  // primaryShop FK → shops.id (defined in shops.ts; plain integer)
  primaryShopId: integer("primary_shop_id"),
  otp: integer("otp"),
  otpExpiry: numeric("otp_expiry"),
  referalCredit: numeric("referal_credit"),
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  emailVerificationDate: timestamp("email_verification_date"),
  lastSeen: timestamp("last_seen").defaultNow(),
  platform: text("platform"),
  appVersion: text("app_version"),
  lastAppRatingDate: timestamp("last_app_rating_date"),
  lastSubscriptionReminder: timestamp("last_subscription_reminder").defaultNow(),
  lastSubscriptionReminderCount: integer("last_subscription_reminder_count").default(0),
  // referral FK → admins.id (self-referential; plain integer)
  referalAdminId: integer("referal_admin_id"),
  // affiliate FK → affiliates.id (plain integer, defined in affiliates.ts)
  affiliateId: integer("affiliate_id"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertAttendantSchema = createInsertSchema(attendants).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

export type Attendant = typeof attendants.$inferSelect;
export type InsertAttendant = z.infer<typeof insertAttendantSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
