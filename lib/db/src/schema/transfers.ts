/**
 * Transfer tables
 */
import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shop";
import { attendants } from "./identity";
import { products } from "./catalog";
import { purchases } from "./purchases";

// ─── Product transfers ────────────────────────────────────────────────────────
// Records stock moved from one shop to another. Transfers are immediate —
// inventory is updated at both shops in the same transaction.
//
// When fromShop is a warehouse (shop.warehouse = true), a purchase record is
// also created at the receiving shop for accounting purposes. purchase_id links
// to that record.
export const productTransfers = pgTable(
  "product_transfers",
  {
    id: serial("id").primaryKey(),

    // Auto-generated reference (e.g. TRF12345)
    transferNo: text("transfer_no").unique(),

    transferNote: text("transfer_note"),

    initiatedBy: integer("initiated_by_id").notNull().references(() => attendants.id),
    fromShop: integer("from_shop_id").notNull().references(() => shops.id),
    toShop: integer("to_shop_id").notNull().references(() => shops.id),

    // Set when fromShop is a warehouse — links to the purchase record
    // created at the receiving shop for this transfer
    purchase: integer("purchase_id").references(() => purchases.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("product_transfers_from_shop_idx").on(table.fromShop),
    index("product_transfers_to_shop_idx").on(table.toShop),
    index("product_transfers_created_at_idx").on(table.createdAt),
  ]
);

// ─── Transfer items ───────────────────────────────────────────────────────────
// One row per product moved. unit_price is the buying_price at time of transfer
// — used to calculate transfer value and populate the linked purchase items.
export const transferItems = pgTable(
  "transfer_items",
  {
    id: serial("id").primaryKey(),
    transfer: integer("transfer_id").notNull().references(() => productTransfers.id, { onDelete: "cascade" }),
    product: integer("product_id").notNull().references(() => products.id),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    // Snapshot of product.buying_price at time of transfer
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }),
  },
  (table) => [
    index("transfer_items_transfer_id_idx").on(table.transfer),
    index("transfer_items_product_id_idx").on(table.product),
  ]
);

// ─── Schemas / types ──────────────────────────────────────────────────────────
export const insertProductTransferSchema = createInsertSchema(productTransfers).omit({ id: true });
export const insertTransferItemSchema = createInsertSchema(transferItems).omit({ id: true });

export type ProductTransfer = typeof productTransfers.$inferSelect;
export type InsertProductTransfer = z.infer<typeof insertProductTransferSchema>;
export type TransferItem = typeof transferItems.$inferSelect;
export type InsertTransferItem = z.infer<typeof insertTransferItemSchema>;
