import {
  pgTable,
  serial,
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
import { products } from "./products";

// Records the movement of products from one shop to another
export const productTransfers = pgTable(
  "product_transfers",
  {
    id: serial("id").primaryKey(),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    fromShopId: integer("from_shop_id").notNull().references(() => shops.id),
    toShopId: integer("to_shop_id").notNull().references(() => shops.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("product_transfers_from_shop_idx").on(table.fromShopId),
    index("product_transfers_to_shop_idx").on(table.toShopId),
    index("product_transfers_created_at_idx").on(table.createdAt),
  ]
);

export const transferItems = pgTable("transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => productTransfers.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
});

export const insertProductTransferSchema = createInsertSchema(productTransfers).omit({ id: true });
export const insertTransferItemSchema = createInsertSchema(transferItems).omit({ id: true });

export type ProductTransfer = typeof productTransfers.$inferSelect;
export type InsertProductTransfer = z.infer<typeof insertProductTransferSchema>;
export type TransferItem = typeof transferItems.$inferSelect;
export type InsertTransferItem = z.infer<typeof insertTransferItemSchema>;
