/**
 * Inventory management tables
 * Tracks physical stock levels, adjustments, write-offs, stock counts,
 * inter-shop transfer requests, and bundle composition.
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
// One record per product per shop — tracks the live quantity on hand.
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id),
    shopId: integer("shop_id").references(() => shops.id),
    // Attendant who last modified this record
    updatedById: integer("updated_by_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),
    isBundle: boolean("is_bundle").default(false),
    // in | out | adjustment (movement type)
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
    index("inventory_product_shop_idx").on(table.productId, table.shopId),
    index("inventory_barcode_idx").on(table.barcode),
  ]
);

// ─── Bundle items ─────────────────────────────────────────────────────────────
// Defines the component products that make up a bundle product.
// inventoryId links to the bundle's inventory record.
// productId = the bundle parent, itemProductId = the component.
// To query all components for a bundle: SELECT * FROM bundle_items WHERE inventory_id = X
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    inventoryId: integer("inventory_id").references(() => inventory.id),
    // The bundle (parent) product
    productId: integer("product_id").references(() => products.id),
    // The component (child) product included in the bundle
    componentProductId: integer("component_product_id").references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("bundle_items_inventory_idx").on(table.inventoryId),
    index("bundle_items_product_idx").on(table.productId),
  ]
);

// ─── Stock adjustments ────────────────────────────────────────────────────────
// Manual quantity corrections (add or remove stock with an audit trail).
export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    // add | remove
    type: text("type").default("add"),
    quantityBefore: numeric("quantity_before", { precision: 14, scale: 4 }).notNull(),
    quantityAfter: numeric("quantity_after", { precision: 14, scale: 4 }).notNull(),
    quantityAdjusted: numeric("quantity_adjusted", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("adjustments_product_shop_idx").on(table.productId, table.shopId),
    index("adjustments_created_at_idx").on(table.createdAt),
  ]
);

// ─── Bad stock (write-offs) ───────────────────────────────────────────────────
// Records of damaged, expired, or otherwise unusable stock removed from inventory.
export const badStocks = pgTable(
  "bad_stocks",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    writtenOffById: integer("written_off_by_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("bad_stocks_shop_id_idx").on(table.shopId),
    index("bad_stocks_product_id_idx").on(table.productId),
  ]
);

// ─── Stock counts ─────────────────────────────────────────────────────────────
// A stock count session groups physical counts taken at a point in time.
export const stockCounts = pgTable(
  "stock_counts",
  {
    id: serial("id").primaryKey(),
    conductedById: integer("conducted_by_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_counts_shop_id_idx").on(table.shopId),
  ]
);

// Individual product line within a stock count session
export const stockCountItems = pgTable("stock_count_items", {
  id: serial("id").primaryKey(),
  stockCountId: integer("stock_count_id").notNull().references(() => stockCounts.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  physicalCount: numeric("physical_count", { precision: 14, scale: 4 }).notNull(),
  systemCount: numeric("system_count", { precision: 14, scale: 4 }).notNull(),
  variance: numeric("variance", { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Stock requests ───────────────────────────────────────────────────────────
// A branch shop requests stock replenishment from a warehouse shop.
export const stockRequests = pgTable(
  "stock_requests",
  {
    id: serial("id").primaryKey(),
    requestedById: integer("requested_by_id").notNull().references(() => attendants.id),
    acceptedById: integer("accepted_by_id").references(() => attendants.id),
    approvedById: integer("approved_by_id").references(() => attendants.id),
    // pending | processed | correction | void | completed
    status: text("status").default("pending"),
    // The branch requesting the stock
    fromShopId: integer("from_shop_id").notNull().references(() => shops.id),
    // The warehouse shop fulfilling the request
    warehouseId: integer("warehouse_id").notNull().references(() => shops.id),
    totalValue: numeric("total_value", { precision: 14, scale: 2 }).default("0"),
    invoiceNumber: text("invoice_number").default("").unique(),
    acceptedAt: timestamp("accepted_at"),
    dispatchedAt: timestamp("dispatched_at"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_requests_from_shop_idx").on(table.fromShopId),
    index("stock_requests_warehouse_idx").on(table.warehouseId),
    index("stock_requests_status_idx").on(table.status),
  ]
);

// Line items within a stock request
export const stockRequestItems = pgTable("stock_request_items", {
  id: serial("id").primaryKey(),
  stockRequestId: integer("stock_request_id").notNull().references(() => stockRequests.id, { onDelete: "cascade" }),
  inventoryId: integer("inventory_id").references(() => inventory.id),
  productId: integer("product_id").references(() => products.id),
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
