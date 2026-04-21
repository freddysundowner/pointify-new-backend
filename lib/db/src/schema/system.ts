/**
 * System / reference-data tables
 * Global lookup and config tables with no shop or admin scope.
 */
import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Shop categories ──────────────────────────────────────────────────────────
// System-wide labels for the type of business a shop runs (Supermarket, Pharmacy…)
export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  sync: boolean("sync").default(false),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
// Free-form key/value config store. `setting` is JSONB so it can hold any
// structure — booleans, arrays, nested objects.
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  setting: jsonb("setting"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertShopCategorySchema = createInsertSchema(shopCategories).omit({ id: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

export type ShopCategory = typeof shopCategories.$inferSelect;
export type InsertShopCategory = z.infer<typeof insertShopCategorySchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
