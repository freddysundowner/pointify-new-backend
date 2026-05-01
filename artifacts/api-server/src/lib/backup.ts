/**
 * Data backup job — exports shop data as CSV attachments and emails them
 * to the shop's configured backupEmail (or admin email as fallback).
 * Runs nightly at 02:00; each shop's cadence is controlled by backupInterval.
 */
import { eq, gte, and } from "drizzle-orm";
import {
  shops, products, customers, sales, purchases, expenses,
  inventory, loyaltyTransactions, admins,
} from "@workspace/db";
import { db } from "./db.js";
import { sendEmail, sendEmailAsync } from "./email.js";
import { logger } from "./logger.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDue(interval: string | null): boolean {
  if (!interval) return false;
  const now = new Date();
  const day = now.getDay();   // 0=Sun … 6=Sat
  const date = now.getDate(); // 1-31
  const month = now.getMonth(); // 0-11

  // Last day of current month
  const lastDayOfMonth = new Date(now.getFullYear(), month + 1, 0).getDate();

  switch (interval.toLowerCase()) {
    case "daily":        return true;
    case "weekly":       return day === 1;               // every Monday
    case "end_of_month": return date === lastDayOfMonth; // last day of month
    case "yearly":       return date === 1 && month === 0; // Jan 1
    default:             return false;
  }
}

/** Convert an array of flat objects into a CSV string */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

function toB64Csv(rows: Record<string, unknown>[]): string {
  return Buffer.from(toCsv(rows)).toString("base64");
}

// ─── CSV builders ─────────────────────────────────────────────────────────────

function buildSalesCsv(rows: any[]): string {
  const mapped = rows.map(s => ({
    Date: s.createdAt ? new Date(s.createdAt).toLocaleString("en-KE") : "",
    Receipt_No: s.receiptNo ?? "",
    Customer_ID: s.customer ?? "",
    Total: s.total ?? "",
    Discount: s.discount ?? "",
    Tax: s.tax ?? "",
    Payment_Method: s.paymentMethod ?? "",
    Amount_Paid: s.amountPaid ?? "",
    Balance: s.balance ?? "",
    Status: s.status ?? "",
    Notes: s.notes ?? "",
  }));
  return toCsv(mapped);
}

function buildProductsCsv(rows: any[]): string {
  const mapped = rows.map(p => ({
    Name: p.name ?? "",
    SKU: p.sku ?? "",
    Barcode: p.barcode ?? "",
    Category: p.category ?? "",
    Selling_Price: p.sellingPrice ?? "",
    Cost_Price: p.costPrice ?? "",
    Stock_Qty: p.inventoryQty ?? "",
    Min_Stock: p.minStock ?? "",
    Max_Stock: p.maxStock ?? "",
    Status: p.status ?? "",
    Unit: p.unit ?? "",
    Taxable: p.taxable ?? false,
  }));
  return toCsv(mapped);
}

function buildCustomersCsv(rows: any[]): string {
  const mapped = rows.map(c => ({
    Name: c.name ?? "",
    Phone: c.phone ?? "",
    Email: c.email ?? "",
    Loyalty_Points: c.loyaltyPoints ?? 0,
    Outstanding_Balance: c.outstandingBalance ?? 0,
    Total_Purchases: c.totalPurchases ?? 0,
    Address: c.address ?? "",
    Created_At: c.createdAt ? new Date(c.createdAt).toLocaleString("en-KE") : "",
  }));
  return toCsv(mapped);
}

function buildPurchasesCsv(rows: any[]): string {
  const mapped = rows.map(p => ({
    Date: p.createdAt ? new Date(p.createdAt).toLocaleString("en-KE") : "",
    Reference: p.reference ?? "",
    Supplier_ID: p.supplier ?? "",
    Total: p.total ?? "",
    Amount_Paid: p.amountPaid ?? "",
    Balance: p.balance ?? "",
    Payment_Status: p.paymentStatus ?? "",
    Note: p.note ?? "",
  }));
  return toCsv(mapped);
}

