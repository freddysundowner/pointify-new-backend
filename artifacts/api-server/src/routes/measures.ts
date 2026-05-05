import { Router } from "express";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { measures } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

// GET /measures?shopId=1  — returns global measures + shop-specific measures for shopId
// GET /measures           — returns global measures only (no shopId provided)
router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const shopFilter = shopId
      ? or(isNull(measures.shopId), eq(measures.shopId, shopId))
      : isNull(measures.shopId);

    const searchFilter = search ? ilike(measures.name, `%${search}%`) : undefined;
    const where = search ? and(shopFilter, searchFilter) : shopFilter;

    const rows = await db.query.measures.findMany({
      where,
      limit,
      offset,
      orderBy: (m, { asc }) => [asc(m.shopId), asc(m.name)],
    });

    const total = await db.$count(measures, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// POST /measures — create a global measure (admin only) or a shop-specific custom measure
// Body: { name, abbreviation?, shopId? }
// If shopId is provided, it creates a shop-specific measure visible only to that shop.
router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { name, abbreviation, shopId } = req.body;
    if (!name) throw badRequest("name is required");

    const [measure] = await db.insert(measures)
      .values({ name, abbreviation: abbreviation ?? null, shopId: shopId ? Number(shopId) : null })
      .returning();
    return created(res, measure);
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const measure = await db.query.measures.findFirst({ where: eq(measures.id, Number(req.params["id"])) });
    if (!measure) throw notFound("Measure not found");
    return ok(res, measure);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, abbreviation } = req.body;
    if (!name) throw badRequest("name is required");

    const [updated] = await db.update(measures)
      .set({ name, abbreviation: abbreviation ?? null })
      .where(eq(measures.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Measure not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const measure = await db.query.measures.findFirst({ where: eq(measures.id, Number(req.params["id"])) });
    if (!measure) throw notFound("Measure not found");
    // Only allow deleting shop-specific measures (not global system ones)
    if (!measure.shopId) throw badRequest("Cannot delete system-level measures");
    const [deleted] = await db.delete(measures).where(eq(measures.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Measure not found");
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
