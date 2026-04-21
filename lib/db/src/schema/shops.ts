import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shopCategories } from "./shop-categories";

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: text("name"),
  address: text("address"),
  shopCategoryId: integer("shop_category_id").references(() => shopCategories.id),
  // adminId FK → admins.id (plain integer to avoid circular dep with admins-attendants.ts)
  adminId: integer("admin_id"),
  // subscriptionId FK → subscriptions.id (plain integer to avoid circular dep)
  subscriptionId: integer("subscription_id"),
  // affiliateId FK → affiliates.id (plain integer)
  affiliateId: integer("affiliate_id"),

  // Location (replaces MongoDB 2dsphere Point)
  locationLat: real("location_lat").default(0),
  locationLng: real("location_lng").default(0),

  currency: text("currency"),
  contact: text("contact"),
  tax: numeric("tax", { precision: 6, scale: 2 }).default("0"),

  // M-Pesa / payment settings
  paybillTill: text("paybill_till"),
  paybillAccount: text("paybill_account"),

  // Receipt & email settings
  addressReceipt: text("address_receipt"),
  receiptEmail: text("receipt_email").default(""),
  warehouseEmail: text("warehouse_email"),
  backupEmail: text("backup_email"),
  backupInterval: text("backup_interval"),
  backupDate: timestamp("backup_date"),

  // Feature flags
  showStockOnline: boolean("show_stock_online").default(false),
  showPriceOnline: boolean("show_price_online").default(false),
  warehouse: boolean("warehouse").default(false),
  allowBackup: boolean("allow_backup").default(true),
  useWarehouse: boolean("use_warehouse").default(false),
  trackBatches: boolean("track_batches").default(false),
  allowOnlineSelling: boolean("allow_online_selling").default(true),
  allowNegativeSelling: boolean("allow_negative_selling").default(false),
  production: boolean("production").default(false),
  deleteWarning: integer("delete_warning").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertShopSchema = createInsertSchema(shops).omit({ id: true });
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
