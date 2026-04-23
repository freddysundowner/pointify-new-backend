/**
 * Public / Customer-facing API
 *
 * These endpoints are accessible without admin/attendant auth so that customers
 * can browse a shop's catalog and place orders online.
 *
 * Authentication:
 *   - Browse endpoints (GET)  → no auth required
 *   - Order placement / tracking → customer JWT required
 *     (issued by POST /auth/customer/login or POST /auth/customer/register)
 */
import { Router } from "express";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import {
  shops, products, productCategories, orders, orderItems, customers, inventory,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { ok, created, paginated } from "../lib/response.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireCustomer } from "../middlewares/auth.js";
import { getPagination, getSearch } from "../lib/paginate.js";

const router = Router();

// ── Shop Info ─────────────────────────────────────────────────────────────────
// Public — no auth required. Only returns safe fields (no internal settings).

router.get("/shops/:shopId", async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    if (!shopId) throw badRequest("Invalid shopId");

    const shop = await db.query.shops.findFirst({
      where: and(eq(shops.id, shopId), eq(shops.allowOnlineSelling, true)),
      columns: {
        id: true,
        name: true,
        address: true,
        contact: true,
        currency: true,
        receiptLogo: true,
        showStockOnline: true,
        showPriceOnline: true,
      },
    });
    if (!shop) throw notFound("Shop not found or not available for online orders");
    return ok(res, shop);
  } catch (e) { next(e); }
});

// ── Product Categories ─────────────────────────────────────────────────────────

router.get("/shops/:shopId/categories", async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    if (!shopId) throw badRequest("Invalid shopId");

    const shop = await db.query.shops.findFirst({
      where: and(eq(shops.id, shopId), eq(shops.allowOnlineSelling, true)),
      columns: { id: true },
    });
    if (!shop) throw notFound("Shop not found or not available for online orders");

    const categories = await db.selectDistinct({
      id: productCategories.id,
      name: productCategories.name,
    })
    .from(productCategories)
    .innerJoin(products, eq(products.category, productCategories.id))
    .where(and(eq(products.shop, shopId), eq(products.isDeleted, false)))
    .orderBy(productCategories.name);
    return ok(res, categories);
  } catch (e) { next(e); }
});

// ── Product Catalog ────────────────────────────────────────────────────────────
// Returns products for a shop. Only returns available (in-stock) products unless
// the shop allows showing out-of-stock items.

router.get("/shops/:shopId/products", async (req, res, next) => {
  try {
    const shopId = Number(req.params["shopId"]);
    if (!shopId) throw badRequest("Invalid shopId");

    const { page, limit, offset } = getPagination(req);
    const search = getSearch(req);
    const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : null;
    const includeOutOfStock = req.query["includeOutOfStock"] === "true";

    const shop = await db.query.shops.findFirst({
      where: and(eq(shops.id, shopId), eq(shops.allowOnlineSelling, true)),
      columns: { id: true, showStockOnline: true, showPriceOnline: true, currency: true },
    });
    if (!shop) throw notFound("Shop not found or not available for online orders");

    const conditions = [
      eq(products.shop, shopId),
      eq(products.isDeleted, false),
    ];
    if (search) conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.description, `%${search}%`)) as ReturnType<typeof eq>);
    if (categoryId) conditions.push(eq(products.category, categoryId));

    const rows = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      sellingPrice: products.sellingPrice,
      images: products.images,
      barcode: products.barcode,
      type: products.type,
      categoryId: products.category,
      inventoryQty: sql<string>`(SELECT ${inventory.quantity} FROM ${inventory} WHERE ${inventory.product} = ${products.id} AND ${inventory.shop} = ${shopId} LIMIT 1)`,
      inventoryStatus: sql<string>`(SELECT ${inventory.status} FROM ${inventory} WHERE ${inventory.product} = ${products.id} AND ${inventory.shop} = ${shopId} LIMIT 1)`,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name)
    .limit(limit)
    .offset(offset);

    // Strip price if shop has prices hidden
    const priced = rows.map((p) => ({
      ...p,
      sellingPrice: shop.showPriceOnline ? p.sellingPrice : undefined,
      inventoryQty: shop.showStockOnline ? p.inventoryQty : undefined,
      inventoryStatus: shop.showStockOnline ? p.inventoryStatus : undefined,
    }));

    // Filter out-of-stock when showStockOnline is enabled and caller didn't opt in
    const filtered = (shop.showStockOnline && !includeOutOfStock)
      ? priced.filter((p) => {
          if (!p.inventoryStatus || p.inventoryStatus === null) return true;
          return p.inventoryStatus !== "out_of_stock";
        })
      : priced;

    const total = await db.$count(products, and(...conditions));
    return paginated(res, filtered, { total, page, limit });
  } catch (e) { next(e); }
});

