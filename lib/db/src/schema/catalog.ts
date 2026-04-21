/**
 * Product catalog tables
 * Everything that describes *what* a shop sells — categories, attributes,
 * products and their price lots (batches).
 *
 * Inventory (how much stock is on hand) lives in inventory.ts.
 */
import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { admins, attendants } from "./identity";
import { suppliers } from "./suppliers";
import { measures } from "./system";

// ─── Product categories ───────────────────────────────────────────────────────
// Scoped per admin (shared across all of that admin's shops)
export const productCategories = pgTable(
  "product_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    adminId: integer("admin_id").notNull().references(() => admins.id),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("product_categories_admin_id_idx").on(table.adminId),
  ]
);

// ─── Attributes ───────────────────────────────────────────────────────────────
// Product variant dimensions (Color, Size, Material…).
// title and name are i18n maps: { en: "Color", sw: "Rangi" }
export const attributes = pgTable("attributes", {
  id: serial("id").primaryKey(),
  title: jsonb("title").notNull(),   // display label (i18n)
  name: jsonb("name").notNull(),     // slug/key (i18n)
  // Dropdown | Radio | Checkbox
  inputType: text("input_type"),
  // attribute | extra
  type: text("type").default("attribute"),
  // show | hide
  status: text("status").default("show"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual options within an attribute (Red, Blue, XL, S…)
export const attributeVariants = pgTable("attribute_variants", {
  id: serial("id").primaryKey(),
  attributeId: integer("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  name: jsonb("name"),
  status: text("status").default("show"),
});

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),

    // Pricing tiers (a sale picks one based on the customer type / sale type)
    buyingPrice: numeric("buying_price", { precision: 14, scale: 2 }),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }),
    wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }),
    dealerPrice: numeric("dealer_price", { precision: 14, scale: 2 }),
    minSellingPrice: numeric("min_selling_price", { precision: 14, scale: 2 }),
    maxDiscount: numeric("max_discount", { precision: 14, scale: 2 }),

    // Stock quantities
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    lastCount: numeric("last_count", { precision: 14, scale: 4 }).default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 4 }).default("0"),

    // Classification
    productCategoryId: integer("product_category_id").references(() => productCategories.id),
    measureUnitId: integer("measure_unit_id").references(() => measures.id),
    // Legacy free-text measure kept alongside the FK for backward compat
    measureText: text("measure_text").default(""),
    manufacturer: text("manufacturer").default(""),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    shopId: integer("shop_id").references(() => shops.id),
    createdById: integer("created_by_id").notNull().references(() => attendants.id),
    adminId: integer("admin_id").references(() => admins.id),

    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),   // main display image
    images: text("images").array().default([]),
    barcode: text("barcode"),
    serialNumber: text("serial_number"),

    // product | bundle | virtual | service
    productType: text("product_type").default("product"),

    // Flags
    isDeleted: boolean("is_deleted").default(false),
    isVirtual: boolean("is_virtual").default(false),
    isBundle: boolean("is_bundle").default(false),
    // If true, stock is tracked by price variations rather than quantity
    manageByPrice: boolean("manage_by_price").default(false),
    isTaxable: boolean("is_taxable").default(false),

    lastCountDate: timestamp("last_count_date"),
    expiryDate: timestamp("expiry_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("products_shop_id_idx").on(table.shopId),
    index("products_barcode_idx").on(table.barcode),
    index("products_shop_deleted_idx").on(table.shopId, table.isDeleted),
    index("products_category_idx").on(table.productCategoryId),
    index("products_supplier_idx").on(table.supplierId),
  ]
);

// ─── Batches ──────────────────────────────────────────────────────────────────
// A batch is a specific buying-price lot of a product, optionally with an
// expiry date. Shops that enable batch tracking use these to manage FIFO stock.
// One product → many batches (batches.product_id is the owning FK).
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

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export const insertAttributeSchema = createInsertSchema(attributes).omit({ id: true });
export const insertAttributeVariantSchema = createInsertSchema(attributeVariants).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;
export type AttributeVariant = typeof attributeVariants.$inferSelect;
export type InsertAttributeVariant = z.infer<typeof insertAttributeVariantSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
