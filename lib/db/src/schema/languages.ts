import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isoCode: text("iso_code").notNull(),
  flag: text("flag"),
  status: text("status").default("show"), // show | hide
  sync: boolean("sync").default(false),
});

export const insertLanguageSchema = createInsertSchema(languages).omit({ id: true });
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
