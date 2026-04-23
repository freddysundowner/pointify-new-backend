import { Router } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { attendants, permissions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest, forbidden } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin } from "../middlewares/auth.js";
import { notifyAttendantWelcome } from "../lib/emailEvents.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const conditions = [eq(attendants.admin, req.admin!.id)];
    if (shopId) conditions.push(eq(attendants.shop, shopId));
    const where = and(...conditions);

    const rows = await db.query.attendants.findMany({ where, limit, offset });
    const total = await db.$count(attendants, where);
    return paginated(res, rows.map(({ pin: _, password: __, ...a }) => a), { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { username, shopId, pin, permissions: perms } = req.body;
    if (!username || !shopId) throw badRequest("username and shopId required");
    await assertShopOwnership(req, Number(shopId));

    const rawPin = String(pin ?? Math.floor(1000 + Math.random() * 9000));
    const hashedPin = await bcrypt.hash(rawPin, 10);

    const [attendant] = await db.insert(attendants).values({
      username,
      shop: Number(shopId),
      admin: req.admin!.id,
      pin: rawPin,
      password: hashedPin,
      permissions: perms ?? [],
    }).returning();

    const { pin: _, password: __, ...safe } = attendant;
    void notifyAttendantWelcome(safe, rawPin);
    return created(res, safe);
  } catch (e) { next(e); }
});

router.get("/permissions", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query.permissions.findMany({ orderBy: (p, { asc }) => [asc(p.sortOrder)] });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const attendant = await db.query.attendants.findFirst({
      where: and(eq(attendants.id, Number(req.params["id"])), eq(attendants.admin, req.admin!.id)),
    });
    if (!attendant) throw notFound("Attendant not found");
    const { pin: _, password: __, ...safe } = attendant;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { username, pin, permissions: perms, shopId } = req.body;
    if (shopId) await assertShopOwnership(req, Number(shopId));
    const pinHash = pin ? await bcrypt.hash(String(pin), 10) : undefined;
    const [updated] = await db.update(attendants).set({
      ...(username && { username }),
      ...(pin && { pin: String(pin), password: pinHash }),
      ...(perms && { permissions: perms }),
      ...(shopId && { shop: Number(shopId) }),
    }).where(and(eq(attendants.id, Number(req.params["id"])), eq(attendants.admin, req.admin!.id))).returning();
    if (!updated) throw notFound("Attendant not found");
    const { pin: _, password: __, ...safe } = updated;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(attendants)
      .where(and(eq(attendants.id, Number(req.params["id"])), eq(attendants.admin, req.admin!.id)))
      .returning();
    if (!deleted) throw notFound("Attendant not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/:id/permissions", requireAdmin, async (req, res, next) => {
  try {
    const { permissions: perms } = req.body;
    if (!Array.isArray(perms)) throw badRequest("permissions must be an array");

    const [updated] = await db.update(attendants)
      .set({ permissions: perms })
      .where(and(eq(attendants.id, Number(req.params["id"])), eq(attendants.admin, req.admin!.id)))
      .returning();
    if (!updated) throw notFound("Attendant not found");
    return ok(res, { message: "Permissions updated" });
  } catch (e) { next(e); }
});

export default router;
