import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  subscriptions, subscriptionShops, packages, packageFeatures, admins, shops
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, unauthorized } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

// ── Packages (read-only for all admins, write for super-admin) ────────────────

router.get("/packages", async (req, res, next) => {
  try {
    const rows = await db.query.packages.findMany({
      where: eq(packages.isActive, true),
      orderBy: (p, { asc }) => [asc(p.sortOrder)],
      with: { packageFeatures: true },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/packages", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { title, description, durationValue, durationUnit, amount, amountUsd, type, shops: maxShops, discount, sortOrder } = req.body;
    if (!title || !durationValue || !durationUnit || !amount || !amountUsd || !type) {
      throw badRequest("title, durationValue, durationUnit, amount, amountUsd, type required");
    }
    const [pkg] = await db.insert(packages).values({
      title, description, durationValue, durationUnit,
      amount: String(amount), amountUsd: String(amountUsd),
      type, shops: maxShops ?? null,
      discount: discount ? String(discount) : "0",
      sortOrder: sortOrder ?? 0,
    }).returning();
    return created(res, pkg);
  } catch (e) { next(e); }
});

router.put("/packages/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { title, description, durationValue, durationUnit, amount, amountUsd, isActive, sortOrder, discount } = req.body;
    const [updated] = await db.update(packages).set({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(durationValue !== undefined && { durationValue }),
      ...(durationUnit && { durationUnit }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(amountUsd !== undefined && { amountUsd: String(amountUsd) }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(discount !== undefined && { discount: String(discount) }),
    }).where(eq(packages.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Package not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/packages/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    await db.delete(packages).where(eq(packages.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/packages/:id/features", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { features } = req.body;
    if (!features?.length) throw badRequest("features array required");

    const rows = await db.insert(packageFeatures).values(
      features.map((feature: string) => ({ package: Number(req.params["id"]), feature }))
    ).returning();
    return created(res, rows);
  } catch (e) { next(e); }
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const adminId = req.admin!.isSuperAdmin
      ? (req.query["adminId"] ? Number(req.query["adminId"]) : null)
      : req.admin!.id;

    const conditions = [];
    if (adminId) conditions.push(eq(subscriptions.admin, adminId));
    const where = conditions[0];

    const rows = await db.query.subscriptions.findMany({
      where,
      limit,
      offset,
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      with: { package: true, subscriptionShops: true },
    });
    const total = await db.$count(subscriptions, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { packageId, shopIds, mpesaCode, currency } = req.body;
    if (!packageId || !shopIds?.length) throw badRequest("packageId and shopIds required");

    const pkg = await db.query.packages.findFirst({ where: eq(packages.id, Number(packageId)) });
    if (!pkg) throw notFound("Package not found");

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (pkg.durationUnit === "days") endDate.setDate(endDate.getDate() + pkg.durationValue);
    else if (pkg.durationUnit === "weeks") endDate.setDate(endDate.getDate() + pkg.durationValue * 7);
    else if (pkg.durationUnit === "months") endDate.setMonth(endDate.getMonth() + pkg.durationValue);
    else if (pkg.durationUnit === "years") endDate.setFullYear(endDate.getFullYear() + pkg.durationValue);

    const primaryShopId = Number(shopIds[0]);
    const [sub] = await db.insert(subscriptions).values({
      admin: req.admin!.id,
      shop: primaryShopId,
      package: Number(packageId),
      amount: pkg.amount,
      currency: currency ?? "kes",
      startDate,
      endDate,
      mpesaCode: mpesaCode ?? null,
      invoiceNo: `INV${Date.now()}`,
    }).returning();

    const shopLinks = await db.insert(subscriptionShops).values(
      shopIds.map((id: number) => ({ subscription: sub.id, shop: Number(id) }))
    ).onConflictDoNothing().returning();

    return created(res, { ...sub, shops: shopLinks });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, Number(req.params["id"])),
      with: { package: true, subscriptionShops: true },
    });
    if (!sub) throw notFound("Subscription not found");
    return ok(res, sub);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { isActive, isPaid, endDate } = req.body;
    const [updated] = await db.update(subscriptions).set({
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(isPaid !== undefined && { isPaid: Boolean(isPaid) }),
      ...(endDate && { endDate: new Date(endDate) }),
    }).where(eq(subscriptions.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Subscription not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    await db.delete(subscriptions).where(eq(subscriptions.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/assign-shops", requireAdmin, async (req, res, next) => {
  try {
    const { subscriptionId, shopIds } = req.body;
    if (!subscriptionId || !shopIds?.length) throw badRequest("subscriptionId and shopIds required");

    await db.delete(subscriptionShops).where(eq(subscriptionShops.subscription, Number(subscriptionId)));
    const rows = await db.insert(subscriptionShops).values(
      shopIds.map((id: number) => ({ subscription: Number(subscriptionId), shop: Number(id) }))
    ).returning();
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Subscription Payment Gateways ─────────────────────────────────────────────

async function loadSubscriptionForPayment(id: number) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, id),
    with: { package: true },
  });
  if (!sub) throw notFound("Subscription not found");
  return sub;
}

async function markSubscriptionPaid(id: number, mpesaCode?: string | null) {
  const [updated] = await db
    .update(subscriptions)
    .set({
      isPaid: true,
      isActive: true,
      ...(mpesaCode ? { mpesaCode } : {}),
    })
    .where(eq(subscriptions.id, id))
    .returning();
  return updated;
}

router.post("/:id/pay", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const sub = await loadSubscriptionForPayment(id);
    const { paymentMethod, paymentReference, mpesaCode } = req.body ?? {};
    const updated = await markSubscriptionPaid(id, mpesaCode ?? paymentReference ?? null);
    return ok(res, {
      subscription: updated,
      payment: {
        gateway: paymentMethod ?? "manual",
        status: "completed",
        reference: paymentReference ?? mpesaCode ?? `PAY${Date.now()}`,
        amount: sub.amount,
        currency: sub.currency,
      },
      note: "Stub payment processor — no real gateway call.",
    });
  } catch (e) { next(e); }
});

router.post("/:id/pay/mpesa", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const sub = await loadSubscriptionForPayment(id);
    const { phone, mpesaCode } = req.body ?? {};
    const checkoutRequestId = `ws_CO_${Date.now()}`;
    if (mpesaCode) {
      const updated = await markSubscriptionPaid(id, mpesaCode);
      return ok(res, {
        subscription: updated,
        payment: {
          gateway: "mpesa",
          status: "completed",
          checkoutRequestId,
          mpesaCode,
          amount: sub.amount,
          currency: sub.currency,
        },
        note: "Stub M-Pesa confirmation.",
      });
    }
    return ok(res, {
      subscription: sub,
      payment: {
        gateway: "mpesa",
        status: "pending",
        checkoutRequestId,
        merchantRequestId: `mr_${Date.now()}`,
        phone: phone ?? null,
        amount: sub.amount,
        currency: sub.currency,
      },
      note: "Stub M-Pesa STK push initiated.",
    });
  } catch (e) { next(e); }
});

router.post("/:id/pay/paystack", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const sub = await loadSubscriptionForPayment(id);
    const { email } = req.body ?? {};
    const reference = `ps_${Date.now()}`;
    return ok(res, {
      subscription: sub,
      payment: {
        gateway: "paystack",
        status: "pending",
        reference,
        authorizationUrl: `https://checkout.paystack.com/${reference}`,
        accessCode: reference,
        email: email ?? null,
        amount: sub.amount,
        currency: sub.currency,
      },
      note: "Stub Paystack checkout initialised.",
    });
  } catch (e) { next(e); }
});

router.post("/:id/pay/stripe", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const sub = await loadSubscriptionForPayment(id);
    const sessionId = `cs_test_${Date.now()}`;
    return ok(res, {
      subscription: sub,
      payment: {
        gateway: "stripe",
        status: "pending",
        sessionId,
        checkoutUrl: `https://checkout.stripe.com/c/pay/${sessionId}`,
        amount: sub.amount,
        currency: sub.currency,
      },
      note: "Stub Stripe Checkout session created.",
    });
  } catch (e) { next(e); }
});

router.get("/admin/summary", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (from) conditions.push(gte(subscriptions.createdAt, from));
    if (to) conditions.push(lte(subscriptions.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [summary] = await db.select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN ${subscriptions.isActive} = true THEN 1 ELSE 0 END)`,
      revenue: sql<string>`SUM(CASE WHEN ${subscriptions.isPaid} = true THEN ${subscriptions.amount}::numeric ELSE 0 END)`,
    }).from(subscriptions).where(where);

    return ok(res, summary);
  } catch (e) { next(e); }
});

export default router;
