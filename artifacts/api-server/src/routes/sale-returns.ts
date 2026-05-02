import { Router } from "express";
import { eq, and, gte, lte, gt, asc, sql } from "drizzle-orm";
import { saleReturns, saleReturnItems, sales, inventory, admins, attendants, customers, loyaltyTransactions, shops, customerWalletTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { notifySaleRefund } from "../lib/emailEvents.js";
import { recordProductHistory } from "../lib/product-history.js";
import { autoRecordCashflow } from "../lib/auto-cashflow.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const fromDate = req.query["fromDate"] ? String(req.query["fromDate"]) : null;
    const toDate = req.query["toDate"] ? String(req.query["toDate"]) : null;
    const attendantId = req.query["attendantId"] ? Number(req.query["attendantId"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(saleReturns.shop, shopId));
    if (fromDate) conditions.push(gte(saleReturns.createdAt, new Date(`${fromDate}T00:00:00`)));
    if (toDate) conditions.push(lte(saleReturns.createdAt, new Date(`${toDate}T23:59:59`)));
    if (attendantId) conditions.push(eq(saleReturns.processedBy, attendantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.query.saleReturns.findMany({
      where,
      limit,
      offset,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: {
        saleReturnItems: true,
        processedBy: { columns: { id: true, username: true } },
        customer: { columns: { id: true, name: true } },
        shop: { columns: { id: true }, with: { admin: { columns: { id: true, username: true, attendant: true } } } },
      },
    });

    // For returns where processedBy is null, inject the shop admin's username as fallback
    const enriched = rows.map((r: any) => {
      if (!r.processedBy && r.shop?.admin) {
        return { ...r, processedBy: { id: null, username: r.shop.admin.username ?? "Admin" } };
      }
      return r;
    });

    const total = await db.$count(saleReturns, where);
    return paginated(res, enriched, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { saleId, shopId, items, reason, refundMethod } = req.body;
    if (!saleId || !shopId || !items?.length) throw badRequest("saleId, shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const sale = await db.query.sales.findFirst({ where: eq(sales.id, Number(saleId)) });
    if (!sale) throw notFound("Sale not found");

    let refundAmount = 0;
    for (const item of items) refundAmount += (item.unitPrice ?? 0) * (item.quantity ?? 1);

    // Resolve who processed this return — attendant or admin's auto-attendant
    let processedById: number | undefined = req.attendant?.id;
    if (!processedById && req.admin) {
      const adminRecord = await db.query.admins.findFirst({
        where: eq(admins.id, req.admin.id),
        columns: { id: true, attendant: true, username: true },
      });
      if (adminRecord?.attendant) {
        processedById = adminRecord.attendant;
      } else if (adminRecord) {
        // Auto-create an attribution attendant for this admin
        const [newAtt] = await db.insert(attendants).values({
          username: adminRecord.username ?? "Admin",
          admin: adminRecord.id,
          shop: Number(shopId),
        }).returning({ id: attendants.id });
        await db.update(admins).set({ attendant: newAtt.id }).where(eq(admins.id, adminRecord.id));
        processedById = newAtt.id;
      }
    }

    const [saleReturn] = await db.insert(saleReturns).values({
      sale: Number(saleId),
      shop: Number(shopId),
      refundAmount: String(refundAmount),
      reason,
      refundMethod: refundMethod ?? "cash",
      processedBy: processedById,
      returnNo: `RET-TEMP-${Date.now()}`,
    }).returning();

    // Replace with clean sequential number now that we have the ID
    const cleanReturnNo = `RET-${String(saleReturn.id).padStart(5, "0")}`;
    await db.update(saleReturns).set({ returnNo: cleanReturnNo }).where(eq(saleReturns.id, saleReturn.id));
    saleReturn.returnNo = cleanReturnNo;

    const itemRows = await db.insert(saleReturnItems).values(
      items.map((item: any) => ({
        saleReturn: saleReturn.id,
        product: Number(item.productId),
        saleItem: Number(item.saleItemId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
    ).returning();

    // Restore inventory for each returned item and capture before/after quantities
    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow) => {
        const qty = parseFloat(itemRow.quantity);
        const sid = saleReturn.shop;

        const existing = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, itemRow.product), eq(inventory.shop, sid)),
          columns: { quantity: true },
        });
        const qtyBefore = existing ? String(existing.quantity) : "0";
        const qtyAfter  = String(parseFloat(qtyBefore) + qty);

        // Add returned stock back to inventory
        await db.insert(inventory)
          .values({ product: itemRow.product, shop: sid, quantity: itemRow.quantity })
          .onConflictDoUpdate({
            target: [inventory.product, inventory.shop],
            set: { quantity: sql`${inventory.quantity} + ${qty}::numeric` },
          });

        return { ...itemRow, qtyBefore, qtyAfter };
      })
    );

    await recordProductHistory(
      enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: saleReturn.shop,
        eventType: "sale_return" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.qtyBefore,
        quantityAfter: itemRow.qtyAfter,
        note: saleReturn.returnNo,
      }))
    );
    // Mark the sale as fully returned if cumulative refunds cover the original total
    const [{ cumulativeRefunds }] = await db.select({
      cumulativeRefunds: sql<string>`COALESCE(SUM(${saleReturns.refundAmount}::numeric), 0)`,
    }).from(saleReturns).where(eq(saleReturns.sale, Number(saleId)));
    if (parseFloat(cumulativeRefunds) >= parseFloat(sale.totalWithDiscount)) {
      await db.update(sales).set({ status: "returned" }).where(eq(sales.id, Number(saleId)));
    }

    // ── Reduce customer outstanding balance on credit sales ────────────────
    // When items from a credit sale are returned:
    //   1. Cancel the remaining outstanding debt on this sale.
    //   2. Any amount already paid towards this sale is applied to OTHER
    //      outstanding credit sales (oldest first) — reducing their debt.
    //   3. Only if no other debts remain is the amount a cash refund to the
    //      customer (handled physically via refundMethod on the return record;
    //      no wallet entry is created).
    if (sale.customer) {
      const saleOutstanding = parseFloat(String(sale.outstandingBalance ?? "0"));
      const alreadyPaid     = parseFloat(String((sale as any).amountPaid ?? "0"));

      // 1. Cancel remaining debt on this sale
      const debtReduction = Math.min(refundAmount, saleOutstanding);
      if (debtReduction > 0) {
        await db.update(customers)
          .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${debtReduction}::numeric)` })
          .where(eq(customers.id, sale.customer));
        await db.update(sales)
          .set({ outstandingBalance: "0" })
          .where(eq(sales.id, Number(saleId)));
      }

      // 2. Apply any already-paid credit to other outstanding credit sales
      //    alreadyCredited = the portion of refundAmount that was already collected
      //    e.g. refundAmount=100, saleOutstanding=20  → 80 was paid, now credited
      //    e.g. refundAmount=30,  saleOutstanding=50  → 0 (customer still owed 20 more)
      const creditToApply = Math.min(Math.max(0, refundAmount - saleOutstanding), alreadyPaid);
      if (creditToApply > 0) {
        const otherCreditSales = await db.query.sales.findMany({
          where: and(
            eq(sales.customer, sale.customer),
            eq(sales.status, "credit"),
            gt(sales.outstandingBalance, "0"),
          ),
          orderBy: [asc(sales.createdAt)],
        });

        let remaining = creditToApply;
        for (const other of otherCreditSales) {
          if (other.id === Number(saleId)) continue; // skip the returned sale
          if (remaining <= 0) break;

          const owed    = parseFloat(String(other.outstandingBalance));
          const applied = Math.min(remaining, owed);
          const newOwed = Math.max(0, owed - applied).toFixed(2);
          const isFullyPaid = parseFloat(newOwed) === 0;

          await db.update(sales).set({
            outstandingBalance: newOwed,
            amountPaid: sql`${sales.amountPaid}::numeric + ${applied}::numeric`,
            ...(isFullyPaid ? { status: "cashed" } : {}),
          }).where(eq(sales.id, other.id));

          // Reduce customer aggregate outstanding to match
          await db.update(customers)
            .set({ outstandingBalance: sql`GREATEST(0, ${customers.outstandingBalance}::numeric - ${applied}::numeric)` })
            .where(eq(customers.id, sale.customer));

          remaining -= applied;
        }
        // `remaining` after the loop is a cash refund to the customer.
        // It is tracked via saleReturn.refundAmount + refundMethod — no wallet entry needed.
      }
    }

    // ── Reverse loyalty points that were earned on this sale ───────────────
    // Look up all "earn" transactions logged for this sale and reverse them
    // proportionally to the refund amount (full reversal if fully returned,
    // partial proportional reversal for partial returns).
    if (sale.customer) {
      const shopSettings = await db.query.shops.findFirst({
        where: eq(shops.id, Number(shopId)),
        columns: { loyaltyEnabled: true },
      });
      if (shopSettings?.loyaltyEnabled) {
        const earnRows = await db.query.loyaltyTransactions.findMany({
          where: and(
            eq(loyaltyTransactions.customer, sale.customer),
            eq(loyaltyTransactions.shop, Number(shopId)),
            eq(loyaltyTransactions.type, "earn"),
            eq(loyaltyTransactions.referenceId, Number(saleId)),
          ),
        });
        const totalEarned = earnRows.reduce((s, r) => s + parseFloat(String(r.points)), 0);
        if (totalEarned > 0) {
          // Proportional reversal: refundAmount / sale.totalWithDiscount
          const saleTotal = parseFloat(String(sale.totalWithDiscount ?? sale.totalAmount ?? "0"));
          const fraction = saleTotal > 0 ? Math.min(1, refundAmount / saleTotal) : 1;
          const pointsToReverse = Math.floor(totalEarned * fraction);
          if (pointsToReverse > 0) {
            const custRow = await db.query.customers.findFirst({
              where: eq(customers.id, sale.customer),
              columns: { loyaltyPoints: true },
            });
            const currentPoints = parseFloat(String(custRow?.loyaltyPoints ?? 0));
            const newPoints = Math.max(0, currentPoints - pointsToReverse);
            await db.update(customers)
              .set({ loyaltyPoints: String(newPoints.toFixed(2)) })
              .where(eq(customers.id, sale.customer));
            await db.insert(loyaltyTransactions).values({
              customer: sale.customer,
              shop: Number(shopId),
              type: "adjust",
              points: String((-pointsToReverse).toFixed(2)),
              balanceAfter: String(newPoints.toFixed(2)),
              referenceId: Number(saleId),
              note: `Points reversed for return ${saleReturn.returnNo}`,
            });
          }
        }
      }
    }

    void notifySaleRefund(saleReturn.id);
    void autoRecordCashflow({
      shopId: Number(shopId),
      amount: refundAmount,
      description: `Sale Return ${sale.receiptNo ?? saleId}`,
      categoryKey: "sale_return",
      recordedBy: req.attendant?.id,
    });
    return created(res, { ...saleReturn, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.saleReturns.findFirst({
      where: eq(saleReturns.id, Number(req.params["id"])),
      with: { saleReturnItems: true },
    });
    if (!row) throw notFound("Sale return not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.saleReturns.findFirst({ where: eq(saleReturns.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Sale return not found");
    await assertShopOwnership(req, existing.shop);

    // Re-deduct inventory that was credited when the return was created
    const items = await db.query.saleReturnItems.findMany({ where: eq(saleReturnItems.saleReturn, id) });
    if (items.length > 0) {
      const enriched = await Promise.all(
        items.map(async (item) => {
          const qty = parseFloat(item.quantity);
          const inv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, existing.shop)),
            columns: { quantity: true },
          });
          const qtyBefore = inv?.quantity ?? "0";
          const qtyAfter = String(Math.max(0, parseFloat(qtyBefore) - qty));
          await db.update(inventory)
            .set({ quantity: qtyAfter })
            .where(and(eq(inventory.product, item.product), eq(inventory.shop, existing.shop)));
          return { ...item, qtyBefore, qtyAfter };
        })
      );
      await recordProductHistory(
        enriched.map((item) => ({
          product: item.product,
          shop: existing.shop,
          eventType: "adjustment" as const,
          referenceId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          quantityBefore: item.qtyBefore,
          quantityAfter: item.qtyAfter,
          note: "Sale return deleted",
        }))
      );
    }

    await db.delete(saleReturns).where(eq(saleReturns.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
