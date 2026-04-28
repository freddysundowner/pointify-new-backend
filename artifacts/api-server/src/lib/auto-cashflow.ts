import { eq, and } from "drizzle-orm";
import { cashflows, cashflowCategories } from "@workspace/db";
import { db } from "./db.js";

const SYSTEM_CATEGORIES = {
  sales:     { name: "Sales",     type: "cashin"  },
  expense:   { name: "Expenses",  type: "cashout" },
  purchase:  { name: "Purchases", type: "cashout" },
} as const;

type CategoryKey = keyof typeof SYSTEM_CATEGORIES;

async function getOrCreateSystemCategory(shopId: number, key: CategoryKey): Promise<number> {
  const def = SYSTEM_CATEGORIES[key];
  const existing = await db.query.cashflowCategories.findFirst({
    where: and(
      eq(cashflowCategories.shop, shopId),
      eq(cashflowCategories.name, def.name),
      eq(cashflowCategories.type, def.type)
    ),
    columns: { id: true },
  });
  if (existing) return existing.id;
  const [created] = await db.insert(cashflowCategories)
    .values({ shop: shopId, name: def.name, type: def.type })
    .returning({ id: cashflowCategories.id });
  return created.id;
}

export async function autoRecordCashflow(opts: {
  shopId: number;
  amount: number;
  description: string;
  categoryKey: CategoryKey;
  recordedBy?: number;
}) {
  try {
    const { shopId, amount, description, categoryKey, recordedBy } = opts;
    if (!amount || amount <= 0) return;
    const categoryId = await getOrCreateSystemCategory(shopId, categoryKey);
    await db.insert(cashflows).values({
      shop: shopId,
      description,
      amount: String(amount.toFixed(2)),
      category: categoryId,
      recordedBy: recordedBy ?? null,
      cashflowNo: `CF${Date.now()}`,
    });
  } catch (err) {
    console.error("[auto-cashflow] failed to record entry:", err);
  }
}
