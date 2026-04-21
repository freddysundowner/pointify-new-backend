/**
 * Shop table
 * A shop is a single physical or virtual location operated by an Admin.
 * An admin may own multiple shops.
 *
 * Circular FK note:
 *   shops.admin       → admins.id
 *   shops.subscription → subscriptions.id
 *   Both are plain integers (no .references()) to avoid boot-order conflicts.
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
    name: text("name").notNull(),
    address: text("address"),
    // Address line printed on customer receipts (may differ from shop address)
    receiptAddress: text("receipt_address"),
    shopCategory: integer("shop_category_id").references(() => shopCategories.id),

    // Circular FKs — resolved as plain integers
    admin: integer("admin_id"),
    subscription: integer("subscription_id"),   // FK → subscriptions.id (active subscription)
    affiliate: integer("affiliate_id"),          // FK → affiliates.id

    // GPS coordinates
    locationLat: real("location_lat").default(0),
    locationLng: real("location_lng").default(0),

    currency: text("currency"),
    contact: text("contact"),
    // VAT / sales-tax percentage applied to taxable products
    taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0"),

    // M-Pesa / mobile-money config
    paybillTill: text("paybill_till"),
    paybillAccount: text("paybill_account"),

    // Email config
    receiptEmail: text("receipt_email").default(""),
    warehouseEmail: text("warehouse_email"),
    backupEmail: text("backup_email"),
    backupInterval: text("backup_interval"),
    backupDate: timestamp("backup_date"),

    // Feature flags
    showStockOnline: boolean("show_stock_online").default(false),
    showPriceOnline: boolean("show_price_online").default(false),
    isWarehouse: boolean("is_warehouse").default(false),
    isProduction: boolean("is_production").default(false),  // manufacturing/production unit
    allowBackup: boolean("allow_backup").default(true),
    useWarehouse: boolean("use_warehouse").default(false),
    trackBatches: boolean("track_batches").default(false),
    allowOnlineSelling: boolean("allow_online_selling").default(true),
    allowNegativeSelling: boolean("allow_negative_selling").default(false),

    // Number of times the admin has been warned about deletion — safety counter
    deleteWarningCount: integer("delete_warning_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("shops_admin_id_idx").on(table.admin),
    index("shops_affiliate_id_idx").on(table.affiliate),
  ]
);

export const insertShopSchema = createInsertSchema(shops).omit({ id: true });
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
