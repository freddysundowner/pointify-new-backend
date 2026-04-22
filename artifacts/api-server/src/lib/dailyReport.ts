/**
 * Daily report job. For every active admin, queries today's activity
 * across all their shops and sends one summary email with four CSV
 * attachments (sales, purchases, stock alerts, credit sales due today).
 *
 * Scheduled by `scheduler.ts` to run nightly at 20:00 server time.
 */
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import {
  admins,
  shops,
  sales,
  purchases,
  expenses,
  inventory,
  products,
  batches,
  customers,
  settings,
} from "@workspace/db";
import { db } from "./db.js";
import { sendEmail } from "./email.js";
import { logger } from "./logger.js";

const DAY = 24 * 60 * 60 * 1000;

// ── Dedupe (so the job can be safely re-run the same day) ────────────────────
const logName = (adminId: number, dayKey: string) => `notify_log:admin_daily_report:${adminId}:${dayKey}`;
async function alreadySentToday(adminId: number, dayKey: string): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(settings.name, logName(adminId, dayKey)) });
  return !!row;
}
async function markSentToday(adminId: number, dayKey: string) {
  const name = logName(adminId, dayKey);
  await db
    .insert(settings)
    .values({ name, setting: { sentAt: Date.now() } })
    .onConflictDoUpdate({ target: settings.name, set: { setting: { sentAt: Date.now() }, updatedAt: new Date() } });
}

// ── CSV helpers ──────────────────────────────────────────────────────────────
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\n");
}
function csvAttachment(name: string, csv: string): { name: string; content: string } {
  return { name, content: Buffer.from(csv, "utf8").toString("base64") };
}
const num = (v: unknown) => Number(v ?? 0);
const fmtMoney = (v: unknown) => num(v).toFixed(2);

