import { Router } from "express";
import { eq, ilike, and } from "drizzle-orm";
import { productCategories } from "@workspace/db";
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

    const where = [];
    if (req.admin) where.push(eq(productCategories.admin, req.admin.id));
    if (search) where.push(ilike(productCategories.name, `%${search}%`));
    const condition = where.length > 1 ? and(...where) : where[0];

    const rows = await db.query.productCategories.findMany({
      where: condition,
      limit,
      offset,
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    const total = await db.$count(productCategories, condition);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) throw badRequest("name is required");
    const [row] = await db.insert(productCategories).values({
      name,
      admin: req.admin!.id,
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.productCategories.findFirst({ where: eq(productCategories.id, Number(req.params["id"])) });
    if (!row) throw notFound("Product category not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    const id = Number(req.params["id"]);
    const [updated] = await db.update(productCategories)
      .set({ ...(name && { name }) })
      .where(and(eq(productCategories.id, id), eq(productCategories.admin, req.admin!.id)))
      .returning();
    if (!updated) throw notFound("Product category not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const [deleted] = await db.delete(productCategories)
      .where(and(eq(productCategories.id, id), eq(productCategories.admin, req.admin!.id)))
      .returning();
    if (!deleted) throw notFound("Product category not found");
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
