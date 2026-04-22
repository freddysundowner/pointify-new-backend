/**
 * Scheduled email jobs. Each job runs daily, queries the DB for matching
 * accounts, and sends the relevant template once per account (deduped via
 * the `settings` table using key `notify_log:<templateKey>:<adminId>`).
 *
 * All jobs are best-effort and never throw — failures are logged.
 */
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
import {
  admins,
  shops,
  products,
  sales,
  subscriptions,
  packages,
  settings,
} from "@workspace/db";
import { db } from "./db.js";
import { sendEmail } from "./email.js";
import { logger } from "./logger.js";

// ── Dedupe log helpers ───────────────────────────────────────────────────────
const logName = (key: string, adminId: number) => `notify_log:${key}:${adminId}`;

async function alreadySent(key: string, adminId: number, withinDays = 365): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, logName(key, adminId)) });
  if (!row) return false;
  const sentAt = (row.setting as { sentAt?: number } | null)?.sentAt ?? 0;
  return Date.now() - sentAt < withinDays * 24 * 60 * 60 * 1000;
}

async function markSent(key: string, adminId: number) {
  const name = logName(key, adminId);
  const payload = { setting: { sentAt: Date.now() } };
  await db
    .insert(settings)
    .values({ name, setting: payload.setting })
    .onConflictDoUpdate({ target: settings.name, set: { setting: payload.setting, updatedAt: new Date() } });
}

const DAY = 24 * 60 * 60 * 1000;

// ── Job: Trial expiring in ~3 days ───────────────────────────────────────────
export async function jobTrialExpiringSoon() {
  try {
    const now = Date.now();
    const lower = new Date(now + 2.5 * DAY);
    const upper = new Date(now + 3.5 * DAY);

    const rows = await db
      .select({
        subId: subscriptions.id,
        shopId: subscriptions.shop,
        endDate: subscriptions.endDate,
        adminId: shops.admin,
        adminEmail: admins.email,
        adminUsername: admins.username,
        shopName: shops.name,
        pkgType: packages.type,
      })
      .from(subscriptions)
      .innerJoin(packages, eq(subscriptions.package, packages.id))
      .innerJoin(shops, eq(subscriptions.shop, shops.id))
      .innerJoin(admins, eq(shops.admin, admins.id))
      .where(
        and(
          eq(packages.type, "trial"),
          eq(subscriptions.isActive, true),
          gte(subscriptions.endDate, lower),
          lte(subscriptions.endDate, upper),
        ),
      );

    for (const r of rows) {
      if (!r.adminId || !r.adminEmail) continue;
      if (await alreadySent("trial_expiring_soon", r.adminId, 7)) continue;
      const daysLeft = Math.max(0, Math.round(((r.endDate?.getTime() ?? now) - now) / DAY));
      const __res = await sendEmail({
        key: "trial_expiring_soon",
        to: { email: r.adminEmail, name: r.adminUsername ?? undefined },
        vars: {
          adminName: r.adminUsername ?? "there",
          shopName: r.shopName ?? "Pointify",
          daysLeft,
          endDate: r.endDate?.toLocaleDateString() ?? "—",
        },
      });
      if (__res.ok) await markSent("trial_expiring_soon", r.adminId);
    }
    logger.info({ scanned: rows.length }, "scheduler: trial_expiring_soon done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobTrialExpiringSoon failed");
  }
}

// ── Job: Trial expired ~3 days ago (followup) ────────────────────────────────
export async function jobTrialExpiredFollowup() {
  try {
    const now = Date.now();
    const lower = new Date(now - 3.5 * DAY);
    const upper = new Date(now - 2.5 * DAY);

    const rows = await db
      .select({
        subId: subscriptions.id,
        shopId: subscriptions.shop,
        endDate: subscriptions.endDate,
        adminId: shops.admin,
        adminEmail: admins.email,
        adminUsername: admins.username,
        shopName: shops.name,
      })
      .from(subscriptions)
      .innerJoin(packages, eq(subscriptions.package, packages.id))
      .innerJoin(shops, eq(subscriptions.shop, shops.id))
      .innerJoin(admins, eq(shops.admin, admins.id))
      .where(
        and(
          eq(packages.type, "trial"),
          eq(subscriptions.isActive, true),
          gte(subscriptions.endDate, lower),
          lte(subscriptions.endDate, upper),
        ),
      );

    for (const r of rows) {
      if (!r.adminId || !r.adminEmail) continue;
      if (await alreadySent("trial_expired_followup", r.adminId, 60)) continue;
      const __res = await sendEmail({
        key: "trial_expired_followup",
        to: { email: r.adminEmail, name: r.adminUsername ?? undefined },
        vars: {
          adminName: r.adminUsername ?? "there",
          shopName: r.shopName ?? "Pointify",
          endDate: r.endDate?.toLocaleDateString() ?? "—",
        },
      });
      if (__res.ok) await markSent("trial_expired_followup", r.adminId);
    }
    logger.info({ scanned: rows.length }, "scheduler: trial_expired_followup done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobTrialExpiredFollowup failed");
  }
}