function buildExpensesCsv(rows: any[]): string {
  const mapped = rows.map(e => ({
    Date: e.createdAt ? new Date(e.createdAt).toLocaleString("en-KE") : "",
    Description: e.description ?? "",
    Amount: e.amount ?? "",
    Category: e.category ?? "",
    Note: e.note ?? "",
    Recorded_By: e.recordedBy ?? "",
  }));
  return toCsv(mapped);
}

function buildLoyaltyCsv(rows: any[], customerMap: Map<number, string>): string {
  const mapped = rows.map(l => ({
    Date: l.createdAt ? new Date(l.createdAt).toLocaleString("en-KE") : "",
    Customer: customerMap.get(l.customer) ?? `ID ${l.customer}`,
    Type: l.type ?? "",
    Points: l.points ?? "",
    Balance_After: l.balanceAfter ?? "",
    Reference_Sale_ID: l.referenceId ?? "",
    Note: l.note ?? "",
  }));
  return toCsv(mapped);
}

// ─── Snapshot (for manual/test use) ──────────────────────────────────────────

export async function generateSnapshot(shopId: number): Promise<object> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [shopRow, productRows, customerRows, inventoryRows, salesRows, purchaseRows, expenseRows] =
    await Promise.all([
      db.query.shops.findFirst({ where: eq(shops.id, shopId) }),
      db.query.products.findMany({ where: eq(products.shop, shopId) }),
      db.query.customers.findMany({ where: eq(customers.shop, shopId) }),
      db.query.inventory.findMany({ where: eq(inventory.shop, shopId) }),
      db.query.sales.findMany({ where: and(eq(sales.shop, shopId), gte(sales.createdAt, thirtyDaysAgo)) }),
      db.query.purchases.findMany({ where: and(eq(purchases.shop, shopId), gte(purchases.createdAt, thirtyDaysAgo)) }),
      db.query.expenses.findMany({ where: and(eq(expenses.shop, shopId), gte(expenses.createdAt, thirtyDaysAgo)) }),
    ]);
  return { generatedAt: new Date().toISOString(), shop: shopRow, products: productRows, customers: customerRows, inventory: inventoryRows, sales: salesRows, purchases: purchaseRows, expenses: expenseRows };
}

// ─── On-demand pre-delete backup ─────────────────────────────────────────────
/**
 * Generate and synchronously send a full CSV backup for a shop.
 * Called immediately before a data-clear or shop-delete operation so the owner
 * has a copy of their data before it is wiped.
 *
 * Uses `sendEmail` (not fire-and-forget) so the email is confirmed dispatched
 * before the caller proceeds with deletion. On email failure the error is logged
 * and the function resolves without throwing — a broken mail config should not
 * block an intentional delete.
 */
