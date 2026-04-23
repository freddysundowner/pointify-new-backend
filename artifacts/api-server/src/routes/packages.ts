import { Router } from "express";
import { eq } from "drizzle-orm";
import { packages, packageFeatures } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, noContent } from "../lib/response.js";
import { notFound, badRequest, unauthorized } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const rows = await db.query.packages.findMany({
      where: eq(packages.isActive, true),
      orderBy: (p, { asc }) => [asc(p.sortOrder)],
      with: { packageFeatures: true },
    });
    return ok(res, rows);
  } catch (e) { next(e); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { title, description, durationValue, durationUnit, amount, amountUsd, type, shops: maxShops, discount, sortOrder } = req.body;
    if (!title || !durationValue || !durationUnit || !amount || !amountUsd || !type) {
      throw badRequest("title, durationValue, durationUnit, amount, amountUsd, type required");
    }
    const [pkg] = await db.insert(packages).values({
      title, description, durationValue, durationUnit,
      amount: String(amount), amountUsd: String(amountUsd),
      type, maxShops: maxShops ?? null,
      discount: discount ? String(discount) : "0",
      sortOrder: sortOrder ?? 0,
    }).returning();
    return created(res, pkg);
  } catch (e) { next(e); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const pkg = await db.query.packages.findFirst({
      where: eq(packages.id, Number(req.params["id"])),
      with: { packageFeatures: true },
    });
    if (!pkg) throw notFound("Package not found");
    return ok(res, pkg);
  } catch (e) { next(e); }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { title, description, durationValue, durationUnit, amount, amountUsd, isActive, sortOrder, discount } = req.body;
    const [updated] = await db.update(packages).set({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(durationValue !== undefined && { durationValue }),
      ...(durationUnit && { durationUnit }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(amountUsd !== undefined && { amountUsd: String(amountUsd) }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(discount !== undefined && { discount: String(discount) }),
    }).where(eq(packages.id, Number(req.params["id"]))).returning();
    if (!updated) throw notFound("Package not found");
    return ok(res, updated);
  } catch (e) { next(e); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    await db.delete(packages).where(eq(packages.id, Number(req.params["id"])));
    return noContent(res);
  } catch (e) { next(e); }
});

router.post("/:id/features", requireAdmin, async (req, res, next) => {
  try {
    if (!req.admin!.isSuperAdmin) throw unauthorized("Super admin required");
    const { features } = req.body;
    if (!features?.length) throw badRequest("features array required");
    const rows = await db.insert(packageFeatures).values(
      features.map((feature: string) => ({ package: Number(req.params["id"]), feature }))
    ).returning();
    return created(res, rows);
  } catch (e) { next(e); }
});

export default router;
