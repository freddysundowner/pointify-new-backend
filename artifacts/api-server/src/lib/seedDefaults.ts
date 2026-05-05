// Idempotent seed for super-admin-controlled global catalogs.
// Runs once at server boot. Only inserts rows that don't already exist.
import { paymentMethods, packages, settings, smsTemplates, permissions, shopCategories } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { DEFAULT_SMS_TEMPLATES } from "./smsTemplates.js";
import {
  DEFAULT_EMAIL_TEMPLATES,
  SETTINGS_NAME_PREFIX,
  settingsName,
} from "./emailTemplates.js";

const DEFAULT_PAYMENT_METHODS = [
  { name: "Cash",          description: "Physical cash", sortOrder: 10 },
  { name: "M-Pesa",        description: "Mobile money",  sortOrder: 20 },
  { name: "Bank Transfer", description: "Direct bank deposit / EFT", sortOrder: 30 },
  { name: "Card",          description: "Debit / credit card", sortOrder: 40 },
  { name: "Wallet",        description: "Customer wallet / prepaid balance", sortOrder: 50 },
];

export async function seedDefaultPaymentMethods(): Promise<void> {
  try {
    const existing = await db.query.paymentMethods.findMany();
    const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));
    const toInsert = DEFAULT_PAYMENT_METHODS.filter(
      (m) => !existingNames.has(m.name.toLowerCase()),
    );
    if (toInsert.length === 0) return;
    await db.insert(paymentMethods).values(toInsert);
    logger.info({ inserted: toInsert.map((m) => m.name) }, "seed: default payment methods inserted");
  } catch (err) {
    logger.error({ err }, "seed: payment methods failed");
  }
}

// Seed the in-code email template registry into the `settings` table (under
// the `email_template:<key>` namespace) so super-admin can edit each template
// through the API. Only inserts templates that don't already exist — never
// overwrites super-admin edits.
export async function seedDefaultEmailTemplates(): Promise<void> {
  try {
    const existing = await db.query.settings.findMany({
      where: like(settings.name, `${SETTINGS_NAME_PREFIX}%`),
    });
    const existingNames = new Set(existing.map((r) => r.name));
    const toInsert = DEFAULT_EMAIL_TEMPLATES
      .filter((t) => !existingNames.has(settingsName(t.key)))
      .map((t) => ({ name: settingsName(t.key), setting: t }));
    if (toInsert.length === 0) return;
    await db.insert(settings).values(toInsert);
    logger.info(
      { inserted: toInsert.map((t) => t.name) },
      "seed: default email templates inserted",
    );
  } catch (err) {
    logger.error({ err }, "seed: email templates failed");
  }
}

// Seed the default trial setting ({ days: 14 }) and a matching trial package.
// The super-admin can override the days value via PUT /system/settings/trial.
// Never overwrites an existing setting or package.
export async function seedDefaultTrialConfig(): Promise<void> {
  try {
    // 1. Seed the trial setting (only if it doesn't exist yet)
    const existingSetting = await db.query.settings.findFirst({ where: eq(settings.name, "trial") });
    if (!existingSetting) {
      await db.insert(settings).values({ name: "trial", setting: { days: 14 } });
      logger.info("seed: default trial setting inserted (14 days)");
    }

    // 2. Seed the trial package (only if no trial package exists yet)
    const existingPkg = await db.query.packages.findFirst({ where: eq(packages.type, "trial") });
    if (!existingPkg) {
      const trialDays = (existingSetting?.setting as { days?: number } | null)?.days ?? 14;
      await db.insert(packages).values({
        title: "Free Trial",
        description: `${trialDays}-day free trial`,
        durationValue: trialDays,
        durationUnit: "days",
        amount: "0",
        amountUsd: "0",
        type: "trial",
        isActive: true,
        sortOrder: 0,
      });
      logger.info({ trialDays }, "seed: default trial package inserted");
    }
  } catch (err) {
    logger.error({ err }, "seed: trial config failed");
  }
}

// Seed the email provider config row into `settings` under the key "email".
// Only inserts if the row doesn't already exist (never overwrites admin edits).
// Reads initial values from environment variables so the row is immediately
// usable when those vars are set:
//   BREVO_API_KEY       → apiKey
//   EMAIL_FROM_ADDRESS  → fromAddress
//   EMAIL_FROM_NAME     → fromName  (default: "Pointify POS")
//   EMAIL_REPLY_TO      → replyTo
export async function seedDefaultEmailConfig(): Promise<void> {
  try {
    const existing = await db.query.settings.findFirst({ where: eq(settings.name, "email") });
    if (existing) return;

    const config = {
      provider:    "brevo",
      apiKey:      process.env["BREVO_API_KEY"]      ?? "",
      fromAddress: process.env["EMAIL_FROM_ADDRESS"] ?? "",
      fromName:    process.env["EMAIL_FROM_NAME"]    ?? "Pointify POS",
      replyTo:     process.env["EMAIL_REPLY_TO"]     ?? "",
    };

    await db.insert(settings).values({ name: "email", setting: config });

    const ready = !!(config.apiKey && config.fromAddress);
    logger.info(
      { ready, fromAddress: config.fromAddress || "(not set)" },
      ready
        ? "seed: email config inserted from environment variables — email sending is active"
        : "seed: email config placeholder inserted — set apiKey + fromAddress via PUT /system/settings/email to activate sending",
    );
  } catch (err) {
    logger.error({ err }, "seed: email config failed");
  }
}

