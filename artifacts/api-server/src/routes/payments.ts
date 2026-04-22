import { Router } from "express";
import { ok } from "../lib/response.js";
import { logger } from "../lib/logger.js";

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

export default router;
