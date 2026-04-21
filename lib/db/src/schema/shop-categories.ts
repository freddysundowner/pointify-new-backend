import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shopCategories = pgTable("shop_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").default(true),
  sync: boolean("sync").default(false),
});

export const insertShopCategorySchema = createInsertSchema(shopCategories).omit({ id: true });
export type ShopCategory = typeof shopCategories.$inferSelect;
export type InsertShopCategory = z.infer<typeof insertShopCategorySchema>;