export async function backupShopNow(shopId: number, reason: "data-clear" | "shop-delete"): Promise<void> {
  try {
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId),
      columns: { id: true, name: true, backupEmail: true, admin: true },
    });
    if (!shop) return;

    // Resolve recipient: backupEmail → admin account email → give up
    let recipient = shop.backupEmail;
    if (!recipient && shop.admin) {
      const adminRow = await db.query.admins.findFirst({
        where: eq(admins.id, shop.admin),
        columns: { email: true },
      });
      recipient = adminRow?.email ?? null;
    }
    if (!recipient) {
      logger.warn({ shopId }, "backupShopNow: no email configured, skipping pre-delete backup");
      return;
    }

    const date = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [salesRows, productRows, customerRows, purchaseRows, expenseRows, loyaltyRows] =
      await Promise.all([
        db.query.sales.findMany({ where: and(eq(sales.shop, shopId), gte(sales.createdAt, thirtyDaysAgo)) }),
        db.query.products.findMany({ where: eq(products.shop, shopId) }),
        db.query.customers.findMany({ where: eq(customers.shop, shopId) }),
        db.query.purchases.findMany({ where: and(eq(purchases.shop, shopId), gte(purchases.createdAt, thirtyDaysAgo)) }),
        db.query.expenses.findMany({ where: and(eq(expenses.shop, shopId), gte(expenses.createdAt, thirtyDaysAgo)) }),
        db.query.loyaltyTransactions.findMany({ where: eq(loyaltyTransactions.shop, shopId) }),
      ]);

    const customerMap = new Map<number, string>(
      customerRows.map(c => [c.id, c.name ?? `Customer ${c.id}`])
    );

    const shopName = shop.name ?? `Shop ${shopId}`;
    const attachments = [
      { name: `${shopName}_sales_${date}.csv`,     content: Buffer.from(buildSalesCsv(salesRows)).toString("base64") },
      { name: `${shopName}_stock_${date}.csv`,     content: Buffer.from(buildProductsCsv(productRows)).toString("base64") },
      { name: `${shopName}_customers_${date}.csv`, content: Buffer.from(buildCustomersCsv(customerRows)).toString("base64") },
      { name: `${shopName}_purchases_${date}.csv`, content: Buffer.from(buildPurchasesCsv(purchaseRows)).toString("base64") },
      { name: `${shopName}_expenses_${date}.csv`,  content: Buffer.from(buildExpensesCsv(expenseRows)).toString("base64") },
      { name: `${shopName}_loyalty_${date}.csv`,   content: Buffer.from(buildLoyaltyCsv(loyaltyRows, customerMap)).toString("base64") },
    ];

    const actionLabel = reason === "shop-delete"
      ? "This shop is about to be <strong>permanently deleted</strong>"
      : "All shop data is about to be <strong>permanently cleared</strong> (the shop itself will remain)";

    await sendEmail({
      key: `pre-delete-backup-${shopId}-${Date.now()}`,
      to: recipient,
      subject: `⚠️ ${shopName} — Pre-Deletion Backup ${date}`,
      html: `
<p>Hello,</p>
<p>${actionLabel}. This email contains a full backup of all data taken <strong>immediately before deletion</strong> on ${new Date().toLocaleString("en-KE")}.</p>
<p>The following CSV files are attached:</p>
<ul>
  <li><strong>Sales</strong> — last 30 days (${salesRows.length} records)</li>
  <li><strong>Stock</strong> — all products (${productRows.length} products)</li>
  <li><strong>Customers</strong> — full list (${customerRows.length} customers)</li>
  <li><strong>Purchases</strong> — last 30 days (${purchaseRows.length} records)</li>
  <li><strong>Expenses</strong> — last 30 days (${expenseRows.length} records)</li>
  <li><strong>Loyalty</strong> — full history (${loyaltyRows.length} records)</li>
</ul>
<p style="color:#dc2626;font-weight:bold">Once deletion completes this data cannot be recovered. Please save these files.</p>
<p style="color:#6b7280;font-size:12px">Pointify POS · Automated pre-deletion backup · ${date}</p>`,
      attachments,
    });

    logger.info({ shopId, email: recipient, reason }, "backupShopNow: pre-delete backup sent");
  } catch (err) {
    // Email failure must never block deletion — log and continue
    logger.error({ err, shopId, reason }, "backupShopNow: failed to send pre-delete backup (deletion will still proceed)");
  }
}

// ─── Scheduled job ─────────────────────────────────────────────────────────────