// ── Job: Signed up ~2 days ago, no products yet ──────────────────────────────
export async function jobNoProductsNudge() {
  try {
    const now = Date.now();
    const lower = new Date(now - 2.5 * DAY);
    const upper = new Date(now - 1.5 * DAY);

    const candidates = await db
      .select({ id: admins.id, email: admins.email, username: admins.username })
      .from(admins)
      .where(and(gte(admins.createdAt, lower), lte(admins.createdAt, upper)));

    for (const a of candidates) {
      if (!a.email) continue;
      if (await alreadySent("admin_no_products_nudge", a.id, 30)) continue;

      // Does this admin own any shop with at least one (non-deleted) product?
      const myShops = await db.select({ id: shops.id }).from(shops).where(eq(shops.admin, a.id));
      if (myShops.length === 0) continue; // no shops yet — separate signal
      const shopIds = myShops.map((s: { id: number }) => s.id);
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(products)
        .where(and(inArray(products.shop, shopIds), eq(products.isDeleted, false)));
      if (count > 0) continue;

      const __res = await sendEmail({
        key: "admin_no_products_nudge",
        to: { email: a.email, name: a.username ?? undefined },
        vars: { adminName: a.username ?? "there", shopName: "Pointify" },
      });
      if (__res.ok) await markSent("admin_no_products_nudge", a.id);
    }
    logger.info({ scanned: candidates.length }, "scheduler: admin_no_products_nudge done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobNoProductsNudge failed");
  }
}

