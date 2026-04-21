/**
 * Communication tables
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
import { attendants } from "./identity";

export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isScheduled: boolean("is_scheduled").default(false),
  // daily | once_weekly | monthly
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

export const emailsSent = pgTable("emails_sent", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  emailTemplate: integer("email_template_id").references(
    () => emailMessages.id,
    { onDelete: "set null" }
  ),
  recipientCount: integer("recipient_count"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    shop: integer("shop_id").notNull().references(() => shops.id),
    attendant: integer("attendant_id").notNull().references(() => attendants.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("activities_shop_id_idx").on(table.shop),
    index("activities_shop_date_idx").on(table.shop, table.createdAt),
    index("activities_attendant_id_idx").on(table.attendant),
  ]
);

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({ id: true });
export const insertEmailSentSchema = createInsertSchema(emailsSent).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailSent = typeof emailsSent.$inferSelect;
export type InsertEmailSent = z.infer<typeof insertEmailSentSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
