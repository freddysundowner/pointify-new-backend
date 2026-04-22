/**
 * Communication tables
 *
 * email_messages : reusable email/SMS templates and campaign definitions
 * emails_sent    : log of each campaign send (which template, how many recipients)
 * activities     : per-shop audit log of attendant actions
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { admins, attendants } from "./identity";

// ─── Email / SMS message templates ───────────────────────────────────────────
// Stores reusable campaign templates. A template can be sent immediately or
// scheduled to fire at a recurring interval.
export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  // Admin who owns this template — scopes campaigns to their account
  admin: integer("admin_id").notNull().references(() => admins.id),
  // Human-readable template name (internal label)
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isScheduled: boolean("is_scheduled").notNull().default(false),
  // daily | once_weekly | monthly — only relevant when is_scheduled = true
  interval: text("interval").notNull().default("monthly"),
  campaign: text("campaign"),
  // email | sms
  type: text("type").notNull().default("email"),
  // subscribers | all | expired | dormant | custom
  audience: text("audience").notNull().default("custom"),
  // Comma-separated email addresses or phone numbers for audience = custom
  audienceEmails: text("audience_emails").notNull().default(""),
  sentCount: integer("sent_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Emails sent log ──────────────────────────────────────────────────────────
// One row per campaign dispatch. Tracks which template was used and how many
// recipients received it.
export const emailsSent = pgTable("emails_sent", {
  id: serial("id").primaryKey(),
  // Admin who sent this campaign (nullable — retained even if admin is deleted)
  admin: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  emailTemplate: integer("email_template_id").references(
    () => emailMessages.id,
    { onDelete: "set null" }
  ),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Activities ───────────────────────────────────────────────────────────────
// Audit log — one row per notable action an attendant takes in a shop.
// action is a short description (e.g. "created sale", "deleted product").
// details holds optional extra context (e.g. sale ID, product name).
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    details: text("details"),
    shop: integer("shop_id").notNull().references(() => shops.id),
    attendant: integer("attendant_id").notNull().references(() => attendants.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activities_shop_id_idx").on(table.shop),
    index("activities_shop_date_idx").on(table.shop, table.createdAt),
    index("activities_attendant_id_idx").on(table.attendant),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true });
export const insertEmailSentSchema = createInsertSchema(emailsSent).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailSent = typeof emailsSent.$inferSelect;
export type InsertEmailSent = z.infer<typeof insertEmailSentSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
