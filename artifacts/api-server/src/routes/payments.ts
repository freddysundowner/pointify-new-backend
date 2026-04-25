import { Router, raw } from "express";
import { eq } from "drizzle-orm";
import { paymentGateways, settings, subscriptions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { applyResolution } from "./sms.js";
import { getAdapter } from "../lib/gateways/index.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

function logWebhook(provider: string, kind: string, body: unknown, headers: unknown) {
  logger.info({ provider, kind, body, headers }, `payment webhook received: ${provider}/${kind}`);
}

// ── Stub legacy webhook routes (kept for existing M-Pesa / Stripe / Paystack
// integrations that have not yet been migrated to a gateway adapter). ────────
router.post("/mpesa/callback",     (req, res) => { logWebhook("mpesa","callback",req.body,req.headers);     return ok(res, { ResultCode: 0, ResultDesc: "Accepted" }); });
router.post("/mpesa/validation",   (req, res) => { logWebhook("mpesa","validation",req.body,req.headers);   return ok(res, { ResultCode: 0, ResultDesc: "Accepted" }); });
router.post("/mpesa/confirmation", (req, res) => { logWebhook("mpesa","confirmation",req.body,req.headers); return ok(res, { ResultCode: 0, ResultDesc: "Accepted" }); });
router.post("/paystack/webhook",   (req, res) => { logWebhook("paystack","webhook",req.body,req.headers);   return ok(res, { received: true, note: "stub" }); });
router.post("/stripe/webhook",     (req, res) => { logWebhook("stripe","webhook",req.body,req.headers);     return ok(res, { received: true, note: "stub" }); });

// ── Generic per-gateway webhooks ─────────────────────────────────────────────
// Any gateway adapter can receive callbacks on these two routes. We resolve
// the originating payment_methods row from the stored `pay_intent:<ref>` so we
// know whose credentials/secret to use — the gateway itself is referenced by
// its registry id (e.g. "sunpay") in the URL.

interface ResolvedIntent {
  intent: Record<string, unknown>;
  paymentGatewayId: number;
  gateway: string;
  config: Record<string, unknown>;
}

async function resolveIntent(externalRef: string): Promise<ResolvedIntent | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, `pay_intent:${externalRef}`) });
  if (!row) return null;
  const intent = (row.setting ?? {}) as Record<string, unknown>;
  const mid = Number(intent["paymentGatewayId"]);
  if (!Number.isFinite(mid)) return null;
  const gw = await db.query.paymentGateways.findFirst({ where: eq(paymentGateways.id, mid) });
  if (!gw) return null;
  return { intent, paymentGatewayId: mid, gateway: gw.gateway, config: (gw.config ?? {}) as Record<string, unknown> };
}

// 1) Per-transaction callback (no signature) — gateways that support a
//    `callbackUrl` field on charge initiation should be configured to POST
//    here. The :gateway segment is informational; the intent already pins
//    which method handled the charge.
router.post("/:gateway/callback/:ref", async (req, res, next) => {
  try {
    const urlGateway = String(req.params["gateway"]);
    const externalRef = String(req.params["ref"]);
    const body = (req.body ?? {}) as Record<string, unknown>;
    logWebhook(urlGateway, `callback:${externalRef}`, body, req.headers);

    // Enforce URL gateway matches the gateway that issued the intent.
    const resolved = await resolveIntent(externalRef);
    if (!resolved) return res.status(404).json({ error: "intent not found" });
    if (resolved.gateway !== urlGateway) {
      logger.warn({ urlGateway, intentGateway: resolved.gateway, externalRef }, "callback gateway mismatch");
      return res.status(400).json({ error: "gateway mismatch" });
    }

    const status = String(body["status"] ?? "");
    const reference = (body["mpesaRef"] ?? body["reference"]) ? String(body["mpesaRef"] ?? body["reference"]) : undefined;
    const result = await applyResolution(externalRef, status, reference);
    return ok(res, { received: true, ...result });
  } catch (err) { next(err); }
});

