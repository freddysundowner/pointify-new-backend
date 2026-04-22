import { Router, raw } from "express";
import { eq } from "drizzle-orm";
import { paymentMethods, settings } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { applyResolution } from "./sms.js";
import { parseSunPayConfig, verifyWebhookSignature } from "../lib/sunpay.js";

const router = Router();

function logWebhook(provider: string, kind: string, body: unknown, headers: unknown) {
  logger.info({ provider, kind, body, headers }, `payment webhook received: ${provider}/${kind}`);
}

// ── M-Pesa ────────────────────────────────────────────────────────────────────

router.post("/mpesa/callback", (req, res) => {
  logWebhook("mpesa", "callback", req.body, req.headers);
  return ok(res, { ResultCode: 0, ResultDesc: "Accepted", note: "Stub M-Pesa STK callback handler — payload logged." });
});

router.post("/mpesa/validation", (req, res) => {
  logWebhook("mpesa", "validation", req.body, req.headers);
  return ok(res, { ResultCode: 0, ResultDesc: "Accepted", note: "Stub M-Pesa C2B validation handler — payload logged." });
});

router.post("/mpesa/confirmation", (req, res) => {
  logWebhook("mpesa", "confirmation", req.body, req.headers);
  return ok(res, { ResultCode: 0, ResultDesc: "Accepted", note: "Stub M-Pesa C2B confirmation handler — payload logged." });
});

// ── Paystack ──────────────────────────────────────────────────────────────────

router.post("/paystack/webhook", (req, res) => {
  logWebhook("paystack", "webhook", req.body, req.headers);
  return ok(res, { received: true, note: "Stub Paystack webhook — payload logged." });
});

// ── Stripe ────────────────────────────────────────────────────────────────────

router.post("/stripe/webhook", (req, res) => {
  logWebhook("stripe", "webhook", req.body, req.headers);
  return ok(res, { received: true, note: "Stub Stripe webhook — payload logged." });
});

// ── SunPay (https://sunpay.co.ke) ────────────────────────────────────────────
// Each payment_methods row with gateway="sunpay" carries its own apiKey and
// optional webhookSecret in its `config` jsonb. We resolve per-intent which
// method owns the inbound webhook so the right secret is used to verify.

// Helper: look up the payment method that issued this externalRef via the
// pending/completed intent we stored at initiation time.
async function methodForRef(externalRef: string): Promise<{ config: ReturnType<typeof parseSunPayConfig> } | null> {
  const intentName = `sunpay_intent:${externalRef}`;
  const intentRow = await db.query.settings.findFirst({ where: eq(settings.name, intentName) });
  if (!intentRow) return null;
  const intent = intentRow.setting as Record<string, unknown>;
  const mid = Number(intent["paymentMethodId"]);
  if (!Number.isFinite(mid)) return null;
  const method = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, mid) });
  if (!method) return null;
  return { config: parseSunPayConfig(method.config) };
}

// 1) Per-transaction callbackUrl — plain POST, no signature.
router.post("/sunpay/callback/:ref", async (req, res, next) => {
  try {
    const externalRef = String(req.params["ref"]);
    const body = (req.body ?? {}) as Record<string, unknown>;
    logWebhook("sunpay", `callback:${externalRef}`, body, req.headers);
    const status = String(body["status"] ?? "");
    const mpesaRef = body["mpesaRef"] ? String(body["mpesaRef"]) : undefined;
    const result = await applyResolution(externalRef, status, mpesaRef);
    return ok(res, { received: true, ...result });
  } catch (err) { next(err); }
});

// 2) Account-wide registered webhook — HMAC-SHA256 signed.
router.post(
  "/sunpay/webhook",
  raw({ type: "application/json", limit: "1mb" }),
  async (req, res, next) => {
    try {
      const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
      const sig = String(req.headers["x-webhook-signature"] ?? "");

      let parsed: any = {};
      try { parsed = JSON.parse(rawBody.toString("utf8") || "{}"); } catch { parsed = {}; }
      const data = parsed?.data ?? {};
      const externalRef = String(data?.externalRef ?? "");

      // Look up which payment method issued this — needed for signature secret.
      const meta = externalRef ? await methodForRef(externalRef) : null;
      const cfg = meta?.config;
      if (cfg?.webhookSecret) {
        if (!verifyWebhookSignature(rawBody, sig, cfg.webhookSecret)) {
          logger.warn({ externalRef }, "sunpay webhook signature invalid");
          return res.status(401).json({ error: "invalid signature" });
        }
      }
      logWebhook("sunpay", "webhook", parsed, req.headers);

      if (externalRef.startsWith("SMSTOPUP-")) {
        const status = String(data?.status ?? "");
        const mpesaRef = data?.mpesaRef ? String(data.mpesaRef) : undefined;
        const result = await applyResolution(externalRef, status, mpesaRef);
        return ok(res, { received: true, ...result });
      }
      return ok(res, { received: true, ignored: true });
    } catch (err) { next(err); }
  },
);

export default router;
