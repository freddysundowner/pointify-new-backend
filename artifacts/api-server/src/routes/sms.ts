import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { admins, smsCreditTransactions, settings } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { chargeWithGateway, getStatusWithGateway, loadGateway } from "../lib/gateways/index.js";
import { logger } from "../lib/logger.js";
import crypto from "node:crypto";

const router = Router();

// ── Pricing ───────────────────────────────────────────────────────────────────
// Reads the settings row named `sms_pricing` = { pricePerCredit: number } (KES).
// (Manage via PUT /api/system/settings/sms_pricing.) Default: 1 KES per credit.
async function getPricePerCredit(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, "sms_pricing") });
  const v = (row?.setting as Record<string, unknown> | undefined) ?? {};
  const p = Number(v["pricePerCredit"] ?? 1);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function publicBaseUrl(): string {
  const explicit = process.env["PUBLIC_URL"]?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const replit = process.env["REPLIT_DEV_DOMAIN"];
  if (replit) return `https://${replit}`;
  return "";
}

// ── Balance ───────────────────────────────────────────────────────────────────

router.get("/balance", requireAdmin, async (req, res, next) => {
  try {
    const admin = await db.query.admins.findFirst({
      where: eq(admins.id, req.admin!.id),
      columns: { smsCredit: true },
    });
    return ok(res, { sms_credit: admin?.smsCredit ?? 0 });
  } catch (e) { next(e); }
});

// ── Top-up: initiate via a configured payment method ──────────────────────────
// Body: { credits | amount, paymentGatewayId, phone? }
//   - credits          : how many SMS credits (=SMSes) to buy. Charge will be
//                        credits * pricePerCredit (KES). Provide this OR amount.
//   - amount           : how much money (KES) to spend. Credits awarded will be
//                        floor(amount / pricePerCredit). Provide this OR credits.
//   - paymentGatewayId : id of a row in payment_gateways. Drives how the charge
//                        is dispatched (only "sunpay" currently triggers STK push).
//   - phone            : M-Pesa phone to charge (defaults to admin.phone)