// ── Single-admin report ──────────────────────────────────────────────────────
async function buildAndSendForAdmin(admin: { id: number; email: string; username: string | null }) {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const sevenDaysOut = new Date(startOfDay.getTime() + 7 * DAY);
  const dayKey = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, "0")}-${String(startOfDay.getDate()).padStart(2, "0")}`;

  if (await alreadySentToday(admin.id, dayKey)) return;

  const myShops = await db.select({ id: shops.id, name: shops.name }).from(shops).where(eq(shops.admin, admin.id));
  if (myShops.length === 0) return; // nothing to report
  const shopIds = myShops.map((s: { id: number }) => s.id);
  const shopNameById = new Map(myShops.map((s: { id: number; name: string | null }) => [s.id, s.name ?? `Shop #${s.id}`]));

  // ── Sales today ──
  const todaySales = await db
    .select({
      id: sales.id,
      receiptNo: sales.receiptNo,
      shop: sales.shop,
      total: sales.totalWithDiscount,
      paid: sales.amountPaid,
      outstanding: sales.outstandingBalance,
      paymentType: sales.paymentType,
      status: sales.status,
      customerId: sales.customer,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(inArray(sales.shop, shopIds), gte(sales.createdAt, startOfDay), lte(sales.createdAt, endOfDay)));

  // Drop voided/refunded so they don't pollute counts, totals or the CSV.
  const validSales = todaySales.filter((s) => s.status !== "voided" && s.status !== "refunded");
  let revenue = 0, cashCollected = 0, outstanding = 0;
  for (const s of validSales) {
    revenue += num(s.total);
    cashCollected += num(s.paid);
    outstanding += num(s.outstanding);
  }

  // ── Purchases today ──
  const todayPurchases = await db
    .select({
      id: purchases.id,
      purchaseNo: purchases.purchaseNo,
      shop: purchases.shop,
      total: purchases.totalAmount,
      paid: purchases.amountPaid,
      outstanding: purchases.outstandingBalance,
      paymentType: purchases.paymentType,
      supplier: purchases.supplier,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .where(and(inArray(purchases.shop, shopIds), gte(purchases.createdAt, startOfDay), lte(purchases.createdAt, endOfDay)));
  const purchasesTotal = todayPurchases.reduce((acc: number, p: { total: unknown }) => acc + num(p.total), 0);

  // ── Expenses today ──
  const [{ total: expensesTotal = 0 } = { total: 0 }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount})::numeric, 0)` })
    .from(expenses)
    .where(and(inArray(expenses.shop, shopIds), gte(expenses.createdAt, startOfDay), lte(expenses.createdAt, endOfDay)));

  const profit = revenue - num(expensesTotal);

  // ── Low stock + expiring batches ──
  const lowStock = await db
    .select({
      productId: products.id,
      product: products.name,
      shop: inventory.shop,
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      status: inventory.status,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.product, products.id))
    .where(
      and(
        inArray(inventory.shop, shopIds),
        eq(products.isDeleted, false),
        sql`(${inventory.status} IN ('low','out_of_stock') OR ${inventory.quantity} <= ${inventory.reorderLevel})`,
      ),
    );

  const expiring = await db
    .select({
      batchId: batches.id,
      batchCode: batches.batchCode,
      productId: products.id,
      product: products.name,
      shop: batches.shop,
      quantity: batches.quantity,
      expirationDate: batches.expirationDate,
    })
    .from(batches)
    .innerJoin(products, eq(batches.product, products.id))
    .where(
      and(
        inArray(batches.shop, shopIds),
        sql`${batches.quantity}::numeric > 0`,
        sql`${batches.expirationDate} IS NOT NULL`,
        gte(batches.expirationDate, startOfDay),
        lte(batches.expirationDate, sevenDaysOut),
      ),
    );

  // ── Credit sales due today ──
  const creditDue = await db
    .select({
      id: sales.id,
      receiptNo: sales.receiptNo,
      shop: sales.shop,
      total: sales.totalWithDiscount,
      outstanding: sales.outstandingBalance,
      customerId: sales.customer,
      customerName: customers.name,
      customerPhone: customers.phone,
      dueDate: sales.dueDate,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customer, customers.id))
    .where(
      and(
        inArray(sales.shop, shopIds),
        eq(sales.status, "credit"),
        sql`${sales.outstandingBalance}::numeric > 0`,
        gte(sales.dueDate, startOfDay),
        lte(sales.dueDate, endOfDay),
      ),
    );
  const creditDueAmount = creditDue.reduce((acc: number, s: { outstanding: unknown }) => acc + num(s.outstanding), 0);

  // ── Build CSV attachments ──
  const salesCsv = toCsv(
    ["receipt_no", "shop", "total", "paid", "outstanding", "payment_type", "status", "time"],
    validSales.map((s) => [
      s.receiptNo ?? `#${s.id}`,
      shopNameById.get(s.shop) ?? "",
      fmtMoney(s.total),
      fmtMoney(s.paid),
      fmtMoney(s.outstanding),
      s.paymentType,
      s.status,
      s.createdAt?.toISOString() ?? "",
    ]),
  );
  const purchasesCsv = toCsv(
    ["purchase_no", "shop", "total", "paid", "outstanding", "payment_type", "time"],
    todayPurchases.map((p) => [
      p.purchaseNo ?? `#${p.id}`,
      shopNameById.get(p.shop) ?? "",
      fmtMoney(p.total),
      fmtMoney(p.paid),
      fmtMoney(p.outstanding),
      p.paymentType,
      p.createdAt?.toISOString() ?? "",
    ]),
  );
  const stockCsv = toCsv(
    ["type", "product", "shop", "quantity", "reorder_level_or_expiry", "status_or_batch"],
    [
      ...lowStock.map((s) => [
        "low_stock",
        s.product,
        shopNameById.get(s.shop) ?? "",
        fmtMoney(s.quantity),
        fmtMoney(s.reorderLevel),
        s.status,
      ]),
      ...expiring.map((b) => [
        "expiring",
        b.product,
        shopNameById.get(b.shop) ?? "",
        fmtMoney(b.quantity),
        b.expirationDate?.toISOString().slice(0, 10) ?? "",
        b.batchCode ?? `batch#${b.batchId}`,
      ]),
    ],
  );
  const creditCsv = toCsv(
    ["receipt_no", "shop", "customer", "phone", "total", "outstanding", "due_date"],
    creditDue.map((s) => [
      s.receiptNo ?? `#${s.id}`,
      shopNameById.get(s.shop) ?? "",
      s.customerName ?? "Walk-in",
      s.customerPhone ?? "",
      fmtMoney(s.total),
      fmtMoney(s.outstanding),
      s.dueDate?.toISOString().slice(0, 10) ?? "",
    ]),
  );

  const headlineShop = myShops.length === 1 ? myShops[0]!.name ?? "your shop" : `${myShops.length} shops`;

  const result = await sendEmail({
    key: "admin_daily_report",
    to: { email: admin.email, name: admin.username ?? undefined },
    vars: {
      adminName: admin.username ?? "there",
      shopName: headlineShop,
      reportDate: dayKey,
      revenue: fmtMoney(revenue),
      cashCollected: fmtMoney(cashCollected),
      outstanding: fmtMoney(outstanding),
      expensesTotal: fmtMoney(expensesTotal),
      purchasesTotal: fmtMoney(purchasesTotal),
      profit: fmtMoney(profit),
      profitColor: profit >= 0 ? "#0f766e" : "#b91c1c",
      salesCount: validSales.length,
      purchasesCount: todayPurchases.length,
      lowStockCount: lowStock.length,
      expiringCount: expiring.length,
      creditDueCount: creditDue.length,
      creditDueAmount: fmtMoney(creditDueAmount),
    },
    attachments: [
      csvAttachment(`sales_${dayKey}.csv`, salesCsv),
      csvAttachment(`purchases_${dayKey}.csv`, purchasesCsv),
      csvAttachment(`stock_alerts_${dayKey}.csv`, stockCsv),
      csvAttachment(`credit_due_today_${dayKey}.csv`, creditCsv),
    ],
  });

  if (result.ok) {
    await markSentToday(admin.id, dayKey);
    logger.info(
      { adminId: admin.id, sales: validSales.length, purchases: todayPurchases.length, lowStock: lowStock.length, expiring: expiring.length, creditDue: creditDue.length },
      "daily report sent",
    );
  } else {
    logger.warn({ adminId: admin.id, ...result }, "daily report send failed");
  }
}

