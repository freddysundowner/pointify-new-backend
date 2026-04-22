import { Router } from "express";
import { eq, ilike, and } from "drizzle-orm";
import { suppliers, supplierWalletTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const shopId = req.query["shopId"] ? Number(req.query["shopId"]) : null;

    const conditions = [];
    if (shopId) conditions.push(eq(suppliers.shop, shopId));
    if (search) conditions.push(ilike(suppliers.name, `%${search}%`));
    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db.query.suppliers.findMany({ where, limit, offset, orderBy: (s, { asc }) => [asc(s.name)] });
    const total = await db.$count(suppliers, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, phone, email, shopId, creditLimit, address } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");
    const [supplier] = await db.insert(suppliers).values({
      name, phone, email, address,
      shop: Number(shopId),
      creditLimit: creditLimit ? String(creditLimit) : null,
    }).returning();
    return created(res, supplier);
  } catch (e) { next(e); }
});

router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, Number(req.params["id"])) });
    if (!supplier) throw notFound("Supplier not found");
    return ok(res, supplier);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { name, phone, email, address, creditLimit } = req.body;
    const [updated] = await db.update(suppliers).set({
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(creditLimit !== undefined && { creditLimit: creditLimit ? String(creditLimit) : null }),
    }).where(eq(suppliers.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Supplier not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [deleted] = await db.delete(suppliers).where(eq(suppliers.id, Number(req.params["id"]))).returning();
    if (!deleted) throw notFound("Supplier not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.get("/:id/wallet", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const supplierId = Number(req.params["id"]);
    const rows = await db.query.supplierWalletTransactions.findMany({
      where: eq(supplierWalletTransactions.supplier, supplierId),
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(supplierWalletTransactions, eq(supplierWalletTransactions.supplier, supplierId));
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

router.post("/:id/wallet", requireAdmin, async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    if (!amount) throw badRequest("amount required");
    const supplierId = Number(req.params["id"]);

    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, supplierId) });
    if (!supplier) throw notFound("Supplier not found");

    const newBalance = (parseFloat(supplier.wallet ?? "0") + parseFloat(String(amount))).toFixed(2);
    await db.update(suppliers).set({ wallet: newBalance }).where(eq(suppliers.id, supplierId));
    await db.insert(supplierWalletTransactions).values({
      supplier: supplierId,
      amount: String(amount),
      balance: newBalance,
      type: "payment",
      description: note ?? "Payment",
    });

    return ok(res, { wallet: newBalance });
  } catch (e) { next(e); }
});

export default router;
