/**
 * Communication tables
 *
 * email_templates        : seeded HTML email layout library (slug-keyed)
 * communications         : individual SMS / email send log (one row per message sent)
 * sms_credit_transactions: ledger tracking every change to an admin's SMS credit balance
 * email_messages         : campaign definitions (subject, body, audience, schedule)
 * emails_sent            : log of each campaign dispatch (which template, recipient count)
 * activities             : per-shop audit log of attendant actions
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

// ─── Email HTML templates ─────────────────────────────────────────────────────
// Seeded HTML layouts used as the structural shell for transactional and
// campaign emails. Each template has named placeholders (e.g. {username},
// {shop_name}) that the mailer substitutes at send time.
// Managed by super-admins; no shop or admin scope.
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  // Human-readable label, e.g. "Welcome Email", "Invoice"
  name: text("name").notNull(),
  // URL-safe unique identifier, e.g. "welcome-email", "invoice"
  slug: text("slug").notNull().unique(),
  // Full HTML content of the template — supports {placeholder} substitution
  htmlContent: text("html_content").notNull(),
  // Logical grouping, e.g. "transactional", "marketing", "billing"
  category: text("category").notNull(),
  // Array of placeholder names that exist in htmlContent, e.g. ["username", "shop_name"]
  placeholders: text("placeholders").array().notNull().default([]),
});

// ─── Individual communications log ───────────────────────────────────────────
// One row per SMS or email sent to a specific contact.
// Used by the super-admin dashboard to audit delivery history and retry failures.
// Also written automatically by any system flow that sends a message (OTP, sale SMS, bulk, etc.)
export const communications = pgTable(
  "communications",
  {
    id: serial("id").primaryKey(),
    // Admin whose sms_credit was consumed — nullable so records survive admin deletion
    admin: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
    // Raw message body that was sent
    message: text("message").notNull(),
    // sent | failed
    status: text("status").notNull().default("sent"),
    // sms | email
    type: text("type").notNull().default("sms"),
    // Phone number (for SMS) or email address (for email)
    contact: text("contact").notNull(),
    // Populated when status = failed — gateway error message or description
    failedReason: text("failed_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("communications_admin_id_idx").on(table.admin),
    index("communications_type_status_idx").on(table.type, table.status),
    index("communications_created_at_idx").on(table.createdAt),
  ]
);

// ─── SMS credit ledger ────────────────────────────────────────────────────────
// Every change to an admin's admins.sms_credit balance is recorded here.
// Provides a full audit trail and supports the top-up and usage dashboards.
//
// type values:
//   top_up    → admin purchased more credits (M-Pesa, manual grant)
//   deduction → 1 credit consumed per SMS sent (linked to communications row)
//   adjustment→ manual correction by super-admin (positive or negative)
//   refund    → credits returned after a failed batch dispatch
export const smsCreditTransactions = pgTable(
  "sms_credit_transactions",
  {
    id: serial("id").primaryKey(),
    // Admin whose sms_credit balance changed
    admin: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
    // top_up | deduction | adjustment | refund
    type: text("type").notNull(),
    // Credits changed — positive for top_up/refund, negative for deduction/adjustment loss
    amount: integer("amount").notNull(),
    // Admin's new sms_credit balance after this transaction (denormalised snapshot)
    balanceAfter: integer("balance_after").notNull(),
    // Human-readable note e.g. "Purchased 100 credits via M-Pesa", "Auto-deduct on sale #12"
    description: text("description"),
    // FK → communications.id — links deduction rows back to the specific message sent
    communication: integer("communication_id").references(() => communications.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sms_credit_tx_admin_id_idx").on(table.admin),
    index("sms_credit_tx_type_idx").on(table.type),
    index("sms_credit_tx_created_at_idx").on(table.createdAt),
  ]
);

// ─── Email / SMS campaign templates ──────────────────────────────────────────
// Stores reusable campaign definitions. A campaign can be sent immediately or
// scheduled to fire at a recurring interval. Scoped per admin.
export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  // Human-readable template name (internal label)
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isScheduled: boolean("is_scheduled").default(false),
  // daily | once_weekly | monthly — only relevant when is_scheduled = true
  interval: text("interval").default("monthly"),
  campaign: text("campaign"),
  // email | sms
  type: text("type").default("email"),
  // subscribers | all | expired | dormant | custom
  audience: text("audience").default("custom"),
  // Comma-separated email addresses or phone numbers for audience = custom
  audienceAddress: text("audience_address").default(""),
  sentCount: integer("sent_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
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
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true });
export const insertCommunicationSchema = createInsertSchema(communications).omit({ id: true });
export const insertSmsCreditTransactionSchema = createInsertSchema(smsCreditTransactions).omit({ id: true });
export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true });
export const insertEmailSentSchema = createInsertSchema(emailsSent).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type SmsCreditTransaction = typeof smsCreditTransactions.$inferSelect;
export type InsertSmsCreditTransaction = z.infer<typeof insertSmsCreditTransactionSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailSent = typeof emailsSent.$inferSelect;
export type InsertEmailSent = z.infer<typeof insertEmailSentSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
