/**
 * Per-event email triggers. Each function does the necessary DB lookups,
 * formats template variables, and fires the email asynchronously (never
 * blocking the calling HTTP route).
 *
 * To add a new wired event: write a `notifyXxx(...)` function here and call
 * `sendEmailAsync({ key, to, vars })` with the right template key.
 */
import { eq } from "drizzle-orm";
import {
  admins,
  attendants,
  customers,
  affiliates,
  shops,
  sales,
  orders,
  saleReturns,
  purchases,
  suppliers,
  packages,
  type Admin,
  type Attendant,
  type Customer,
  type Affiliate,
} from "@workspace/db";
import { db } from "./db.js";
import { sendEmailAsync } from "./email.js";
import { logger } from "./logger.js";


/** Wrap an async DB-loading notify helper so its failures never escape as unhandled rejections. */
async function guard<T>(label: string, fn: () => Promise<T>): Promise<void> {
  try { await fn(); } catch (err) { logger.warn({ err, label }, "email notify helper failed"); }
}

async function loadShop(shopId: number | null | undefined) {
  if (!shopId) return null;
  return db.query.shops.findFirst({ where: eq(shops.id, shopId) });
}

function shopVars(shop: { name?: string | null; email?: string | null; phone?: string | null } | null) {
  return {
    shopName: shop?.name ?? "Pointify",
    shopEmail: shop?.email ?? "",
    shopPhone: shop?.phone ?? "",
  };
}

const fmt = (n: unknown) => (n === null || n === undefined || n === "" ? "0.00" : String(n));

// ── Admin / auth ──────────────────────────────────────────────────────────────
export function notifyAdminWelcome(admin: Pick<Admin, "id" | "email" | "username">) {
  if (!admin.email) return;
  sendEmailAsync({
    key: "admin_welcome",
    to: { email: admin.email, name: admin.username ?? undefined },
    vars: {
      ...shopVars(null),
      adminName: admin.username ?? admin.email,
      adminEmail: admin.email,
      adminUsername: admin.username ?? "",
    },
  });
}

export function notifyAdminEmailVerification(admin: Pick<Admin, "email" | "username">, otp: string, expiryMinutes = 10) {
  if (!admin.email) return;
  sendEmailAsync({
    key: "admin_email_verification",
    to: { email: admin.email, name: admin.username ?? undefined },
    vars: { ...shopVars(null), adminName: admin.username ?? admin.email, otp, expiryMinutes },
  });
}

export function notifyAdminPasswordReset(admin: Pick<Admin, "email" | "username">, resetUrl: string, expiryMinutes = 30) {
  if (!admin.email) return;
  sendEmailAsync({
    key: "admin_password_reset",
    to: { email: admin.email, name: admin.username ?? undefined },
    vars: { ...shopVars(null), adminEmail: admin.email, resetUrl, expiryMinutes },
  });
}

export function notifyAdminPasswordChanged(admin: Pick<Admin, "email" | "username">) {
  if (!admin.email) return;
  sendEmailAsync({
    key: "admin_password_changed",
    to: { email: admin.email, name: admin.username ?? undefined },
    vars: {
      ...shopVars(null),
      adminName: admin.username ?? admin.email,
      changedAt: new Date().toLocaleString(),
    },
  });
}

