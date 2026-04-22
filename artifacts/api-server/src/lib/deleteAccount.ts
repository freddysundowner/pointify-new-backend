/**
 * Hard-delete an admin account and every record that belongs to them.
 *
 * Order matters: child rows must die before parents. Many child tables
 * cascade on their parent FK, so we can rely on cascading where it exists
 * and only explicitly delete the parents (sales, orders, purchases, etc.).
 *
 * The whole thing runs inside a transaction so a failure mid-way leaves
 * the database untouched.
 */
import { eq, inArray, or, sql } from "drizzle-orm";
import {
  admins,
  attendants,
  shops,
  // catalog
  products,
  productCategories,
  batches,
  productSerials,
  inventory,
  adjustments,
  badStocks,
  stockCounts,
  stockRequests,
  // sales / orders / purchases / transfers
  sales,
  saleReturns,
  orders,
  purchases,
  purchaseReturns,
  productTransfers,
  // people
  customers,
  customerWalletTransactions,
  suppliers,
  supplierWalletTransactions,
  // finance
  cashflows,
  expenses,
  banks,
  paymentMethods,
  expenseCategories,
  cashflowCategories,
  userPayments,
  // subscriptions
  subscriptions,
  // communications
  communications,
  smsCreditTransactions,
  emailMessages,
  emailsSent,
  activities,
  // affiliates
  affiliateTransactions,
  awards,
} from "@workspace/db";
import { db } from "./db.js";
import { logger } from "./logger.js";

export interface DeletedAdminSummary {
  id: number;
  email: string;
  username: string | null;
  shopsDeleted: number;
}

export async function deleteAdminAccount(adminId: number): Promise<DeletedAdminSummary | null> {
  const admin = await db.query.admins.findFirst({ where: eq(admins.id, adminId) });
  if (!admin) return null;

  const myShops = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.admin, adminId));
  const shopIds = myShops.map((s: { id: number }) => s.id);

  await db.transaction(async (tx) => {
    if (shopIds.length > 0) {
      // ── Sales (cascades to saleItems, salePayments, saleItemBatches) ──
      await tx.delete(saleReturns).where(inArray(saleReturns.shop, shopIds));
      await tx.delete(sales).where(inArray(sales.shop, shopIds));

      // ── Orders (cascades to orderItems) ──
      await tx.delete(orders).where(inArray(orders.shop, shopIds));

      // ── Purchases (cascades to purchaseItems, purchasePayments) ──
      await tx.delete(purchaseReturns).where(inArray(purchaseReturns.shop, shopIds));
      await tx.delete(purchases).where(inArray(purchases.shop, shopIds));

      // ── Transfers (cascades to transferItems) ──
      await tx
        .delete(productTransfers)
        .where(or(inArray(productTransfers.fromShop, shopIds), inArray(productTransfers.toShop, shopIds)));

      // ── Stock-management ──
      await tx.delete(stockRequests).where(inArray(stockRequests.shop, shopIds));
      await tx.delete(stockCounts).where(inArray(stockCounts.shop, shopIds));
      await tx.delete(badStocks).where(inArray(badStocks.shop, shopIds));
      await tx.delete(adjustments).where(inArray(adjustments.shop, shopIds));
      await tx.delete(inventory).where(inArray(inventory.shop, shopIds));

      // ── Catalog ──
      await tx.delete(productSerials).where(inArray(productSerials.shop, shopIds));
      await tx.delete(batches).where(inArray(batches.shop, shopIds));
      // bundle_items references products with no cascade — kill those rows first.
      await tx.execute(sql`DELETE FROM bundle_items WHERE product_id IN (SELECT id FROM products WHERE shop_id = ANY(${shopIds}))`);
      await tx.execute(sql`DELETE FROM bundle_items WHERE bundle_product_id IN (SELECT id FROM products WHERE shop_id = ANY(${shopIds}))`);
      await tx.delete(products).where(inArray(products.shop, shopIds));

      // ── Finance / wallets (must run before customers + suppliers) ──
      await tx.delete(userPayments).where(inArray(userPayments.shopId, shopIds));
      await tx.delete(customerWalletTransactions).where(inArray(customerWalletTransactions.shop, shopIds));
      await tx.delete(supplierWalletTransactions).where(inArray(supplierWalletTransactions.shop, shopIds));

      // ── People scoped to shop ──
      await tx.delete(customers).where(inArray(customers.shop, shopIds));
      await tx.delete(suppliers).where(inArray(suppliers.shop, shopIds));

      // ── Remaining finance ──
      await tx.delete(cashflows).where(inArray(cashflows.shop, shopIds));
      await tx.delete(expenses).where(inArray(expenses.shop, shopIds));
      await tx.delete(banks).where(inArray(banks.shop, shopIds));
      await tx.delete(paymentMethods).where(inArray(paymentMethods.shop, shopIds));
      await tx.delete(expenseCategories).where(inArray(expenseCategories.shop, shopIds));
      await tx.delete(cashflowCategories).where(inArray(cashflowCategories.shop, shopIds));

      // ── Comms / activity ──
      await tx.delete(activities).where(inArray(activities.shop, shopIds));

      // ── Subscriptions (cascades to subscriptionShops) ──
      await tx.delete(subscriptions).where(inArray(subscriptions.shop, shopIds));
    }

    // ── Admin-scoped (independent of shop, covers admins with no shops) ──
    await tx.delete(subscriptions).where(eq(subscriptions.admin, adminId));
    await tx.delete(userPayments).where(eq(userPayments.adminId, adminId));
    await tx.delete(productCategories).where(eq(productCategories.admin, adminId));
    await tx.delete(attendants).where(eq(attendants.admin, adminId));
    await tx.delete(communications).where(eq(communications.admin, adminId));
    await tx.delete(smsCreditTransactions).where(eq(smsCreditTransactions.admin, adminId));
    await tx.delete(emailMessages).where(eq(emailMessages.admin, adminId));
    await tx.delete(emailsSent).where(eq(emailsSent.admin, adminId));
    await tx.delete(affiliateTransactions).where(eq(affiliateTransactions.admin, adminId));
    await tx.delete(awards).where(eq(awards.fromAdmin, adminId));

    // ── Self-references in admins (referredBy → null) ──
    await tx.execute(sql`UPDATE admins SET referral_admin_id = NULL WHERE referral_admin_id = ${adminId}`);
    // Clear FK pointers on the admin row itself before deleting
    await tx
      .update(admins)
      .set({ shop: null, attendant: null })
      .where(eq(admins.id, adminId));

    // ── Shops ──
    if (shopIds.length > 0) {
      await tx.delete(shops).where(inArray(shops.id, shopIds));
    }

    // ── Admin row ──
    await tx.delete(admins).where(eq(admins.id, adminId));
  });

  logger.info({ adminId, email: admin.email, shopsDeleted: shopIds.length }, "admin account deleted");

  return {
    id: admin.id,
    email: admin.email,
    username: admin.username,
    shopsDeleted: shopIds.length,
  };
}
