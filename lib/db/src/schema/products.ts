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
import { shops } from "./shops";
import { admins, attendants } from "./admins-attendants";
import { productCategories } from "./categories";
import { suppliers } from "./suppliers";
import { measures } from "./measures";

export const products = pgTable("products", {
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
});

export const batches = pgTable("batches", {
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
});

// Junction: products ↔ batches (product.batches array in MongoDB)
export const productBatches = pgTable("product_batches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
});

export const inventory = pgTable("inventory", {
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
});

export const bundleItems = pgTable("bundle_items", {
  id: serial("id").primaryKey(),
  // item FK → inventory.id
  inventoryId: integer("inventory_id").references(() => inventory.id),
  // product FK → products.id (the bundle product)
  productId: integer("product_id").references(() => products.id),
  // item_product FK → products.id (the component product)
  itemProductId: integer("item_product_id").references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

// Junction: inventory.bundleItems array
export const inventoryBundleItems = pgTable("inventory_bundle_items", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull().references(() => inventory.id, { onDelete: "cascade" }),
  bundleItemId: integer("bundle_item_id").notNull().references(() => bundleItems.id, { onDelete: "cascade" }),
});

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
