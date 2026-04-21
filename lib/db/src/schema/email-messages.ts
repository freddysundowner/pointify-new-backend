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

export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  scheduled: boolean("scheduled").default(false),
  interval: text("interval").default("monthly"), // daily | monthly | once_weekly
  campaign: text("campaign"),
  type: text("type").default(""),
  audience: text("audience").default("custom"), // subscribers | all | expired | dormant | custom
  audienceAddress: text("audience_address").default(""),
  sentCount: integer("sent_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const emailsSent = pgTable("emails_sent", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  emailTemplateId: integer("email_template_id").references(() => emailMessages.id),
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
