import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  durationValue: integer("duration_value").notNull(),
  durationUnit: text("duration_unit").notNull(), // days | weeks | months | years
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 6, scale: 2 }).default("0"),
  status: boolean("status").default(true),
  order: integer("order").default(0),
  type: text("type").notNull(), // trial | production
  maxShops: integer("max_shops"),
  sync: boolean("sync").default(false),
});

export const packageFeatures = pgTable("package_features", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => packages.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  // userId FK → admins.id (plain integer)
  userId: integer("user_id").notNull(),
  // shop FK → shops.id (plain integer)
  shopId: integer("shop_id").notNull(),
  packageId: integer("package_id").notNull().references(() => packages.id),
  mpesaCode: text("mpesa_code"),
  amount: numeric("amount", { precision: 14, scale: 2 }).default("0"),
  invoiceNo: text("invoice_no"),
  type: text("type"),
  status: boolean("status").default(false),
  commission: numeric("commission", { precision: 14, scale: 2 }).default("0"),
  currency: text("currency").default("kes"),
  paid: boolean("paid").default(false),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Many-to-many: a subscription can cover multiple shops
export const subscriptionShops = pgTable("subscription_shops", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  // shopId FK → shops.id (plain integer)
  shopId: integer("shop_id").notNull(),
});

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true });

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
