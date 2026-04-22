import { Router } from "express";
import { eq } from "drizzle-orm";
import { bundleItems, products } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const productId = req.query["productId"] ? Number(req.query["productId"]) : null;

    const where = productId ? eq(bundleItems.product, productId) : undefined;

    const rows = await db.select({
      id: bundleItems.id,
      product: bundleItems.product,
      componentProduct: bundleItems.componentProduct,
      quantity: bundleItems.quantity,
      createdAt: bundleItems.createdAt,
      componentName: products.name,
      componentSellingPrice: products.sellingPrice,
    }).from(bundleItems)
      .leftJoin(products, eq(bundleItems.componentProduct, products.id))
      .where(where as any)
      .limit(limit).offset(offset);

    const total = await db.$count(bundleItems, where as any);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { productId, componentProductId, quantity } = req.body ?? {};
    if (!productId || !componentProductId || quantity == null) {
      throw badRequest("productId, componentProductId and quantity required");
    }
    const [row] = await db.insert(bundleItems).values({
      product: Number(productId),
      componentProduct: Number(componentProductId),
      quantity: String(quantity),
    }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const row = await db.query.bundleItems.findFirst({
      where: eq(bundleItems.id, Number(req.params["id"])),
    });
    if (!row) throw notFound("Bundle item not found");
    return ok(res, row);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { quantity, componentProductId } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (quantity != null) updates["quantity"] = String(quantity);
    if (componentProductId != null) updates["componentProduct"] = Number(componentProductId);
    if (Object.keys(updates).length === 0) throw badRequest("nothing to update");

    const [updated] = await db.update(bundleItems)
      .set(updates as any)
      .where(eq(bundleItems.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Bundle item not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(bundleItems)
      .where(eq(bundleItems.id, Number(req.params["id"])))
      .returning();
    if (!deleted) throw notFound("Bundle item not found");
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;
