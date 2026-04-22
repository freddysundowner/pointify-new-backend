import { Router } from "express";
import { eq } from "drizzle-orm";
import { shops } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent } from "../lib/response.js";
import { notFound, badRequest, forbidden } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query.shops.findMany({
      where: eq(shops.admin, req.admin!.id),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, categoryId, address, currency, phone, taxRate } = req.body;
    if (!name) throw badRequest("name is required");

    const [shop] = await db.insert(shops).values({
      name,
      address,
      category: categoryId ? Number(categoryId) : null,
      admin: req.admin!.id,
      currency: currency ?? "KES",
      contact: phone,
      taxRate: taxRate ?? "0",
    }).returning();

    return created(res, shop);
  } catch (e) { next(e); }
});

router.get("/by-referral/:referralId", async (req, res, next) => {
  try {
    const referralId = Number(req.params["referralId"]);
    if (!referralId || isNaN(referralId)) throw notFound("Shop not found");
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, referralId),
    });
    if (!shop) throw notFound("Shop not found");
    return ok(res, shop);
  } catch (e) { next(e); }
});

router.get("/:shopId", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const shop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!shop) throw notFound("Shop not found");

    if (req.admin && shop.admin !== req.admin.id && !req.admin.isSuperAdmin) {
      throw forbidden("Access denied");
    }
    return ok(res, shop);
  } catch (e) { next(e); }
});

router.put("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    const { name, address, currency, phone, taxRate, receiptAddress,
      paybillTill, paybillAccount, receiptEmail, backupEmail,
      showStockOnline, showPriceOnline, locationLat, locationLng,
      isWarehouse, useWarehouse, trackBatches, allowOnlineSelling, allowNegativeSelling, isProduction } = req.body;

    const [updated] = await db.update(shops).set({
      ...(name && { name }),
      ...(address !== undefined && { address }),
      ...(currency && { currency }),
      ...(phone !== undefined && { contact: phone }),
      ...(taxRate !== undefined && { taxRate: String(taxRate) }),
      ...(receiptAddress !== undefined && { receiptAddress }),
      ...(paybillTill !== undefined && { paybillTill }),
      ...(paybillAccount !== undefined && { paybillAccount }),
      ...(receiptEmail !== undefined && { receiptEmail }),
      ...(backupEmail !== undefined && { backupEmail }),
      ...(showStockOnline !== undefined && { showStockOnline: Boolean(showStockOnline) }),
      ...(showPriceOnline !== undefined && { showPriceOnline: Boolean(showPriceOnline) }),
      ...(locationLat !== undefined && { locationLat: Number(locationLat) }),
      ...(locationLng !== undefined && { locationLng: Number(locationLng) }),
      ...(isWarehouse !== undefined && { isWarehouse: Boolean(isWarehouse) }),
      ...(useWarehouse !== undefined && { useWarehouse: Boolean(useWarehouse) }),
      ...(trackBatches !== undefined && { trackBatches: Boolean(trackBatches) }),
      ...(allowOnlineSelling !== undefined && { allowOnlineSelling: Boolean(allowOnlineSelling) }),
      ...(allowNegativeSelling !== undefined && { allowNegativeSelling: Boolean(allowNegativeSelling) }),
      ...(isProduction !== undefined && { isProduction: Boolean(isProduction) }),
    }).where(eq(shops.id, shopId)).returning();

    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    await db.delete(shops).where(eq(shops.id, shopId));
    return noContent(res);
  } catch (e) { next(e); }
});

router.delete("/:shopId/data", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    return ok(res, { message: "Shop data cleared", shopId });
  } catch (e) { next(e); }
});

router.post("/:shopId/redeem-usage", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const shop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!shop) throw notFound("Shop not found");
    return ok(res, { message: "Usage redeemed" });
  } catch (e) { next(e); }
});

router.put("/:shopId/backup-interval", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const { interval } = req.body;
    if (!interval) throw badRequest("interval is required");

    const [updated] = await db.update(shops)
      .set({ backupInterval: String(interval) })
      .where(eq(shops.id, shopId))
      .returning();
    if (!updated) throw notFound("Shop not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

export default router;