// Seed the master permissions catalogue into the `permissions` table.
// Runs once at boot — only inserts groups that don't already exist (by key).
// Never overwrites rows that are already in the DB so admin edits are preserved.
const DEFAULT_PERMISSIONS = [
  {
    key: "pos",
    label: "POS",
    values: ["set_sale_date", "can_sell", "can_sell_to_dealer_&_wholesaler", "discount", "edit_price"],
    condition: null,
    sortOrder: 10,
  },
  {
    key: "stocks",
    label: "Stocks",
    values: [
      "view_products", "add_products", "view_buying_price", "stock_summary",
      "view_purchases", "add_purchases", "stock_count", "badstock",
      "transfer", "return", "delete_purchase_invoice",
    ],
    condition: null,
    sortOrder: 20,
  },
  {
    key: "products",
    label: "Products",
    values: ["edit", "delete", "add", "adjust_stock", "view_adjustment_history"],
    condition: null,
    sortOrder: 30,
  },
  {
    key: "sales",
    label: "Sales",
    values: ["view_sales", "return", "delete", "view_profit"],
    condition: null,
    sortOrder: 40,
  },
  {
    key: "reports",
    label: "Reports",
    values: [
      "sales", "dues", "productsales", "discoutedsales", "debtors",
      "purchases", "expenses", "stocktake", "netprofit",
      "stockreport", "productmovement", "profitanalysis",
    ],
    condition: null,
    sortOrder: 50,
  },
  { key: "purchases", label: "Purchases", values: ["edit_buying_price"], condition: null, sortOrder: 60 },
  { key: "accounts",  label: "Accounts",  values: ["cashflow"],           condition: null, sortOrder: 70 },
  { key: "expenses",  label: "Expenses",  values: ["manage"],             condition: null, sortOrder: 80 },
  { key: "suppliers", label: "Suppliers", values: ["manage"],             condition: null, sortOrder: 90 },
  { key: "customers", label: "Customers", values: ["manage", "deposit"],  condition: null, sortOrder: 100 },
  { key: "shop",       label: "Shop",       values: ["manage", "switch"], condition: null, sortOrder: 110 },
  { key: "attendants", label: "Attendants", values: ["manage", "view"],   condition: null, sortOrder: 120 },
  { key: "usage",      label: "Usage",      values: ["manage"],           condition: null, sortOrder: 130 },
  { key: "support",    label: "Support",    values: ["manage"],           condition: null, sortOrder: 140 },
  {
    key: "production",
    label: "Production",
    values: ["delete", "change_status", "edit", "adjust_stock", "view_adjustment_history"],
    condition: "production",
    sortOrder: 150,
  },
  {
    key: "warehouse",
    label: "Warehouse",
    values: [
      "invoice_delete", "show_buying_price", "show_available_stock",
      "view_buying_price", "create_orders", "view_orders",
      "return", "accept_warehouse_orders",
    ],
    condition: "warehouse",
    sortOrder: 160,
  },
] as const;

export async function seedDefaultPermissions(): Promise<void> {
  try {
    const existing = await db.query.permissions.findMany();
    const existingKeys = new Set(existing.map((r) => r.key));
    const toInsert = DEFAULT_PERMISSIONS.filter((p) => !existingKeys.has(p.key));
    if (toInsert.length === 0) return;
    await db.insert(permissions).values(toInsert.map((p) => ({ ...p, condition: p.condition ?? null })));
    logger.info({ inserted: toInsert.map((p) => p.key) }, "seed: default permissions inserted");
  } catch (err) {
    logger.error({ err }, "seed: permissions failed");
  }
}

// Seed the in-code SMS template registry into sms_templates so super-admin can
// edit the bodies through the API. Only inserts templates that don't already
// exist by name (key) — never overwrites super-admin edits.
export async function seedDefaultSmsTemplates(): Promise<void> {
  try {
    const existing = await db.query.smsTemplates.findMany();
    const existingNames = new Set(existing.map((r) => r.name));
    const toInsert = DEFAULT_SMS_TEMPLATES
      .filter((t) => !existingNames.has(t.key))
      .map((t) => ({ name: t.key, body: t.body, description: t.description, isActive: true }));
    if (toInsert.length === 0) return;
    await db.insert(smsTemplates).values(toInsert);
    logger.info({ inserted: toInsert.map((t) => t.name) }, "seed: default sms templates inserted");
  } catch (err) {
    logger.error({ err }, "seed: sms templates failed");
  }
}

// Shop categories seeded from electron/data/shopcategories.json in the desktop app.
// Only inserts categories that don't already exist (by name). Never overwrites.
const DEFAULT_SHOP_CATEGORIES = [
  { name: "HARDWARE" },
];

export async function seedDefaultShopCategories(): Promise<void> {
  try {
    const existing = await db.query.shopCategories.findMany();
    const existingNames = new Set(existing.map((r) => r.name.trim().toLowerCase()));
    const toInsert = DEFAULT_SHOP_CATEGORIES.filter(
      (c) => !existingNames.has(c.name.trim().toLowerCase()),
    );
    if (toInsert.length > 0) {
      await db.insert(shopCategories).values(toInsert);
      logger.info({ inserted: toInsert.map((c) => c.name) }, "seed: default shop categories inserted");
    } else {
      logger.info("seed: shop categories already present");
    }
  } catch (err) {
    logger.error({ err }, "seed: shop categories failed");
  }
}
