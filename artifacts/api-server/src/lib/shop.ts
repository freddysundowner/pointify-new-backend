import { eq, and } from "drizzle-orm";
import { shops } from "@workspace/db";
import { db } from "./db.js";
import { forbidden } from "./errors.js";

/**
 * Resolve which shop IDs the caller is allowed to see.
 *  - attendant  → only their assigned shop
 *  - admin      → all shops they own (or a specific one if shopId is given)
 *  - superAdmin → unrestricted (returns null = no shop filter)
 * Returns [] when the caller has no access to the requested shop.
 */
export async function resolveShopFilter(
  req: any,
  requestedShopId: number | null
): Promise<number[] | null> {
  if (req.attendant) {
    const sid = req.attendant.shopId as number;
    if (requestedShopId && requestedShopId !== sid) return [];
    return [sid];
  }
  if (req.admin) {
    if (req.admin.isSuperAdmin) return null;
    if (requestedShopId) {
      const owned = await db.query.shops.findFirst({
        where: and(eq(shops.id, requestedShopId), eq(shops.admin, req.admin.id)),
        columns: { id: true },
      });
      return owned ? [requestedShopId] : [];
    }
    const ownedShops = await db.query.shops.findMany({
      where: eq(shops.admin, req.admin.id),
      columns: { id: true },
    });
    return ownedShops.map((s) => s.id);
  }
  return [];
}

/**
 * Throws 403 if the calling admin does not own `shopId`.
 * Super-admins pass unconditionally.
 * Attendants are allowed only if they are assigned to that shop.
 */
export async function assertShopOwnership(req: any, shopId: number): Promise<void> {
  if (req.admin?.isSuperAdmin) return;
  if (req.attendant) {
    if (req.attendant.shopId !== shopId) throw forbidden("You do not have access to this shop");
    return;
  }
  if (req.admin) {
    const owned = await db.query.shops.findFirst({
      where: and(eq(shops.id, shopId), eq(shops.admin, req.admin.id)),
      columns: { id: true },
    });
    if (!owned) throw forbidden("You do not own this shop");
  }
}
