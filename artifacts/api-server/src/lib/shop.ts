import { eq, and } from "drizzle-orm";
import { shops } from "@workspace/db";
import { db } from "./db.js";
import { forbidden } from "./errors.js";

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