// ── Place Order (Customer) ─────────────────────────────────────────────────────
// POST /public/orders
// Requires customer JWT. Customer can only place an order linked to their own account.
// Body: { shopId, items: [{productId, quantity, price?}], note?, deliveryAddress? }

router.post("/orders", requireCustomer, async (req, res, next) => {
  try {
    const { shopId, items, note, deliveryAddress } = req.body;
    if (!shopId || !items?.length) throw badRequest("shopId and items are required");

    const shopId_ = Number(shopId);

    // Verify shop accepts online orders
    const shop = await db.query.shops.findFirst({
      where: and(eq(shops.id, shopId_), eq(shops.allowOnlineSelling, true)),
      columns: { id: true, allowOnlineSelling: true },
    });
    if (!shop) throw notFound("Shop not found or not available for online orders");

    // Customer from token
    const customerId = req.customer!.id;

    // Validate that all products belong to this shop and are active
    const productIds = items.map((i: any) => Number(i.productId));
    const productRows = await db.query.products.findMany({
      where: and(eq(products.shop, shopId_), eq(products.isDeleted, false)),
      columns: { id: true, sellingPrice: true, name: true },
    });
    const productMap = new Map(productRows.map((p) => [p.id, p]));
    for (const productId of productIds) {
      if (!productMap.has(productId)) throw badRequest(`Product ${productId} not available in this shop`);
    }

    const orderNo = `ORD${Date.now()}`;
    const [order] = await db.insert(orders).values({
      shop: shopId_,
      customer: customerId,
      orderNo,
      orderNote: note ?? null,
      status: "pending",
    }).returning();

    const itemRows = await db.insert(orderItems).values(
      items.map((item: any) => {
        const p = productMap.get(Number(item.productId));
        return {
          order: order.id,
          product: Number(item.productId),
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.price ?? p?.sellingPrice ?? 0),
        };
      })
    ).returning();

    void notifyOrderConfirmation(order.id);
    return created(res, { ...order, items: itemRows, deliveryAddress });
  } catch (e) { next(e); }
});

// ── Order Status (Customer) ────────────────────────────────────────────────────
// GET /public/orders/:orderNo — customers check their order status by orderNo
// Requires customer JWT (they can only see their own orders)

router.get("/orders/:orderNo", requireCustomer, async (req, res, next) => {
  try {
    const orderNo = String(req.params["orderNo"]);
    const customerId = req.customer!.id;

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.orderNo, orderNo), eq(orders.customer, customerId)),
      with: {
        orderItems: {
          with: { product: { columns: { id: true, name: true, images: true } } },
        },
      },
    });
    if (!order) throw notFound("Order not found");
    return ok(res, order);
  } catch (e) { next(e); }
});

// ── My Orders (Customer) ───────────────────────────────────────────────────────
// GET /public/my-orders — list all orders for the logged-in customer

router.get("/my-orders", requireCustomer, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const customerId = req.customer!.id;
    const status = req.query["status"] ? String(req.query["status"]) : null;

    const conditions = [eq(orders.customer, customerId)];
    if (status) conditions.push(eq(orders.status, status));
    const where = and(...conditions);

    const rows = await db.query.orders.findMany({
      where,
      with: {
        orderItems: {
          with: { product: { columns: { id: true, name: true, images: true, sellingPrice: true } } },
        },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit,
      offset,
    });
    const total = await db.$count(orders, where);
    return paginated(res, rows, { total, page, limit });
  } catch (e) { next(e); }
});

// ── My Profile (Customer) ──────────────────────────────────────────────────────
// GET /public/me — the authenticated customer's own profile

router.get("/me", requireCustomer, async (req, res, next) => {
  try {
    const customerId = req.customer!.id;
    const cust = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });
    if (!cust) throw notFound("Customer not found");
    return ok(res, cust);
  } catch (e) { next(e); }
});

export default router;
