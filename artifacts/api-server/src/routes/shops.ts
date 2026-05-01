import { Router } from "express";
import { eq, inArray, or, desc } from "drizzle-orm";
import {
  packages, settings, shops, subscriptions, subscriptionShops,
  sales, saleReturns,
  purchases, purchaseReturns,
  orders,
  productTransfers,
  stockCounts, stockRequests,
  adjustments, badStocks,
  activities,
  expenses, cashflows, userPayments,
  expenseCategories, cashflowCategories, banks,
  loyaltyTransactions,
  inventory,
  products, batches, productSerials, bundleItems as bundleItemsTable, productHistory,
  customers, customerWalletTransactions,
  suppliers, supplierWalletTransactions,
} from "@workspace/db";
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
      // Receipt customisation
      receiptLogo, receiptFooter, receiptShowTax, receiptShowDiscount,
      // Loyalty programme
      loyaltyEnabled, pointsPerAmount, pointsValue,
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
      isWarehouse: isWarehouse !== undefined ? Boolean(isWarehouse) : false,
      ...(allowBackup !== undefined && { allowBackup: Boolean(allowBackup) }),
      ...(trackBatches !== undefined && { trackBatches: Boolean(trackBatches) }),
      ...(allowOnlineSelling !== undefined && { allowOnlineSelling: Boolean(allowOnlineSelling) }),
      ...(allowNegativeSelling !== undefined && { allowNegativeSelling: Boolean(allowNegativeSelling) }),
      ...(isProduction !== undefined && { isProduction: Boolean(isProduction) }),
      // Receipt customisation
      ...(receiptLogo !== undefined && { receiptLogo: blank(receiptLogo) ? null : String(receiptLogo) }),
      ...(receiptFooter !== undefined && { receiptFooter: blank(receiptFooter) ? null : String(receiptFooter) }),
      ...(receiptShowTax !== undefined && { receiptShowTax: Boolean(receiptShowTax) }),
      ...(receiptShowDiscount !== undefined && { receiptShowDiscount: Boolean(receiptShowDiscount) }),
      // Loyalty
      ...(loyaltyEnabled !== undefined && { loyaltyEnabled: Boolean(loyaltyEnabled) }),
      ...(pointsPerAmount !== undefined && { pointsPerAmount: blank(pointsPerAmount) ? "0" : String(pointsPerAmount) }),
      ...(pointsValue !== undefined && { pointsValue: blank(pointsValue) ? "0" : String(pointsValue) }),
    }).returning();

    // Auto-create a trial subscription for the new shop (synchronous so it
    // is committed before the 201 response is sent to the client).
    try {
      const trialSetting = await db.query.settings.findFirst({ where: eq(settings.name, "trial") });
      const trialDays = (trialSetting?.setting as { days?: number } | null)?.days ?? 14;

      const trialPkg = await db.query.packages.findFirst({ where: eq(packages.type, "trial") });
      if (!trialPkg) {
        logger.warn({ shopId: shop.id }, "shops: no trial package found — skipping trial subscription");
      } else {
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
      }
    } catch (err) {
      logger.warn({ err, shopId: shop.id }, "shops: failed to create trial subscription");
    }

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
      allowOnlineSelling, allowNegativeSelling, isProduction,
      // Receipt customisation
      receiptLogo, receiptFooter, receiptShowTax, receiptShowDiscount,
      // Loyalty
      loyaltyEnabled, pointsPerAmount, pointsValue,
    } = req.body ?? {};

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
      // Receipt customisation
      ...(receiptLogo !== undefined && { receiptLogo: blank(receiptLogo) ? null : String(receiptLogo) }),
      ...(receiptFooter !== undefined && { receiptFooter: blank(receiptFooter) ? null : String(receiptFooter) }),
      ...(receiptShowTax !== undefined && { receiptShowTax: Boolean(receiptShowTax) }),
      ...(receiptShowDiscount !== undefined && { receiptShowDiscount: Boolean(receiptShowDiscount) }),
      // Loyalty
      ...(loyaltyEnabled !== undefined && { loyaltyEnabled: Boolean(loyaltyEnabled) }),
      ...(pointsPerAmount !== undefined && { pointsPerAmount: blank(pointsPerAmount) ? "0" : String(pointsPerAmount) }),
      ...(pointsValue !== undefined && { pointsValue: blank(pointsValue) ? "0" : String(pointsValue) }),
    }).where(eq(shops.id, shopId)).returning();

    return ok(res, updated);
  } catch (e) { next(e); }
});

