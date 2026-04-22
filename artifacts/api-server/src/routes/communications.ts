import { Router } from "express";
import { eq, and, gte, lte, ilike } from "drizzle-orm";
import {
  communications, emailTemplates, smsTemplates, smsCreditTransactions, emailMessages, emailsSent, activities
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant, requireSuperAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { clearSmsTemplateCache } from "../lib/sms.js";

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

// ── SMS templates (shared library — super-admin manages, all admins read) ────

router.get("/sms-templates", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = (req.query["search"] as string | undefined)?.trim();
    const activeOnly = String(req.query["activeOnly"] ?? "") === "true";

    const conds = [] as ReturnType<typeof eq>[];
    if (search) conds.push(ilike(smsTemplates.name, `%${search}%`));
    if (activeOnly) conds.push(eq(smsTemplates.isActive, true));
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

    const rows = await db.query.smsTemplates.findMany({
      where,
      orderBy: (t, { asc }) => asc(t.name),
      limit,
      offset,
    });
    const total = await db.$count(smsTemplates, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/sms-templates/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const row = await db.query.smsTemplates.findFirst({ where: eq(smsTemplates.id, id) });
    if (!row) throw notFound("SMS template not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.post("/sms-templates", requireSuperAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!name) throw badRequest("name is required");
    if (!body) throw badRequest("body is required");
    const description = req.body?.description ? String(req.body.description) : null;
    const isActive = req.body?.isActive === undefined ? true : Boolean(req.body.isActive);

    const [row] = await db.insert(smsTemplates).values({ name, body, description, isActive }).returning();
    clearSmsTemplateCache();
    return created(res, row);
  } catch (e) { next(e); }
});

router.put("/sms-templates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.smsTemplates.findFirst({ where: eq(smsTemplates.id, id) });
    if (!existing) throw notFound("SMS template not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.name !== undefined) patch["name"] = String(req.body.name).trim();
    if (req.body?.body !== undefined) patch["body"] = String(req.body.body).trim();
    if (req.body?.description !== undefined) patch["description"] = req.body.description === null ? null : String(req.body.description);
    if (req.body?.isActive !== undefined) patch["isActive"] = Boolean(req.body.isActive);

    const [row] = await db.update(smsTemplates).set(patch).where(eq(smsTemplates.id, id)).returning();
    clearSmsTemplateCache();
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/sms-templates/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const [row] = await db.delete(smsTemplates).where(eq(smsTemplates.id, id)).returning();
    if (!row) throw notFound("SMS template not found");
    clearSmsTemplateCache();
    return ok(res, { id });
  } catch (e) { next(e); }
});

// Render `{{key}}` placeholders against a vars object.
function renderTemplate(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ── Send SMS ──────────────────────────────────────────────────────────────────
// Body: { contact, message? } OR { contact, templateId, variables? }

router.post("/sms", requireAdmin, async (req, res, next) => {
  try {
    const contact = String(req.body?.contact ?? "").trim();
    if (!contact) throw badRequest("contact is required");

    let message: string;
    const templateId = req.body?.templateId !== undefined ? Number(req.body.templateId) : null;
    if (templateId !== null) {
      if (!Number.isInteger(templateId) || templateId <= 0) throw badRequest("templateId must be a positive integer");
      const tpl = await db.query.smsTemplates.findFirst({ where: eq(smsTemplates.id, templateId) });
      if (!tpl) throw notFound("SMS template not found");
      if (!tpl.isActive) throw badRequest("SMS template is not active");
      const vars = (req.body?.variables && typeof req.body.variables === "object")
        ? (req.body.variables as Record<string, unknown>)
        : {};
      message = renderTemplate(tpl.body, vars);
    } else {
      message = String(req.body?.message ?? "").trim();
      if (!message) throw badRequest("Provide either message or templateId");
    }

    const adminId = req.admin!.id;
    const [log] = await db.insert(communications).values({
      admin: adminId,
      type: "sms",
      message,
      contact,
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
