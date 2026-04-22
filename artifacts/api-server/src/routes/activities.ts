import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { activities } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, paginated, created } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router: IRouter = Router({ mergeParams: true });

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopIdParam =
      (req.params as { shopId?: string }).shopId ?? req.query["shopId"];
    const shopId = shopIdParam ? Number(shopIdParam) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(activities.shop, shopId));
    if (from) conditions.push(gte(activities.createdAt, from));
    if (to) conditions.push(lte(activities.createdAt, to));
    const where =
      conditions.length > 1
        ? and(...conditions)
        : conditions.length === 1
          ? conditions[0]
          : undefined;

    const rows = await db.query.activities.findMany({
      where,
      limit,
      offset,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    const total = await db.$count(activities, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopIdParam =
      (req.params as { shopId?: string }).shopId ?? req.body?.shopId;
    const shopId = shopIdParam ? Number(shopIdParam) : null;
    const { action, attendantId } = req.body ?? {};
    if (!shopId || !action || !attendantId) {
      throw badRequest("shopId, action and attendantId are required");
    }
    const [row] = await db
      .insert(activities)
      .values({
        shop: shopId,
        action: String(action),
        attendant: Number(attendantId),
      })
      .returning();
    return created(res, row);
  } catch (e) {
    next(e);
  }
});

router.get("/recent", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopIdParam =
      (req.params as { shopId?: string }).shopId ?? req.query["shopId"];
    const shopId = shopIdParam ? Number(shopIdParam) : null;
    const where = shopId ? eq(activities.shop, shopId) : undefined;
    const rows = await db.query.activities.findMany({
      where,
      limit: 20,
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    return ok(res, rows);
  } catch (e) {
    next(e);
  }
});

export default router;
