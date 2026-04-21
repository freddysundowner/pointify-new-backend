/**
 * Shop table
 * A shop is a single physical or virtual location operated by an Admin.
 * An admin may own multiple shops.
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shopCategories } from "./system";

export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    address: text("address"),
    shopCategoryId: integer("shop_category_id").references(() => shopCategories.id),

    // Plain integers to avoid circular imports with identity.ts / subscriptions.ts
    adminId: integer("admin_id"),          // FK → admins.id
    subscriptionId: integer("subscription_id"), // FK → subscriptions.id
    affiliateId: integer("affiliate_id"),  // FK → affiliates.id

    // GPS coordinates (replaces MongoDB 2dsphere GeoJSON Point)
    locationLat: real("location_lat").default(0),
    locationLng: real("location_lng").default(0),

    currency: text("currency"),
    contact: text("contact"),
    // VAT / sales-tax rate applied to taxable products (percentage)
    taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0"),

    // Mobile-money / M-Pesa configuration
    paybillTill: text("paybill_till"),
    paybillAccount: text("paybill_account"),

    // Receipt & backup email settings
    receiptAddress: text("receipt_address"),
    receiptEmail: text("receipt_email").default(""),
    warehouseEmail: text("warehouse_email"),
    backupEmail: text("backup_email"),
    backupInterval: text("backup_interval"),
    backupDate: timestamp("backup_date"),

    // Feature flags
    showStockOnline: boolean("show_stock_online").default(false),
    showPriceOnline: boolean("show_price_online").default(false),
    isWarehouse: boolean("is_warehouse").default(false),        // acts as a warehouse for other shops
    allowBackup: boolean("allow_backup").default(true),
    useWarehouse: boolean("use_warehouse").default(false),
    trackBatches: boolean("track_batches").default(false),
    allowOnlineSelling: boolean("allow_online_selling").default(true),
    allowNegativeSelling: boolean("allow_negative_selling").default(false),
    isProduction: boolean("is_production").default(false),      // manufacturing/production shop
    deleteWarningCount: integer("delete_warning_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("shops_admin_id_idx").on(table.adminId),
    index("shops_affiliate_id_idx").on(table.affiliateId),
  ]
);

export const insertShopSchema = createInsertSchema(shops).omit({ id: true });
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
