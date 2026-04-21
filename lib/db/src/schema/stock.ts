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
import { shops } from "./shops";
import { attendants } from "./admins-attendants";
import { products, inventory } from "./products";

export const badStocks = pgTable(
  "bad_stocks",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
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

export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    // add | remove
    type: text("type").default("add"),
    before: numeric("before", { precision: 14, scale: 4 }).notNull(),
    after: numeric("after", { precision: 14, scale: 4 }).notNull(),
    adjusted: numeric("adjusted", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("adjustments_product_shop_idx").on(table.productId, table.shopId),
    index("adjustments_created_at_idx").on(table.createdAt),
  ]
);

export const stockCounts = pgTable(
  "stock_counts",
  {
    id: serial("id").primaryKey(),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_counts_shop_id_idx").on(table.shopId),
  ]
);

export const stockCountItems = pgTable("stock_count_items", {
  id: serial("id").primaryKey(),
  stockCountId: integer("stock_count_id").notNull().references(() => stockCounts.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  physicalCount: numeric("physical_count", { precision: 14, scale: 4 }).notNull(),
  initialCount: numeric("initial_count", { precision: 14, scale: 4 }).notNull(),
  variance: numeric("variance", { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockRequests = pgTable(
  "stock_requests",
  {
    id: serial("id").primaryKey(),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    acceptedById: integer("accepted_by_id").references(() => attendants.id),
    approvedById: integer("approved_by_id").references(() => attendants.id),
    // pending | processed | correction | void | completed
    status: text("status").default("pending"),
    // The shop that is requesting stock
    fromShopId: integer("from_shop_id").notNull().references(() => shops.id),
    // The warehouse shop fulfilling the request
    warehouseId: integer("warehouse_id").notNull().references(() => shops.id),
    total: numeric("total", { precision: 14, scale: 2 }).default("0"),
    invoiceNumber: text("invoice_number").default("").unique(),
    acceptedDate: timestamp("accepted_date"),
    dispatchedDate: timestamp("dispatched_date"),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("stock_requests_from_shop_idx").on(table.fromShopId),
    index("stock_requests_warehouse_idx").on(table.warehouseId),
    index("stock_requests_status_idx").on(table.status),
  ]
);

export const stockRequestItems = pgTable("stock_request_items", {
  id: serial("id").primaryKey(),
  stockRequestId: integer("stock_request_id").notNull().references(() => stockRequests.id, { onDelete: "cascade" }),
  inventoryId: integer("inventory_id").references(() => inventory.id),
  productId: integer("product_id").references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  received: numeric("received", { precision: 14, scale: 4 }).default("0"),
  sync: boolean("sync").default(false),
});

export const insertBadStockSchema = createInsertSchema(badStocks).omit({ id: true });
export const insertAdjustmentSchema = createInsertSchema(adjustments).omit({ id: true });
export const insertStockCountSchema = createInsertSchema(stockCounts).omit({ id: true });
export const insertStockCountItemSchema = createInsertSchema(stockCountItems).omit({ id: true });
export const insertStockRequestSchema = createInsertSchema(stockRequests).omit({ id: true });
export const insertStockRequestItemSchema = createInsertSchema(stockRequestItems).omit({ id: true });

export type BadStock = typeof badStocks.$inferSelect;
export type InsertBadStock = z.infer<typeof insertBadStockSchema>;
export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = z.infer<typeof insertAdjustmentSchema>;
export type StockCount = typeof stockCounts.$inferSelect;
export type InsertStockCount = z.infer<typeof insertStockCountSchema>;
export type StockCountItem = typeof stockCountItems.$inferSelect;
export type InsertStockCountItem = z.infer<typeof insertStockCountItemSchema>;
export type StockRequest = typeof stockRequests.$inferSelect;
export type InsertStockRequest = z.infer<typeof insertStockRequestSchema>;
export type StockRequestItem = typeof stockRequestItems.$inferSelect;
export type InsertStockRequestItem = z.infer<typeof insertStockRequestItemSchema>;
