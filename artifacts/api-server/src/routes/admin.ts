import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, and, gte, lte, sql, or } from "drizzle-orm";
import {
  admins, shops, subscriptions, packages,
  affiliates, awards, affiliateTransactions,
  communications, emailTemplates, emailMessages, emailsSent,
  smsCreditTransactions,
  customers,
  paymentGateways,
} from "@workspace/db";
import { SUPPORTED_GATEWAYS, GATEWAY_CATALOG } from "../lib/gateways/index.js";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, unauthorized, forbidden, conflict } from "../lib/errors.js";
import { requireAdmin, requireSuperAdmin } from "../middlewares/auth.js";
import { deleteAdminAccount } from "../lib/deleteAccount.js";
import { notifyAccountDeleted } from "../lib/emailEvents.js";
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
    const b = req.body ?? {};
    // Display-name aliases
    const displayName = b.username ?? b.name;
    const updates: Record<string, unknown> = {};

    // Identity
    if (displayName) updates['username'] = displayName;
    if (b.phone) {
      updates['phone'] = b.phone;
      updates['phoneVerified'] = false; // changing phone requires re-verification
    }
    if (b.email) {
      // Block duplicates against another admin's email
      const existing = await db.query.admins.findFirst({ where: eq(admins.email, String(b.email).toLowerCase()) });
      if (existing && existing.id !== req.admin!.id) throw badRequest("Email already in use");
      updates['email'] = String(b.email).toLowerCase();
      updates['emailVerified'] = false;
      updates['emailVerificationDate'] = null;
    }

    // Per-shop default & primary shop
    if (b.shop !== undefined) updates['shop'] = b.shop ? Number(b.shop) : null;

    // SMS / receipts / printing preferences
    if (b.autoPrint !== undefined) updates['autoPrint'] = Boolean(b.autoPrint);
    if (b.saleSmsEnabled !== undefined) updates['saleSmsEnabled'] = Boolean(b.saleSmsEnabled);

    // Device / app metadata
    if (b.platform !== undefined) updates['platform'] = b.platform;
    if (b.appVersion !== undefined) updates['appVersion'] = b.appVersion;

    if (Object.keys(updates).length === 0) {
      const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
      if (!admin) throw notFound("Admin not found");
      const { password: _, otp: __, ...safe } = admin;
      return ok(res, safe);
    }
    const [updated] = await db.update(admins).set(updates as any).where(eq(admins.id, req.admin!.id)).returning();
    if (!updated) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});


