/**
 * High-level SMS event helpers — call these from route handlers / schedulers.
 * Each function is fire-and-forget and never throws.
 */
import { db } from "./db.js";
import { admins, customers, sales, shops } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendSmsAsync } from "./sms.js";
import { buildReceiptUrl } from "./receipts.js";

const fmt = (n: unknown) => Number(n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function smsSubscriptionExpiryReminder(adminId: number, phone: string, adminName: string, daysLeft: number) {
  sendSmsAsync({
    adminId,
    to: phone,
    key: "subscription_expiry_reminder",
    vars: { adminName, daysLeft },
    system: true,
  });
}

export function smsSubscriptionExpired(adminId: number, phone: string, adminName: string) {
  sendSmsAsync({
    adminId,
    to: phone,
    key: "subscription_expired",
    vars: { adminName },
    system: true,
  });
}

export function smsSubscriptionPaymentSuccess(adminId: number, phone: string, adminName: string, planName: string, shopCount: number) {
  sendSmsAsync({
    adminId,
    to: phone,
    key: "subscription_payment_success",
    vars: { adminName, planName, shopCount },
    system: true,
  });
}

export function smsAffiliateCommissionEarned(
  affiliateId: number | null,
  phone: string,
  affiliateName: string,
  adminName: string,
  commission: string | number,
  balance: string | number,
) {
  // Affiliate SMS is platform-paid (system) — affiliates have no smsCredit balance.
  sendSmsAsync({
    adminId: null,
    to: phone,
    key: "affiliate_commission_earned",
    vars: { affiliateName, adminName, commission: fmt(commission), balance: fmt(balance) },
    system: true,
  });
  void affiliateId; // currently unused; reserved for per-affiliate logging if needed
}

export function smsShopDormant(adminId: number, phone: string, adminName: string) {
  sendSmsAsync({
    adminId,
    to: phone,
    key: "shop_dormant_30d",
    vars: { adminName },
    system: true,
  });
}

/**
 * Sale-receipt SMS to the customer. Only fires when:
 *   - admin.saleSmsEnabled = true
 *   - admin.smsCredit > 0
 *   - the sale has a customer with a phone number
 * Credit is charged to the admin (system: false).
 */
export async function notifySaleReceiptSms(saleId: number) {
  try {
    const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!sale?.customer) return;
    const cust = await db.query.customers.findFirst({ where: eq(customers.id, sale.customer) });
    if (!cust?.phone) return;
    const shop = await db.query.shops.findFirst({ where: eq(shops.id, sale.shop) });
    if (!shop?.admin) return;
    const admin = await db.query.admins.findFirst({ where: eq(admins.id, shop.admin) });
    if (!admin?.saleSmsEnabled) return;
    if ((admin.smsCredit ?? 0) <= 0) return;

    sendSmsAsync({
      adminId: admin.id,
      to: cust.phone,
      key: "sale_receipt",
      vars: {
        shopName: shop.name ?? "Pointify",
        itemCount: 1, // overwritten below if we can compute properly
        total: fmt(sale.totalWithDiscount ?? sale.totalAmount),
        receiptUrl: buildReceiptUrl(sale.id),
      },
    });
  } catch (err) {
    logger.warn({ err, saleId }, "notifySaleReceiptSms failed");
  }
}
