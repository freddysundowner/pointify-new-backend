import { productHistory } from "@workspace/db";
import { db } from "./db.js";

export type ProductHistoryEvent = {
  product: number;
  shop: number;
  eventType:
    | "sale"
    | "sale_return"
    | "purchase"
    | "purchase_return"
    | "adjustment"
    | "bad_stock"
    | "stock_count"
    | "transfer_in"
    | "transfer_out";
  referenceId?: number;
  quantity?: string | number;
  unitPrice?: string | number;
  quantityBefore?: string | number;
  quantityAfter?: string | number;
  note?: string;
};

export async function recordProductHistory(events: ProductHistoryEvent[]): Promise<void> {
  if (!events.length) return;
  await db.insert(productHistory).values(
    events.map((e) => ({
      product: e.product,
      shop: e.shop,
      eventType: e.eventType,
      referenceId: e.referenceId ?? null,
      quantity: e.quantity != null ? String(e.quantity) : null,
      unitPrice: e.unitPrice != null ? String(e.unitPrice) : null,
      quantityBefore: e.quantityBefore != null ? String(e.quantityBefore) : null,
      quantityAfter: e.quantityAfter != null ? String(e.quantityAfter) : null,
      note: e.note ?? null,
    }))
  );
}
