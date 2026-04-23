/**
 * Data backup job — collects all shop data into a JSON bundle and emails it
 * to the shop's configured backupEmail. Runs on a per-shop cadence (daily /
 * weekly / monthly) controlled by shop.backupInterval.
 */
import { eq, gte, and } from "drizzle-orm";
import { shops, products, customers, sales, purchases, expenses, inventory } from "@workspace/db";
import { db } from "./db.js";
import { sendEmailAsync } from "./email.js";
import { logger } from "./logger.js";

/** Returns true if `interval` is due to run today */
function isDue(interval: string | null): boolean {
  if (!interval) return false;
  const now = new Date();
  const day = now.getDay();    // 0=Sun … 6=Sat
  const date = now.getDate();  // 1-31
  switch (interval.toLowerCase()) {
    case "daily":   return true;
    case "weekly":  return day === 1;    // every Monday
    case "monthly": return date === 1;   // 1st of each month
    default:        return false;
  }
}

/** Generate a compact JSON snapshot of all core data for a single shop */
export async function generateSnapshot(shopId: number): Promise<object> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    shopRow,
    productRows,
    customerRows,
    inventoryRows,
    salesRows,
    purchaseRows,
    expenseRows,
  ] = await Promise.all([
    db.query.shops.findFirst({ where: eq(shops.id, shopId) }),
    db.query.products.findMany({ where: eq(products.shop, shopId) }),
    db.query.customers.findMany({ where: eq(customers.shop, shopId) }),
    db.query.inventory.findMany({ where: eq(inventory.shop, shopId) }),
    db.query.sales.findMany({
      where: and(eq(sales.shop, shopId), gte(sales.createdAt, thirtyDaysAgo)),
    }),
    db.query.purchases.findMany({
      where: and(eq(purchases.shop, shopId), gte(purchases.createdAt, thirtyDaysAgo)),
    }),
    db.query.expenses.findMany({
      where: and(eq(expenses.shop, shopId), gte(expenses.createdAt, thirtyDaysAgo)),
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    shop: shopRow,
    products: productRows,
    customers: customerRows,
    inventory: inventoryRows,
    sales: salesRows,
    purchases: purchaseRows,
    expenses: expenseRows,
  };
}

/** Scheduled job — find eligible shops and email their backup */
export async function jobBackup(): Promise<void> {
  try {
    const eligibleShops = await db.query.shops.findMany({
      where: eq(shops.allowBackup, true),
      columns: {
        id: true, name: true, backupEmail: true, backupInterval: true, admin: true,
      },
    });

    for (const shop of eligibleShops) {
      if (!shop.backupEmail || !isDue(shop.backupInterval)) continue;

      try {
        const snapshot = await generateSnapshot(shop.id);
        const json = JSON.stringify(snapshot, null, 2);
        const b64 = Buffer.from(json).toString("base64");
        const date = new Date().toISOString().split("T")[0];
        const filename = `backup-shop-${shop.id}-${date}.json`;

        sendEmailAsync({
          key: `backup-shop-${shop.id}`,
          to: shop.backupEmail,
          subject: `${shop.name ?? "Shop"} — data backup ${date}`,
          html: `<p>Hello,</p>
<p>Please find attached the latest data backup for <strong>${shop.name ?? `Shop ${shop.id}`}</strong>.</p>
<p>This backup includes all products, customers, inventory, and the last 30 days of sales, purchases, and expenses.</p>
<p>Generated: ${new Date().toLocaleString("en-KE")}</p>
<p style="color:#6b7280;font-size:12px">This is an automated backup from Pointify POS.</p>`,
          attachments: [{ name: filename, content: b64 }],
        });

        // Update last backup date
        await db.update(shops).set({ backupDate: new Date() }).where(eq(shops.id, shop.id));
        logger.info({ shopId: shop.id, email: shop.backupEmail }, "backup: sent");
      } catch (err) {
        logger.error({ err, shopId: shop.id }, "backup: failed for shop");
      }
    }
  } catch (err) {
    logger.error({ err }, "backup: job failed");
  }
}
