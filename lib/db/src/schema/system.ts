/**
 * System / reference-data tables
 * These are global lookup tables with no shop or admin scope.
 */
import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Shop categories ──────────────────────────────────────────────────────────
// System-wide labels for the type of business a shop runs (Supermarket, Pharmacy…)
export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").default(true),
  sync: boolean("sync").default(false),
});

// ─── Units of measure ─────────────────────────────────────────────────────────
export const measures = pgTable("measures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // kg | litre | piece | box …
  sync: boolean("sync").default(false),
});

// ─── Languages ────────────────────────────────────────────────────────────────
export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isoCode: text("iso_code").notNull(),
  flag: text("flag"),
  // show | hide
  status: text("status").default("show"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
// Free-form key/value config store. `setting` field is typed as JSONB so it can
// hold any structure (booleans, arrays, nested objects).
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  setting: jsonb("setting"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertShopCategorySchema = createInsertSchema(shopCategories).omit({ id: true });
export const insertMeasureSchema = createInsertSchema(measures).omit({ id: true });
export const insertLanguageSchema = createInsertSchema(languages).omit({ id: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

export type ShopCategory = typeof shopCategories.$inferSelect;
export type InsertShopCategory = z.infer<typeof insertShopCategorySchema>;
export type Measure = typeof measures.$inferSelect;
export type InsertMeasure = z.infer<typeof insertMeasureSchema>;
export type Language = typeof languages.$inferSelect;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
