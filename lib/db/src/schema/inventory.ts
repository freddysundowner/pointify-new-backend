/**
 * Inventory management tables
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
import { shops } from "./shop";
import { attendants } from "./identity";
import { products, batches } from "./catalog";

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").references(() => products.id),
    shop: integer("shop_id").references(() => shops.id),
    updatedBy: integer("updated_by_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),
    isBundle: boolean("is_bundle").default(false),
    // in | out | adjustment
    type: text("type"),
    // active | low | out_of_stock
    status: text("status"),
    barcode: text("barcode"),
    lastCountDate: timestamp("last_count_date"),
    expiryDate: timestamp("expiry_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("inventory_product_shop_idx").on(table.product, table.shop),
    index("inventory_barcode_idx").on(table.barcode),
  ]
);

// ─── Bundle items ─────────────────────────────────────────────────────────────
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    inventory: integer("inventory_id").references(() => inventory.id),
    product: integer("product_id").references(() => products.id),             // the bundle
    componentProduct: integer("component_product_id").references(() => products.id), // the component
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("bundle_items_inventory_idx").on(table.inventory),
    index("bundle_items_product_idx").on(table.product),
  ]
);

// ─── Stock adjustments ────────────────────────────────────────────────────────
export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    // add | remove
    type: text("type").default("add"),
    quantityBefore: numeric("quantity_before", { precision: 14, scale: 4 }).notNull(),
    quantityAfter: numeric("quantity_after", { precision: 14, scale: 4 }).notNull(),
    quantityAdjusted: numeric("quantity_adjusted", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("adjustments_product_shop_idx").on(table.product, table.shop),
    index("adjustments_created_at_idx").on(table.createdAt),
  ]
);

// ─── Bad stock (write-offs) ───────────────────────────────────────────────────
export const badStocks = pgTable(
  "bad_stocks",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    writtenOffBy: integer("written_off_by_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("bad_stocks_shop_id_idx").on(table.shop),
    index("bad_stocks_product_id_idx").on(table.product),
  ]
);

// ─── Stock counts ─────────────────────────────────────────────────────────────
export const stockCounts = pgTable(
  "stock_counts",
  {
    id: serial("id").primaryKey(),
    conductedBy: integer("conducted_by_id").notNull().references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_counts_shop_id_idx").on(table.shop),
  ]
);

export const stockCountItems = pgTable("stock_count_items", {
  id: serial("id").primaryKey(),
  stockCount: integer("stock_count_id").notNull().references(() => stockCounts.id, { onDelete: "cascade" }),
  product: integer("product_id").notNull().references(() => products.id),
  physicalCount: numeric("physical_count", { precision: 14, scale: 4 }).notNull(),
  systemCount: numeric("system_count", { precision: 14, scale: 4 }).notNull(),
  variance: numeric("variance", { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Stock requests ───────────────────────────────────────────────────────────
export const stockRequests = pgTable(
  "stock_requests",
  {
    id: serial("id").primaryKey(),
    requestedBy: integer("requested_by_id").notNull().references(() => attendants.id),
    acceptedBy: integer("accepted_by_id").references(() => attendants.id),
    approvedBy: integer("approved_by_id").references(() => attendants.id),
    // pending | processed | correction | void | completed
    status: text("status").default("pending"),
    fromShop: integer("from_shop_id").notNull().references(() => shops.id),
    warehouse: integer("warehouse_id").notNull().references(() => shops.id),
    totalValue: numeric("total_value", { precision: 14, scale: 2 }).default("0"),
    invoiceNumber: text("invoice_number").default("").unique(),
    acceptedAt: timestamp("accepted_at"),
    dispatchedAt: timestamp("dispatched_at"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_requests_from_shop_idx").on(table.fromShop),
    index("stock_requests_warehouse_idx").on(table.warehouse),
    index("stock_requests_status_idx").on(table.status),
  ]
);

export const stockRequestItems = pgTable("stock_request_items", {
  id: serial("id").primaryKey(),
  stockRequest: integer("stock_request_id").notNull().references(() => stockRequests.id, { onDelete: "cascade" }),
  inventory: integer("inventory_id").references(() => inventory.id),
  product: integer("product_id").references(() => products.id),
  quantityRequested: numeric("quantity_requested", { precision: 14, scale: 4 }).notNull(),
  quantityReceived: numeric("quantity_received", { precision: 14, scale: 4 }).default("0"),
  sync: boolean("sync").default(false),
});

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({ id: true });
export const insertAdjustmentSchema = createInsertSchema(adjustments).omit({ id: true });
export const insertBadStockSchema = createInsertSchema(badStocks).omit({ id: true });
export const insertStockCountSchema = createInsertSchema(stockCounts).omit({ id: true });
export const insertStockCountItemSchema = createInsertSchema(stockCountItems).omit({ id: true });
export const insertStockRequestSchema = createInsertSchema(stockRequests).omit({ id: true });
export const insertStockRequestItemSchema = createInsertSchema(stockRequestItems).omit({ id: true });

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = z.infer<typeof insertAdjustmentSchema>;
export type BadStock = typeof badStocks.$inferSelect;
export type InsertBadStock = z.infer<typeof insertBadStockSchema>;
export type StockCount = typeof stockCounts.$inferSelect;
export type InsertStockCount = z.infer<typeof insertStockCountSchema>;
export type StockCountItem = typeof stockCountItems.$inferSelect;
export type InsertStockCountItem = z.infer<typeof insertStockCountItemSchema>;
export type StockRequest = typeof stockRequests.$inferSelect;
export type InsertStockRequest = z.infer<typeof insertStockRequestSchema>;
export type StockRequestItem = typeof stockRequestItems.$inferSelect;
export type InsertStockRequestItem = z.infer<typeof insertStockRequestItemSchema>;
