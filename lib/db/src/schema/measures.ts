import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const measures = pgTable("measures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sync: boolean("sync").default(false),
});

export const insertMeasureSchema = createInsertSchema(measures).omit({ id: true });
export type Measure = typeof measures.$inferSelect;
export type InsertMeasure = z.infer<typeof insertMeasureSchema>;
