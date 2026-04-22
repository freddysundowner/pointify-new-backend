import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { admins, smsCreditTransactions, settings } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { initiateStkPush, getPaymentStatus, normaliseKePhone } from "../lib/sunpay.js";
import { logger } from "../lib/logger.js";
import crypto from "node:crypto";

const router = Router();

// ── Pricing ───────────────────────────────────────────────────────────────────
// Reads `system/settings/sms_pricing` = { pricePerCredit: number } (KES).
// Default: 1 KES per credit.
async function getPricePerCredit(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, "system/settings/sms_pricing") });
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

// ── Top-up: initiate SunPay STK push ──────────────────────────────────────────
// Body: { credits, phone? }
//   - credits: how many SMS credits to buy
//   - phone:   M-Pesa phone to charge (defaults to admin.phone)
// The amount in KES is computed from system/settings/sms_pricing.pricePerCredit.

router.post("/top-up", requireAdmin, async (req, res, next) => {
  try {
    const credits = Number(req.body?.credits);
    if (!Number.isFinite(credits) || credits <= 0) throw badRequest("credits must be a positive number");

    const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
    if (!admin) throw notFound("Admin not found");

    const phoneRaw = req.body?.phone ?? admin.phone;
    if (!phoneRaw) throw badRequest("phone required (no phone on admin profile)");
    const phone = normaliseKePhone(String(phoneRaw));

    const pricePerCredit = await getPricePerCredit();
    const amount = Math.round(credits * pricePerCredit);
    if (amount < 1) throw badRequest("computed amount is below KES 1");

    // Unique reference our system will recognise on the callback.
    const externalRef = `SMSTOPUP-${admin.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Persist intent BEFORE calling gateway so the callback always finds it.
    const intentName = `sunpay_intent:${externalRef}`;
    await db.insert(settings).values({
      name: intentName,
      setting: {
        adminId: admin.id,
        credits,
        amount,
        pricePerCredit,
        phone,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    });

    const baseUrl = publicBaseUrl();
    const callbackUrl = baseUrl ? `${baseUrl}/api/payments/sunpay/callback/${externalRef}` : undefined;

    const result = await initiateStkPush({ phone, amount, externalRef, callbackUrl });
    if (!result.ok) {
      // Mark intent as failed-to-initiate but keep it for audit.
      await db.update(settings)
        .set({ setting: { adminId: admin.id, credits, amount, pricePerCredit, phone, status: "init_failed", error: result.message, createdAt: new Date().toISOString() } })
        .where(eq(settings.name, intentName));
      throw badRequest(`Could not start STK push: ${result.message ?? "unknown error"}`);
    }

    // Save gateway IDs onto the intent for later polling/lookup.
    await db.update(settings)
      .set({
        setting: {
          adminId: admin.id,
          credits,
          amount,
          pricePerCredit,
          phone,
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
      amount,
      credits,
      phone,
      status: "pending",
      message: "STK push sent — confirm the prompt on your phone. Credits will be added once SunPay confirms payment.",
    });
  } catch (e) { next(e); }
});

// ── Top-up: status check (polled by client) ───────────────────────────────────

router.get("/top-up/:ref", requireAdmin, async (req, res, next) => {
  try {
    const externalRef = String(req.params["ref"]);
    const intentName = `sunpay_intent:${externalRef}`;
    const intentRow = await db.query.settings.findFirst({ where: eq(settings.name, intentName) });
    if (!intentRow) throw notFound("Top-up intent not found");
    const intent = intentRow.setting as Record<string, unknown>;
    if (intent["adminId"] !== req.admin!.id) throw notFound("Top-up intent not found");

    // If still pending, poll SunPay so the client gets fresh state without
    // having to wait for the webhook.
    if (intent["status"] === "pending" && intent["transactionId"]) {
      try {
        const live = await getPaymentStatus(String(intent["transactionId"]));
        if (live.ok && live.status && live.status !== "pending") {
          // Process the resolution exactly like a webhook would.
          await applyResolution(externalRef, live.status, live.mpesaRef);
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
// Exported so the SunPay webhook handler can also call it.
export async function applyResolution(externalRef: string, status: string, mpesaRef?: string): Promise<{ credited: boolean; reason?: string }> {
  const intentName = `sunpay_intent:${externalRef}`;
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

  const adminId = Number(intent["adminId"]);
  const credits = Number(intent["credits"]);
  const amount = Number(intent["amount"]);

  // Atomic credit + ledger insert + intent flip.
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
      description: `Purchased ${credits} credits via SunPay M-Pesa for KES ${amount}${mpesaRef ? ` (M-Pesa: ${mpesaRef})` : ""}`,
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
