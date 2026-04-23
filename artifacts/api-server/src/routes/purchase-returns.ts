import { Router } from "express";
import { eq } from "drizzle-orm";
import { purchaseReturns, purchaseReturnItems, purchases } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const where = shopId ? eq(purchaseReturns.shop, shopId) : undefined;

    const rows = await db.query.purchaseReturns.findMany({
      where,
      limit,
      offset,
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: { purchaseReturnItems: true },
    });
    const total = await db.$count(purchaseReturns, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { purchaseId, shopId, items, reason, refundMethod } = req.body;
    if (!purchaseId || !shopId || !items?.length) throw badRequest("purchaseId, shopId and items required");
    await assertShopOwnership(req, Number(shopId));

    const purchase = await db.query.purchases.findFirst({ where: eq(purchases.id, Number(purchaseId)) });
    if (!purchase) throw notFound("Purchase not found");

    let refundAmount = 0;
    for (const item of items) refundAmount += (item.unitPrice ?? 0) * (item.quantity ?? 1);

    const [purchaseReturn] = await db.insert(purchaseReturns).values({
      purchase: Number(purchaseId),
      shop: Number(shopId),
      refundAmount: String(refundAmount),
      reason,
      refundMethod: refundMethod ?? "cash",
      processedBy: req.attendant?.id ?? undefined,
      returnNo: `PRE${Date.now()}`,
    }).returning();

    const itemRows = await db.insert(purchaseReturnItems).values(
      items.map((item: any) => ({
        purchaseReturn: purchaseReturn.id,
        product: Number(item.productId),
        purchaseItem: Number(item.purchaseItemId),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
      }))
    ).returning();

    return created(res, { ...purchaseReturn, items: itemRows });
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.purchaseReturns.findFirst({
      where: eq(purchaseReturns.id, Number(req.params["id"])),
      with: { purchaseReturnItems: true },
    });
    if (!row) throw notFound("Purchase return not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.purchaseReturns.findFirst({ where: eq(purchaseReturns.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Purchase return not found");
    await assertShopOwnership(req, existing.shop);
    await db.delete(purchaseReturns).where(eq(purchaseReturns.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