// ── Self: Permanently delete own account ──────────────────────────────────────
// Wipes the admin and EVERY record they own (shops, products, sales,
// customers, suppliers, finance, subscriptions, attendants, etc.) inside a
// single transaction, then sends a confirmation email.
router.delete("/account", requireAdmin, async (req, res, next) => {
  try {
    const adminId = req.admin!.id;
    const summary = await deleteAdminAccount(adminId);
    if (!summary) throw notFound("Admin account not found");
    notifyAccountDeleted(summary.email, summary.username);
    return ok(res, { deleted: true, ...summary });
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

// ══════════════════════════════════════════════════════════════════════════════
// Admin Management — /admin/admins (super-admin only)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/admins", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const conditions = [];
    if (search) {
      conditions.push(or(
        ilike(admins.email, `%${search}%`),
        ilike(admins.phone, `%${search}%`),
        ilike(admins.username, `%${search}%`),
      )!);
    }
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];
    const rows = await db.query.admins.findMany({
      where, limit, offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(admins, where);
    return paginated(res, rows.map(({ password: _, otp: __, ...a }) => a), { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/admins/by-subscription", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = String(req.query["status"] ?? "");
    // status: trial_active | trial_expired | production_active | production_expired
    const now = new Date();
    const conditions: any[] = [];
    if (status.startsWith("trial")) conditions.push(eq(subscriptions.type, "trial"));
    else if (status.startsWith("production")) conditions.push(eq(subscriptions.type, "production"));
    if (status.endsWith("active")) conditions.push(eq(subscriptions.isActive, true), gte(subscriptions.endDate, now));
    else if (status.endsWith("expired")) conditions.push(lte(subscriptions.endDate, now));
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db.select({
      id: admins.id, email: admins.email, phone: admins.phone, username: admins.username,
      subscriptionId: subscriptions.id, type: subscriptions.type,
      endDate: subscriptions.endDate, isActive: subscriptions.isActive,
    }).from(admins)
      .innerJoin(subscriptions, eq(subscriptions.admin, admins.id))
      .where(where as any)
      .limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(admins).innerJoin(subscriptions, eq(subscriptions.admin, admins.id)).where(where as any);
    return paginated(res, rows, { total: Number(count ?? 0), page, limit });
  } catch (e) { next(e); }
});

router.get("/admins/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const admin = await db.query.admins.findFirst({ where: eq(admins.id, Number(req.params["id"])) });
    if (!admin) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = admin;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/admins/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const { email, phone, username, emailVerified, smsCredit, saleSmsEnabled } = req.body;
    const [updated] = await db.update(admins).set({
      ...(email && { email }),
      ...(phone && { phone }),
      ...(username && { username }),
      ...(emailVerified !== undefined && { emailVerified: Boolean(emailVerified) }),
      ...(smsCredit !== undefined && { smsCredit: Number(smsCredit) }),
      ...(saleSmsEnabled !== undefined && { saleSmsEnabled: Boolean(saleSmsEnabled) }),
    }).where(eq(admins.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Admin not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.delete("/admins/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const summary = await deleteAdminAccount(Number(req.params["id"]));
    if (!summary) throw notFound("Admin not found");
    notifyAccountDeleted(summary.email, summary.username);
    return ok(res, { deleted: true, ...summary });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Affiliate Admin Management — /admin/affiliates (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/affiliates", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const where = search ? ilike(affiliates.email, `%${search}%`) : undefined;
    const rows = await db.query.affiliates.findMany({
      where, limit, offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(affiliates, where);
    return paginated(res, rows.map(({ password: _, otp: __, ...a }) => a), { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/affiliates", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, email, password, phone, address, country, isActive, commission } = req.body;
    if (!name || !email || !password) throw badRequest("name, email and password required");
    const existing = await db.query.affiliates.findFirst({ where: eq(affiliates.email, email) });
    if (existing) throw conflict("Email already registered");
    const hashed = await bcrypt.hash(password, 10);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const [aff] = await db.insert(affiliates).values({
      name, email, phone, address, country, password: hashed, code,
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(commission !== undefined && { commission: String(commission) }),
    }).returning();
    const { password: _, otp: __, ...safe } = aff;
    return created(res, safe);
  } catch (e) { next(e); }
});

router.get("/affiliates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, Number(req.params["id"])) });
    if (!aff) throw notFound("Affiliate not found");
    const { password: _, otp: __, ...safe } = aff;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/affiliates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, phone, address, country, isActive, isBlocked, commission } = req.body;
    const [updated] = await db.update(affiliates).set({
      ...(name && { name }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(country && { country }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(isBlocked !== undefined && { isBlocked: Boolean(isBlocked) }),
      ...(commission !== undefined && { commission: String(commission) }),
    }).where(eq(affiliates.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Affiliate not found");
    const { password: _, otp: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.post("/affiliates/:id/award", requireSuperAdmin, async (req, res, next) => {
  try {
    const { amount, commissionAmount, type, awardType, shopId } = req.body;
    if (!amount || !type || !awardType) throw badRequest("amount, type and awardType required");
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, Number(req.params["id"])) });
    if (!aff) throw notFound("Affiliate not found");

    const finalCommission = commissionAmount
      ? String(commissionAmount)
      : (parseFloat(String(amount)) * parseFloat(aff.commission) / 100).toFixed(2);

    const [award] = await db.insert(awards).values({
      affiliate: aff.id,
      totalAmount: String(amount),
      commissionAmount: finalCommission,
      type,
      awardType,
      shop: shopId ? Number(shopId) : null,
      fromAdmin: req.admin!.id,
      paymentNo: `AWD${Date.now()}`,
    }).returning();

    const newWallet = (parseFloat(aff.wallet) + parseFloat(finalCommission)).toFixed(2);
    await db.update(affiliates).set({ wallet: newWallet }).where(eq(affiliates.id, aff.id));
    await db.insert(affiliateTransactions).values({
      affiliate: aff.id,
      amount: String(amount),
      affiliateAmount: finalCommission,
      balance: newWallet,
      type: "award",
      isCompleted: true,
      admin: req.admin!.id,
    });

    return created(res, award);
  } catch (e) { next(e); }
});

router.put("/affiliate-transactions/:id/complete", requireSuperAdmin, async (req, res, next) => {
  try {
    const tx = await db.query.affiliateTransactions.findFirst({
      where: eq(affiliateTransactions.id, Number(req.params["id"])),
    });
    if (!tx) throw notFound("Transaction not found");
    if (tx.isCompleted) throw badRequest("Already completed");

    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, tx.affiliate) });
    if (!aff) throw notFound("Affiliate not found");

    const newWallet = parseFloat(aff.wallet) - parseFloat(tx.amount);
    if (newWallet < 0) throw badRequest("Insufficient wallet balance");

    await db.update(affiliateTransactions)
      .set({ isCompleted: true, balance: newWallet.toFixed(2), admin: req.admin!.id })
      .where(eq(affiliateTransactions.id, tx.id));
    await db.update(affiliates).set({ wallet: newWallet.toFixed(2) }).where(eq(affiliates.id, aff.id));

    return ok(res, { id: tx.id, isCompleted: true, balance: newWallet.toFixed(2) });
  } catch (e) { next(e); }
});

router.post("/affiliate-transactions/:id/payout-mpesa", requireSuperAdmin, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) throw badRequest("phone required");
    const tx = await db.query.affiliateTransactions.findFirst({
      where: eq(affiliateTransactions.id, Number(req.params["id"])),
    });
    if (!tx) throw notFound("Transaction not found");
    // Stub: would call Safaricom B2C API. Return acknowledgment.
    return ok(res, {
      transactionId: tx.id,
      phone,
      amount: tx.amount,
      status: "initiated",
      note: "M-Pesa B2C payout integration stub — completion happens on async callback",
    });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Communications — /admin/communications (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/communications", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const type = req.query["type"] ? String(req.query["type"]) : null;
    const status = req.query["status"] ? String(req.query["status"]) : null;
    const contact = req.query["contact"] ? String(req.query["contact"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conds: any[] = [];
    if (type) conds.push(eq(communications.type, type));
    if (status) conds.push(eq(communications.status, status));
    if (contact) conds.push(eq(communications.contact, contact));
    if (from) conds.push(gte(communications.createdAt, from));
    if (to) conds.push(lte(communications.createdAt, to));
    const where = conds.length > 1 ? and(...conds) : conds[0];

    const rows = await db.query.communications.findMany({
      where, limit, offset,
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
    const total = await db.$count(communications, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/communications/send", requireSuperAdmin, async (req, res, next) => {
  try {
    const { to, body, type, subject, message, channel, recipientType, recipientIds } = req.body ?? {};

    // Spec shape: { subject, message, channel, recipientType, recipientIds }
    if (channel || recipientType) {
      const sendType = (channel ?? "sms") as string;
      const msgBody = String(message ?? body ?? "");
      if (!msgBody) throw badRequest("message required");
      if (sendType === "email" && !subject) throw badRequest("subject required for email");

      const messageText = subject ? `${subject}\n\n${msgBody}` : msgBody;
      const contacts: { contact: string; adminId?: number }[] = [];

      const rt = String(recipientType ?? "all");
      if (rt === "specific") {
        const ids: number[] = Array.isArray(recipientIds) ? recipientIds.map((x: any) => Number(x)) : [];
        if (!ids.length) throw badRequest("recipientIds required for recipientType=specific");
        if (sendType === "email") {
          const rows = await db.query.admins.findMany({ where: (a, { inArray }) => inArray(a.id, ids) });
          for (const r of rows) if (r.email) contacts.push({ contact: r.email, adminId: r.id });
        } else {
          const rows = await db.query.admins.findMany({ where: (a, { inArray }) => inArray(a.id, ids) });
          for (const r of rows) if (r.phone) contacts.push({ contact: r.phone, adminId: r.id });
        }
      } else if (rt === "admins" || rt === "all") {
        const rows = await db.query.admins.findMany({});
        for (const r of rows) {
          const c = sendType === "email" ? r.email : r.phone;
          if (c) contacts.push({ contact: c, adminId: r.id });
        }
      }
      if (rt === "customers" || rt === "all") {
        const rows = await db.query.customers.findMany({});
        for (const r of rows) {
          const c = sendType === "email" ? r.email : r.phone;
          if (c) contacts.push({ contact: c });
        }
      }

      if (!contacts.length) {
        return ok(res, { sent: 0, note: "No recipients matched" });
      }

      const inserted = await db.insert(communications).values(
        contacts.map((c) => ({
          admin: c.adminId ?? req.admin!.id,
          type: sendType,
          message: messageText,
          contact: c.contact,
          status: "sent",
        })),
      ).returning();

      return created(res, { sent: inserted.length, note: "Gateway integration stub — messages logged as sent" });
    }

    // Backward-compat shape: { to, body, type, subject }
    if (!to || !body) throw badRequest("to and body required");
    const sendType = type ?? "sms";
    if (sendType === "email" && !subject) throw badRequest("subject required for email");

    const [log] = await db.insert(communications).values({
      admin: req.admin!.id,
      type: sendType,
      message: subject ? `${subject}\n\n${body}` : String(body),
      contact: String(to),
      status: "sent",
    }).returning();

    return created(res, { ...log, note: "Gateway integration stub — message logged as sent" });
  } catch (e) { next(e); }
});

router.post("/communications/bulk-sms", requireSuperAdmin, async (req, res, next) => {
  try {
    const { userType, message } = req.body;
    if (!userType || !message) throw badRequest("userType and message required");

    // Find admins matching subscription segment.
    const now = new Date();
    const conds: any[] = [];
    if (userType.startsWith("trial")) conds.push(eq(subscriptions.type, "trial"));
    else if (userType.startsWith("production")) conds.push(eq(subscriptions.type, "production"));
    if (userType.endsWith("active")) conds.push(eq(subscriptions.isActive, true), gte(subscriptions.endDate, now));
    else if (userType.endsWith("expired")) conds.push(lte(subscriptions.endDate, now));

    const recipients = await db.selectDistinct({
      id: admins.id, phone: admins.phone,
    }).from(admins)
      .innerJoin(subscriptions, eq(subscriptions.admin, admins.id))
      .where(conds.length ? and(...conds) : undefined as any);

    let sent = 0, failed = 0;
    for (const r of recipients) {
      if (!r.phone) { failed++; continue; }
      await db.insert(communications).values({
        admin: r.id,
        type: "sms",
        message: String(message),
        contact: r.phone,
        status: "sent",
      });
      sent++;
    }
    return ok(res, { total: recipients.length, sent, failed, userType });
  } catch (e) { next(e); }
});

router.post("/communications/:id/resend", requireSuperAdmin, async (req, res, next) => {
  try {
    const row = await db.query.communications.findFirst({
      where: eq(communications.id, Number(req.params["id"])),
    });
    if (!row) throw notFound("Communication not found");
    // Stub: would re-call gateway. Mark as sent and clear failed reason.
    const [updated] = await db.update(communications)
      .set({ status: "sent", failedReason: null })
      .where(eq(communications.id, row.id))
      .returning();
    return ok(res, updated);
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Email Templates — /admin/email-templates (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/email-templates", requireSuperAdmin, async (_req, res, next) => {
  try {
    const rows = await db.query.emailTemplates.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/email-templates", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug, htmlContent, category, placeholders } = req.body;
    if (!name || !slug || !htmlContent || !category) {
      throw badRequest("name, slug, htmlContent and category required");
    }
    const [row] = await db.insert(emailTemplates).values({
      name, slug, htmlContent, category,
      placeholders: Array.isArray(placeholders) ? placeholders : [],
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/email-templates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const row = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.id, Number(req.params["id"])),
    });
    if (!row) throw notFound("Template not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/email-templates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug, htmlContent, category, placeholders } = req.body;
    const [updated] = await db.update(emailTemplates).set({
      ...(name && { name }),
      ...(slug && { slug }),
      ...(htmlContent && { htmlContent }),
      ...(category && { category }),
      ...(placeholders && { placeholders }),
    }).where(eq(emailTemplates.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Template not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/email-templates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Email Messages (campaigns) — /admin/email-messages (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/email-messages", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const rows = await db.query.emailMessages.findMany({
      limit, offset,
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });
    const total = await db.$count(emailMessages);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/email-messages", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, subject, body, type, audience, audienceEmails, isScheduled, interval, campaign } = req.body;
    if (!name || !subject || !body) throw badRequest("name, subject and body required");
    const [row] = await db.insert(emailMessages).values({
      name, subject, body,
      type: type ?? "email",
      audience: audience ?? "custom",
      audienceAddress: audienceEmails ?? "",
      isScheduled: Boolean(isScheduled),
      interval: interval ?? "monthly",
      campaign: campaign ?? null,
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/email-messages/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, subject, body, type, audience, audienceEmails, isScheduled, interval, campaign } = req.body;
    const [updated] = await db.update(emailMessages).set({
      ...(name && { name }),
      ...(subject && { subject }),
      ...(body && { body }),
      ...(type && { type }),
      ...(audience && { audience }),
      ...(audienceEmails !== undefined && { audienceAddress: audienceEmails }),
      ...(isScheduled !== undefined && { isScheduled: Boolean(isScheduled) }),
      ...(interval && { interval }),
      ...(campaign !== undefined && { campaign }),
    }).where(eq(emailMessages.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Email message not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/email-messages/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    await db.delete(emailMessages).where(eq(emailMessages.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/email-messages/:id/send", requireSuperAdmin, async (req, res, next) => {
  try {
    const msg = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.id, Number(req.params["id"])),
    });
    if (!msg) throw notFound("Email message not found");

    // Stub: determine recipients. For "custom" audience, parse audienceAddress.
    const recipients = (msg.audienceAddress ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const recipientCount = recipients.length;

    await db.insert(emailsSent).values({
      admin: req.admin!.id,
      subject: msg.subject,
      emailTemplate: msg.id,
      recipientCount,
    });
    await db.update(emailMessages)
      .set({ sentCount: (msg.sentCount ?? 0) + recipientCount })
      .where(eq(emailMessages.id, msg.id));

    for (const to of recipients) {
      await db.insert(communications).values({
        admin: req.admin!.id,
        type: msg.type ?? "email",
        message: `${msg.subject}\n\n${msg.body}`,
        contact: to,
        status: "sent",
      });
    }
    return ok(res, { messageId: msg.id, recipientCount, note: "Gateway integration stub" });
  } catch (e) { next(e); }
});

router.get("/emails-sent", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const rows = await db.query.emailsSent.findMany({
      limit, offset,
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    const total = await db.$count(emailsSent);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// SMS adjust credits — /admin/sms/adjust-credits (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.post("/sms/adjust-credits", requireSuperAdmin, async (req, res, next) => {
  try {
    const { adminId, shopId, delta, reason, amount, description } = req.body ?? {};
    const signedAmount = delta !== undefined ? Number(delta) : (amount !== undefined ? Number(amount) : NaN);
    if (Number.isNaN(signedAmount)) throw badRequest("delta (or amount) required");

    let targetAdminId = adminId ? Number(adminId) : null;
    if (!targetAdminId && shopId) {
      const shop = await db.query.shops.findFirst({ where: eq(shops.id, Number(shopId)) });
      if (!shop) throw notFound("Shop not found");
      targetAdminId = shop.admin;
    }
    if (!targetAdminId) throw badRequest("adminId or shopId required");

    const target = await db.query.admins.findFirst({ where: eq(admins.id, targetAdminId) });
    if (!target) throw notFound("Admin not found");

    const newBalance = (target.smsCredit ?? 0) + signedAmount;
    await db.update(admins).set({ smsCredit: newBalance }).where(eq(admins.id, target.id));
    const [tx] = await db.insert(smsCreditTransactions).values({
      admin: target.id,
      type: "adjustment",
      amount: signedAmount,
      balanceAfter: newBalance,
      description: reason ?? description ?? null,
    }).returning();

    return ok(res, { adminId: target.id, smsCredit: newBalance, transaction: tx });
  } catch (e) { next(e); }
});

// ══════════════════════════════════════════════════════════════════════════════
// Subscriptions — /admin/subscriptions (super-admin)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/subscriptions", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const adminId = req.query["adminId"] ? Number(req.query["adminId"]) : null;
    const where = adminId ? eq(subscriptions.admin, adminId) : undefined;

    const rows = await db.query.subscriptions.findMany({
      where, limit, offset,
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      with: { package: true, subscriptionShops: true },
    });
    const total = await db.$count(subscriptions, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/subscriptions/stats", requireSuperAdmin, async (_req, res, next) => {
  try {
    const now = new Date();
    const [stats] = await db.select({
      totalActive: sql<number>`SUM(CASE WHEN ${subscriptions.isActive} = true AND ${subscriptions.endDate} >= ${now} THEN 1 ELSE 0 END)`,
      totalTrial: sql<number>`SUM(CASE WHEN ${subscriptions.type} = 'trial' THEN 1 ELSE 0 END)`,
      totalExpired: sql<number>`SUM(CASE WHEN ${subscriptions.endDate} < ${now} THEN 1 ELSE 0 END)`,
      totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${subscriptions.isPaid} = true THEN ${subscriptions.amount}::numeric ELSE 0 END), 0)`,
    }).from(subscriptions);

    const byPackage = await db.select({
      packageId: packages.id,
      title: packages.title,
      count: sql<number>`COUNT(${subscriptions.id})`,
    }).from(packages)
      .leftJoin(subscriptions, eq(subscriptions.package, packages.id))
      .groupBy(packages.id, packages.title);

    return ok(res, { ...stats, byPackage });
  } catch (e) { next(e); }
});

// ── Payment Gateways (super-admin controlled) ────────────────────────────────
// Online providers Pointify uses to charge admins for subscriptions and
// SMS credits (SunPay, Stripe, Paystack, M-Pesa Daraja). Credentials live
// here and are dispatched through the gateway adapter at charge time.

// Discovery — list every gateway type the server knows how to dispatch,
// along with the credential fields its config needs. Used by the
// super-admin "add payment gateway" form to render the right inputs
// after the provider is picked.
router.get("/payment-gateways/catalog", requireSuperAdmin, async (_req, res, next) => {
  try {
    return ok(res, GATEWAY_CATALOG);
  } catch (e) { next(e); }
});

router.get("/payment-gateways", requireSuperAdmin, async (_req, res, next) => {
  try {
    const rows = await db.query.paymentGateways.findMany({
      orderBy: (g, { asc }) => [asc(g.id)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

// Admin-facing list — only id/name/gateway/isActive, no credentials.
// Used by the subscription / SMS top-up screens to populate the picker.
router.get("/payment-gateways/active", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.query.paymentGateways.findMany({
      where: eq(paymentGateways.isActive, true),
      orderBy: (g, { asc }) => [asc(g.id)],
    });
    return ok(res, rows.map((r) => ({ id: r.id, name: r.name, gateway: r.gateway })));
  } catch (e) { next(e); }
});

router.post("/payment-gateways", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, gateway, config, isActive } = req.body ?? {};
    if (!name) throw badRequest("name required");
    if (!gateway) throw badRequest("gateway required");
    if (!SUPPORTED_GATEWAYS.includes(String(gateway))) {
      throw badRequest(`unsupported gateway. supported: ${SUPPORTED_GATEWAYS.join(", ")}`);
    }
    const [row] = await db.insert(paymentGateways).values({
      name: String(name),
      gateway: String(gateway),
      config: (config ?? {}) as any,
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/payment-gateways/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, gateway, config, isActive } = req.body ?? {};
    if (gateway !== undefined && !SUPPORTED_GATEWAYS.includes(String(gateway))) {
      throw badRequest(`unsupported gateway. supported: ${SUPPORTED_GATEWAYS.join(", ")}`);
    }
    const [updated] = await db.update(paymentGateways).set({
      ...(name !== undefined && { name: String(name) }),
      ...(gateway !== undefined && { gateway: String(gateway) }),
      ...(config !== undefined && { config: config as any }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    }).where(eq(paymentGateways.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Payment gateway not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/payment-gateways/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    await db.delete(paymentGateways).where(eq(paymentGateways.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
