import { Router } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { packages, settings, shops, subscriptions, subscriptionShops } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent } from "../lib/response.js";
import { notFound, badRequest, forbidden } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

// ── Subscription info helper ──────────────────────────────────────────────────

type SubscriptionInfo = {
  subscriptionId: number;
  type: string | null;
  status: "active" | "expired" | "none";
  isActive: boolean;
  isPaid: boolean;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;    // positive = days left, 0 or negative = expired
  isExpired: boolean;
  packageId: number | null;
  packageTitle: string | null;
} | { status: "none"; daysRemaining: 0; isExpired: false; subscriptionId: null; type: null; isActive: false; isPaid: false; startDate: null; endDate: null; packageId: null; packageTitle: null };

/** Pick the most relevant subscription: active+unexpired first, else latest. */
function pickBestSub(subs: { id: number; type: string | null; isActive: boolean; isPaid: boolean; startDate: Date; endDate: Date | null; package: number | null }[]) {
  const now = new Date();
  const active = subs.filter(s => s.isActive && s.endDate && s.endDate > now);
  return active[0] ?? subs[0] ?? null;
}

function buildSubInfo(
  sub: { id: number; type: string | null; isActive: boolean; isPaid: boolean; startDate: Date; endDate: Date | null; package: number | null } | null,
  pkg: { id: number; title: string } | null,
): SubscriptionInfo {
  if (!sub) {
    return { status: "none", daysRemaining: 0, isExpired: false, subscriptionId: null, type: null, isActive: false, isPaid: false, startDate: null, endDate: null, packageId: null, packageTitle: null };
  }
  const now = new Date();
  const endDate = sub.endDate ?? null;
  const msRemaining = endDate ? endDate.getTime() - now.getTime() : null;
  const daysRemaining = msRemaining !== null ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;
  const isExpired = endDate ? endDate <= now : false;
  const status: "active" | "expired" = isExpired ? "expired" : "active";
  return {
    subscriptionId: sub.id,
    type: sub.type,
    status,
    isActive: sub.isActive,
    isPaid: sub.isPaid,
    startDate: sub.startDate.toISOString(),
    endDate: endDate ? endDate.toISOString() : null,
    daysRemaining,
    isExpired,
    packageId: pkg?.id ?? sub.package ?? null,
    packageTitle: pkg?.title ?? null,
  };
}

/** Fetch subscription info for a single shop. */
async function fetchSubInfoForShop(shopId: number): Promise<SubscriptionInfo> {
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.shop, shopId),
    orderBy: [desc(subscriptions.endDate)],
    with: { package: true },
  });
  const best = pickBestSub(subs);
  return buildSubInfo(best, best?.package ?? null);
}

/** Fetch subscription info for many shops efficiently (single query). */
async function fetchSubInfoForShops(shopIds: number[]): Promise<Map<number, SubscriptionInfo>> {
  const map = new Map<number, SubscriptionInfo>();
  if (!shopIds.length) return map;

  const allSubs = await db.query.subscriptions.findMany({
    where: inArray(subscriptions.shop, shopIds),
    orderBy: [desc(subscriptions.endDate)],
    with: { package: true },
  });

  // Group by shopId
  const byShop = new Map<number, typeof allSubs>();
  for (const sub of allSubs) {
    const arr = byShop.get(sub.shop) ?? [];
    arr.push(sub);
    byShop.set(sub.shop, arr);
  }

  for (const shopId of shopIds) {
    const subs = byShop.get(shopId) ?? [];
    const best = pickBestSub(subs);
    map.set(shopId, buildSubInfo(best, best?.package ?? null));
  }
  return map;
}

