/**
 * Subscription billing tables
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { admins } from "./identity";
import { shops } from "./shop";

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  durationValue: integer("duration_value").notNull(),
  durationUnit: text("duration_unit").notNull(), // days | weeks | months | years
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 6, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  type: text("type").notNull(), // trial | production
  shops: integer("shops"),     // max shops this plan covers
});

export const packageFeatures = pgTable("package_features", {
  id: serial("id").primaryKey(),
  package: integer("package_id").notNull().references(() => packages.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    admin: integer("admin_id").notNull().references(() => admins.id),
    package: integer("package_id").notNull().references(() => packages.id),
    paymentReference: text("payment_reference"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    invoiceNo: text("invoice_no").unique(),
    isActive: boolean("is_active").default(false),
    isPaid: boolean("is_paid").default(false),
    currency: text("currency").default("kes"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("subscriptions_admin_id_idx").on(table.admin),
    index("subscriptions_end_date_idx").on(table.endDate),
  ]
);

// A single subscription can cover multiple shops (multi-branch plans)
export const subscriptionShops = pgTable(
  "subscription_shops",
  {
    id: serial("id").primaryKey(),
    subscription: integer("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
    shop: integer("shop_id").notNull().references(() => shops.id),
  },
  (table) => [
    unique("subscription_shops_unique").on(table.subscription, table.shop),
    index("subscription_shops_shop_id_idx").on(table.shop),
  ]
);

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export const insertPackageFeatureSchema = createInsertSchema(packageFeatures).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });
export const insertSubscriptionShopSchema = createInsertSchema(subscriptionShops).omit({ id: true });

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type PackageFeature = typeof packageFeatures.$inferSelect;
export type InsertPackageFeature = z.infer<typeof insertPackageFeatureSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionShop = typeof subscriptionShops.$inferSelect;
export type InsertSubscriptionShop = z.infer<typeof insertSubscriptionShopSchema>;
