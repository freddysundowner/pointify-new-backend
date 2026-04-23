import { eq, inArray } from "drizzle-orm";
import { bundleItems, products } from "@workspace/db";
import { db } from "./db.js";

export type BundleItemDetail = {
  id: number;
  product: number;
  componentProduct: number;
  quantity: string;
  createdAt: Date;
  componentName: string | null;
  componentSellingPrice: string | null;
};

/**
 * Given any array of product rows, fetches bundle items for all products that
 * have type === "bundle" in a single SQL query and attaches them as a
 * `bundleItems` array on each product. Non-bundle products get an empty array.
 */
export async function attachBundleItems<T extends { id: number; type: string }>(
  productRows: T[]
): Promise<(T & { bundleItems: BundleItemDetail[] })[]> {
  const bundleIds = productRows
    .filter((p) => p.type === "bundle")
    .map((p) => p.id);

  if (!bundleIds.length) {
    return productRows.map((p) => ({ ...p, bundleItems: [] }));
  }

  const rows = await db
    .select({
      id: bundleItems.id,
      product: bundleItems.product,
      componentProduct: bundleItems.componentProduct,
      quantity: bundleItems.quantity,
      createdAt: bundleItems.createdAt,
      componentName: products.name,
      componentSellingPrice: products.sellingPrice,
    })
    .from(bundleItems)
    .leftJoin(products, eq(bundleItems.componentProduct, products.id))
    .where(inArray(bundleItems.product, bundleIds));

  const grouped = new Map<number, BundleItemDetail[]>();
  for (const row of rows) {
    if (!grouped.has(row.product)) grouped.set(row.product, []);
    grouped.get(row.product)!.push(row as BundleItemDetail);
  }

  return productRows.map((p) => ({
    ...p,
    bundleItems: grouped.get(p.id) ?? [],
  }));
}
