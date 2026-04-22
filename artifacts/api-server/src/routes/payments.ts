import { Router, raw } from "express";
import { ok } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { applyResolution } from "./sms.js";
import { getSunPayConfig, verifyWebhookSignature } from "../lib/sunpay.js";

const router = Router();

function logWebhook(provider: string, kind: string, body: unknown, headers: unknown) {
  logger.info({ provider, kind, body, headers }, `payment webhook received: ${provider}/${kind}`);
}

// ── M-Pesa ────────────────────────────────────────────────────────────────────

router.post("/mpesa/callback", (req, res) => {
  logWebhook("mpesa", "callback", req.body, req.headers);
  return ok(res, {
    ResultCode: 0,
    ResultDesc: "Accepted",
    note: "Stub M-Pesa STK callback handler — payload logged.",
  });
});

router.post("/mpesa/validation", (req, res) => {
  logWebhook("mpesa", "validation", req.body, req.headers);
  return ok(res, {
    ResultCode: 0,
    ResultDesc: "Accepted",
    note: "Stub M-Pesa C2B validation handler — payload logged.",
  });
});

router.post("/mpesa/confirmation", (req, res) => {
  logWebhook("mpesa", "confirmation", req.body, req.headers);
  return ok(res, {
    ResultCode: 0,
    ResultDesc: "Accepted",
    note: "Stub M-Pesa C2B confirmation handler — payload logged.",
  });
});

// ── Paystack ──────────────────────────────────────────────────────────────────

router.post("/paystack/webhook", (req, res) => {
  logWebhook("paystack", "webhook", req.body, req.headers);
  return ok(res, {
    received: true,
    note: "Stub Paystack webhook — payload logged.",
  });
});

// ── Stripe ────────────────────────────────────────────────────────────────────

router.post("/stripe/webhook", (req, res) => {
  logWebhook("stripe", "webhook", req.body, req.headers);
  return ok(res, {
    received: true,
    note: "Stub Stripe webhook — payload logged.",
  });
});


// ── SunPay (https://sunpay.co.ke) ────────────────────────────────────────────
// Two delivery modes documented by SunPay:
//   1) Per-transaction `callbackUrl` — plain POST, no signature, fires only
//      for that specific transaction. We register one of these per top-up
//      keyed by externalRef so we can credit the right admin idempotently.
//   2) Registered webhook — signed with HMAC-SHA256 in X-Webhook-Signature,
//      account-wide. Verified against system/settings/sunpay.webhookSecret.

router.post("/sunpay/callback/:ref", async (req, res, next) => {
  try {
    const externalRef = String(req.params["ref"]);
    const body = (req.body ?? {}) as Record<string, unknown>;
    logWebhook("sunpay", `callback:${externalRef}`, body, req.headers);
    // Per-transaction callback payload is the raw `data` object directly.
    const status = String(body["status"] ?? "");
    const mpesaRef = body["mpesaRef"] ? String(body["mpesaRef"]) : undefined;
    const result = await applyResolution(externalRef, status, mpesaRef);
    return ok(res, { received: true, ...result });
  } catch (err) { next(err); }
});

router.post(
  "/sunpay/webhook",
  raw({ type: "application/json", limit: "1mb" }),
  async (req, res, next) => {
    try {
      const cfg = await getSunPayConfig();
      const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
      const sig = String(req.headers["x-webhook-signature"] ?? "");
      if (cfg?.webhookSecret) {
        if (!verifyWebhookSignature(rawBody, sig, cfg.webhookSecret)) {
          logger.warn({ sig }, "sunpay webhook signature invalid");
          return res.status(401).json({ error: "invalid signature" });
        }
      }
      let parsed: any = null;
      try { parsed = JSON.parse(rawBody.toString("utf8") || "{}"); } catch { parsed = {}; }
      logWebhook("sunpay", "webhook", parsed, req.headers);
      const data = parsed?.data ?? {};
      const externalRef = String(data?.externalRef ?? "");
      if (externalRef.startsWith("SMSTOPUP-")) {
        const status = String(data?.status ?? "");
        const mpesaRef = data?.mpesaRef ? String(data.mpesaRef) : undefined;
        const result = await applyResolution(externalRef, status, mpesaRef);
        return ok(res, { received: true, ...result });
      }
      // Other event types (subscriptions, manual C2B, etc.) — just log.
      return ok(res, { received: true, ignored: true });
    } catch (err) { next(err); }
  },
);

export default router;
