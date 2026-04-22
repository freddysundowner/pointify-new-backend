import { Router } from "express";
import { eq } from "drizzle-orm";
import { settings } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok } from "../lib/response.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";

const router = Router();

function shopKey(shopId: number) {
  return `shop_${shopId}`;
}

router.get("/:shopId", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    let row = await db.query.settings.findFirst({ where: eq(settings.name, shopKey(shopId)) });
    if (!row) {
      const [created] = await db.insert(settings)
        .values({ name: shopKey(shopId), setting: {} })
        .returning();
      row = created;
    }
    return ok(res, row.setting ?? {});
  } catch (e) { next(e); }
});

router.put("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const key = shopKey(shopId);
    const existing = await db.query.settings.findFirst({ where: eq(settings.name, key) });
    const merged = { ...(existing?.setting ?? {}), ...req.body };

    if (existing) {
      const [updated] = await db.update(settings).set({ setting: merged, updatedAt: new Date() }).where(eq(settings.name, key)).returning();
      return ok(res, updated.setting);
    } else {
      const [created] = await db.insert(settings).values({ name: key, setting: merged }).returning();
      return ok(res, created.setting);
    }
  } catch (e) { next(e); }
});

export default router;
