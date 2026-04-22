// SunPay (https://sunpay.co.ke) adapter — implements the GatewayAdapter
// contract. Credentials are read out of the per-method `config` jsonb at
// call-time; nothing is hard-coded.
import crypto from "node:crypto";
import { logger } from "../logger.js";
import type { GatewayAdapter, ChargeArgs, ChargeResult, StatusResult } from "./types.js";

interface ParsedConfig { apiKey: string; baseUrl: string; webhookSecret?: string; }
function parse(config: Record<string, unknown>): ParsedConfig | null {
  const apiKey = String(config?.["apiKey"] ?? "").trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: String(config?.["baseUrl"] ?? "https://sunpay.co.ke/api/v1").replace(/\/+$/, ""),
    webhookSecret: config?.["webhookSecret"] ? String(config["webhookSecret"]) : undefined,
  };
}

// Normalise to 254XXXXXXXXX as SunPay expects.
export function normaliseKePhone(input: string): string {
  const digits = String(input ?? "").replace(/\D+/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export const sunpayAdapter: GatewayAdapter = {
  id: "sunpay",

  async charge(config, args: ChargeArgs): Promise<ChargeResult> {
    const cfg = parse(config);
    if (!cfg) return { ok: false, status: "failed", message: "SunPay payment method missing apiKey" };
    if (!args.phone) return { ok: false, status: "failed", message: "phone required for SunPay STK push" };

    const body = {
      phoneNumber: normaliseKePhone(args.phone),
      amount: Number(args.amount),
      externalRef: args.externalRef,
      ...(args.callbackUrl ? { callbackUrl: args.callbackUrl } : {}),
    };
    try {
      const resp = await fetch(`${cfg.baseUrl}/payments/stk-push`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
      if (!resp.ok || !json?.success) {
        logger.warn({ status: resp.status, body: json ?? text, ref: args.externalRef }, "sunpay charge failed");
        return { ok: false, status: "failed", message: json?.message ?? text?.slice(0, 200), raw: json ?? text };
      }
      return {
        ok: true,
        status: "pending",
        transactionId: json.transactionId,
        checkoutRequestId: json.checkoutRequestId,
        message: json.message,
        raw: json,
      };
    } catch (err) {
      logger.error({ err, ref: args.externalRef }, "sunpay charge exception");
      return { ok: false, status: "failed", message: err instanceof Error ? err.message : "network error" };
    }
  },

  async getStatus(config, transactionId): Promise<StatusResult> {
    const cfg = parse(config);
    if (!cfg) return { ok: false, message: "SunPay payment method missing apiKey" };
    try {
      const resp = await fetch(`${cfg.baseUrl}/payments/${encodeURIComponent(transactionId)}`, {
        headers: { "Authorization": `Bearer ${cfg.apiKey}` },
      });
      const json = (await resp.json().catch(() => null)) as any;
      if (!resp.ok || !json) return { ok: false, message: json?.message ?? `HTTP ${resp.status}`, raw: json };
      return {
        ok: true,
        status: json.status,
        amount: json.amount,
        reference: json.mpesaRef,
        raw: json,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "network error" };
    }
  },

  verifyWebhook(config, rawBody, signatureHeader) {
    const cfg = parse(config);
    if (!cfg?.webhookSecret) return true; // no secret configured → skip verify
    if (!signatureHeader) return false;
    const expected = crypto.createHmac("sha256", cfg.webhookSecret)
      .update(typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody)
      .digest("hex");
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    try { return crypto.timingSafeEqual(a, b); } catch { return false; }
  },
};
