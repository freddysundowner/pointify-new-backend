import { Router } from "express";
import { eq, ilike } from "drizzle-orm";
import { shopCategories } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);

    const rows = await db.query.shopCategories.findMany({
      where: search ? ilike(shopCategories.name, `%${search}%`) : undefined,
      limit,
      offset,
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    const total = await db.$count(shopCategories, search ? ilike(shopCategories.name, `%${search}%`) : undefined);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    if (!name) throw badRequest("name is required");
    const [row] = await db.insert(shopCategories).values({ name, icon }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const row = await db.query.shopCategories.findFirst({ where: eq(shopCategories.id, Number(req.params["id"])) });
    if (!row) throw notFound("Shop category not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    const [updated] = await db.update(shopCategories)
      .set({ ...(name && { name }), ...(icon !== undefined && { icon }) })
      .where(eq(shopCategories.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Shop category not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(shopCategories).where(eq(shopCategories.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Shop category not found");
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
