import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shops } from "./shops";
import { attendants } from "./admins-attendants";

// Audit log: records what action an attendant performed in a shop
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    shopId: integer("shop_id").notNull().references(() => shops.id),
    attendantId: integer("attendant_id").notNull().references(() => attendants.id),
    createdAt: timestamp("created_at").defaultNow(),
    sync: boolean("sync").default(false),
  },
  (table) => [
    index("activities_shop_id_idx").on(table.shopId),
    index("activities_shop_date_idx").on(table.shopId, table.createdAt),
    index("activities_attendant_id_idx").on(table.attendantId),
  ]
);

export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
