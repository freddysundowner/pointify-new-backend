import { Router } from "express";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { productTransfers, transferItems, inventory, products, shops, bundleItems } from "@workspace/db";
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

    // ── Step 1: Expand bundle products into their components ──────────────────
    // Each entry: { productId, quantity, fromBundleName? }
    const expandedMap = new Map<number, { quantity: number; fromBundleName?: string }>();

    for (const item of items) {
      const productId = Number(item.productId);
      const qty       = Number(item.quantity ?? 1);

      const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: { id: true, type: true, name: true },
      });

      if (product?.type === "bundle") {
        // Fetch components with their names
        const components = await db
          .select({
            componentProduct: bundleItems.componentProduct,
            quantity:         bundleItems.quantity,
            componentName:    products.name,
          })
          .from(bundleItems)
          .leftJoin(products, eq(bundleItems.componentProduct, products.id))
          .where(eq(bundleItems.product, productId));

        for (const comp of components) {
          const needed = parseFloat(comp.quantity) * qty;
          const prev   = expandedMap.get(comp.componentProduct);
          expandedMap.set(comp.componentProduct, {
            quantity:        (prev?.quantity ?? 0) + needed,
            fromBundleName:  product.name,
          });
        }
      } else {
        const prev = expandedMap.get(productId);
        expandedMap.set(productId, { quantity: (prev?.quantity ?? 0) + qty });
      }
    }

    const expandedItems = Array.from(expandedMap.entries()).map(([productId, v]) => ({
      productId,
      quantity: v.quantity,
      fromBundleName: v.fromBundleName,
    }));

    // ── Step 2: Validate stock for all expanded items ─────────────────────────
    const stockErrors: Array<{
      productId: number; productName: string;
      required: number; available: number; fromBundle?: string;
    }> = [];

    await Promise.all(expandedItems.map(async (item) => {
      const inv = await db.query.inventory.findFirst({
        where: and(eq(inventory.product, item.productId), eq(inventory.shop, Number(fromShopId))),
        columns: { quantity: true },
      });
      const available = parseFloat(String(inv?.quantity ?? 0));

      if (available < item.quantity) {
        const prod = await db.query.products.findFirst({
          where: eq(products.id, item.productId),
          columns: { name: true },
        });
        stockErrors.push({
          productId:   item.productId,
          productName: prod?.name ?? `Product #${item.productId}`,
          required:    item.quantity,
          available,
          fromBundle:  item.fromBundleName,
        });
      }
    }));

    if (stockErrors.length > 0) {
      return res.status(422).json({
        success: false,
        message: "Insufficient stock for transfer",
        errors:  stockErrors,
      });
    }

    // ── Step 3: Create the transfer record and move inventory ─────────────────
    const [transfer] = await db.insert(productTransfers).values({
      fromShop:     Number(fromShopId),
      toShop:       Number(toShopId),
      transferNote: note,
      initiatedBy:  req.attendant?.id ?? undefined,
      transferNo:   `TRF${Date.now()}`,
    }).returning();

    const itemRows = await db.insert(transferItems).values(
      expandedItems.map((item) => ({
        transfer:  transfer.id,
        product:   item.productId,
        quantity:  String(item.quantity),
        unitPrice: "0",
      }))
    ).returning();

    const enrichedItems = await Promise.all(
      itemRows.map(async (itemRow) => {
        const qty       = parseFloat(itemRow.quantity);
        const productId = itemRow.product;

        const fromBefore    = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, productId), eq(inventory.shop, transfer.fromShop)),
          columns: { quantity: true },
        });
        const fromQtyBefore = fromBefore ? String(fromBefore.quantity) : "0";
        const fromQtyAfter  = String(Math.max(0, parseFloat(fromQtyBefore) - qty));

        const toBefore    = await db.query.inventory.findFirst({
          where: and(eq(inventory.product, productId), eq(inventory.shop, transfer.toShop)),
          columns: { quantity: true },
        });
        const toQtyBefore = toBefore ? String(toBefore.quantity) : "0";
        const toQtyAfter  = String(parseFloat(toQtyBefore) + qty);

        await db.update(inventory)
          .set({ quantity: sql`GREATEST(0, ${inventory.quantity} - ${qty}::numeric)` })
          .where(and(eq(inventory.product, productId), eq(inventory.shop, transfer.fromShop)));

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
        product:        itemRow.product,
        shop:           transfer.fromShop,
        eventType:      "transfer_out" as const,
        referenceId:    itemRow.id,
        quantity:       itemRow.quantity,
        unitPrice:      itemRow.unitPrice,
        quantityBefore: itemRow.fromQtyBefore,
        quantityAfter:  itemRow.fromQtyAfter,
        note:           transfer.transferNo ?? undefined,
      })),
      ...enrichedItems.map((itemRow) => ({
        product:        itemRow.product,
        shop:           transfer.toShop,
        eventType:      "transfer_in" as const,
        referenceId:    itemRow.id,
        quantity:       itemRow.quantity,
        unitPrice:      itemRow.unitPrice,
        quantityBefore: itemRow.toQtyBefore,
        quantityAfter:  itemRow.toQtyAfter,
        note:           transfer.transferNo ?? undefined,
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
