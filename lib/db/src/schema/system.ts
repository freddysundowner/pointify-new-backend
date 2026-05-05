/**
 * System / reference-data tables
 * Global lookup and config tables with no shop or admin scope.
 */
import { pgTable, serial, text, boolean, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { shops } from "./shop";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Permissions ──────────────────────────────────────────────────────────────
// Master list of all permission groups and their sub-permissions.
// This is the catalogue the admin UI reads to show a checklist when editing an
// attendant's profile. Each row is one permission group (e.g. "pos", "stocks").
//
// condition:
//   null        → always visible to every shop
//   "warehouse" → only surfaced when shop.warehouse = true
//   "production"→ only surfaced when shop.production = true
//
// values: array of sub-permission strings that belong to this group,
//   e.g. ["can_sell", "can_sell_to_dealer_&_wholesaler", "discount", "edit_price"]
//
// The individual permission token stored on attendants.permissions is
// "key.value", e.g. "pos.can_sell". On creation attendants start with an
// empty permissions array; the admin grants sub-permissions from this table.
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  // Machine-readable group name — unique
  key: text("key").notNull().unique(),
  // Human-readable label shown in the admin UI
  label: text("label").notNull(),
  // Ordered list of sub-permission strings for this group
  values: text("values").array().notNull().default([]),
  // null | "warehouse" | "production"
  condition: text("condition"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Shop categories ──────────────────────────────────────────────────────────
// System-wide labels for the type of business a shop runs (Supermarket, Pharmacy…).
// Presented to admins during shop registration.
export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Measure Units ────────────────────────────────────────────────────────────
// Lookup table of unit-of-measure labels.
// shopId = null  → global/system unit (visible to all shops, seeded at boot)
// shopId = X     → custom unit created by shop X (only visible to that shop)
// Examples: Pieces, Kilograms, Litres, Crates, Dozens, Metres.
export const measures = pgTable("measures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Short label shown in product cards (e.g. "kg", "pcs", "L")
  abbreviation: text("abbreviation"),
  isActive: boolean("is_active").notNull().default(true),
  // null = global system unit; set = shop-specific custom unit
  shopId: integer("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("measures_shop_id_idx").on(table.shopId),
]);

// ─── Settings ─────────────────────────────────────────────────────────────────
// Free-form key/value config store for platform-wide configuration.
// `setting` is JSONB — can hold any structure (boolean, array, nested object).
// NOTE: updated_at is NOT auto-managed by Drizzle — the API must set it
// explicitly on every update: { updatedAt: new Date() }
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  setting: jsonb("setting"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertShopCategorySchema = createInsertSchema(shopCategories).omit({ id: true });
export const insertMeasureSchema = createInsertSchema(measures).omit({ id: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type ShopCategory = typeof shopCategories.$inferSelect;
export type InsertShopCategory = z.infer<typeof insertShopCategorySchema>;
export type Measure = typeof measures.$inferSelect;
export type InsertMeasure = z.infer<typeof insertMeasureSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
