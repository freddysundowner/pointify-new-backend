import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Email campaign templates
export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  scheduled: boolean("scheduled").default(false),
  // daily | monthly | once_weekly
  interval: text("interval").default("monthly"),
  campaign: text("campaign"),
  type: text("type").default(""),
  // subscribers | all | expired | dormant | custom
  audience: text("audience").default("custom"),
  audienceAddress: text("audience_address").default(""),
  sentCount: integer("sent_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Log of each time a campaign was dispatched
export const emailsSent = pgTable("emails_sent", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  // SET NULL so sent logs are preserved if the template is later deleted
  emailTemplateId: integer("email_template_id").references(
    () => emailMessages.id,
    { onDelete: "set null" }
  ),
  usersCount: integer("users_count"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true });
export const insertEmailSentSchema = createInsertSchema(emailsSent).omit({ id: true });

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailSent = typeof emailsSent.$inferSelect;
export type InsertEmailSent = z.infer<typeof insertEmailSentSchema>;
