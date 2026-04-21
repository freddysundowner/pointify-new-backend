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
import { shopCategories } from "./shop-categories";

export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    address: text("address"),
    shopCategoryId: integer("shop_category_id").references(() => shopCategories.id),
    // FK → admins.id (plain integer — circular dep with admins-attendants.ts)
    adminId: integer("admin_id"),
    // FK → subscriptions.id (plain integer — subscriptions file imports shops,
    // so we cannot import subscriptions here)
    subscriptionId: integer("subscription_id"),
    // FK → affiliates.id
    affiliateId: integer("affiliate_id"),

    // GPS coordinates (replaces MongoDB 2dsphere GeoJSON Point)
    locationLat: real("location_lat").default(0),
    locationLng: real("location_lng").default(0),

    currency: text("currency"),
    contact: text("contact"),
    // VAT/tax rate applied to taxable products (percentage)
    tax: numeric("tax", { precision: 6, scale: 2 }).default("0"),

    // M-Pesa / mobile money settings
    paybillTill: text("paybill_till"),
    paybillAccount: text("paybill_account"),

    // Receipt & communication settings
    addressReceipt: text("address_receipt"),
    receiptEmail: text("receipt_email").default(""),
    warehouseEmail: text("warehouse_email"),
    backupEmail: text("backup_email"),
    backupInterval: text("backup_interval"),
    backupDate: timestamp("backup_date"),

    // Feature flags
    showStockOnline: boolean("show_stock_online").default(false),
    showPriceOnline: boolean("show_price_online").default(false),
    // Is this shop acting as a warehouse for other shops?
    warehouse: boolean("warehouse").default(false),
    allowBackup: boolean("allow_backup").default(true),
    useWarehouse: boolean("use_warehouse").default(false),
    trackBatches: boolean("track_batches").default(false),
    allowOnlineSelling: boolean("allow_online_selling").default(true),
    allowNegativeSelling: boolean("allow_negative_selling").default(false),
    // Is this a production/manufacturing shop?
    production: boolean("production").default(false),
    // Counter for deletion grace warnings sent
    deleteWarning: integer("delete_warning").default(0),

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
