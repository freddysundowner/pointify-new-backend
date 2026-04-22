/**
 * System / reference-data tables
 * Global lookup and config tables with no shop or admin scope.
 */
import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Shop categories ──────────────────────────────────────────────────────────
// System-wide labels for the type of business a shop runs (Supermarket, Pharmacy…).
// Presented to admins during shop registration.
export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
// Free-form key/value config store for platform-wide configuration.
// `setting` is JSONB — can hold any structure (boolean, array, nested object).
// NOTE: updated_at is NOT auto-managed by Drizzle — the API must set it
// explicitly on every update: { updatedAt: new Date() }
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  setting: jsonb("setting"),
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
