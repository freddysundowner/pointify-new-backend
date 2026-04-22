import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gte, lte } from "drizzle-orm";
import { affiliates, awards, affiliateTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, unauthorized, conflict } from "../lib/errors.js";
import { requireAdmin, requireAffiliate } from "../middlewares/auth.js";
import { signToken } from "../lib/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifyAffiliateWelcome, notifyAffiliateCommissionEarned, notifyAffiliatePayout } from "../lib/emailEvents.js";
import { smsAffiliateCommissionEarned } from "../lib/smsEvents.js";

const router = Router();

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Affiliate Auth ─────────────────────────────────────────────────────────────

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, address, country } = req.body;
    if (!name || !email || !password) throw badRequest("name, email and password required");

    const existing = await db.query.affiliates.findFirst({ where: eq(affiliates.email, email) });
    if (existing) throw conflict("Email already registered");

    const hashed = await bcrypt.hash(password, 10);
    const [affiliate] = await db.insert(affiliates).values({
      name, email, phone, address, country,
      password: hashed,
      code: makeCode(),
    }).returning();

    const { password: _, otp: __, ...safe } = affiliate;
    const referralUrl = `https://pointify.app/?ref=${safe.code}`;
    notifyAffiliateWelcome(safe, referralUrl);
    return created(res, safe);
  } catch (e) { next(e); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw badRequest("email and password required");

    const affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.email, email) });
    if (!affiliate) throw unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(password, affiliate.password);
    if (!valid) throw unauthorized("Invalid credentials");

    const token = signToken({ role: "affiliate", id: affiliate.id });
    const { password: _, otp: __, ...safe } = affiliate;
    return ok(res, { token, affiliate: safe });
  } catch (e) { next(e); }
});

router.get("/me", requireAffiliate, async (req, res, next) => {
  try {
    const affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, req.affiliate!.id) });
    if (!affiliate) throw notFound("Affiliate not found");
    const { password: _, otp: __, ...safe } = affiliate;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/me", requireAffiliate, async (req, res, next) => {
  try {
    const { name, phone, address, country } = req.body;
    const [updated] = await db.update(affiliates).set({
      ...(name && { name }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(country && { country }),
    }).where(eq(affiliates.id, req.affiliate!.id)).returning();
    if (!updated) throw notFound("Affiliate not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

// ── Affiliate self-service: awards / transactions / withdraw ─────────────────

router.get("/me/awards", requireAffiliate, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conds: any[] = [eq(awards.affiliate, req.affiliate!.id)];
    if (from) conds.push(gte(awards.createdAt, from));
    if (to) conds.push(lte(awards.createdAt, to));
    const where = conds.length > 1 ? and(...conds) : conds[0];

    const rows = await db.query.awards.findMany({
      where, limit, offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(awards, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/me/transactions", requireAffiliate, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const where = eq(affiliateTransactions.affiliate, req.affiliate!.id);
    const rows = await db.query.affiliateTransactions.findMany({
      where, limit, offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(affiliateTransactions, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/me/withdraw", requireAffiliate, async (req, res, next) => {
  try {
    const { amount, paymentType, paymentReference, phone, accountName, accountNumber } = req.body;
    if (amount === undefined || amount === null || amount === "") throw badRequest("amount required");
    const resolvedPaymentType = paymentType ?? "mpesa";

    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, req.affiliate!.id) });
    if (!aff) throw notFound("Affiliate not found");
    if (parseFloat(String(amount)) > parseFloat(aff.wallet)) {
      throw badRequest("Withdrawal amount exceeds wallet balance");
    }

    // Per spec: do NOT decrement wallet — only on admin approval (complete).
    const [tx] = await db.insert(affiliateTransactions).values({
      affiliate: aff.id,
      amount: String(amount),
      affiliateAmount: String(amount),
      balance: aff.wallet,
      type: "withdraw",
      isCompleted: false,
      transId: paymentReference ?? null,
    }).returning();

    notifyAffiliatePayout(aff, {
      payoutAmount: String(amount),
      payoutMethod: resolvedPaymentType,
      payoutReference: paymentReference ?? `WD${tx.id}`,
    });
    return created(res, { ...tx, paymentType: resolvedPaymentType, phone: phone ?? null, accountName: accountName ?? null, accountNumber: accountNumber ?? null });
  } catch (e) { next(e); }
});

// ── Awards ─────────────────────────────────────────────────────────────────────

router.get("/awards", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const affiliateId = req.query["affiliateId"] ? Number(req.query["affiliateId"]) : null;
    const where = affiliateId ? eq(awards.affiliate, affiliateId) : undefined;

    const rows = await db.query.awards.findMany({
      where,
      limit,
      offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(awards, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/awards", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin access required");
    const { affiliateId, amount, type, awardType, shopId } = req.body;
    if (!affiliateId || !amount || !type) throw badRequest("affiliateId, amount and type required");

    const affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, Number(affiliateId)) });
    if (!affiliate) throw notFound("Affiliate not found");

    const commissionAmount = (parseFloat(String(amount)) * parseFloat(affiliate.commission) / 100).toFixed(2);
    const [award] = await db.insert(awards).values({
      affiliate: Number(affiliateId),
      amount: String(amount),
      commissionAmount,
      type,
      awardType,
      shop: shopId ? Number(shopId) : null,
      fromAdmin: req.admin!.id,
      paymentNo: `AWD${Date.now()}`,
    }).returning();

    const newBalance = (parseFloat(affiliate.wallet) + parseFloat(commissionAmount)).toFixed(2);
    await db.update(affiliates).set({ wallet: newBalance }).where(eq(affiliates.id, Number(affiliateId)));

    notifyAffiliateCommissionEarned(affiliate, { commissionAmount, availableBalance: newBalance });
    if (affiliate.phone) {
      smsAffiliateCommissionEarned(affiliate.id, affiliate.phone, affiliate.name, req.admin!.email ?? "an admin", commissionAmount, newBalance);
    }

    return created(res, award);
  } catch (e) { next(e); }
});

// ── Affiliate Transactions ─────────────────────────────────────────────────────

router.get("/transactions", requireAffiliate, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const affiliateId = req.affiliate!.id;

    const rows = await db.query.affiliateTransactions.findMany({
      where: eq(affiliateTransactions.affiliate, affiliateId),
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(affiliateTransactions, eq(affiliateTransactions.affiliate, affiliateId));
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Admin: Affiliates list ─────────────────────────────────────────────────────

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin access required");
    const { page, limit, offset } = getPagination(req);

    const rows = await db.query.affiliates.findMany({
      limit,
      offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(affiliates);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin access required");
    const affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, Number(req.params["id"])) });
    if (!affiliate) throw notFound("Affiliate not found");
    const { password: _, otp: __, ...safe } = affiliate;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/:id/block", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin access required");
    const [updated] = await db.update(affiliates)
      .set({ isBlocked: true })
      .where(eq(affiliates.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Affiliate not found");
    return ok(res, { message: "Affiliate blocked" });
  } catch (e) { next(e); }
});

router.put("/:id/unblock", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin access required");
    const [updated] = await db.update(affiliates)
      .set({ isBlocked: false })
      .where(eq(affiliates.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Affiliate not found");
    return ok(res, { message: "Affiliate unblocked" });
  } catch (e) { next(e); }
});

export default router;
