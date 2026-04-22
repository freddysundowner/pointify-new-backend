import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
import { measures } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);

    const rows = await db.query.measures.findMany({
      where: search ? ilike(measures.name, `%${search}%`) : undefined,
      limit,
      offset,
      orderBy: (m, { asc }) => [asc(m.name)],
    });

    const total = await db.$count(measures, search ? ilike(measures.name, `%${search}%`) : undefined);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) throw badRequest("name is required");

    const [measure] = await db.insert(measures).values({ name }).returning();
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
    const { name } = req.body;
    if (!name) throw badRequest("name is required");

    const [updated] = await db.update(measures)
      .set({ name })
      .where(eq(measures.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Measure not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(measures).where(eq(measures.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Measure not found");
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
