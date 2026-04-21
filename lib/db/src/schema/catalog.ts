/**
 * Product catalog tables
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

    category: integer("product_category_id").references(() => productCategories.id),
    measureUnit: text("measure_unit").default(""),
    manufacturer: text("manufacturer").default(""),
    supplier: integer("supplier_id").references(() => suppliers.id),
    shop: integer("shop_id").references(() => shops.id),
    createdBy: integer("created_by_id").notNull().references(() => attendants.id),
    admin: integer("admin_id").references(() => admins.id),

    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    images: text("images").array().default([]),
    barcode: text("barcode"),
    serialNumber: text("serial_number"),

    // product | bundle | virtual | service
    type: text("product_type").default("product"),

    isDeleted: boolean("is_deleted").default(false),
    isVirtual: boolean("is_virtual").default(false),
    isBundle: boolean("is_bundle").default(false),
    manageByPrice: boolean("manage_by_price").default(false),
    isTaxable: boolean("is_taxable").default(false),

    lastCountDate: timestamp("last_count_date"),
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

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
