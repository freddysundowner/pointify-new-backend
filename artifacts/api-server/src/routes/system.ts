import { Router } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { settings, shopCategories, shops, admins } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, paginated, noContent } from "../lib/response.js";
import { badRequest, notFound } from "../lib/errors.js";
import { requireSuperAdmin, requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { clearEmailConfigCache } from "../lib/email.js";
import { clearSmsConfigCache } from "../lib/sms.js";

const router = Router();

// ── Global system settings (key/value JSONB store) ────────────────────────────
// Stored in the same `settings` table used by per-shop settings, but namespaced
// with arbitrary names (e.g. "mpesa", "smtp", "email", "platform").
// Per-shop settings use the reserved name pattern "shop_<id>".

router.get("/settings", requireSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = (req.query["search"] as string | undefined)?.trim();
    const where = search ? ilike(settings.name, `%${search}%`) : undefined;

    const rows = await db.query.settings.findMany({
      where,
      orderBy: (s, { asc }) => asc(s.name),
      limit,
      offset,
    });
    const total = await db.$count(settings, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/settings/:name", requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.params["name"]);
    const row = await db.query.settings.findFirst({ where: eq(settings.name, name) });
    if (!row) {
      return ok(res, { name, setting: {} });
    }
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/settings/:name", requireSuperAdmin, async (req, res, next) => {
  try {
    const name = String(req.params["name"]);
    if (!name) throw badRequest("setting name required");
    const incoming = req.body?.setting ?? req.body ?? {};

    const existing = await db.query.settings.findFirst({ where: eq(settings.name, name) });
    const prev = (existing?.setting ?? {}) as Record<string, unknown>;
    const merged = (incoming && typeof incoming === "object" && !Array.isArray(incoming))
      ? { ...prev, ...(incoming as Record<string, unknown>) }
      : incoming;

    if (existing) {
      const [updated] = await db.update(settings)
        .set({ setting: merged, updatedAt: new Date() })
        .where(eq(settings.name, name))
        .returning();
      if (name === "email") clearEmailConfigCache();
      if (name === "sms") clearSmsConfigCache();
      return ok(res, updated);
    }
    const [created] = await db.insert(settings).values({ name, setting: merged }).returning();
    if (name === "email") clearEmailConfigCache();
      if (name === "sms") clearSmsConfigCache();
    return ok(res, created);
  } catch (e) { next(e); }
});

router.delete("/settings/:name", requireSuperAdmin, async (req, res, next) => {
  try {
    const name = String(req.params["name"]);
    const [deleted] = await db.delete(settings).where(eq(settings.name, name)).returning();
    if (!deleted) throw notFound("Setting not found");
    if (name === "email") clearEmailConfigCache();
      if (name === "sms") clearSmsConfigCache();
    return noContent(res);
  } catch (e) { next(e); }
});

// ── System shop categories (alias for /shop-categories under /system) ─────────
router.get("/shop-categories", async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = (req.query["search"] as string | undefined)?.trim();
    const where = search ? ilike(shopCategories.name, `%${search}%`) : undefined;
    const rows = await db.query.shopCategories.findMany({ where, limit, offset });
    const total = await db.$count(shopCategories, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.get("/shop-categories/:id", async (req, res, next) => {
  try {
    const row = await db.query.shopCategories.findFirst({ where: eq(shopCategories.id, Number(req.params["id"])) });
    if (!row) throw notFound("Shop category not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

// ── Platform metrics ──────────────────────────────────────────────────────────
router.get("/shop-metrics", requireSuperAdmin, async (_req, res, next) => {
  try {
    const [shopsTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(shops);
    const [adminsTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(admins);
    return ok(res, {
      shops: shopsTotal?.c ?? 0,
      admins: adminsTotal?.c ?? 0,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});

export default router;
