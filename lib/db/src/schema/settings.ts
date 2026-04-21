import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Setting.setting was type: {} in MongoDB — free-form JSONB is the best PostgreSQL equivalent
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  setting: jsonb("setting"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
