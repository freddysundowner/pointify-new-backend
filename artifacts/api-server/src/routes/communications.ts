import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  communications, emailTemplates, smsCreditTransactions, emailMessages, emailsSent, activities
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

// ── Email Templates ───────────────────────────────────────────────────────────

router.get("/email-templates", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query.emailTemplates.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/email-templates", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw badRequest("Super admin required");
    const { name, slug, htmlContent, category, placeholders } = req.body;
    if (!name || !slug || !htmlContent || !category) throw badRequest("name, slug, htmlContent and category required");
    const [row] = await db.insert(emailTemplates).values({
      name, slug, htmlContent, category,
      placeholders: Array.isArray(placeholders) ? placeholders : [],
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/email-templates/:id", requireAdmin, async (req, res, next) => {
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

router.delete("/email-templates/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

// ── Communications log ────────────────────────────────────────────────────────

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const adminId = req.query["adminId"]
      ? Number(req.query["adminId"])
      : (req.admin!.isSuperAdmin ? null : req.admin!.id);
    const type = req.query["type"] ? String(req.query["type"]) : null;

    const conditions = [];
    if (adminId) conditions.push(eq(communications.admin, adminId));
    if (type) conditions.push(eq(communications.type, type));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.communications.findMany({ where, limit, offset, orderBy: (c, { desc }) => [desc(c.createdAt)] });
    const total = await db.$count(communications, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Email Messages (campaigns) ────────────────────────────────────────────────

router.get("/email-messages", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const rows = await db.query.emailMessages.findMany({
      limit,
      offset,
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });
    const total = await db.$count(emailMessages);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── SMS Credits ───────────────────────────────────────────────────────────────

router.get("/sms-credits", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const adminId = req.admin!.id;

    const rows = await db.query.smsCreditTransactions.findMany({
      where: eq(smsCreditTransactions.admin, adminId),
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(smsCreditTransactions, eq(smsCreditTransactions.admin, adminId));
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Send SMS ──────────────────────────────────────────────────────────────────

router.post("/sms", requireAdmin, async (req, res, next) => {
  try {
    const { contact, message } = req.body;
    if (!message || !contact) throw badRequest("contact and message are required");

    const adminId = req.admin!.id;

    const [log] = await db.insert(communications).values({
      admin: adminId,
      type: "sms",
      message: String(message),
      contact: String(contact),
      status: "sent",
    }).returning();

    return created(res, log);
  } catch (e) { next(e); }
});

// ── Activities ────────────────────────────────────────────────────────────────

router.get("/activities", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(activities.shop, shopId));
    if (from) conditions.push(gte(activities.createdAt, from));
    if (to) conditions.push(lte(activities.createdAt, to));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.activities.findMany({ where, limit, offset, orderBy: (a, { desc }) => [desc(a.createdAt)] });
    const total = await db.$count(activities, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

export default router;
