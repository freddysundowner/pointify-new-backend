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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  durationValue: integer("duration_value").notNull(),
  // days | weeks | months | years
  durationUnit: text("duration_unit").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 6, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  // trial | production
  type: text("type").notNull(),
  maxShops: integer("max_shops"),
  sync: boolean("sync").default(false),
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
    admin: integer("admin_id").notNull(),   // FK → admins.id
    shop: integer("shop_id").notNull(),     // primary shop for this subscription
    package: integer("package_id").notNull().references(() => packages.id),
    mpesaCode: text("mpesa_code"),
    amount: numeric("amount", { precision: 14, scale: 2 }).default("0"),
    invoiceNo: text("invoice_no"),
    type: text("type"),
    isActive: boolean("is_active").default(false),
    commission: numeric("commission", { precision: 14, scale: 2 }).default("0"),
    currency: text("currency").default("kes"),
    isPaid: boolean("is_paid").default(false),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("subscriptions_admin_id_idx").on(table.admin),
    index("subscriptions_shop_id_idx").on(table.shop),
    index("subscriptions_end_date_idx").on(table.endDate),
  ]
);

// A single subscription can cover multiple shops (multi-branch plans)
export const subscriptionShops = pgTable("subscription_shops", {
  id: serial("id").primaryKey(),
  subscription: integer("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  shop: integer("shop_id").notNull(),
});

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
