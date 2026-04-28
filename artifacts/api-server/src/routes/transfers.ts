import { Router } from "express";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { productTransfers, transferItems, inventory, products, shops } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";
import { recordProductHistory } from "../lib/product-history.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const where = shopId
      ? or(eq(productTransfers.fromShop, shopId), eq(productTransfers.toShop, shopId))
      : undefined;

    const rows = await db.query.productTransfers.findMany({
      where,
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: { transferItems: true },
    });
    const total = await db.$count(productTransfers, where);

    // Enrich with product names and shop names
    const allProductIds = [...new Set(rows.flatMap(r => r.transferItems.map(i => i.product)))];
    const allShopIds = [...new Set(rows.flatMap(r => [r.fromShop, r.toShop]))];

    const [productNames, shopNames] = await Promise.all([
      allProductIds.length
        ? db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, allProductIds))
        : Promise.resolve([]),
      allShopIds.length
        ? db.select({ id: shops.id, name: shops.name }).from(shops).where(inArray(shops.id, allShopIds))
        : Promise.resolve([]),
    ]);

    const pMap: Record<number, string> = {};
    productNames.forEach(p => { pMap[p.id] = p.name; });
    const sMap: Record<number, string> = {};
    shopNames.forEach(s => { sMap[s.id] = s.name; });

    const enriched = rows.map(r => ({
      ...r,
      fromShopName: sMap[r.fromShop] ?? `Shop #${r.fromShop}`,
      toShopName: sMap[r.toShop] ?? `Shop #${r.toShop}`,
      transferItems: r.transferItems.map(i => ({ ...i, productName: pMap[i.product] ?? `Product #${i.product}` })),
    }));

    return paginated(res, enriched, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { fromShopId, toShopId, items, note } = req.body;
    if (!fromShopId || !toShopId || !items?.length) throw badRequest("fromShopId, toShopId and items required");
    await assertShopOwnership(req, Number(fromShopId));

    const [transfer] = await db.insert(productTransfers).values({
      fromShop: Number(fromShopId),
      toShop: Number(toShopId),
      transferNote: note,
      initiatedBy: req.attendant?.id ?? undefined,
      transferNo: `TRF${Date.now()}`,
    }).returning();

    const itemRows = await db.insert(transferItems).values(
      items.map((item: any) => ({
        transfer: transfer.id,
        product: Number(item.productId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
    ).returning();

    // Move inventory between shops and capture before/after for each item
    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow) => {
        const qty = parseFloat(itemRow.quantity);
        const productId = itemRow.product;

        // Read fromShop inventory before deduction
        const fromBefore = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, productId), eq(inventory.shop, transfer.fromShop)),
          columns: { quantity: true },
        });
        const fromQtyBefore = fromBefore ? String(fromBefore.quantity) : "0";
        const fromQtyAfter  = String(Math.max(0, parseFloat(fromQtyBefore) - qty));

        // Read toShop inventory before addition
        const toBefore = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, productId), eq(inventory.shop, transfer.toShop)),
          columns: { quantity: true },
        });
        const toQtyBefore = toBefore ? String(toBefore.quantity) : "0";
        const toQtyAfter  = String(parseFloat(toQtyBefore) + qty);

        // Deduct from source shop
        await db.update(inventory)
          .set({ quantity: sql`GREATEST(0, ${inventory.quantity} - ${qty}::numeric)` })
          .where(and(eq(inventory.product, productId), eq(inventory.shop, transfer.fromShop)));

        // Add to destination shop (create row if it doesn't exist)
        await db.insert(inventory)
          .values({ product: productId, shop: transfer.toShop, quantity: itemRow.quantity })
          .onConflictDoUpdate({
            target: [inventory.product, inventory.shop],
            set: { quantity: sql`${inventory.quantity} + ${qty}::numeric` },
          });

        return { ...itemRow, fromQtyBefore, fromQtyAfter, toQtyBefore, toQtyAfter };
      })
    );

    await recordProductHistory([
      ...enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: transfer.fromShop,
        eventType: "transfer_out" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.fromQtyBefore,
        quantityAfter: itemRow.fromQtyAfter,
        note: transfer.transferNo ?? undefined,
      })),
      ...enrichedItems.map((itemRow) => ({
        product: itemRow.product,
        shop: transfer.toShop,
        eventType: "transfer_in" as const,
        referenceId: itemRow.id,
        quantity: itemRow.quantity,
        unitPrice: itemRow.unitPrice,
        quantityBefore: itemRow.toQtyBefore,
        quantityAfter: itemRow.toQtyAfter,
        note: transfer.transferNo ?? undefined,
      })),
    ]);
    return created(res, { ...transfer, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.productTransfers.findFirst({
      where: eq(productTransfers.id, Number(req.params["id"])),
      with: { transferItems: true },
    });
    if (!row) throw notFound("Transfer not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.productTransfers.findFirst({ where: eq(productTransfers.id, id), columns: { fromShop: true, toShop: true } });
    if (!existing) throw notFound("Transfer not found");
    await assertShopOwnership(req, existing.fromShop);

    // Reverse inventory movements: restore fromShop, deduct toShop
    const items = await db.query.transferItems.findMany({ where: eq(transferItems.transfer, id) });
    if (items.length > 0) {
      const historyEntries: any[] = [];
      await Promise.all(
        items.map(async (item) => {
          const qty = parseFloat(item.quantity);

          // Restore fromShop inventory
          const fromInv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, existing.fromShop)),
            columns: { quantity: true },
          });
          const fromBefore = fromInv?.quantity ?? "0";
          const fromAfter = String(parseFloat(fromBefore) + qty);
          await db.insert(inventory)
            .values({ product: item.product, shop: existing.fromShop, quantity: item.quantity })
            .onConflictDoUpdate({
              target: [inventory.product, inventory.shop],
              set: { quantity: sql`${inventory.quantity} + ${qty}::numeric` },
            });

          // Deduct toShop inventory
          const toInv = await db.query.inventory.findFirst({
            where: and(eq(inventory.product, item.product), eq(inventory.shop, existing.toShop)),
            columns: { quantity: true },
          });
          const toBefore = toInv?.quantity ?? "0";
          const toAfter = String(Math.max(0, parseFloat(toBefore) - qty));
          await db.update(inventory)
            .set({ quantity: toAfter })
            .where(and(eq(inventory.product, item.product), eq(inventory.shop, existing.toShop)));

          historyEntries.push(
            {
              product: item.product,
              shop: existing.fromShop,
              eventType: "transfer_in" as const,
              referenceId: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              quantityBefore: fromBefore,
              quantityAfter: fromAfter,
              note: "Transfer deleted",
            },
            {
              product: item.product,
              shop: existing.toShop,
              eventType: "transfer_out" as const,
              referenceId: item.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              quantityBefore: toBefore,
              quantityAfter: toAfter,
              note: "Transfer deleted",
            }
          );
        })
      );
      await recordProductHistory(historyEntries);
    }

    await db.delete(productTransfers).where(eq(productTransfers.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