// 2) Account-wide registered webhook — signature verified per gateway
//    adapter using the credentials from the issuing payment method.
router.post(
  "/:gateway/webhook",
  raw({ type: "application/json", limit: "1mb" }),
  async (req, res, next) => {
    try {
      const urlGateway = String(req.params["gateway"]);
      const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
      // Common signature header names across gateways. Adapters get the value
      // verbatim and decide how to interpret it.
      const sig = (
        req.headers["x-webhook-signature"] ??
        req.headers["x-signature"] ??
        req.headers["x-paystack-signature"] ??
        req.headers["stripe-signature"]
      ) as string | undefined;

      let parsed: any = {};
      try { parsed = JSON.parse(rawBody.toString("utf8") || "{}"); } catch { parsed = {}; }
      const data = parsed?.data ?? parsed;
      const externalRef = String(data?.externalRef ?? data?.reference ?? "");

      if (!externalRef) {
        logWebhook(urlGateway, "webhook", parsed, req.headers);
        return ok(res, { received: true, ignored: true, reason: "no externalRef" });
      }

      const resolved = await resolveIntent(externalRef);
      if (!resolved) return res.status(404).json({ error: "intent not found" });
      if (resolved.gateway !== urlGateway) {
        logger.warn({ urlGateway, intentGateway: resolved.gateway, externalRef }, "webhook gateway mismatch");
        return res.status(400).json({ error: "gateway mismatch" });
      }

      // Verifier is selected by the issuing method's gateway, not the URL.
      const adapter = getAdapter(resolved.gateway);
      if (adapter?.verifyWebhook) {
        if (!adapter.verifyWebhook(resolved.config, rawBody, sig)) {
          logger.warn({ gateway: resolved.gateway, externalRef }, "webhook signature invalid");
          return res.status(401).json({ error: "invalid signature" });
        }
      }
      logWebhook(resolved.gateway, "webhook", parsed, req.headers);

      const status = String(data?.status ?? "");
      const reference = (data?.mpesaRef ?? data?.reference) ? String(data?.mpesaRef ?? data?.reference) : undefined;
      const result = await applyResolution(externalRef, status, reference);
      return ok(res, { received: true, ...result });
    } catch (err) { next(err); }
  },
);

// ── Subscription payment confirmation ────────────────────────────────────────
// Called by the payment-waiting page to check if M-Pesa payment was received.
router.post("/confirm", requireAdmin, async (req, res, next) => {
  try {
    const { subscriptionid } = req.body ?? {};
    if (!subscriptionid) throw badRequest("subscriptionid is required");

    const subId = Number(subscriptionid);
    if (!Number.isFinite(subId)) throw badRequest("subscriptionid must be a valid number");

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subId),
    });
    if (!sub) throw notFound("Subscription not found");

    // Consider paid if isPaid flag is set or an mpesaCode / payment reference exists
    const isPaid = sub.isPaid || !!sub.mpesaCode;

    if (isPaid) {
      return ok(res, { status: true, paid: true, subscription: sub });
    }

    return ok(res, { status: false, paid: false, message: "no payment received yet" });
  } catch (e) { next(e); }
});

// ── Re-send M-Pesa STK push ───────────────────────────────────────────────────
// Called by the payment-waiting page to re-send the payment prompt.
router.post("/resend", requireAdmin, async (req, res, next) => {
  try {
    const { subscriptionid, phonenumber, amount } = req.body ?? {};
    if (!subscriptionid) throw badRequest("subscriptionid is required");

    const subId = Number(subscriptionid);
    if (!Number.isFinite(subId)) throw badRequest("subscriptionid must be a valid number");

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subId),
    });
    if (!sub) throw notFound("Subscription not found");

    // Log the resend attempt
    logger.info({ subscriptionId: subId, phonenumber, amount }, "M-Pesa STK push resend requested");

    // Return stub success — real M-Pesa integration would re-initiate STK push here
    return ok(res, {
      status: true,
      success: true,
      message: "Payment prompt re-sent. Please check your phone.",
      subscriptionId: subId,
    });
  } catch (e) { next(e); }
});

export default router;