// ── Job: Signed up ~5 days ago, has products, but never sold anything ────────
export async function jobNoSalesNudge() {
  try {
    const now = Date.now();
    const lower = new Date(now - 5.5 * DAY);
    const upper = new Date(now - 4.5 * DAY);

    // Admins whose signup landed in the day-5 window
    const candidates = await db
      .select({ id: admins.id, email: admins.email, username: admins.username })
      .from(admins)
      .where(and(gte(admins.createdAt, lower), lte(admins.createdAt, upper)));

    for (const a of candidates) {
      if (!a.email) continue;
      if (await alreadySent("admin_no_sales_nudge", a.id, 365)) continue;

      const myShops = await db.select({ id: shops.id }).from(shops).where(eq(shops.admin, a.id));
      if (myShops.length === 0) continue;
      const shopIds = myShops.map((s: { id: number }) => s.id);

      const [{ count: productCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(products)
        .where(and(inArray(products.shop, shopIds), eq(products.isDeleted, false)));
      if (productCount === 0) continue; // covered by no-products nudge

      // Has the admin ever made a sale?
      const [{ count: anySales }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(sales)
        .where(inArray(sales.shop, shopIds));
      if (anySales > 0) continue; // they've sold before — leave them alone

      const __res = await sendEmail({
        key: "admin_no_sales_nudge",
        to: { email: a.email, name: a.username ?? undefined },
        vars: { adminName: a.username ?? "there", shopName: "Pointify" },
      });
      if (__res.ok) await markSent("admin_no_sales_nudge", a.id);
    }
    logger.info({ scanned: candidates.length }, "scheduler: admin_no_sales_nudge done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobNoSalesNudge failed");
  }
}

// ── Job: Subscription renewal reminder (paid plans, ~3 days out) ─────────────
export async function jobSubscriptionRenewalReminder() {
  try {
    const now = Date.now();
    const lower = new Date(now + 2.5 * DAY);
    const upper = new Date(now + 3.5 * DAY);

    const rows = await db
      .select({
        endDate: subscriptions.endDate,
        adminId: shops.admin,
        adminEmail: admins.email,
        adminUsername: admins.username,
        shopName: shops.name,
        amount: subscriptions.amount,
        planName: packages.title,
      })
      .from(subscriptions)
      .innerJoin(packages, eq(subscriptions.package, packages.id))
      .innerJoin(shops, eq(subscriptions.shop, shops.id))
      .innerJoin(admins, eq(shops.admin, admins.id))
      .where(
        and(
          eq(packages.type, "production"),
          eq(subscriptions.isActive, true),
          gte(subscriptions.endDate, lower),
          lte(subscriptions.endDate, upper),
        ),
      );

    for (const r of rows) {
      if (!r.adminId || !r.adminEmail) continue;
      if (await alreadySent("subscription_renewal_reminder", r.adminId, 7)) continue;
      const __res = await sendEmail({
        key: "subscription_renewal_reminder",
        to: { email: r.adminEmail, name: r.adminUsername ?? undefined },
        vars: {
          adminName: r.adminUsername ?? "there",
          shopName: r.shopName ?? "Pointify",
          planName: r.planName ?? "Your plan",
          renewalDate: r.endDate?.toLocaleDateString() ?? "—",
          amount: String(r.amount ?? ""),
        },
      });
      if (__res.ok) await markSent("subscription_renewal_reminder", r.adminId);
    }
    logger.info({ scanned: rows.length }, "scheduler: subscription_renewal_reminder done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobSubscriptionRenewalReminder failed");
  }
}


// ── Job: Welcome features pitch ~24h after signup ────────────────────────────
export async function jobWelcomeFeaturesPitch() {
  try {
    const now = Date.now();
    const lower = new Date(now - 1.5 * DAY);
    const upper = new Date(now - 0.5 * DAY);

    const candidates = await db
      .select({ id: admins.id, email: admins.email, username: admins.username })
      .from(admins)
      .where(and(gte(admins.createdAt, lower), lte(admins.createdAt, upper)));

    for (const a of candidates) {
      if (!a.email) continue;
      if (await alreadySent("admin_welcome_features", a.id, 365)) continue;

      const __res = await sendEmail({
        key: "admin_welcome_features",
        to: { email: a.email, name: a.username ?? undefined },
        vars: { adminName: a.username ?? "there" },
      });
      if (__res.ok) await markSent("admin_welcome_features", a.id);
    }
    logger.info({ scanned: candidates.length }, "scheduler: admin_welcome_features done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobWelcomeFeaturesPitch failed");
  }
}

/** Run every scheduled job once (used at startup and by the daily cron). */
export async function runAllScheduledJobs() {
  await jobTrialExpiringSoon();
  await jobTrialExpiredFollowup();
  await jobNoProductsNudge();
  await jobNoSalesNudge();
  await jobSubscriptionRenewalReminder();
  await jobWelcomeFeaturesPitch();
  await jobSmsSubscriptionExpiryReminders();
  await jobSmsShopDormant();
}


// ── Job: SMS subscription expiry reminders (5d → 1d before, then expired day) ──
import { sendSms } from "./sms.js";

export async function jobSmsSubscriptionExpiryReminders() {
  try {
    const now = Date.now();
    const start = new Date(now - 0.5 * DAY);
    const end = new Date(now + 5.5 * DAY);

    const rows = await db
      .select({
        adminId: subscriptions.admin,
        endDate: subscriptions.endDate,
        username: admins.username,
        email: admins.email,
        phone: admins.phone,
      })
      .from(subscriptions)
      .innerJoin(admins, eq(admins.id, subscriptions.admin))
      .where(and(eq(subscriptions.isActive, true), gte(subscriptions.endDate, start), lte(subscriptions.endDate, end)));

    for (const r of rows) {
      if (!r.phone || !r.adminId) continue;
      const ms = (r.endDate?.getTime() ?? now) - now;
      const daysLeft = Math.round(ms / DAY);

      if (daysLeft <= 0) {
        // Expired today — send once and stop.
        if (await alreadySent("sms_subscription_expired", r.adminId, 90)) continue;
        const res = await sendSms({
          adminId: r.adminId,
          to: r.phone,
          key: "subscription_expired",
          vars: { adminName: r.username ?? r.email ?? "there" },
          system: true,
        });
        if (res.ok) await markSent("sms_subscription_expired", r.adminId);
      } else if (daysLeft >= 1 && daysLeft <= 5) {
        // One reminder per day in the 5-day window — dedupe per (key+day).
        const key = `sms_subscription_expiring_${daysLeft}d`;
        if (await alreadySent(key, r.adminId, 1)) continue;
        const res = await sendSms({
          adminId: r.adminId,
          to: r.phone,
          key: "subscription_expiry_reminder",
          vars: { adminName: r.username ?? r.email ?? "there", daysLeft },
          system: true,
        });
        if (res.ok) await markSent(key, r.adminId);
      }
    }
    logger.info({ scanned: rows.length }, "scheduler: sms subscription expiry done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobSmsSubscriptionExpiryReminders failed");
  }
}

// ── Job: Dormant shop SMS (no sales in last 30 days) ─────────────────────────
export async function jobSmsShopDormant() {
  try {
    const now = Date.now();
    const cutoff = new Date(now - 30 * DAY);

    // Admins with at least one shop
    const adminRows = await db
      .selectDistinct({ id: admins.id, phone: admins.phone, username: admins.username, email: admins.email })
      .from(admins)
      .innerJoin(shops, eq(shops.admin, admins.id));

    for (const a of adminRows) {
      if (!a.phone) continue;
      // Most-recent non-voided/non-refunded sale across this admin's shops
      const [{ lastSaleAt } = { lastSaleAt: null as Date | null }] = await db
        .select({ lastSaleAt: sql<Date | null>`MAX(${sales.createdAt})` })
        .from(sales)
        .innerJoin(shops, eq(shops.id, sales.shop))
        .where(and(eq(shops.admin, a.id), inArray(sales.status, ["cashed", "credit"])));

      // Dormant only if there is no sale at all OR the last sale is older than 30 days
      const lastMs = lastSaleAt ? new Date(lastSaleAt).getTime() : 0;
      if (lastMs && lastMs >= cutoff.getTime()) continue;

      // Send at most once per 30 days per admin
      if (await alreadySent("sms_shop_dormant_30d", a.id, 30)) continue;
      const res = await sendSms({
        adminId: a.id,
        to: a.phone,
        key: "shop_dormant_30d",
        vars: { adminName: a.username ?? a.email ?? "there" },
        system: true,
      });
      if (res.ok) await markSent("sms_shop_dormant_30d", a.id);
    }
    logger.info({ scanned: adminRows.length }, "scheduler: sms shop dormant done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobSmsShopDormant failed");
  }
}