export async function jobDailyReport() {
  try {
    const allAdmins = await db
      .select({ id: admins.id, email: admins.email, username: admins.username })
      .from(admins);

    for (const a of allAdmins) {
      if (!a.email) continue;
      try {
        await buildAndSendForAdmin(a);
      } catch (err) {
        logger.warn({ err, adminId: a.id }, "daily report failed for admin");
      }
    }
    logger.info({ scanned: allAdmins.length }, "scheduler: admin_daily_report done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobDailyReport failed");
  }
}


// ── Daily SMS summary ────────────────────────────────────────────────────────
import { sendSms } from "./sms.js";

const fmtKes = (n: unknown) => Number(n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

async function buildAndSendSmsForAdmin(admin: { id: number; phone: string; username: string | null; email: string }) {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const dayKey = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, "0")}-${String(startOfDay.getDate()).padStart(2, "0")}`;

  // Reuse the email-side dedupe key so we don't double-send if both run.
  const settingsKey = `notify_log:admin_daily_summary_sms:${admin.id}:${dayKey}`;
  const existing = await db.query.settings.findFirst({ where: eq(settings.name, settingsKey) });
  if (existing) return;

  const myShops = await db.select({ id: shops.id }).from(shops).where(eq(shops.admin, admin.id));
  if (myShops.length === 0) return;
  const shopIds = myShops.map((s) => s.id);

  const todaySales = await db
    .select({
      total: sales.totalWithDiscount,
      paid: sales.amountPaid,
      status: sales.status,
    })
    .from(sales)
    .where(and(inArray(sales.shop, shopIds), gte(sales.createdAt, startOfDay), lte(sales.createdAt, endOfDay)));

  const valid = todaySales.filter((s) => s.status !== "voided" && s.status !== "refunded");
  const salesCount = valid.length;
  let revenue = 0, cashCollected = 0;
  for (const s of valid) { revenue += num(s.total); cashCollected += num(s.paid); }

  const [{ total: expensesTotal = 0 } = { total: 0 }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount})::numeric, 0)` })
    .from(expenses)
    .where(and(inArray(expenses.shop, shopIds), gte(expenses.createdAt, startOfDay), lte(expenses.createdAt, endOfDay)));
  const profit = revenue - num(expensesTotal);

  const result = await sendSms({
    adminId: admin.id,
    to: admin.phone,
    key: "admin_daily_summary",
    vars: {
      adminName: admin.username ?? admin.email,
      salesCount,
      revenue: fmtKes(revenue),
      cashCollected: fmtKes(cashCollected),
      expenses: fmtKes(expensesTotal),
      profit: fmtKes(profit),
    },
    // Charged to the admin's smsCredit balance (not system-paid).
  });

  if (result.ok) {
    await db
      .insert(settings)
      .values({ name: settingsKey, setting: { sentAt: Date.now() } })
      .onConflictDoUpdate({ target: settings.name, set: { setting: { sentAt: Date.now() }, updatedAt: new Date() } });
  }
}

export async function jobDailySummarySms() {
  try {
    // Only admins who explicitly opted in via saleSmsEnabled and have credits.
    const candidates = await db
      .select({ id: admins.id, phone: admins.phone, username: admins.username, email: admins.email, smsCredit: admins.smsCredit, enabled: admins.saleSmsEnabled })
      .from(admins);

    let sent = 0, skipped = 0;
    for (const a of candidates) {
      if (!a.enabled || (a.smsCredit ?? 0) <= 0 || !a.phone) { skipped++; continue; }
      try {
        await buildAndSendSmsForAdmin({ id: a.id, phone: a.phone, username: a.username, email: a.email });
        sent++;
      } catch (err) {
        logger.warn({ err, adminId: a.id }, "daily summary SMS failed for admin");
      }
    }
    logger.info({ sent, skipped, total: candidates.length }, "scheduler: admin_daily_summary_sms done");
  } catch (err) {
    logger.error({ err }, "scheduler: jobDailySummarySms failed");
  }
}
