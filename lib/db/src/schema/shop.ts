/**
 * Shop table
 * A shop is a single physical or virtual location operated by an Admin.
 * An admin may own multiple shops.
 *
 * Circular FK note:
 *   shops.admin         → admins.id
 *   shops.subscription  → subscriptions.id
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
    name: text("name"),
    address: text("address"),
    // Address line printed on customer receipts
    receiptAddress: text("receipt_address"),
    category: integer("shop_category_id").references(() => shopCategories.id, { onDelete: "set null" }),

    // Circular FKs — resolved as plain integers
    admin: integer("admin_id"),
    subscription: integer("subscription_id"),
    affiliate: integer("affiliate_id"),

    // GPS coordinates
    locationLat: real("location_lat").notNull().default(0),
    locationLng: real("location_lng").notNull().default(0),

    currency: text("currency"),
    contact: text("contact"),
    taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).notNull().default("0"),

    // M-Pesa / mobile-money config
    paybillTill: text("paybill_till"),
    paybillAccount: text("paybill_account"),

    // Email config
    receiptEmail: text("receipt_email").notNull().default(""),
    warehouseEmail: text("warehouse_email"),
    backupEmail: text("backup_email"),
    backupInterval: text("backup_interval"),
    backupDate: timestamp("backup_date"),

    // Receipt customisation — controls what appears on the printed/digital receipt
    receiptLogo: text("receipt_logo"),
    receiptFooter: text("receipt_footer"),
    receiptShowTax: boolean("receipt_show_tax").notNull().default(true),
    receiptShowDiscount: boolean("receipt_show_discount").notNull().default(true),

    // Loyalty points — earn points on purchase, redeem for discounts
    loyaltyEnabled: boolean("loyalty_enabled").notNull().default(false),
    // When true, customers can redeem their points at checkout for a discount
    loyaltyRedemptionEnabled: boolean("loyalty_redemption_enabled").notNull().default(false),
    // How much the customer must spend (in shop currency) to earn 1 loyalty point
    pointsPerAmount: numeric("points_per_amount", { precision: 10, scale: 4 }).notNull().default("0"),
    // Monetary value of 1 loyalty point (in shop currency) when redeemed
    pointsValue: numeric("points_value", { precision: 10, scale: 4 }).notNull().default("0"),

    // Feature flags
    showStockOnline: boolean("show_stock_online").notNull().default(false),
    showPriceOnline: boolean("show_price_online").notNull().default(false),
    isWarehouse: boolean("is_warehouse").notNull().default(false),
    allowBackup: boolean("allow_backup").notNull().default(true),
    useWarehouse: boolean("use_warehouse").notNull().default(false),
    trackBatches: boolean("track_batches").notNull().default(false),
    allowOnlineSelling: boolean("allow_online_selling").notNull().default(true),
    allowNegativeSelling: boolean("allow_negative_selling").notNull().default(false),
    isProduction: boolean("is_production").notNull().default(false),
    deleteWarningCount: integer("delete_warning_count").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("shops_admin_id_idx").on(table.admin),
    index("shops_subscription_id_idx").on(table.subscription),
    index("shops_affiliate_id_idx").on(table.affiliate),
  ]
);

export const insertShopSchema = createInsertSchema(shops).omit({ id: true });
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
