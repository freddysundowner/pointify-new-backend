import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isoCode: text("iso_code").notNull(),
  flag: text("flag"),
  // show | hide
  status: text("status").default("show"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  // Mongoose timestamps: true also gives updatedAt
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLanguageSchema = createInsertSchema(languages).omit({ id: true });
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