// ── Shared helper: deletes ALL data linked to a shop inside an existing tx ──
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function clearShopData(tx: Tx, shopId: number): Promise<void> {
  // ── 1. Transactional records ────────────────────────────────────────────────
  // Returns first — they hold non-cascade FKs back to sales/purchases
  await tx.delete(saleReturns).where(eq(saleReturns.shop, shopId));         // cascades saleReturnItems
  await tx.delete(purchaseReturns).where(eq(purchaseReturns.shop, shopId)); // cascades purchaseReturnItems

  await tx.delete(sales).where(eq(sales.shop, shopId));       // cascades saleItems → saleItemBatches + salePayments
  await tx.delete(purchases).where(eq(purchases.shop, shopId)); // cascades purchaseItems + purchasePayments
  await tx.delete(orders).where(eq(orders.shop, shopId));     // cascades orderItems

  // productTransfers references shops on BOTH fromShop AND toShop — handle both sides
  await tx.delete(productTransfers).where(
    or(eq(productTransfers.fromShop, shopId), eq(productTransfers.toShop, shopId))
  ); // cascades transferItems

  await tx.delete(stockCounts).where(eq(stockCounts.shop, shopId)); // cascades stockCountItems

  // stockRequests references shops on BOTH fromShop AND warehouse — handle both sides
  await tx.delete(stockRequests).where(
    or(eq(stockRequests.fromShop, shopId), eq(stockRequests.warehouse, shopId))
  ); // cascades stockRequestItems

  await tx.delete(adjustments).where(eq(adjustments.shop, shopId));
  await tx.delete(badStocks).where(eq(badStocks.shop, shopId));
  await tx.delete(activities).where(eq(activities.shop, shopId));
  await tx.delete(expenses).where(eq(expenses.shop, shopId));
  await tx.delete(cashflows).where(eq(cashflows.shop, shopId));

  // ── 2. Catalog data ─────────────────────────────────────────────────────────
  const shopProductIds = (
    await tx.select({ id: products.id }).from(products).where(eq(products.shop, shopId))
  ).map((r) => r.id);

  if (shopProductIds.length > 0) {
    await tx.delete(productHistory).where(
      or(eq(productHistory.shop, shopId), inArray(productHistory.product, shopProductIds))
    );
    await tx.delete(bundleItemsTable).where(
      or(
        inArray(bundleItemsTable.product, shopProductIds),
        inArray(bundleItemsTable.componentProduct, shopProductIds),
      ),
    );
    await tx.delete(productSerials).where(
      or(inArray(productSerials.product, shopProductIds), eq(productSerials.shop, shopId))
    );
    await tx.delete(batches).where(
      or(inArray(batches.product, shopProductIds), eq(batches.shop, shopId))
    );
    await tx.delete(inventory).where(
      or(inArray(inventory.product, shopProductIds), eq(inventory.shop, shopId))
    );
  } else {
    await tx.delete(productHistory).where(eq(productHistory.shop, shopId));
    await tx.delete(productSerials).where(eq(productSerials.shop, shopId));
    await tx.delete(batches).where(eq(batches.shop, shopId));
    await tx.delete(inventory).where(eq(inventory.shop, shopId));
  }

  await tx.delete(products).where(eq(products.shop, shopId));

  // ── 3. Customers, loyalty and suppliers ─────────────────────────────────────
  await tx.delete(loyaltyTransactions).where(eq(loyaltyTransactions.shop, shopId));
  await tx.delete(userPayments).where(eq(userPayments.shopId, shopId));
  await tx.delete(customerWalletTransactions).where(eq(customerWalletTransactions.shop, shopId));
  await tx.delete(supplierWalletTransactions).where(eq(supplierWalletTransactions.shop, shopId));
  await tx.delete(customers).where(eq(customers.shop, shopId));
  await tx.delete(suppliers).where(eq(suppliers.shop, shopId));

  // ── 4. Finance reference data ────────────────────────────────────────────────
  await tx.delete(banks).where(eq(banks.shop, shopId));
  await tx.delete(expenseCategories).where(eq(expenseCategories.shop, shopId));
  await tx.delete(cashflowCategories).where(eq(cashflowCategories.shop, shopId));
  // NOTE: subscriptions / subscriptionShops are billing records — never cleared here.
}

// DELETE /api/shops/:shopId — clear all data, then remove the shop record itself
router.delete("/:shopId", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    await db.transaction(async (tx) => {
      // Clear all transactional + catalog + customer data
      await clearShopData(tx, shopId);

      // Remove billing/subscription links — must happen before the shop row is deleted
      // because both subscriptions.shop_id and subscription_shops.shop_id are NO ACTION FKs.
      await tx.delete(subscriptionShops).where(eq(subscriptionShops.shop, shopId));
      await tx.delete(subscriptions).where(eq(subscriptions.shop, shopId));

      await tx.delete(shops).where(eq(shops.id, shopId));
    });

    return noContent(res);
  } catch (e) {
    logger.error({ err: e }, "delete shop failed");
    next(e);
  }
});

// DELETE /api/shops/:shopId/data — clear all data but keep the shop record
router.delete("/:shopId/data", requireAdmin, async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    await db.transaction(async (tx) => {
      await clearShopData(tx, shopId);
    });

    return ok(res, { message: "Shop data cleared", shopId });
  } catch (e) {
    logger.error({ err: e }, "clear shop data failed");
    next(e);
  }
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

    const existing = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!existing) throw notFound("Shop not found");
    if (existing.admin !== req.admin!.id && !req.admin!.isSuperAdmin) throw forbidden("Access denied");

    const [updated] = await db.update(shops)
      .set({ backupInterval: String(interval) })
      .where(eq(shops.id, shopId))
      .returning();
    if (!updated) throw notFound("Shop not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

export default router;
