import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Attribute.title and Attribute.name were type: Object in MongoDB (i18n maps).
// e.g. title = { en: "Color", sw: "Rangi" }
export const attributes = pgTable("attributes", {
  id: serial("id").primaryKey(),
  title: jsonb("title").notNull(),
  name: jsonb("name").notNull(),
  // Dropdown | Radio | Checkbox
  option: text("option"),
  // attribute | extra
  type: text("type").default("attribute"),
  // show | hide
  status: text("status").default("show"),
  sync: boolean("sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  // Mongoose timestamps: true also gives updatedAt
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attributeVariants = pgTable("attribute_variants", {
  id: serial("id").primaryKey(),
  attributeId: integer("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  name: jsonb("name"),
  // show | hide
  status: text("status").default("show"),
});

export const insertAttributeSchema = createInsertSchema(attributes).omit({ id: true });
export const insertAttributeVariantSchema = createInsertSchema(attributeVariants).omit({ id: true });

export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;
export type AttributeVariant = typeof attributeVariants.$inferSelect;
export type InsertAttributeVariant = z.infer<typeof insertAttributeVariantSchema>;
