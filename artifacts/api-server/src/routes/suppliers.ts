import { Router } from "express";
import { eq, ilike, and } from "drizzle-orm";
import { suppliers, supplierWalletTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { assertShopOwnership } from "../lib/shop.js";
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
    await assertShopOwnership(req, Number(shopId));
    const [supplier] = await db.insert(suppliers).values({
      name, phone, email, address,
      shop: Number(shopId),
      ...(creditLimit !== undefined && creditLimit !== null && { creditLimit: String(creditLimit) }),
    }).returning();
    return created(res, supplier);
  } catch (e) { next(e); }
});

router.post("/bulk-import", requireAdmin, async (req, res, next) => {
  try {
    const list = Array.isArray(req.body?.suppliers) ? req.body.suppliers : null;
    if (!list) throw badRequest("suppliers array required");

    const uniqueShopIds = [...new Set(list.filter((s: any) => s?.shopId).map((s: any) => Number(s.shopId)))];
    for (const sid of uniqueShopIds) await assertShopOwnership(req, sid);

    const errors: { index: number; message: string }[] = [];
    let createdCount = 0;
    let skipped = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        if (!s?.name || !s?.shopId) {
          skipped++;
          errors.push({ index: i, message: "name and shopId required" });
          continue;
        }
        await db.insert(suppliers).values({
          name: s.name,
          phone: s.phone ?? null,
          email: s.email ?? null,
          address: s.address ?? null,
          shop: Number(s.shopId),
        });
        createdCount++;
      } catch (err) {
        skipped++;
        errors.push({ index: i, message: (err as Error).message });
      }
    }
    return ok(res, { created: createdCount, skipped, errors });
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
    const id = Number(req.params["id"]);
    const existing = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Supplier not found");
    await assertShopOwnership(req, existing.shop);
    const [updated] = await db.update(suppliers).set({
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(creditLimit !== undefined && { creditLimit: creditLimit !== null ? String(creditLimit) : null }),
    }).where(eq(suppliers.id, id)).returning();
    if (!updated) throw notFound("Supplier not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const existing = await db.query.suppliers.findFirst({ where: eq(suppliers.id, id), columns: { shop: true } });
    if (!existing) throw notFound("Supplier not found");
    await assertShopOwnership(req, existing.shop);
    const [deleted] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    if (!deleted) throw notFound("Supplier not found");
    return noContent(res);
  } catch (e) { next(e); }
});

router.get("/:id/wallet", requireAdmin, async (req, res, next) => {
  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, Number(req.params["id"])),
      columns: { wallet: true },
    });
    if (!supplier) throw notFound("Supplier not found");
    return ok(res, { wallet: supplier.wallet ?? "0.00" });
  } catch (e) { next(e); }
});

router.get("/:id/wallet-transactions", requireAdmin, async (req, res, next) => {
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
    const { amount } = req.body;
    if (!amount) throw badRequest("amount required");
    const supplierId = Number(req.params["id"]);

    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, supplierId) });
    if (!supplier) throw notFound("Supplier not found");
    await assertShopOwnership(req, supplier.shop);

    const newBalance = (parseFloat(supplier.wallet ?? "0") + parseFloat(String(amount))).toFixed(2);
    await db.update(suppliers).set({ wallet: newBalance }).where(eq(suppliers.id, supplierId));
    await db.insert(supplierWalletTransactions).values({
      supplier: supplierId,
      shop: supplier.shop,
      amount: String(amount),
      balance: newBalance,
      type: "deposit",
    });

    return ok(res, { wallet: newBalance });
  } catch (e) { next(e); }
});

async function applySupplierWalletChange(
  req: any,
  type: "deposit" | "withdraw" | "payment" | "refund",
  signedAmount: (n: number) => number,
) {
  const { amount, paymentNo, paymentReference, paymentType } = req.body ?? {};
  if (!amount) throw badRequest("amount required");
  const supplierId = Number(req.params["id"]);
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, supplierId) });
  if (!supplier) throw notFound("Supplier not found");
  await assertShopOwnership(req, supplier.shop);

  const numAmount = parseFloat(String(amount));
  if (Number.isNaN(numAmount) || numAmount <= 0) throw badRequest("amount must be positive");
  const delta = signedAmount(numAmount);
  const current = parseFloat(supplier.wallet ?? "0");
  const newBalance = (current + delta).toFixed(2);

  await db.update(suppliers).set({ wallet: newBalance }).where(eq(suppliers.id, supplierId));
  const [tx] = await db.insert(supplierWalletTransactions).values({
    supplier: supplierId,
    shop: supplier.shop,
    amount: String(numAmount.toFixed(2)),
    balance: newBalance,
    type,
    paymentNo: paymentNo ?? null,
    paymentReference: paymentReference ?? null,
    paymentType: paymentType ?? null,
  }).returning();

  return { wallet: newBalance, transaction: tx };
}

router.post("/:id/wallet/deposit", requireAdmin, async (req, res, next) => {
  try {
    const result = await applySupplierWalletChange(req, "deposit", (n) => n);
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post("/:id/wallet/payment", requireAdmin, async (req, res, next) => {
  try {
    const result = await applySupplierWalletChange(req, "payment", (n) => -n);
    return ok(res, { ...result, note: "Payment recorded against supplier outstanding balance (stub)" });
  } catch (e) { next(e); }
});

export default router;
