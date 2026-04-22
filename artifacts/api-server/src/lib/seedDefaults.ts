// Idempotent seed for super-admin-controlled global catalogs.
// Runs once at server boot. Only inserts rows that don't already exist.
import { paymentMethods, smsTemplates } from "@workspace/db";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { DEFAULT_SMS_TEMPLATES } from "./smsTemplates.js";

const DEFAULT_PAYMENT_METHODS = [
  { name: "Cash",          description: "Physical cash", sortOrder: 10 },
  { name: "M-Pesa",        description: "Mobile money",  sortOrder: 20 },
  { name: "Bank Transfer", description: "Direct bank deposit / EFT", sortOrder: 30 },
  { name: "Card",          description: "Debit / credit card", sortOrder: 40 },
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
