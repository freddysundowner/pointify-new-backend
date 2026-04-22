/**
 * Product catalog + inventory tables
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
import { admins, attendants } from "./identity";
import { suppliers } from "./suppliers";

// ─── Product categories ───────────────────────────────────────────────────────
export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    admin: integer("admin_id").notNull().references(() => admins.id),
  },
  (table) => [
    index("product_categories_admin_id_idx").on(table.admin),
  ]
);

// ─── Products ─────────────────────────────────────────────────────────────────
// Defines what a product IS. One record per product per shop.
// Stock levels live in inventory, not here.
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),

    // Pricing
    buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }),
    wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }),
    dealerPrice: numeric("dealer_price", { precision: 14, scale: 2 }),
    minSellingPrice: numeric("min_selling_price", { precision: 14, scale: 2 }),
    maxDiscount: numeric("max_discount", { precision: 14, scale: 2 }),

    // Classification
    category: integer("product_category_id").references(() => productCategories.id),
    measureUnit: text("measure_unit").default(""),
    manufacturer: text("manufacturer").default(""),
    supplier: integer("supplier_id").references(() => suppliers.id),
    shop: integer("shop_id").references(() => shops.id),
    createdBy: integer("created_by_id").notNull().references(() => attendants.id),

    // Media & identification
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    images: text("images").array().default([]),
    barcode: text("barcode"),
    sku: text("sku"),

    // product | bundle | virtual | service
    type: text("product_type").default("product"),

    isDeleted: boolean("is_deleted").default(false),
    manageByPrice: boolean("manage_by_price").default(false),
    isTaxable: boolean("is_taxable").default(false),

    expiryDate: timestamp("expiry_date"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("products_shop_id_idx").on(table.shop),
    index("products_barcode_idx").on(table.barcode),
    index("products_shop_deleted_idx").on(table.shop, table.isDeleted),
    index("products_category_idx").on(table.category),
    index("products_supplier_idx").on(table.supplier),
  ]
);

// ─── Batches ──────────────────────────────────────────────────────────────────
// Individual stock lots per product per shop.
// Used when shop.track_batches = true (pharmacies, food shops, etc.).
// inventory.quantity = SUM(batches.quantity) when batch tracking is on.
export const batches = pgTable(
  "batches",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").references(() => products.id),
    shop: integer("shop_id").references(() => shops.id),
    buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }).default("0"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).default("0"),
    totalQuantity: numeric("total_quantity", { precision: 14, scale: 4 }).default("0"),
    expirationDate: timestamp("expiration_date"),
    batchCode: text("batch_code").unique(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("batches_product_shop_idx").on(table.product, table.shop),
    index("batches_expiration_idx").on(table.expirationDate),
  ]
);

// ─── Product serials ──────────────────────────────────────────────────────────
// Tracks individual unit serial numbers for serialised products (phones, laptops, etc.)
export const productSerials = pgTable(
  "product_serials",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").references(() => shops.id),
    serialNumber: text("serial_number").notNull(),
    // available | sold | returned | void
    status: text("status").default("available"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("product_serials_product_idx").on(table.product),
    index("product_serials_serial_number_idx").on(table.serialNumber),
  ]
);

// ─── Inventory ────────────────────────────────────────────────────────────────
// Per-shop stock record. Always created alongside its product (1:1 with products).
// This is the single source of truth for stock levels — never products.
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    updatedBy: integer("updated_by_id").references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    lastCountDate: timestamp("last_count_date"),
    // active | low | out_of_stock
    status: text("status").default("active"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("inventory_product_shop_idx").on(table.product, table.shop),
  ]
);

// ─── Bundle items ─────────────────────────────────────────────────────────────
// Defines the components of a bundle product.
// e.g. "Gift Basket" = 1x Mug + 2x Chocolate + 1x Card
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),           // the bundle
    componentProduct: integer("component_product_id").notNull().references(() => products.id), // the component
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("bundle_items_product_idx").on(table.product),
  ]
);

// ─── Stock adjustments ────────────────────────────────────────────────────────
// Audit log of manual stock changes (adding or removing stock outside of sales/purchases).
export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    product: integer("product_id").notNull().references(() => products.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    adjustedBy: integer("adjusted_by_id").notNull().references(() => attendants.id),
    // add | remove
    type: text("type").default("add"),
    quantityBefore: numeric("quantity_before", { precision: 14, scale: 4 }).notNull(),
    quantityAfter: numeric("quantity_after", { precision: 14, scale: 4 }).notNull(),
    quantityAdjusted: numeric("quantity_adjusted", { precision: 14, scale: 4 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("adjustments_product_shop_idx").on(table.product, table.shop),
    index("adjustments_created_at_idx").on(table.createdAt),
  ]
);

// ─── Bad stock (write-offs) ───────────────────────────────────────────────────
// Records damaged, expired, or lost stock that is written off.
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
  },
  (table) => [
    index("bad_stocks_shop_id_idx").on(table.shop),
    index("bad_stocks_product_id_idx").on(table.product),
  ]
);

// ─── Stock counts ─────────────────────────────────────────────────────────────
// A physical stock count session. One header + many line items.
export const stockCounts = pgTable(
  "stock_counts",
  {
    id: serial("id").primaryKey(),
    conductedBy: integer("conducted_by_id").notNull().references(() => attendants.id),
    shop: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("stock_counts_shop_id_idx").on(table.shop),
  ]
);

export const stockCountItems = pgTable(
  "stock_count_items",
  {
    id: serial("id").primaryKey(),
    stockCount: integer("stock_count_id").notNull().references(() => stockCounts.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    physicalCount: numeric("physical_count", { precision: 14, scale: 4 }).notNull(),
    systemCount: numeric("system_count", { precision: 14, scale: 4 }).notNull(),
    variance: numeric("variance", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("stock_count_items_stock_count_idx").on(table.stockCount),
  ]
);

// ─── Stock requests ───────────────────────────────────────────────────────────
// A shop requests stock from a warehouse. One header + many line items.
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
    invoiceNumber: text("invoice_number").unique(),
    acceptedAt: timestamp("accepted_at"),
    dispatchedAt: timestamp("dispatched_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("stock_requests_from_shop_idx").on(table.fromShop),
    index("stock_requests_warehouse_idx").on(table.warehouse),
    index("stock_requests_status_idx").on(table.status),
  ]
);

export const stockRequestItems = pgTable(
  "stock_request_items",
  {
    id: serial("id").primaryKey(),
    stockRequest: integer("stock_request_id").notNull().references(() => stockRequests.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    quantityRequested: numeric("quantity_requested", { precision: 14, scale: 4 }).notNull(),
    quantityReceived: numeric("quantity_received", { precision: 14, scale: 4 }).default("0"),
  },
  (table) => [
    index("stock_request_items_request_idx").on(table.stockRequest),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });
export const insertProductSerialSchema = createInsertSchema(productSerials).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({ id: true });
export const insertAdjustmentSchema = createInsertSchema(adjustments).omit({ id: true });
export const insertBadStockSchema = createInsertSchema(badStocks).omit({ id: true });
export const insertStockCountSchema = createInsertSchema(stockCounts).omit({ id: true });
export const insertStockCountItemSchema = createInsertSchema(stockCountItems).omit({ id: true });
export const insertStockRequestSchema = createInsertSchema(stockRequests).omit({ id: true });
export const insertStockRequestItemSchema = createInsertSchema(stockRequestItems).omit({ id: true });

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type ProductSerial = typeof productSerials.$inferSelect;
export type InsertProductSerial = z.infer<typeof insertProductSerialSchema>;
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
