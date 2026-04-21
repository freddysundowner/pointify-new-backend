import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shops";
import { admins, attendants } from "./admins-attendants";
import { productCategories } from "./categories";
import { suppliers } from "./suppliers";
import { measures } from "./measures";

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }),
    wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }),
    dealerPrice: numeric("dealer_price", { precision: 14, scale: 2 }),
    minSellingPrice: numeric("min_selling_price", { precision: 14, scale: 2 }),
    maxDiscount: numeric("max_discount", { precision: 14, scale: 2 }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),
    productCategoryId: integer("product_category_id").references(() => productCategories.id),
    measureUnitId: integer("measure_unit_id").references(() => measures.id),
    // Legacy free-text measure field kept alongside the FK for backward compat
    measure: text("measure").default(""),
    manufacturer: text("manufacturer").default(""),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    shopId: integer("shop_id").references(() => shops.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    adminId: integer("admin_id").references(() => admins.id),
    description: text("description"),
    uploadImage: text("upload_image"),
    images: text("images").array().default([]),
    barcode: text("barcode"),
    serialNumber: text("serial_number"),
    // product | bundle | virtual | service etc.
    productType: text("product_type").default("product"),
    deleted: boolean("deleted").default(false),
    virtual: boolean("virtual").default(false),
    bundle: boolean("bundle").default(false),
    manageByPrice: boolean("manage_by_price").default(false),
    taxable: boolean("taxable").default(false),
    lastCountDate: timestamp("last_count_date"),
    expiryDate: timestamp("expiry_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("products_shop_id_idx").on(table.shopId),
    index("products_barcode_idx").on(table.barcode),
    index("products_shop_deleted_idx").on(table.shopId, table.deleted),
    index("products_category_idx").on(table.productCategoryId),
    index("products_supplier_idx").on(table.supplierId),
  ]
);

// A batch tracks a specific buying-price lot for a product, including expiry.
// Relationship: one product → many batches (batches.product_id is the FK).
// No junction table needed.
export const batches = pgTable(
  "batches",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id),
    shopId: integer("shop_id").references(() => shops.id),
    buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }).default("0"),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).default("0"),
    totalQuantity: numeric("total_quantity", { precision: 14, scale: 4 }).default("0"),
    expirationDate: timestamp("expiration_date"),
    batchCode: text("batch_code").unique(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("batches_product_shop_idx").on(table.productId, table.shopId),
    index("batches_expiration_idx").on(table.expirationDate),
  ]
);

// Inventory tracks per-shop stock levels for each product.
// One product can have one inventory record per shop.
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id),
    shopId: integer("shop_id").references(() => shops.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),
    bundle: boolean("bundle").default(false),
    type: text("type"),
    status: text("status"),
    barcode: text("barcode"),
    lastCountDate: timestamp("last_count_date"),
    expiryDate: timestamp("expiry_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    // Core lookup: most queries are "give me stock for product X in shop Y"
    index("inventory_product_shop_idx").on(table.productId, table.shopId),
    index("inventory_barcode_idx").on(table.barcode),
  ]
);

// A bundle item defines how much of a component product goes into a bundle product.
// inventoryId links it to the specific inventory record of the bundle.
// productId = the bundle (parent), itemProductId = the component (child).
// To fetch all bundle items for an inventory record: SELECT * FROM bundle_items WHERE inventory_id = X
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    inventoryId: integer("inventory_id").references(() => inventory.id),
    productId: integer("product_id").references(() => products.id),
    itemProductId: integer("item_product_id").references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("bundle_items_inventory_idx").on(table.inventoryId),
    index("bundle_items_product_idx").on(table.productId),
  ]
);

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({ id: true });

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
