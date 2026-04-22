// SunPay (https://sunpay.co.ke) M-Pesa gateway adapter.
//
// Reads config from `system/settings/sunpay`:
//   { apiKey, baseUrl?, webhookSecret? }
//
// - apiKey:        SunPay API key (starts with `sp_`)
// - baseUrl:       defaults to "https://api.sunpay.co.ke/api/v1"
// - webhookSecret: only required if you also enable a registered webhook
//                  in SunPay Settings → Webhooks (HMAC-SHA256 verification).
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { settings } from "@workspace/db";
import { db } from "./db.js";
import { logger } from "./logger.js";

export interface SunPayConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret?: string;
}

let cachedCfg: SunPayConfig | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export function invalidateSunPayCache() {
  cachedCfg = null;
  cachedAt = 0;
}

export async function getSunPayConfig(): Promise<SunPayConfig | null> {
  if (cachedCfg && Date.now() - cachedAt < CACHE_MS) return cachedCfg;
  const row = await db.query.settings.findFirst({ where: eq(settings.name, "system/settings/sunpay") });
  const v = (row?.setting as Record<string, unknown> | undefined) ?? {};
  const apiKey = String(v["apiKey"] ?? "").trim();
  if (!apiKey) return null;
  cachedCfg = {
    apiKey,
    baseUrl: String(v["baseUrl"] ?? "https://api.sunpay.co.ke/api/v1").replace(/\/+$/, ""),
    webhookSecret: v["webhookSecret"] ? String(v["webhookSecret"]) : undefined,
  };
  cachedAt = Date.now();
  return cachedCfg;
}

// Normalise to 254XXXXXXXXX as SunPay expects.
export function normaliseKePhone(input: string): string {
  const digits = String(input ?? "").replace(/\D+/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export interface StkPushArgs {
  phone: string;
  amount: number;
  externalRef: string;
  callbackUrl?: string;
}

export interface StkPushResult {
  ok: boolean;
  status: number;
  transactionId?: string;
  checkoutRequestId?: string;
  message?: string;
  raw?: unknown;
}

export async function initiateStkPush(args: StkPushArgs): Promise<StkPushResult> {
  const cfg = await getSunPayConfig();
  if (!cfg) return { ok: false, status: 0, message: "SunPay not configured (set system/settings/sunpay.apiKey)" };

  const body = {
    phoneNumber: normaliseKePhone(args.phone),
    amount: Number(args.amount),
    externalRef: args.externalRef,
    ...(args.callbackUrl ? { callbackUrl: args.callbackUrl } : {}),
  };
  try {
    const resp = await fetch(`${cfg.baseUrl}/payments/stk-push`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
    if (!resp.ok || !json?.success) {
      logger.warn({ status: resp.status, body: json ?? text, ref: args.externalRef }, "sunpay stk-push failed");
      return { ok: false, status: resp.status, message: json?.message ?? text?.slice(0, 200), raw: json ?? text };
    }
    return {
      ok: true,
      status: resp.status,
      transactionId: json.transactionId,
      checkoutRequestId: json.checkoutRequestId,
      message: json.message,
      raw: json,
    };
  } catch (err) {
    logger.error({ err, ref: args.externalRef }, "sunpay stk-push exception");
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "network error" };
  }
}

export interface PaymentStatus {
  ok: boolean;
  id?: string;
  status?: "pending" | "completed" | "failed" | string;
  amount?: string;
  phoneNumber?: string;
  mpesaRef?: string;
  raw?: unknown;
  message?: string;
}

export async function getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
  const cfg = await getSunPayConfig();
  if (!cfg) return { ok: false, message: "SunPay not configured" };
  try {
    const resp = await fetch(`${cfg.baseUrl}/payments/${encodeURIComponent(transactionId)}`, {
      headers: { "Authorization": `Bearer ${cfg.apiKey}` },
    });
    const json = (await resp.json().catch(() => null)) as any;
    if (!resp.ok || !json) return { ok: false, message: json?.message ?? `HTTP ${resp.status}`, raw: json };
    return {
      ok: true,
      id: json.id,
      status: json.status,
      amount: json.amount,
      phoneNumber: json.phoneNumber,
      mpesaRef: json.mpesaRef,
      raw: json,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "network error" };
  }
}

// HMAC-SHA256 verification for the registered (account-wide) webhook.
// Pass the raw request body bytes — NOT the parsed JSON.
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret)
    .update(typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody)
    .digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}
