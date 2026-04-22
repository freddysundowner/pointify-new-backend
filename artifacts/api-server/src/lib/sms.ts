/**
 * SMS gateway adapter for BlessedTexts (or any compatible HTTP gateway).
 *
 * Reads credentials from /system/settings/sms:
 *   { provider, apiKey, endpoint, senderId }
 *
 * Public API:
 *   sendSms({ adminId, to, key, vars, system? })
 *
 * Behaviour:
 *   - Unless `system: true`, requires admins.smsCredit > 0 and decrements by 1.
 *   - Logs every attempt (success or failure) into `communications`.
 *   - On success, also writes a -1 sms_credit_transactions row.
 */

import { db } from "./db.js";
import { admins, communications, settings, smsCreditTransactions, smsTemplates } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { SMS_TEMPLATES_BY_KEY, renderSms } from "./smsTemplates.js";

// Template body cache — refreshed every 60s so super-admin edits propagate
// without needing a server restart.
let tplCache: { value: Map<string, { body: string; isActive: boolean }>; loadedAt: number } = {
  value: new Map(),
  loadedAt: 0,
};
const TPL_CACHE_TTL_MS = 60 * 1000;

async function loadTemplateBody(key: string): Promise<{ body: string; isActive: boolean } | null> {
  if (Date.now() - tplCache.loadedAt > TPL_CACHE_TTL_MS) {
    try {
      const rows = await db.query.smsTemplates.findMany();
      const map = new Map<string, { body: string; isActive: boolean }>();
      for (const r of rows) map.set(r.name, { body: r.body, isActive: r.isActive });
      tplCache = { value: map, loadedAt: Date.now() };
    } catch (err) {
      logger.warn({ err }, "sms: failed to refresh template cache");
    }
  }
  return tplCache.value.get(key) ?? null;
}

export function clearSmsTemplateCache() {
  tplCache = { value: new Map(), loadedAt: 0 };
}

type SmsConfig = {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  senderId?: string;
};

let cache: { value: SmsConfig | null; loadedAt: number } = { value: null, loadedAt: 0 };
const CACHE_TTL_MS = 60 * 1000;

export function clearSmsConfigCache() {
  cache = { value: null, loadedAt: 0 };
}

async function loadConfig(): Promise<SmsConfig | null> {
  if (cache.value && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.value;
  const row = await db.query.settings.findFirst({ where: eq(settings.name, "sms") });
  const v = (row?.setting as SmsConfig | undefined) ?? null;
  cache = { value: v, loadedAt: Date.now() };
  return v;
}

export type SendSmsInput = {
  /** Admin whose credit should be charged (and to scope the log row). */
  adminId: number | null;
  /** Phone in E.164 (preferred) or local format the gateway accepts. */
  to: string;
  /** Template key from smsTemplates. */
  key: string;
  /** Variables for the template. */
  vars?: Record<string, unknown>;
  /**
   * If true, do NOT charge admin credits (used for system messages such as
   * subscription expiry / dormant nudges that the platform sends on the
   * admin's behalf). Defaults to false.
   */
  system?: boolean;
};

export type SendSmsResult =
  | { ok: true; providerId?: string }
  | { ok: false; skipped?: string; error?: string };

function normalizePhone(p: string): string {
  // BlessedTexts/Africa's Talking style — accept "07xx" or "+254..." both work,
  // but most KE gateways prefer 2547xxxxxxxx without the leading +.
  const t = p.replace(/[^0-9]/g, "");
  if (t.startsWith("254")) return t;
  if (t.startsWith("0") && t.length === 10) return "254" + t.slice(1);
  if (t.startsWith("7") && t.length === 9) return "254" + t;
  return t;
}

async function logCommunication(adminId: number | null, to: string, message: string, status: "sent" | "failed", failedReason?: string) {
  try {
    await db.insert(communications).values({
      admin: adminId,
      type: "sms",
      message,
      contact: to,
      status,
      failedReason: failedReason ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "sms: failed to write communications log");
  }
}

async function chargeCredit(adminId: number) {
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(admins)
      .set({ smsCredit: sql`${admins.smsCredit} - 1` })
      .where(eq(admins.id, adminId))
      .returning({ balance: admins.smsCredit });
    await tx.insert(smsCreditTransactions).values({
      admin: adminId,
      type: "deduction",
      amount: -1,
      balanceAfter: updated?.balance ?? 0,
      description: "Auto-deduct on SMS send",
    } as typeof smsCreditTransactions.$inferInsert);
  });
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const { adminId, to, key, vars, system } = input;

  // Prefer the editable DB row; fall back to the in-code default if the row
  // hasn't been seeded yet or the DB lookup failed.
  const dbTpl = await loadTemplateBody(key);
  if (dbTpl && !dbTpl.isActive) return { ok: false, skipped: `sms template inactive: ${key}` };
  const codeTpl = SMS_TEMPLATES_BY_KEY[key];
  const body = dbTpl?.body ?? codeTpl?.body;
  if (!body) return { ok: false, skipped: `unknown sms template: ${key}` };
  const message = renderSms(body, vars ?? {});
  if (!to) return { ok: false, skipped: "no recipient phone" };

  const cfg = await loadConfig();
  if (!cfg?.apiKey || !cfg?.endpoint) {
    await logCommunication(adminId, to, message, "failed", "sms gateway not configured");
    return { ok: false, skipped: "sms gateway not configured (set /system/settings/sms)" };
  }

  // Charge credits unless this is a system-paid message.
  if (!system && adminId != null) {
    const a = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
    if (!a || (a.smsCredit ?? 0) <= 0) {
      await logCommunication(adminId, to, message, "failed", "insufficient sms credits");
      return { ok: false, skipped: "insufficient sms credits" };
    }
  }

  const phone = normalizePhone(to);
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        api_key: cfg.apiKey,
        sender_id: cfg.senderId ?? "PointifyPOS",
        message,
        phone,
        // Most KE gateways accept any of these aliases — sending all is harmless.
        to: phone,
        msg: message,
      }),
    });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* keep raw */ }

    if (!res.ok) {
      const reason = typeof body === "string" ? body : (body?.message || body?.error || `HTTP ${res.status}`);
      await logCommunication(adminId, to, message, "failed", String(reason).slice(0, 500));
      return { ok: false, error: String(reason) };
    }

    if (!system && adminId != null) {
      try { await chargeCredit(adminId); } catch (err) { logger.warn({ err, adminId }, "sms: charge credit failed"); }
    }
    await logCommunication(adminId, to, message, "sent");
    const providerId = typeof body === "object" && body ? (body.id || body.message_id || body.requestId) : undefined;
    return { ok: true, providerId: providerId ? String(providerId) : undefined };
  } catch (err: any) {
    const reason = err?.message ?? String(err);
    await logCommunication(adminId, to, message, "failed", reason.slice(0, 500));
    logger.warn({ err, key, adminId }, "sms: send failed");
    return { ok: false, error: reason };
  }
}

/** Fire-and-forget convenience wrapper. */
export function sendSmsAsync(input: SendSmsInput): void {
  void sendSms(input).catch((err) => logger.warn({ err, key: input.key }, "sendSmsAsync failed"));
}