// ── Attendants ────────────────────────────────────────────────────────────────
export async function notifyAttendantWelcome(
  attendant: Pick<Attendant, "id" | "email" | "username" | "shop">,
  tempPassword: string,
) {
  try {
  if (!attendant.email) return;
  const shop = await loadShop(attendant.shop);
  const owner = shop ? await db.query.admins.findFirst({ where: eq(admins.id, shop.admin) }) : null;
  sendEmailAsync({
    key: "attendant_welcome",
    to: { email: attendant.email, name: attendant.username ?? undefined },
    vars: {
      ...shopVars(shop),
      attendantName: attendant.username ?? attendant.email,
      attendantUsername: attendant.username ?? "",
      adminName: owner?.username ?? "Your admin",
      tempPassword,
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifyAttendantWelcome failed");
  }
}

// ── Customers ─────────────────────────────────────────────────────────────────
export async function notifyCustomerWelcome(customer: Pick<Customer, "id" | "email" | "name" | "shop">) {
  try {
  if (!customer.email) return;
  const shop = await loadShop(customer.shop);
  sendEmailAsync({
    key: "customer_welcome",
    to: { email: customer.email, name: customer.name ?? undefined },
    vars: { ...shopVars(shop), customerName: customer.name ?? "there" },
  });
  } catch (err) {
    logger.warn({ err }, "notifyCustomerWelcome failed");
  }
}

export async function notifyCustomerOtpLogin(customer: Pick<Customer, "email" | "name" | "shop">, otp: string) {
  try {
  if (!customer.email) return;
  const shop = await loadShop(customer.shop);
  sendEmailAsync({
    key: "customer_otp_login",
    to: { email: customer.email, name: customer.name ?? undefined },
    vars: { ...shopVars(shop), customerName: customer.name ?? "there", otp },
  });
  } catch (err) {
    logger.warn({ err }, "notifyCustomerOtpLogin failed");
  }
}

export async function notifyCustomerPasswordReset(
  customer: Pick<Customer, "email" | "name" | "shop">,
  resetUrl: string,
  expiryMinutes = 30,
) {
  try {
  if (!customer.email) return;
  const shop = await loadShop(customer.shop);
  sendEmailAsync({
    key: "customer_password_reset",
    to: { email: customer.email, name: customer.name ?? undefined },
    vars: { ...shopVars(shop), customerName: customer.name ?? "there", resetUrl, expiryMinutes },
  });
  } catch (err) {
    logger.warn({ err }, "notifyCustomerPasswordReset failed");
  }
}

// ── Sales / receipts ──────────────────────────────────────────────────────────
export async function notifySaleReceipt(saleId: number) {
  try {
    const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
    if (!sale?.customer) return;
    const cust = await db.query.customers.findFirst({ where: eq(customers.id, sale.customer) });
    if (!cust?.email) return;
    const shop = await loadShop(sale.shop);
    sendEmailAsync({
      key: "sale_receipt",
      to: { email: cust.email, name: cust.name ?? undefined },
      vars: {
        ...shopVars(shop),
        customerName: cust.name ?? "there",
        receiptNo: sale.receiptNo ?? `INV-${sale.id}`,
        saleDate: (sale.createdAt ?? new Date()).toLocaleString(),
        itemsTableRows: "",
        subtotal: fmt(sale.totalAmount),
        tax: fmt(sale.totalTax),
        discount: fmt(sale.saleDiscount),
        total: fmt(sale.totalWithDiscount ?? sale.totalAmount),
        amountPaid: fmt(sale.amountPaid),
        paymentMethod: sale.paymentType ?? "",
      },
    });
  } catch (err) {
    logger.warn({ err, saleId }, "notifySaleReceipt failed");
  }
}

export async function notifySaleRefund(saleReturnId: number) {
  try {
    const ret = await db.query.saleReturns.findFirst({ where: eq(saleReturns.id, saleReturnId) });
    if (!ret) return;
    const sale = ret.sale ? await db.query.sales.findFirst({ where: eq(sales.id, ret.sale) }) : null;
    const cust = ret.customer ? await db.query.customers.findFirst({ where: eq(customers.id, ret.customer) }) : null;
    if (!cust?.email) return;
    const shop = await loadShop(ret.shop);
    sendEmailAsync({
      key: "sale_refund",
      to: { email: cust.email, name: cust.name ?? undefined },
      vars: {
        ...shopVars(shop),
        customerName: cust.name ?? "there",
        receiptNo: sale?.receiptNo ?? `INV-${ret.sale ?? ret.id}`,
        refundAmount: fmt(ret.refundAmount),
        refundMethod: ret.refundMethod ?? "—",
        reason: ret.reason ?? "—",
      },
    });
  } catch (err) {
    logger.warn({ err, saleReturnId }, "notifySaleRefund failed");
  }
}

// ── Online orders ─────────────────────────────────────────────────────────────
async function loadOrderEmailContext(orderId: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order?.customer) return null;
  const cust = await db.query.customers.findFirst({ where: eq(customers.id, order.customer) });
  if (!cust?.email) return null;
  const shop = await loadShop(order.shop);
  return { order, cust, shop };
}

export async function notifyOrderConfirmation(orderId: number) {
  try {
  const ctx = await loadOrderEmailContext(orderId);
  if (!ctx) return;
  const { order, cust, shop } = ctx;
  sendEmailAsync({
    key: "order_confirmation",
    to: { email: cust.email!, name: cust.name ?? undefined },
    vars: {
      ...shopVars(shop),
      customerName: cust.name ?? "there",
      orderNo: order.orderNo ?? `ORD-${order.id}`,
      itemCount: "",
      total: "",
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifyOrderConfirmation failed");
  }
}

export async function notifyOrderShipped(orderId: number, ship: { carrier?: string; trackingNumber?: string; eta?: string } = {}) {
  try {
  const ctx = await loadOrderEmailContext(orderId);
  if (!ctx) return;
  sendEmailAsync({
    key: "order_shipped",
    to: { email: ctx.cust.email!, name: ctx.cust.name ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      orderNo: ctx.order.orderNo ?? `ORD-${ctx.order.id}`,
      carrier: ship.carrier ?? "—",
      trackingNumber: ship.trackingNumber ?? "—",
      eta: ship.eta ?? "—",
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifyOrderShipped failed");
  }
}

export async function notifyOrderDelivered(orderId: number) {
  try {
  const ctx = await loadOrderEmailContext(orderId);
  if (!ctx) return;
  sendEmailAsync({
    key: "order_delivered",
    to: { email: ctx.cust.email!, name: ctx.cust.name ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      orderNo: ctx.order.orderNo ?? `ORD-${ctx.order.id}`,
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifyOrderDelivered failed");
  }
}

export async function notifyOrderCancelled(orderId: number, reason = "—") {
  try {
  const ctx = await loadOrderEmailContext(orderId);
  if (!ctx) return;
  sendEmailAsync({
    key: "order_cancelled",
    to: { email: ctx.cust.email!, name: ctx.cust.name ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      orderNo: ctx.order.orderNo ?? `ORD-${ctx.order.id}`,
      reason,
      refundNote: "",
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifyOrderCancelled failed");
  }
}

// ── Suppliers / purchases ─────────────────────────────────────────────────────
export async function notifyPurchaseOrderToSupplier(purchaseId: number) {
  try {
    const po = await db.query.purchases.findFirst({ where: eq(purchases.id, purchaseId) });
    if (!po?.supplier) return;
    const sup = await db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplier) });
    if (!sup?.email) return;
    const shop = await loadShop(po.shop);
    sendEmailAsync({
      key: "purchase_order_to_supplier",
      to: { email: sup.email, name: sup.name ?? undefined },
      vars: {
        ...shopVars(shop),
        supplierName: sup.name ?? "there",
        poNumber: po.purchaseNo ?? `PO-${po.id}`,
        poDate: (po.createdAt ?? new Date()).toLocaleDateString(),
        itemCount: "",
        poTotal: fmt(po.totalAmount),
        deliveryDate: "",
      },
    });
  } catch (err) {
    logger.warn({ err, purchaseId }, "notifyPurchaseOrderToSupplier failed");
  }
}

// ── Subscriptions / billing ───────────────────────────────────────────────────
async function loadSubscriptionContext(packageId: number, shopId: number) {
  const pkg = await db.query.packages.findFirst({ where: eq(packages.id, packageId) });
  const shop = await loadShop(shopId);
  if (!shop) return null;
  const owner = await db.query.admins.findFirst({ where: eq(admins.id, shop.admin) });
  if (!owner?.email) return null;
  return { pkg, shop, owner };
}

export async function notifySubscriptionActivated(packageId: number, shopId: number, opts: { nextBillingDate?: string; amount?: string } = {}) {
  try {
  const ctx = await loadSubscriptionContext(packageId, shopId);
  if (!ctx) return;
  sendEmailAsync({
    key: "subscription_activated",
    to: { email: ctx.owner.email!, name: ctx.owner.username ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      planName: ctx.pkg?.title ?? "Your plan",
      nextBillingDate: opts.nextBillingDate ?? "—",
      amount: opts.amount ?? fmt(ctx.pkg?.amount),
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifySubscriptionActivated failed");
  }
}

export async function notifySubscriptionPaymentSuccess(
  packageId: number,
  shopId: number,
  opts: { amount: string; reference: string; nextBillingDate?: string },
) {
  try {
  const ctx = await loadSubscriptionContext(packageId, shopId);
  if (!ctx) return;
  sendEmailAsync({
    key: "subscription_payment_success",
    to: { email: ctx.owner.email!, name: ctx.owner.username ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      planName: ctx.pkg?.title ?? "Your plan",
      amount: opts.amount,
      reference: opts.reference,
      nextBillingDate: opts.nextBillingDate ?? "—",
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifySubscriptionPaymentSuccess failed");
  }
}

export async function notifySubscriptionPaymentFailed(
  packageId: number,
  shopId: number,
  opts: { amount: string; failureReason: string },
) {
  try {
  const ctx = await loadSubscriptionContext(packageId, shopId);
  if (!ctx) return;
  sendEmailAsync({
    key: "subscription_payment_failed",
    to: { email: ctx.owner.email!, name: ctx.owner.username ?? undefined },
    vars: {
      ...shopVars(ctx.shop),
      planName: ctx.pkg?.title ?? "Your plan",
      amount: opts.amount,
      failureReason: opts.failureReason,
    },
  });
  } catch (err) {
    logger.warn({ err }, "notifySubscriptionPaymentFailed failed");
  }
}

// ── Affiliates ────────────────────────────────────────────────────────────────
export function notifyAffiliateWelcome(affiliate: Pick<Affiliate, "email" | "name">, referralUrl: string) {
  if (!affiliate.email) return;
  sendEmailAsync({
    key: "affiliate_welcome",
    to: { email: affiliate.email, name: affiliate.name ?? undefined },
    vars: { ...shopVars(null), affiliateName: affiliate.name ?? "there", referralUrl },
  });
}

export function notifyAffiliateCommissionEarned(
  affiliate: Pick<Affiliate, "email" | "name">,
  opts: { commissionAmount: string; availableBalance: string },
) {
  if (!affiliate.email) return;
  sendEmailAsync({
    key: "affiliate_commission_earned",
    to: { email: affiliate.email, name: affiliate.name ?? undefined },
    vars: { ...shopVars(null), affiliateName: affiliate.name ?? "there", ...opts },
  });
}

export function notifyAffiliatePayout(
  affiliate: Pick<Affiliate, "email" | "name">,
  opts: { payoutAmount: string; payoutMethod: string; payoutReference: string },
) {
  if (!affiliate.email) return;
  sendEmailAsync({
    key: "affiliate_payout",
    to: { email: affiliate.email, name: affiliate.name ?? undefined },
    vars: { ...shopVars(null), affiliateName: affiliate.name ?? "there", ...opts },
  });
}

// ── Loyalty / wallets ─────────────────────────────────────────────────────────
export async function notifyWalletTopup(customerId: number, amount: string, walletBalance: string) {
  try {
  const cust = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
  if (!cust?.email) return;
  const shop = await loadShop(cust.shop);
  sendEmailAsync({
    key: "wallet_topup_confirmation",
    to: { email: cust.email, name: cust.name ?? undefined },
    vars: { ...shopVars(shop), customerName: cust.name ?? "there", amount, walletBalance },
  });
  } catch (err) {
    logger.warn({ err }, "notifyWalletTopup failed");
  }
}

export function notifyAccountDeleted(email: string, username: string | null) {
  if (!email) return;
  sendEmailAsync({
    key: "account_deleted",
    to: { email, name: username ?? undefined },
    vars: { adminName: username ?? "there", adminEmail: email },
  });
}