import { Router } from "express";
import { eq, ilike, and, lte, sql } from "drizzle-orm";
import { products, productSerials, inventory, attributes, attributeVariants } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin, requireAdminOrAttendant } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/search", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    const shopId = Number(req.query["shopId"]);
    if (!q || !shopId) throw badRequest("q and shopId required");

    const rows = await db.query.products.findMany({
      where: and(
        eq(products.shop, shopId),
        ilike(products.name, `%${q}%`),
      ),
      limit: 20,
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.get("/", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(products.shop, shopId));
    if (categoryId) conditions.push(eq(products.category, categoryId));
    if (search) conditions.push(ilike(products.name, `%${search}%`));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.products.findMany({
      where,
      limit,
      offset,
      orderBy: (p, { asc }) => [asc(p.name)],
    });
    const total = await db.$count(products, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, shopId, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, quantity, measureUnit, manufacturer,
      supplierId, description, alertQuantity, expiryDate, type,
    } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");

    const [product] = await db.insert(products).values({
      name,
      shop: Number(shopId),
      category: categoryId ? Number(categoryId) : null,
      barcode,
      serialNumber,
      buyingPrice: buyingPrice ? String(buyingPrice) : null,
      sellingPrice: sellingPrice ? String(sellingPrice) : null,
      wholesalePrice: wholesalePrice ? String(wholesalePrice) : null,
      dealerPrice: dealerPrice ? String(dealerPrice) : null,
      measureUnit: measureUnit ?? "",
      manufacturer: manufacturer ?? "",
      supplier: supplierId ? Number(supplierId) : null,
      description,
      productType: type ?? "product",
      createdBy: req.attendant?.id ?? null,
    }).returning();

    return created(res, product);
  } catch (e) { next(e); }
});

// ── Attributes (must come before /:id to avoid conflict) ─────────────────────

router.get("/attributes", requireAdminOrAttendant, async (_req, res, next) => {
  try {
    const rows = await db.select().from(attributes);
    const variants = await db.select().from(attributeVariants);
    const enriched = rows.map((attr) => ({
      ...attr,
      variants: variants.filter((v) => v.attributeId === attr.id),
    }));
    return ok(res, enriched);
  } catch (e) { next(e); }
});

router.post("/attributes", requireAdmin, async (req, res, next) => {
  try {
    const { title, name, inputType, type, status } = req.body;
    if (!title || !name) throw badRequest("title and name are required");
    const [row] = await db.insert(attributes).values({ title, name, inputType, type, status }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

router.get("/attributes/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const attr = await db.select().from(attributes).where(eq(attributes.id, Number(req.params["id"])));
    if (!attr.length) throw notFound("Attribute not found");
    const variants = await db.select().from(attributeVariants).where(eq(attributeVariants.attributeId, Number(req.params["id"])));
    return ok(res, { ...attr[0], variants });
  } catch (e) { next(e); }
});

router.post("/attributes/:id/variants", requireAdmin, async (req, res, next) => {
  try {
    const attrId = Number(req.params["id"]);
    const { name, status } = req.body;
    if (!name) throw badRequest("name is required");
    const [row] = await db.insert(attributeVariants).values({ attributeId: attrId, name, status }).returning();
    return created(res, row);
  } catch (e) { next(e); }
});

// ── Product by ID ─────────────────────────────────────────────────────────────

router.get("/:id", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, Number(req.params["id"])),
      with: { category: true },
    });
    if (!product) throw notFound("Product not found");
    return ok(res, product);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const {
      name, categoryId, barcode, serialNumber, buyingPrice, sellingPrice,
      wholesalePrice, dealerPrice, measureUnit, manufacturer,
      supplierId, description, alertQuantity, type,
    } = req.body;

    const [updated] = await db.update(products).set({
      ...(name && { name }),
      ...(categoryId !== undefined && { category: categoryId ? Number(categoryId) : null }),
      ...(barcode !== undefined && { barcode }),
      ...(serialNumber !== undefined && { serialNumber }),
      ...(buyingPrice !== undefined && { buyingPrice: String(buyingPrice) }),
      ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
      ...(wholesalePrice !== undefined && { wholesalePrice: String(wholesalePrice) }),
      ...(dealerPrice !== undefined && { dealerPrice: String(dealerPrice) }),
      ...(measureUnit !== undefined && { measureUnit }),
      ...(manufacturer !== undefined && { manufacturer }),
      ...(supplierId !== undefined && { supplier: supplierId ? Number(supplierId) : null }),
      ...(description !== undefined && { description }),
      ...(alertQuantity !== undefined && { alertQuantity: Number(alertQuantity) }),
      ...(type && { productType: type }),
    }).where(eq(products.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Product not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(products).where(eq(products.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Product not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.put("/:id/image", requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    const file = (req as any).file;
    if (!file) throw badRequest("image file required");
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const [updated] = await db.update(products)
      .set({ thumbnailUrl: imageUrl })
      .where(eq(products.id, Number(req.params["id"])))
      .returning();
    if (!updated) throw notFound("Product not found");
    return ok(res, { imageUrl: updated.thumbnailUrl });
  } catch (e) { next(e); }
});

router.get("/:id/serials", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const rows = await db.query.productSerials.findMany({
      where: eq(productSerials.product, Number(req.params["id"])),
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/:id/serials", requireAdmin, async (req, res, next) => {
  try {
    const { serials } = req.body;
    if (!Array.isArray(serials) || serials.length === 0) throw badRequest("serials array required");
    const productId = Number(req.params["id"]);

    const { shopId } = req.body;
    if (!shopId) throw badRequest("shopId required");

    const rows = await db.insert(productSerials).values(
      serials.map((serialNumber: string) => ({ product: productId, shop: Number(shopId), serialNumber }))
    ).returning();
    return created(res, rows);
  } catch (e) { next(e); }
});

export default router;
