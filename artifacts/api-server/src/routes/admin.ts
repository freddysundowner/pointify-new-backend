import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, and, gte, lte, sql } from "drizzle-orm";
import { admins, shops, subscriptions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, unauthorized, forbidden } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

// ── Self / Account ─────────────────────────────────────────────────────────────

router.get("/profile", requireAdmin, async (req, res, next) => {
  try {
    const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
    if (!admin) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = admin;
    return ok(res, { ...safe, isSuperAdmin: req.admin!.isSuperAdmin });
  } catch (e) { next(e); }
});

router.put("/profile", requireAdmin, async (req, res, next) => {
  try {
    const { username, phone, platform, appVersion, autoPrint, saleSmsEnabled } = req.body;
    const [updated] = await db.update(admins).set({
      ...(username && { username }),
      ...(phone && { phone }),
      ...(platform && { platform }),
      ...(appVersion && { appVersion }),
      ...(autoPrint !== undefined && { autoPrint: Boolean(autoPrint) }),
      ...(saleSmsEnabled !== undefined && { saleSmsEnabled: Boolean(saleSmsEnabled) }),
    }).where(eq(admins.id, req.admin!.id)).returning();
    if (!updated) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/profile/password", requireAdmin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw badRequest("currentPassword and newPassword required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
    if (!admin) throw notFound("Admin not found");

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) throw unauthorized("Current password incorrect");

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(admins).set({ password: hashed }).where(eq(admins.id, req.admin!.id));
    return ok(res, { message: "Password updated" });
  } catch (e) { next(e); }
});

router.get("/sms-credits", requireAdmin, async (req, res, next) => {
  try {
    const admin = await db.query.admins.findFirst({
      where: eq(admins.id, req.admin!.id),
      columns: { smsCredit: true },
    });
    return ok(res, { smsCredit: admin?.smsCredit ?? 0 });
  } catch (e) { next(e); }
});

router.post("/sms-credits/topup", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin access required");
    const { adminId, amount } = req.body;
    if (!adminId || !amount) throw badRequest("adminId and amount required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.id, Number(adminId)) });
    if (!admin) throw notFound("Admin not found");

    const [updated] = await db.update(admins)
      .set({ smsCredit: (admin.smsCredit ?? 0) + Number(amount) })
      .where(eq(admins.id, Number(adminId)))
      .returning({ smsCredit: admins.smsCredit });
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.get("/referrals", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query.admins.findMany({
      where: eq(admins.referredBy, req.admin!.id),
      columns: { id: true, username: true, email: true, createdAt: true },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// ── Super Admin: All admins ───────────────────────────────────────────────────

router.get("/all", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);

    const where = search ? ilike(admins.email, `%${search}%`) : undefined;
    const rows = await db.query.admins.findMany({
      where,
      limit,
      offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(admins, where);
    return paginated(res, rows.map(({ password: _, otp: __, ...a }) => a), { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/all/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    const admin = await db.query.admins.findFirst({ where: eq(admins.id, Number(req.params["id"])) });
    if (!admin) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = admin;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/all/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    const { username, phone, saleSmsEnabled, smsCredit } = req.body;
    const [updated] = await db.update(admins).set({
      ...(username && { username }),
      ...(phone && { phone }),
      ...(saleSmsEnabled !== undefined && { saleSmsEnabled: Boolean(saleSmsEnabled) }),
      ...(smsCredit !== undefined && { smsCredit: Number(smsCredit) }),
    }).where(eq(admins.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.delete("/all/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    await db.delete(admins).where(eq(admins.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Super Admin: All shops ─────────────────────────────────────────────────────

router.get("/shops", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const adminId = req.query["adminId"] ? Number(req.query["adminId"]) : null;

    const conditions = [];
    if (search) conditions.push(ilike(shops.name, `%${search}%`));
    if (adminId) conditions.push(eq(shops.admin, adminId));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.shops.findMany({ where, limit, offset, orderBy: (s, { desc }) => [desc(s.createdAt)] });
    const total = await db.$count(shops, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Subscription summary for admin portal ─────────────────────────────────────

router.get("/subscriptions/summary", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw forbidden("Super admin required");
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (from) conditions.push(gte(subscriptions.createdAt, from));
    if (to) conditions.push(lte(subscriptions.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [summary] = await db.select({
      totalSubscriptions: sql<number>`COUNT(*)`,
      activeSubscriptions: sql<number>`SUM(CASE WHEN ${subscriptions.isActive} = true THEN 1 ELSE 0 END)`,
      totalRevenue: sql<string>`SUM(CASE WHEN ${subscriptions.isPaid} = true THEN ${subscriptions.amount}::numeric ELSE 0 END)`,
      pendingRevenue: sql<string>`SUM(CASE WHEN ${subscriptions.isPaid} = false THEN ${subscriptions.amount}::numeric ELSE 0 END)`,
    }).from(subscriptions).where(where);

    return ok(res, summary);
  } catch (e) { next(e); }
});

export default router;
