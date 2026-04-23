import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { productTransfers, transferItems } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
import { requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

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
    return paginated(res, rows, { total, page, limit });
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
    const existing = await db.query.productTransfers.findFirst({ where: eq(productTransfers.id, id), columns: { fromShop: true } });
    if (!existing) throw notFound("Transfer not found");
    await assertShopOwnership(req, existing.fromShop);
    await db.delete(productTransfers).where(eq(productTransfers.id, id));
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
