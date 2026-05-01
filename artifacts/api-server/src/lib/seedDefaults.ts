// Idempotent seed for super-admin-controlled global catalogs.
// Runs once at server boot. Only inserts rows that don't already exist.
import { paymentMethods, packages, settings, smsTemplates } from "@workspace/db";
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
