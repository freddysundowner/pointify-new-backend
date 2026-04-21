import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Attribute.title and Attribute.name were type: Object in MongoDB (i18n maps)
export const attributes = pgTable("attributes", {
  id: serial("id").primaryKey(),
  title: jsonb("title").notNull(),   // { en: "Color", sw: "Rangi" } etc.
  name: jsonb("name").notNull(),
  option: text("option"),            // Dropdown | Radio | Checkbox
  type: text("type").default("attribute"), // attribute | extra
  status: text("status").default("show"),  // show | hide
  sync: boolean("sync").default(false),
});

export const attributeVariants = pgTable("attribute_variants", {
  id: serial("id").primaryKey(),
  attributeId: integer("attribute_id").notNull().references(() => attributes.id, { onDelete: "cascade" }),
  name: jsonb("name"),
  status: text("status").default("show"), // show | hide
});

export const insertAttributeSchema = createInsertSchema(attributes).omit({ id: true });
export const insertAttributeVariantSchema = createInsertSchema(attributeVariants).omit({ id: true });

export type Attribute = typeof attributes.$inferSelect;
export type InsertAttribute = z.infer<typeof insertAttributeSchema>;
export type AttributeVariant = typeof attributeVariants.$inferSelect;
export type InsertAttributeVariant = z.infer<typeof insertAttributeVariantSchema>;
