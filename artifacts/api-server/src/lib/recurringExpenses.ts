import { and, eq, lte } from "drizzle-orm";
import { db } from "./db.js";
import { expenses } from "@workspace/db";
import { logger } from "./logger.js";
import { autoRecordCashflow } from "./auto-cashflow.js";

function computeNextOccurrence(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "friday": {
      const dow = now.getDay();
      const daysUntilFriday = (5 - dow + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntilFriday);
      break;
    }
    case "saturday": {
      const dow = now.getDay();
      const daysUntilSaturday = (6 - dow + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntilSaturday);
      break;
    }
    case "start_of_month":
      next.setMonth(next.getMonth() + 1, 1);
      break;
    case "end_of_month":
      next.setDate(0);
      if (next <= now) next.setMonth(now.getMonth() + 2, 0);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

export async function jobRecurringExpenses(): Promise<void> {
  try {
    const now = new Date();
    const due = await db.query.expenses.findMany({
      where: and(
        eq(expenses.isRecurring, true),
        lte(expenses.nextOccurrenceAt, now),
      ),
    });

    if (due.length === 0) return;
    logger.info({ count: due.length }, "recurringExpenses: processing due entries");

    for (const exp of due) {
      try {
        const nextOccurrenceAt = exp.frequency
          ? computeNextOccurrence(exp.frequency)
          : null;

        const [newRow] = await db
          .insert(expenses)
          .values({
            shop: exp.shop,
            description: exp.description,
            amount: exp.amount,
            category: exp.category,
            recordedBy: exp.recordedBy,
            isRecurring: true,
            frequency: exp.frequency,
            nextOccurrenceAt,
            expenseNo: `EXP${Date.now()}`,
          })
          .returning();

        await db
          .update(expenses)
          .set({ nextOccurrenceAt })
          .where(eq(expenses.id, exp.id));

        void autoRecordCashflow({
          shopId: exp.shop,
          amount: parseFloat(String(exp.amount)),
          description: exp.description
            ? `Expense: ${exp.description}`
            : `Expense ${newRow.expenseNo}`,
          categoryKey: "expense",
        });

        logger.info({ expenseId: exp.id, newId: newRow.id }, "recurringExpenses: cloned");
      } catch (err) {
        logger.error({ err, expenseId: exp.id }, "recurringExpenses: failed to clone entry");
      }
    }
  } catch (err) {
    logger.error({ err }, "recurringExpenses: job failed");
  }
}