router.post("/top-up", requireAdmin, async (req, res, next) => {
  try {
    const rawCredits = req.body?.credits;
    const rawAmount = req.body?.amount;
    const hasCredits = rawCredits !== undefined && rawCredits !== null && rawCredits !== "";
    const hasAmount = rawAmount !== undefined && rawAmount !== null && rawAmount !== "";
    if (hasCredits && hasAmount) throw badRequest("Provide either credits or amount, not both");
    if (!hasCredits && !hasAmount) throw badRequest("Provide credits or amount");

    const paymentGatewayId = Number(req.body?.paymentGatewayId);
    if (!Number.isFinite(paymentGatewayId) || paymentGatewayId <= 0) throw badRequest("paymentGatewayId required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
    if (!admin) throw notFound("Admin not found");

    // Resolve the payment method and ensure it's a SunPay one (only online
    // gateway wired for credit purchases right now).
    const gw = await loadGateway(paymentGatewayId);
    if (!gw) throw badRequest("paymentGatewayId is not an active payment gateway or its provider is not supported");

    const phone = String(req.body?.phone ?? admin.phone ?? "");

    const pricePerCredit = await getPricePerCredit();

    const toPositiveInt = (v: unknown, field: string): number => {
      if (typeof v === "boolean") throw badRequest(`${field} must be a positive integer`);
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} must be a positive integer`);
      return n;
    };

    let credits: number;
    let amount: number;
    if (hasCredits) {
      credits = toPositiveInt(rawCredits, "credits");
      amount = Math.round(credits * pricePerCredit);
    } else {
      amount = toPositiveInt(rawAmount, "amount");
      credits = Math.floor(amount / pricePerCredit);
      if (credits < 1) throw badRequest(`amount KES ${amount} is below the price of one SMS (KES ${pricePerCredit})`);
    }
    if (amount < 1) throw badRequest("computed amount is below KES 1");

    const externalRef = `SMSTOPUP-${admin.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const intentName = `pay_intent:${externalRef}`;
    await db.insert(settings).values({
      name: intentName,
      setting: {
        kind: "sms_topup",
        adminId: admin.id,
        paymentGatewayId: gw.id,
        credits,
        amount,
        pricePerCredit,
        phone,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    });

    const baseUrl = publicBaseUrl();
    const callbackUrl = baseUrl ? `${baseUrl}/api/payments/${gw.gateway}/callback/${externalRef}` : undefined;

    const result = await chargeWithGateway(gw.id, { phone, amount, externalRef, callbackUrl, description: `SMS credits x${credits}` });
    if (!result.ok) {
      await db.update(settings)
        .set({
          setting: {
            kind: "sms_topup",
            adminId: admin.id,
            paymentGatewayId: gw.id,
            credits, amount, pricePerCredit, phone,
            status: "init_failed",
            error: result.message,
            createdAt: new Date().toISOString(),
          },
        })
        .where(eq(settings.name, intentName));
      throw badRequest(`Could not start STK push: ${result.message ?? "unknown error"}`);
    }

    await db.update(settings)
      .set({
        setting: {
          kind: "sms_topup",
          adminId: admin.id,
          paymentGatewayId: gw.id,
          credits, amount, pricePerCredit, phone,
          status: "pending",
          transactionId: result.transactionId,
          checkoutRequestId: result.checkoutRequestId,
          createdAt: new Date().toISOString(),
        },
      })
      .where(eq(settings.name, intentName));

    return created(res, {
      externalRef,
      transactionId: result.transactionId,
      checkoutRequestId: result.checkoutRequestId,
      paymentGateway: { id: gw.id, name: gw.name, gateway: gw.gateway },
      amount, credits, pricePerCredit, phone,
      status: "pending",
      message: `STK push sent for KES ${amount} (${credits} SMS @ KES ${pricePerCredit} each). Confirm on your phone.`,
    });
  } catch (e) { next(e); }
});

// ── Top-up: status check (polled by client) ───────────────────────────────────

router.get("/top-up/:ref", requireAdmin, async (req, res, next) => {
  try {
    const externalRef = String(req.params["ref"]);
    const intentName = `pay_intent:${externalRef}`;
    const intentRow = await db.query.settings.findFirst({ where: eq(settings.name, intentName) });
    if (!intentRow) throw notFound("Top-up intent not found");
    const intent = intentRow.setting as Record<string, unknown>;
    if (intent["adminId"] !== req.admin!.id) throw notFound("Top-up intent not found");

    if (intent["status"] === "pending" && intent["transactionId"] && intent["paymentGatewayId"]) {
      try {
        const live = await getStatusWithGateway(Number(intent["paymentGatewayId"]), String(intent["transactionId"]));
        if (live.ok && live.status && live.status !== "pending") {
          await applyResolution(externalRef, live.status, live.reference);
          const refreshed = await db.query.settings.findFirst({ where: eq(settings.name, intentName) });
          return ok(res, refreshed?.setting ?? intent);
        }
      } catch (err) {
        logger.warn({ err, externalRef }, "sunpay status poll failed");
      }
    }

    return ok(res, intent);
  } catch (e) { next(e); }
});

// ── Resolution helper (idempotent) ────────────────────────────────────────────
// Used by the SunPay webhook handler. Applies an SMS top-up if and only if
// the intent is still pending. Safe to call repeatedly.
export async function applyResolution(externalRef: string, status: string, mpesaRef?: string): Promise<{ credited: boolean; reason?: string }> {
  const intentName = `pay_intent:${externalRef}`;
  const intentRow = await db.query.settings.findFirst({ where: eq(settings.name, intentName) });
  if (!intentRow) return { credited: false, reason: "intent not found" };
  const intent = intentRow.setting as Record<string, unknown>;
  if (intent["status"] === "completed" || intent["status"] === "failed") {
    return { credited: false, reason: `already ${intent["status"]}` };
  }
  if (status !== "completed") {
    await db.update(settings)
      .set({ setting: { ...intent, status: "failed", failedAt: new Date().toISOString(), mpesaRef } })
      .where(eq(settings.name, intentName));
    return { credited: false, reason: status };
  }

  const kind = String(intent["kind"] ?? "sms_topup");

  // ── Branch: subscription payment ────────────────────────────────────────
  if (kind === "sub_payment") {
    const { resolveSubscriptionPayment } = await import("./subscriptions.js");
    await resolveSubscriptionPayment(Number(intent["subscriptionId"]), mpesaRef);
    await db.update(settings)
      .set({ setting: { ...intent, status: "completed", completedAt: new Date().toISOString(), mpesaRef } })
      .where(eq(settings.name, intentName));
    return { credited: true };
  }

  if (kind !== "sms_topup") {
    return { credited: false, reason: "unsupported intent kind" };
  }

  const adminId = Number(intent["adminId"]);
  const credits = Number(intent["credits"]);
  const amount = Number(intent["amount"]);

  await db.transaction(async (tx) => {
    const admin = await tx.query.admins.findFirst({ where: eq(admins.id, adminId) });
    if (!admin) throw new Error("admin disappeared");
    const newBalance = (admin.smsCredit ?? 0) + credits;
    await tx.update(admins).set({ smsCredit: newBalance }).where(eq(admins.id, adminId));
    await tx.insert(smsCreditTransactions).values({
      admin: adminId,
      type: "top_up",
      amount: credits,
      balanceAfter: newBalance,
      description: `Purchased ${credits} credits via payment gateway #${intent["paymentGatewayId"]} for KES ${amount}${mpesaRef ? ` (M-Pesa: ${mpesaRef})` : ""}`,
    });
    await tx.update(settings)
      .set({ setting: { ...intent, status: "completed", completedAt: new Date().toISOString(), mpesaRef, balanceAfter: newBalance } })
      .where(eq(settings.name, intentName));
  });
  return { credited: true };
}

// ── Transactions ledger ───────────────────────────────────────────────────────

router.get("/transactions", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const type = req.query["type"] ? String(req.query["type"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conds: any[] = [eq(smsCreditTransactions.admin, req.admin!.id)];
    if (type) conds.push(eq(smsCreditTransactions.type, type));
    if (from) conds.push(gte(smsCreditTransactions.createdAt, from));
    if (to) conds.push(lte(smsCreditTransactions.createdAt, to));
    const where = conds.length > 1 ? and(...conds) : conds[0];

    const rows = await db.query.smsCreditTransactions.findMany({
      where, limit, offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(smsCreditTransactions, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

export default router;