const router = Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query.shops.findMany({
      where: eq(shops.admin, req.admin!.id),
      orderBy: (s, { asc }) => [asc(s.name)],
    });
    const subInfoMap = await fetchSubInfoForShops(rows.map(s => s.id));
    const result = rows.map(shop => ({ ...shop, subscriptionInfo: subInfoMap.get(shop.id) }));
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, categoryId, address, receiptAddress, currency, phone, taxRate,
      paybillTill, paybillAccount,
      receiptEmail, warehouseEmail, backupEmail, backupInterval,
      locationLat, locationLng,
      showStockOnline, showPriceOnline,
      isWarehouse, allowBackup, trackBatches,
      allowOnlineSelling, allowNegativeSelling, isProduction,
    } = req.body ?? {};
    if (!name) throw badRequest("name is required");

    // Treat empty strings as "not provided" so numeric columns don't blow up
    // with `invalid input syntax for type numeric: ""`.
    const blank = (v: unknown) => v === undefined || v === null || v === "";
    const numOrZero = (v: unknown) => (blank(v) ? 0 : Number(v));

    const [shop] = await db.insert(shops).values({
      name,
      address: blank(address) ? null : String(address),
      receiptAddress: blank(receiptAddress) ? null : String(receiptAddress),
      category: blank(categoryId) ? null : Number(categoryId),
      admin: req.admin!.id,
      currency: blank(currency) ? "KES" : String(currency),
      contact: blank(phone) ? null : String(phone),
      taxRate: blank(taxRate) ? "0" : String(taxRate),
      paybillTill: blank(paybillTill) ? null : String(paybillTill),
      paybillAccount: blank(paybillAccount) ? null : String(paybillAccount),
      ...(receiptEmail !== undefined && { receiptEmail: blank(receiptEmail) ? "" : String(receiptEmail) }),
      warehouseEmail: blank(warehouseEmail) ? null : String(warehouseEmail),
      backupEmail: blank(backupEmail) ? null : String(backupEmail),
      backupInterval: blank(backupInterval) ? null : String(backupInterval),
      ...(locationLat !== undefined && { locationLat: numOrZero(locationLat) }),
      ...(locationLng !== undefined && { locationLng: numOrZero(locationLng) }),
      ...(showStockOnline !== undefined && { showStockOnline: Boolean(showStockOnline) }),
      ...(showPriceOnline !== undefined && { showPriceOnline: Boolean(showPriceOnline) }),
      ...(isWarehouse !== undefined && { isWarehouse: Boolean(isWarehouse) }),
      ...(allowBackup !== undefined && { allowBackup: Boolean(allowBackup) }),
      ...(trackBatches !== undefined && { trackBatches: Boolean(trackBatches) }),
      ...(allowOnlineSelling !== undefined && { allowOnlineSelling: Boolean(allowOnlineSelling) }),
      ...(allowNegativeSelling !== undefined && { allowNegativeSelling: Boolean(allowNegativeSelling) }),
      ...(isProduction !== undefined && { isProduction: Boolean(isProduction) }),
    }).returning();

    // Auto-create a trial subscription for the new shop.
    // Reads trial days from system settings (key "trial") — defaults to 14.
    void (async () => {
      try {
        const trialSetting = await db.query.settings.findFirst({ where: eq(settings.name, "trial") });
        const trialDays = (trialSetting?.setting as { days?: number } | null)?.days ?? 14;

        const trialPkg = await db.query.packages.findFirst({ where: eq(packages.type, "trial") });
        if (!trialPkg) {
          logger.warn({ shopId: shop.id }, "shops: no trial package found — skipping trial subscription");
          return;
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + trialDays);

        const [sub] = await db.insert(subscriptions).values({
          admin: req.admin!.id,
          shop: shop.id,
          package: trialPkg.id,
          type: "trial",
          amount: "0",
          currency: "kes",
          isActive: true,
          isPaid: true,
          startDate,
          endDate,
          invoiceNo: `TRIAL-${shop.id}-${Date.now()}`,
        }).returning();

        await db.insert(subscriptionShops).values({
          subscription: sub.id,
          shop: shop.id,
        }).onConflictDoNothing();

        logger.info({ shopId: shop.id, trialDays, endDate }, "shops: trial subscription created");
      } catch (err) {
        logger.warn({ err, shopId: shop.id }, "shops: failed to create trial subscription");
      }
    })();

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
    const subscriptionInfo = await fetchSubInfoForShop(shopId);
    return ok(res, { ...shop, subscriptionInfo });
  } catch (e) { next(e); }
});

router.put("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    const { name, categoryId, address, currency, phone, taxRate, receiptAddress,
      paybillTill, paybillAccount,
      receiptEmail, warehouseEmail, backupEmail, backupInterval,
      showStockOnline, showPriceOnline, locationLat, locationLng,
      isWarehouse, allowBackup, trackBatches,
      allowOnlineSelling, allowNegativeSelling, isProduction } = req.body ?? {};

    const blank = (v: unknown) => v === undefined || v === null || v === "";
    const numOrZero = (v: unknown) => (blank(v) ? 0 : Number(v));

    const [updated] = await db.update(shops).set({
      ...(name && { name }),
      ...(categoryId !== undefined && { category: blank(categoryId) ? null : Number(categoryId) }),
      ...(address !== undefined && { address: blank(address) ? null : String(address) }),
      ...(currency && { currency }),
      ...(phone !== undefined && { contact: blank(phone) ? null : String(phone) }),
      ...(taxRate !== undefined && { taxRate: blank(taxRate) ? "0" : String(taxRate) }),
      ...(receiptAddress !== undefined && { receiptAddress: blank(receiptAddress) ? null : String(receiptAddress) }),
      ...(paybillTill !== undefined && { paybillTill: blank(paybillTill) ? null : String(paybillTill) }),
      ...(paybillAccount !== undefined && { paybillAccount: blank(paybillAccount) ? null : String(paybillAccount) }),
      ...(receiptEmail !== undefined && { receiptEmail: blank(receiptEmail) ? "" : String(receiptEmail) }),
      ...(warehouseEmail !== undefined && { warehouseEmail: blank(warehouseEmail) ? null : String(warehouseEmail) }),
      ...(backupEmail !== undefined && { backupEmail: blank(backupEmail) ? null : String(backupEmail) }),
      ...(backupInterval !== undefined && { backupInterval: blank(backupInterval) ? null : String(backupInterval) }),
      ...(showStockOnline !== undefined && { showStockOnline: Boolean(showStockOnline) }),
      ...(showPriceOnline !== undefined && { showPriceOnline: Boolean(showPriceOnline) }),
      ...(locationLat !== undefined && { locationLat: numOrZero(locationLat) }),
      ...(locationLng !== undefined && { locationLng: numOrZero(locationLng) }),
      ...(isWarehouse !== undefined && { isWarehouse: Boolean(isWarehouse) }),
      ...(allowBackup !== undefined && { allowBackup: Boolean(allowBackup) }),
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
