import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  address: text("address"),
  password: text("password"),
  country: text("country"),
  commission: numeric("commission", { precision: 10, scale: 2 }).default("20"),
  wallet: numeric("wallet", { precision: 14, scale: 2 }).default("0"),
  blocked: boolean("blocked").default(false),
  active: boolean("active").default(false),
  code: text("code"),
  otp: integer("otp"),
  otpExpiry: numeric("otp_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  sync: boolean("sync").default(false),
});

export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ id: true });
export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
