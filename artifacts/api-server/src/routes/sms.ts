import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { admins, smsCreditTransactions } from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getPagination } from "../lib/paginate.js";

const router = Router();

// ── Balance ───────────────────────────────────────────────────────────────────

router.get("/balance", requireAdmin, async (req, res, next) => {
  try {
    const admin = await db.query.admins.findFirst({
      where: eq(admins.id, req.admin!.id),
      columns: { smsCredit: true },
    });
    return ok(res, { sms_credit: admin?.smsCredit ?? 0 });
  } catch (e) { next(e); }
});

// ── Top-up (M-Pesa stub) ──────────────────────────────────────────────────────

router.post("/top-up", requireAdmin, async (req, res, next) => {
  try {
    const { amount, phone, credits } = req.body;
    if (!amount || !credits) throw badRequest("amount and credits required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin!.id) });
    if (!admin) throw notFound("Admin not found");

    const newBalance = (admin.smsCredit ?? 0) + Number(credits);
    await db.update(admins).set({ smsCredit: newBalance }).where(eq(admins.id, admin.id));
    const [tx] = await db.insert(smsCreditTransactions).values({
      admin: admin.id,
      type: "top_up",
      amount: Number(credits),
      balanceAfter: newBalance,
      description: `Purchased ${credits} credits via M-Pesa for KES ${amount}`,
    }).returning();

    return created(res, {
      smsCredit: newBalance,
      transaction: tx,
      phone: phone ?? admin.phone,
      note: "M-Pesa STK push integration stub — credits applied immediately",
    });
  } catch (e) { next(e); }
});

// ── Transactions ledger ───────────────────────────────────────────────────────

router.get("/transactions", requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const type = req.query["type"] ? String(req.query["type"]) : null;
    const from = req.query["from"] ? new Date(String(req.query["from"])) : null;
    const to = req.query["to"] ? new Date(String(req.query["to"])) : null;

    const conds: any[] = [eq(smsCreditTransactions.admin, req.admin!.id)];
    if (type) conds.push(eq(smsCreditTransactions.type, type));
    if (from) conds.push(gte(smsCreditTransactions.createdAt, from));
    if (to) conds.push(lte(smsCreditTransactions.createdAt, to));
    const where = conds.length > 1 ? and(...conds) : conds[0];

    const rows = await db.query.smsCreditTransactions.findMany({
      where, limit, offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const total = await db.$count(smsCreditTransactions, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

export default router;