export async function jobBackup(): Promise<void> {
  try {
    const eligibleShops = await db.query.shops.findMany({
      where: eq(shops.allowBackup, true),
      columns: { id: true, name: true, backupEmail: true, backupInterval: true, admin: true },
    });

    for (const shop of eligibleShops) {
      if (!isDue(shop.backupInterval)) continue;

      try {
        // Resolve recipient — use backupEmail if set, otherwise fall back to admin email
        let recipient = shop.backupEmail;
        if (!recipient && shop.admin) {
          const adminRow = await db.query.admins.findFirst({
            where: eq(admins.id, shop.admin),
            columns: { email: true },
          });
          recipient = adminRow?.email ?? null;
        }
        if (!recipient) {
          logger.warn({ shopId: shop.id }, "backup: no email configured, skipping");
          continue;
        }

        const date = new Date().toISOString().split("T")[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // ── Fetch all data in parallel ────────────────────────────────────────
        const [salesRows, productRows, customerRows, purchaseRows, expenseRows, loyaltyRows] =
          await Promise.all([
            db.query.sales.findMany({
              where: and(eq(sales.shop, shop.id), gte(sales.createdAt, thirtyDaysAgo)),
            }),
            db.query.products.findMany({ where: eq(products.shop, shop.id) }),
            db.query.customers.findMany({ where: eq(customers.shop, shop.id) }),
            db.query.purchases.findMany({
              where: and(eq(purchases.shop, shop.id), gte(purchases.createdAt, thirtyDaysAgo)),
            }),
            db.query.expenses.findMany({
              where: and(eq(expenses.shop, shop.id), gte(expenses.createdAt, thirtyDaysAgo)),
            }),
            db.query.loyaltyTransactions.findMany({
              where: eq(loyaltyTransactions.shop, shop.id),
            }),
          ]);

        // Build customer name map for loyalty CSV
        const customerMap = new Map<number, string>(
          customerRows.map(c => [c.id, c.name ?? `Customer ${c.id}`])
        );

        // ── Build CSV attachments ─────────────────────────────────────────────
        const attachments = [
          {
            name: `${shop.name ?? "shop"}_sales_${date}.csv`,
            content: Buffer.from(buildSalesCsv(salesRows)).toString("base64"),
          },
          {
            name: `${shop.name ?? "shop"}_stock_${date}.csv`,
            content: Buffer.from(buildProductsCsv(productRows)).toString("base64"),
          },
          {
            name: `${shop.name ?? "shop"}_customers_${date}.csv`,
            content: Buffer.from(buildCustomersCsv(customerRows)).toString("base64"),
          },
          {
            name: `${shop.name ?? "shop"}_purchases_${date}.csv`,
            content: Buffer.from(buildPurchasesCsv(purchaseRows)).toString("base64"),
          },
          {
            name: `${shop.name ?? "shop"}_expenses_${date}.csv`,
            content: Buffer.from(buildExpensesCsv(expenseRows)).toString("base64"),
          },
          {
            name: `${shop.name ?? "shop"}_loyalty_${date}.csv`,
            content: Buffer.from(buildLoyaltyCsv(loyaltyRows, customerMap)).toString("base64"),
          },
        ];

        sendEmailAsync({
          key: `backup-shop-${shop.id}`,
          to: recipient,
          subject: `${shop.name ?? "Shop"} — Data Backup ${date}`,
          html: `
<p>Hello,</p>
<p>Please find attached the automated data backup for <strong>${shop.name ?? `Shop ${shop.id}`}</strong> as of <strong>${date}</strong>.</p>
<p>The following CSV files are attached:</p>
<ul>
  <li><strong>Sales</strong> — last 30 days of sales transactions (${salesRows.length} records)</li>
  <li><strong>Stock</strong> — all products and current inventory levels (${productRows.length} products)</li>
  <li><strong>Customers</strong> — customer list with loyalty points and balances (${customerRows.length} customers)</li>
  <li><strong>Purchases</strong> — last 30 days of stock purchases/supplier orders (${purchaseRows.length} records)</li>
  <li><strong>Expenses</strong> — last 30 days of recorded expenses (${expenseRows.length} records)</li>
  <li><strong>Loyalty</strong> — full loyalty points transaction history (${loyaltyRows.length} records)</li>
</ul>
<p>All CSV files can be opened directly in Excel, Google Sheets, or any spreadsheet application.</p>
<p style="color:#6b7280;font-size:12px">This is an automated backup from Pointify POS. Generated: ${new Date().toLocaleString("en-KE")}</p>`,
          attachments,
        });

        await db.update(shops).set({ backupDate: new Date() }).where(eq(shops.id, shop.id));
        logger.info({ shopId: shop.id, email: recipient, files: attachments.length }, "backup: sent");
      } catch (err) {
        logger.error({ err, shopId: shop.id }, "backup: failed for shop");
      }
    }
  } catch (err) {
    logger.error({ err }, "backup: job failed");
  }
}
