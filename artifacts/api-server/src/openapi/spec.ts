const bearer = {
  BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
};

const paginationParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
];

const searchParam = {
  name: "search",
  in: "query",
  schema: { type: "string" },
};

const idParam = (name = "id") => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer" },
});

const auth = (roles: string[]) => ({
  "x-roles": roles,
  security: [{ BearerAuth: [] }],
});

function ok(description: string, props: Record<string, unknown> = {}) {
  return {
    200: {
      description,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { success: { type: "boolean" }, data: props },
          },
        },
      },
    },
  };
}

function list(description: string) {
  return {
    200: {
      description,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "array", items: {} },
              meta: {
                type: "object",
                properties: {
                  total: { type: "integer" },
                  page: { type: "integer" },
                  limit: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function body(props: Record<string, unknown>, required?: string[]) {
  return {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { type: "object", properties: props, required },
        },
      },
    },
  };
}

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pointify POS API",
    version: "2.0.0",
    description:
      "Backend API for the Pointify POS system. Use the **Authorize** button with `Bearer <token>` to authenticate.\n\n**Token types:** Admin · Attendant · Customer · Affiliate",
  },
  servers: [{ url: "/api", description: "Current server" }],
  components: {
    securitySchemes: bearer,
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
    },
  },
  tags: [
    { name: "Auth" },
    { name: "Shops" },
    { name: "Shop Categories" },
    { name: "Settings" },
    { name: "Measures" },
    { name: "Product Categories" },
    { name: "Products" },
    { name: "Inventory" },
    { name: "Adjustments" },
    { name: "Bad Stocks" },
    { name: "Stock Counts" },
    { name: "Stock Requests" },
    { name: "Transfers" },
    { name: "Customers" },
    { name: "Orders" },
    { name: "Sales" },
    { name: "Sale Returns" },
    { name: "Purchases" },
    { name: "Purchase Returns" },
    { name: "Suppliers" },
    { name: "Expenses" },
    { name: "Cashflow" },
    { name: "Banks" },
    { name: "Payment Methods" },
    { name: "Affiliates" },
    { name: "Subscriptions" },
    { name: "Packages" },
    { name: "Admin" },
    { name: "Attendants" },
    { name: "Permissions" },
    { name: "Reports" },
    { name: "Communications" },
    { name: "Email Templates" },
    { name: "Sync" },
    { name: "Activities" },
  ],
  paths: {
    // ── Health ────────────────────────────────────────────────────────────────
    "/healthz": {
      get: {
        tags: ["Auth"],
        summary: "Health check",
        responses: { 200: { description: "OK" } },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────────────────
    "/auth/admin/register": {
      post: {
        tags: ["Auth"],
        summary: "Register admin account",
        ...body({
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string" },
          phone: { type: "string" },
          referralCode: { type: "string" },
        }, ["name", "email", "password"]),
        responses: { 201: { description: "Admin registered, OTP sent" } },
      },
    },
    "/auth/admin/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email with OTP",
        ...body({ email: { type: "string" }, otp: { type: "string" } }, ["email", "otp"]),
        responses: { 200: { description: "Email verified" } },
      },
    },
    "/auth/admin/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Resend OTP",
        ...body({ email: { type: "string" } }, ["email"]),
        responses: { 200: { description: "OTP resent" } },
      },
    },
    "/auth/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin login",
        ...body({
          email: { type: "string" },
          password: { type: "string" },
        }, ["email", "password"]),
        responses: ok("JWT token + admin object"),
      },
    },
    "/auth/admin/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset OTP",
        ...body({ email: { type: "string" } }, ["email"]),
        responses: { 200: { description: "OTP sent" } },
      },
    },
    "/auth/admin/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with OTP",
        ...body({
          email: { type: "string" },
          otp: { type: "string" },
          password: { type: "string" },
        }, ["email", "otp", "password"]),
        responses: { 200: { description: "Password updated" } },
      },
    },
    "/auth/admin/reset-password-sms": {
      post: {
        tags: ["Auth"],
        summary: "Reset password via SMS OTP",
        ...body({
          phone: { type: "string" },
          otp: { type: "string" },
          password: { type: "string" },
        }, ["phone", "otp", "password"]),
        responses: { 200: { description: "Password updated" } },
      },
    },
    "/auth/admin/save-local": {
      post: {
        tags: ["Auth"],
        summary: "Save admin credentials locally (offline mode)",
        ...auth(["Admin"]),
        responses: { 200: { description: "Credentials hash saved" } },
      },
    },
    "/auth/admin/logout": {
      post: {
        tags: ["Auth"],
        summary: "Admin logout",
        ...auth(["Admin"]),
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/auth/attendant/login": {
      post: {
        tags: ["Auth"],
        summary: "Attendant login",
        ...body({
          pin: { type: "string" },
          shopId: { type: "integer" },
        }, ["pin", "shopId"]),
        responses: ok("JWT token + attendant object"),
      },
    },
    "/auth/attendant/logout": {
      post: {
        tags: ["Auth"],
        summary: "Attendant logout",
        ...auth(["Attendant"]),
        responses: { 200: { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        ...auth(["Admin", "Attendant"]),
        responses: ok("Current user profile"),
      },
    },
    "/auth/me/last-seen": {
      put: {
        tags: ["Auth"],
        summary: "Update last seen timestamp",
        ...auth(["Admin", "Attendant"]),
        responses: { 200: { description: "Updated" } },
      },
    },
    "/auth/customer/register": {
      post: {
        tags: ["Auth"],
        summary: "Customer self-registration",
        ...body({
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          password: { type: "string" },
          shopId: { type: "integer" },
        }, ["name", "shopId"]),
        responses: { 201: { description: "Customer registered" } },
      },
    },
    "/auth/customer/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current customer profile",
        ...auth(["Customer"]),
        responses: ok("Customer profile"),
      },
    },
    "/auth/customer/login": {
      post: {
        tags: ["Auth"],
        summary: "Customer login",
        ...body({
          emailOrPhone: { type: "string" },
          password: { type: "string" },
          shopId: { type: "integer" },
        }, ["emailOrPhone", "password", "shopId"]),
        responses: ok("JWT token + customer object"),
      },
    },
    "/auth/customer/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Customer forgot password",
        ...body({ emailOrPhone: { type: "string" }, shopId: { type: "integer" } }, ["emailOrPhone", "shopId"]),
        responses: { 200: { description: "OTP sent" } },
      },
    },
    "/auth/customer/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Customer reset password",
        ...body({
          emailOrPhone: { type: "string" },
          otp: { type: "string" },
          password: { type: "string" },
          shopId: { type: "integer" },
        }, ["emailOrPhone", "otp", "password", "shopId"]),
        responses: { 200: { description: "Password updated" } },
      },
    },

    // ── Shops ─────────────────────────────────────────────────────────────────
    "/shops": {
      get: {
        tags: ["Shops"],
        summary: "List shops for authenticated admin",
        ...auth(["Admin"]),
        responses: list("Shops list"),
      },
      post: {
        tags: ["Shops"],
        summary: "Create a new shop",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          categoryId: { type: "integer" },
          address: { type: "string" },
          currency: { type: "string" },
          phone: { type: "string" },
        }, ["name"]),
        responses: ok("Created shop", {}),
      },
    },
    "/shops/{shopId}": {
      get: {
        tags: ["Shops"],
        summary: "Get shop by ID",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId")],
        responses: ok("Shop details"),
      },
      put: {
        tags: ["Shops"],
        summary: "Update shop",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        ...body({ name: { type: "string" }, address: { type: "string" } }),
        responses: ok("Updated shop"),
      },
      delete: {
        tags: ["Shops"],
        summary: "Delete shop",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/shops/{shopId}/data": {
      delete: {
        tags: ["Shops"],
        summary: "Wipe all data for this shop (keep structure)",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        responses: { 200: { description: "Data cleared" } },
      },
    },
    "/shops/by-referral/{referralId}": {
      get: {
        tags: ["Shops"],
        summary: "Find shop by referral code",
        parameters: [{ name: "referralId", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Shop matching referral code"),
      },
    },
    "/shops/{shopId}/redeem-usage": {
      post: {
        tags: ["Shops"],
        summary: "Redeem free-trial usage unit",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        responses: { 200: { description: "Usage redeemed" } },
      },
    },
    "/shops/{shopId}/backup-interval": {
      put: {
        tags: ["Shops"],
        summary: "Update sync backup interval",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        ...body({ interval: { type: "integer" } }, ["interval"]),
        responses: { 200: { description: "Updated" } },
      },
    },

    // ── Shop Categories ───────────────────────────────────────────────────────
    "/shop-categories": {
      get: {
        tags: ["Shop Categories"],
        summary: "List shop categories",
        parameters: [...paginationParams, searchParam],
        responses: list("Shop categories"),
      },
      post: {
        tags: ["Shop Categories"],
        summary: "Create shop category",
        ...auth(["Admin"]),
        ...body({ name: { type: "string" }, icon: { type: "string" } }, ["name"]),
        responses: ok("Created", {}),
      },
    },
    "/shop-categories/{id}": {
      get: {
        tags: ["Shop Categories"],
        summary: "Get shop category",
        parameters: [idParam()],
        responses: ok("Shop category"),
      },
      put: {
        tags: ["Shop Categories"],
        summary: "Update shop category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Shop Categories"],
        summary: "Delete shop category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    "/settings/{shopId}": {
      get: {
        tags: ["Settings"],
        summary: "Get shop settings",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId")],
        responses: ok("Settings object"),
      },
      put: {
        tags: ["Settings"],
        summary: "Update shop settings",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        ...body({
          currency: { type: "string" },
          taxRate: { type: "number" },
          receiptFooter: { type: "string" },
          lowStockAlert: { type: "integer" },
        }),
        responses: ok("Updated settings"),
      },
    },

    // ── Measures ──────────────────────────────────────────────────────────────
    "/measures": {
      get: {
        tags: ["Measures"],
        summary: "List measure units",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, searchParam],
        responses: list("Measure units"),
      },
      post: {
        tags: ["Measures"],
        summary: "Create measure unit",
        ...auth(["Admin"]),
        ...body({ name: { type: "string" } }, ["name"]),
        responses: ok("Created measure unit", {}),
      },
    },
    "/measures/{id}": {
      get: {
        tags: ["Measures"],
        summary: "Get measure unit",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Measure unit"),
      },
      put: {
        tags: ["Measures"],
        summary: "Update measure unit",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Measures"],
        summary: "Delete measure unit",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Product Categories ────────────────────────────────────────────────────
    "/product-categories": {
      get: {
        tags: ["Product Categories"],
        summary: "List product categories",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams,
          searchParam,
          { name: "shopId", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Product categories"),
      },
      post: {
        tags: ["Product Categories"],
        summary: "Create product category",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          shopId: { type: "integer" },
          color: { type: "string" },
        }, ["name", "shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/product-categories/{id}": {
      get: {
        tags: ["Product Categories"],
        summary: "Get product category",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Product category"),
      },
      put: {
        tags: ["Product Categories"],
        summary: "Update product category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, color: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Product Categories"],
        summary: "Delete product category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Products ──────────────────────────────────────────────────────────────
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams,
          searchParam,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "categoryId", in: "query", schema: { type: "integer" } },
          { name: "lowStock", in: "query", schema: { type: "boolean" } },
        ],
        responses: list("Products"),
      },
      post: {
        tags: ["Products"],
        summary: "Create product",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          shopId: { type: "integer" },
          categoryId: { type: "integer" },
          barcode: { type: "string" },
          buyingPrice: { type: "number" },
          sellingPrice: { type: "number" },
          quantity: { type: "number" },
          unit: { type: "string" },
          measureId: { type: "integer" },
          alertQuantity: { type: "integer" },
          expiryDate: { type: "string", format: "date" },
        }, ["name", "shopId", "sellingPrice"]),
        responses: ok("Created product", {}),
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get product",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Product"),
      },
      put: {
        tags: ["Products"],
        summary: "Update product",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          name: { type: "string" },
          buyingPrice: { type: "number" },
          sellingPrice: { type: "number" },
          quantity: { type: "number" },
        }),
        responses: ok("Updated product"),
      },
      delete: {
        tags: ["Products"],
        summary: "Delete product",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/products/{id}/image": {
      put: {
        tags: ["Products"],
        summary: "Upload product image",
        ...auth(["Admin"]),
        parameters: [idParam()],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" } } } } },
        },
        responses: ok("Image URL updated"),
      },
    },
    "/products/search": {
      get: {
        tags: ["Products"],
        summary: "Quick product search by name/barcode",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: list("Matched products"),
      },
    },
    "/products/{id}/serials": {
      get: {
        tags: ["Products"],
        summary: "List serials for a product",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: list("Serial numbers"),
      },
      post: {
        tags: ["Products"],
        summary: "Add serial numbers to product",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ serials: { type: "array", items: { type: "string" } } }, ["serials"]),
        responses: ok("Serials added"),
      },
    },

    // ── Bundle Items ──────────────────────────────────────────────────────────
    "/bundle-items": {
      get: {
        tags: ["Products"],
        summary: "List bundle items",
        ...auth(["Admin", "Attendant"]),
        parameters: [{ name: "productId", in: "query", schema: { type: "integer" } }],
        responses: list("Bundle items"),
      },
      post: {
        tags: ["Products"],
        summary: "Create bundle item",
        ...auth(["Admin"]),
        ...body({
          productId: { type: "integer" },
          bundledProductId: { type: "integer" },
          quantity: { type: "number" },
        }, ["productId", "bundledProductId", "quantity"]),
        responses: ok("Created", {}),
      },
    },
    "/bundle-items/{id}": {
      put: {
        tags: ["Products"],
        summary: "Update bundle item",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ quantity: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Products"],
        summary: "Delete bundle item",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Inventory ─────────────────────────────────────────────────────────────
    "/shops/{shopId}/inventory": {
      get: {
        tags: ["Inventory"],
        summary: "List inventory for shop",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId"), ...paginationParams, searchParam],
        responses: list("Inventory rows"),
      },
    },
    "/inventory/{id}": {
      get: {
        tags: ["Inventory"],
        summary: "Get inventory record",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Inventory record"),
      },
    },

    // ── Adjustments ───────────────────────────────────────────────────────────
    "/adjustments": {
      get: {
        tags: ["Adjustments"],
        summary: "List stock adjustments",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Adjustments"),
      },
      post: {
        tags: ["Adjustments"],
        summary: "Create stock adjustment",
        ...auth(["Admin", "Attendant"]),
        ...body({
          productId: { type: "integer" },
          shopId: { type: "integer" },
          quantity: { type: "number" },
          type: { type: "string", enum: ["increase", "decrease"] },
          reason: { type: "string" },
        }, ["productId", "shopId", "quantity", "type"]),
        responses: ok("Created adjustment", {}),
      },
    },
    "/adjustments/{id}": {
      get: {
        tags: ["Adjustments"],
        summary: "Get adjustment",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Adjustment"),
      },
      delete: {
        tags: ["Adjustments"],
        summary: "Delete adjustment",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Bad Stocks ────────────────────────────────────────────────────────────
    "/bad-stocks": {
      get: {
        tags: ["Bad Stocks"],
        summary: "List bad stocks (damaged / expired)",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Bad stock records"),
      },
      post: {
        tags: ["Bad Stocks"],
        summary: "Record bad stock",
        ...auth(["Admin", "Attendant"]),
        ...body({
          productId: { type: "integer" },
          shopId: { type: "integer" },
          quantity: { type: "number" },
          reason: { type: "string" },
        }, ["productId", "shopId", "quantity"]),
        responses: ok("Created", {}),
      },
    },
    "/bad-stocks/{id}": {
      get: {
        tags: ["Bad Stocks"],
        summary: "Get bad stock record",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Bad stock"),
      },
      delete: {
        tags: ["Bad Stocks"],
        summary: "Delete bad stock record",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Stock Counts ──────────────────────────────────────────────────────────
    "/stock-counts": {
      get: {
        tags: ["Stock Counts"],
        summary: "List stock counts",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Stock counts"),
      },
      post: {
        tags: ["Stock Counts"],
        summary: "Create stock count session",
        ...auth(["Admin"]),
        ...body({
          shopId: { type: "integer" },
          title: { type: "string" },
        }, ["shopId"]),
        responses: ok("Created stock count", {}),
      },
    },
    "/stock-counts/{id}": {
      get: {
        tags: ["Stock Counts"],
        summary: "Get stock count with items",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Stock count"),
      },
      put: {
        tags: ["Stock Counts"],
        summary: "Update stock count (approve / add items)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ status: { type: "string", enum: ["draft", "completed"] }, items: { type: "array" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Stock Counts"],
        summary: "Delete stock count",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/stock-counts/product-search": {
      get: {
        tags: ["Stock Counts"],
        summary: "Search products for stock count",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: list("Products with current quantity"),
      },
    },
    "/stock-counts/by-product/{productId}": {
      get: {
        tags: ["Stock Counts"],
        summary: "Stock count history for a product",
        ...auth(["Admin"]),
        parameters: [idParam("productId")],
        responses: list("Stock count records for product"),
      },
    },

    // ── Stock Requests ────────────────────────────────────────────────────────
    "/stock-requests": {
      get: {
        tags: ["Stock Requests"],
        summary: "List stock requests",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Stock requests"),
      },
      post: {
        tags: ["Stock Requests"],
        summary: "Create stock request",
        ...auth(["Admin", "Attendant"]),
        ...body({
          fromShopId: { type: "integer" },
          toShopId: { type: "integer" },
          items: { type: "array" },
        }, ["fromShopId", "toShopId", "items"]),
        responses: ok("Created", {}),
      },
    },
    "/stock-requests/{id}": {
      get: {
        tags: ["Stock Requests"],
        summary: "Get stock request",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Stock request"),
      },
      put: {
        tags: ["Stock Requests"],
        summary: "Update stock request status",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ status: { type: "string", enum: ["pending", "approved", "rejected", "fulfilled"] } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Stock Requests"],
        summary: "Delete stock request",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Transfers ─────────────────────────────────────────────────────────────
    "/transfers": {
      get: {
        tags: ["Transfers"],
        summary: "List stock transfers",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Transfers"),
      },
      post: {
        tags: ["Transfers"],
        summary: "Create stock transfer",
        ...auth(["Admin"]),
        ...body({
          fromShopId: { type: "integer" },
          toShopId: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "integer" },
                quantity: { type: "number" },
              },
            },
          },
        }, ["fromShopId", "toShopId", "items"]),
        responses: ok("Transfer created", {}),
      },
    },
    "/transfers/{id}": {
      get: {
        tags: ["Transfers"],
        summary: "Get transfer",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Transfer with items"),
      },
      delete: {
        tags: ["Transfers"],
        summary: "Delete transfer (if pending)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Customers ─────────────────────────────────────────────────────────────
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams,
          searchParam,
          { name: "shopId", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Customers"),
      },
      post: {
        tags: ["Customers"],
        summary: "Create customer",
        ...auth(["Admin", "Attendant"]),
        ...body({
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          shopId: { type: "integer" },
          creditLimit: { type: "number" },
        }, ["name", "shopId"]),
        responses: ok("Created customer", {}),
      },
    },
    "/customers/{id}": {
      get: {
        tags: ["Customers"],
        summary: "Get customer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Customer"),
      },
      put: {
        tags: ["Customers"],
        summary: "Update customer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, phone: { type: "string" }, creditLimit: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Customers"],
        summary: "Delete customer",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/customers/{id}/wallet": {
      get: {
        tags: ["Customers"],
        summary: "Get customer wallet transactions",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), ...paginationParams],
        responses: list("Wallet transactions"),
      },
      post: {
        tags: ["Customers"],
        summary: "Top up customer wallet",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }, ["amount"]),
        responses: ok("Wallet updated"),
      },
    },
    "/customers/{id}/verify": {
      put: {
        tags: ["Customers"],
        summary: "Verify customer account",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Verified"),
      },
    },

    // ── Orders ────────────────────────────────────────────────────────────────
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        ...auth(["Admin", "Attendant", "Customer"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: list("Orders"),
      },
      post: {
        tags: ["Orders"],
        summary: "Place order",
        ...auth(["Admin", "Attendant", "Customer"]),
        ...body({
          shopId: { type: "integer" },
          customerId: { type: "integer" },
          items: { type: "array" },
        }, ["shopId", "items"]),
        responses: ok("Created order", {}),
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get order",
        ...auth(["Admin", "Attendant", "Customer"]),
        parameters: [idParam()],
        responses: ok("Order with items"),
      },
      put: {
        tags: ["Orders"],
        summary: "Update order status",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ status: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Orders"],
        summary: "Cancel / delete order",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Sales ─────────────────────────────────────────────────────────────────
    "/sales": {
      get: {
        tags: ["Sales"],
        summary: "List sales",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "customerId", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Sales"),
      },
      post: {
        tags: ["Sales"],
        summary: "Create sale",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId: { type: "integer" },
          customerId: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "integer" },
                quantity: { type: "number" },
                price: { type: "number" },
                discount: { type: "number" },
              },
            },
          },
          paymentMethod: { type: "string" },
          amountPaid: { type: "number" },
          discount: { type: "number" },
          note: { type: "string" },
        }, ["shopId", "items"]),
        responses: ok("Created sale", {}),
      },
    },
    "/sales/{id}": {
      get: {
        tags: ["Sales"],
        summary: "Get sale",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Sale with items and payments"),
      },
      put: {
        tags: ["Sales"],
        summary: "Update sale",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ note: { type: "string" }, discount: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Sales"],
        summary: "Delete / void sale",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Voided" } },
      },
    },
    "/sales/{id}/payments": {
      post: {
        tags: ["Sales"],
        summary: "Add payment to sale",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({
          amount: { type: "number" },
          method: { type: "string" },
          reference: { type: "string" },
        }, ["amount", "method"]),
        responses: ok("Payment recorded"),
      },
    },
    "/sales/cross-shop": {
      get: {
        tags: ["Sales"],
        summary: "Cross-shop sales summary",
        ...auth(["Admin"]),
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Cross-shop totals"),
      },
    },

    // ── Sale Returns ──────────────────────────────────────────────────────────
    "/sale-returns": {
      get: {
        tags: ["Sale Returns"],
        summary: "List sale returns",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Sale returns"),
      },
      post: {
        tags: ["Sale Returns"],
        summary: "Create sale return",
        ...auth(["Admin", "Attendant"]),
        ...body({
          saleId: { type: "integer" },
          items: { type: "array" },
          reason: { type: "string" },
        }, ["saleId", "items"]),
        responses: ok("Return created", {}),
      },
    },
    "/sale-returns/{id}": {
      get: {
        tags: ["Sale Returns"],
        summary: "Get sale return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Sale return"),
      },
      delete: {
        tags: ["Sale Returns"],
        summary: "Delete sale return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Purchases ─────────────────────────────────────────────────────────────
    "/purchases": {
      get: {
        tags: ["Purchases"],
        summary: "List purchases",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "supplierId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Purchases"),
      },
      post: {
        tags: ["Purchases"],
        summary: "Create purchase",
        ...auth(["Admin"]),
        ...body({
          shopId: { type: "integer" },
          supplierId: { type: "integer" },
          items: { type: "array" },
          amountPaid: { type: "number" },
          note: { type: "string" },
        }, ["shopId", "items"]),
        responses: ok("Created purchase", {}),
      },
    },
    "/purchases/{id}": {
      get: {
        tags: ["Purchases"],
        summary: "Get purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Purchase with items"),
      },
      put: {
        tags: ["Purchases"],
        summary: "Update purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ note: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Purchases"],
        summary: "Delete purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/purchases/{id}/payments": {
      post: {
        tags: ["Purchases"],
        summary: "Add payment to purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, method: { type: "string" } }, ["amount", "method"]),
        responses: ok("Payment added"),
      },
    },

    // ── Purchase Returns ──────────────────────────────────────────────────────
    "/purchase-returns": {
      get: {
        tags: ["Purchase Returns"],
        summary: "List purchase returns",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Purchase returns"),
      },
      post: {
        tags: ["Purchase Returns"],
        summary: "Create purchase return",
        ...auth(["Admin"]),
        ...body({
          purchaseId: { type: "integer" },
          items: { type: "array" },
          reason: { type: "string" },
        }, ["purchaseId", "items"]),
        responses: ok("Created", {}),
      },
    },
    "/purchase-returns/{id}": {
      get: {
        tags: ["Purchase Returns"],
        summary: "Get purchase return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Purchase return"),
      },
      delete: {
        tags: ["Purchase Returns"],
        summary: "Delete purchase return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Suppliers ─────────────────────────────────────────────────────────────
    "/suppliers": {
      get: {
        tags: ["Suppliers"],
        summary: "List suppliers",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          searchParam,
          { name: "shopId", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Suppliers"),
      },
      post: {
        tags: ["Suppliers"],
        summary: "Create supplier",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          shopId: { type: "integer" },
          creditLimit: { type: "number" },
        }, ["name", "shopId"]),
        responses: ok("Created supplier", {}),
      },
    },
    "/suppliers/{id}": {
      get: {
        tags: ["Suppliers"],
        summary: "Get supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Supplier"),
      },
      put: {
        tags: ["Suppliers"],
        summary: "Update supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, phone: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Suppliers"],
        summary: "Delete supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/suppliers/{id}/wallet": {
      get: {
        tags: ["Suppliers"],
        summary: "Get supplier wallet transactions",
        ...auth(["Admin"]),
        parameters: [idParam(), ...paginationParams],
        responses: list("Wallet transactions"),
      },
      post: {
        tags: ["Suppliers"],
        summary: "Record supplier payment",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }, ["amount"]),
        responses: ok("Payment recorded"),
      },
    },

    // ── Expenses ──────────────────────────────────────────────────────────────
    "/expense-categories": {
      get: {
        tags: ["Expenses"],
        summary: "List expense categories",
        ...auth(["Admin"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Expense categories"),
      },
      post: {
        tags: ["Expenses"],
        summary: "Create expense category",
        ...auth(["Admin"]),
        ...body({ name: { type: "string" }, shopId: { type: "integer" } }, ["name", "shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/expense-categories/{id}": {
      put: {
        tags: ["Expenses"],
        summary: "Update expense category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete expense category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "categoryId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Expenses"),
      },
      post: {
        tags: ["Expenses"],
        summary: "Create expense",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId: { type: "integer" },
          categoryId: { type: "integer" },
          amount: { type: "number" },
          description: { type: "string" },
          date: { type: "string", format: "date" },
        }, ["shopId", "categoryId", "amount"]),
        responses: ok("Created expense", {}),
      },
    },
    "/expenses/{id}": {
      get: {
        tags: ["Expenses"],
        summary: "Get expense",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Expense"),
      },
      put: {
        tags: ["Expenses"],
        summary: "Update expense",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, description: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete expense",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Cashflow ──────────────────────────────────────────────────────────────
    "/cashflow-categories": {
      get: {
        tags: ["Cashflow"],
        summary: "List cashflow categories",
        ...auth(["Admin"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Cashflow categories"),
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create cashflow category",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          type: { type: "string", enum: ["cashin", "cashout"] },
          shopId: { type: "integer" },
        }, ["name", "type", "shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/cashflow-categories/{id}": {
      put: {
        tags: ["Cashflow"],
        summary: "Update cashflow category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Cashflow"],
        summary: "Delete cashflow category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/cashflow": {
      get: {
        tags: ["Cashflow"],
        summary: "List cashflow entries",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["cashin", "cashout"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Cashflow entries"),
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create cashflow entry",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId: { type: "integer" },
          categoryId: { type: "integer" },
          amount: { type: "number" },
          type: { type: "string", enum: ["cashin", "cashout"] },
          bankId: { type: "integer" },
          note: { type: "string" },
        }, ["shopId", "amount", "type"]),
        responses: ok("Created", {}),
      },
    },
    "/cashflow/{id}": {
      get: {
        tags: ["Cashflow"],
        summary: "Get cashflow entry",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Cashflow entry"),
      },
      put: {
        tags: ["Cashflow"],
        summary: "Update cashflow entry",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Cashflow"],
        summary: "Delete cashflow entry",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/cashflow/shop/cashflow": {
      get: {
        tags: ["Cashflow"],
        summary: "Combined cashflow dashboard (cashin/cashout totals by period)",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: ok("Cashflow summary"),
      },
    },

    // ── Banks ─────────────────────────────────────────────────────────────────
    "/banks": {
      get: {
        tags: ["Banks"],
        summary: "List banks",
        ...auth(["Admin"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Banks"),
      },
      post: {
        tags: ["Banks"],
        summary: "Create bank account",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          accountNumber: { type: "string" },
          shopId: { type: "integer" },
          openingBalance: { type: "number" },
        }, ["name", "shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/banks/{id}": {
      get: {
        tags: ["Banks"],
        summary: "Get bank",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Bank"),
      },
      put: {
        tags: ["Banks"],
        summary: "Update bank",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, accountNumber: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Banks"],
        summary: "Delete bank",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Payment Methods ───────────────────────────────────────────────────────
    "/payment-methods": {
      get: {
        tags: ["Payment Methods"],
        summary: "List payment methods",
        ...auth(["Admin", "Attendant"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Payment methods"),
      },
      post: {
        tags: ["Payment Methods"],
        summary: "Create payment method",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          shopId: { type: "integer" },
          isActive: { type: "boolean" },
        }, ["name", "shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/payment-methods/{id}": {
      put: {
        tags: ["Payment Methods"],
        summary: "Update payment method",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, isActive: { type: "boolean" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Payment Methods"],
        summary: "Delete payment method",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Affiliates ────────────────────────────────────────────────────────────
    "/affiliates": {
      get: {
        tags: ["Affiliates"],
        summary: "List affiliates",
        security: [{ BearerAuth: [] }],
        parameters: [...paginationParams, searchParam],
        responses: list("Affiliates"),
      },
      post: {
        tags: ["Affiliates"],
        summary: "Create affiliate account",
        ...body({
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          commission: { type: "number" },
        }, ["name", "email"]),
        responses: ok("Created", {}),
      },
    },
    "/affiliates/{id}": {
      get: {
        tags: ["Affiliates"],
        summary: "Get affiliate",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        responses: ok("Affiliate"),
      },
      put: {
        tags: ["Affiliates"],
        summary: "Update affiliate",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        ...body({ name: { type: "string" }, commission: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Affiliates"],
        summary: "Delete affiliate",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/affiliates/{id}/transactions": {
      get: {
        tags: ["Affiliates"],
        summary: "Affiliate transaction history",
        security: [{ BearerAuth: [] }],
        parameters: [idParam(), ...paginationParams],
        responses: list("Transactions"),
      },
    },
    "/awards": {
      get: {
        tags: ["Affiliates"],
        summary: "List affiliate awards",
        ...auth(["Admin"]),
        parameters: [...paginationParams],
        responses: list("Awards"),
      },
    },
    "/awards/{id}": {
      get: {
        tags: ["Affiliates"],
        summary: "Get award",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Award"),
      },
    },

    // ── Packages ──────────────────────────────────────────────────────────────
    "/packages": {
      get: {
        tags: ["Packages"],
        summary: "List subscription packages",
        parameters: [...paginationParams],
        responses: list("Packages"),
      },
      post: {
        tags: ["Packages"],
        summary: "Create package",
        ...auth(["Admin"]),
        ...body({
          title: { type: "string" },
          price: { type: "number" },
          durationDays: { type: "integer" },
          shopLimit: { type: "integer" },
          description: { type: "string" },
        }, ["title", "price", "durationDays"]),
        responses: ok("Created", {}),
      },
    },
    "/packages/{id}": {
      get: {
        tags: ["Packages"],
        summary: "Get package",
        parameters: [idParam()],
        responses: ok("Package with features"),
      },
      put: {
        tags: ["Packages"],
        summary: "Update package",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ title: { type: "string" }, price: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Packages"],
        summary: "Delete package",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/packages/{id}/features": {
      get: {
        tags: ["Packages"],
        summary: "List features for a package",
        parameters: [idParam()],
        responses: list("Package features"),
      },
      post: {
        tags: ["Packages"],
        summary: "Add feature to package",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ title: { type: "string" }, included: { type: "boolean" } }, ["title"]),
        responses: ok("Created", {}),
      },
    },
    "/package-features/{id}": {
      put: {
        tags: ["Packages"],
        summary: "Update package feature",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ title: { type: "string" }, included: { type: "boolean" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Packages"],
        summary: "Delete package feature",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Subscriptions ─────────────────────────────────────────────────────────
    "/admin/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "List all subscriptions (super-admin)",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "trial", "expired", "unpaid"] } },
          { name: "packageId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Subscriptions"),
      },
    },
    "/admin/subscriptions/stats": {
      get: {
        tags: ["Subscriptions"],
        summary: "Platform-wide subscription statistics",
        ...auth(["Admin"]),
        responses: ok("Subscription stats"),
      },
    },
    "/admin/subscriptions/summary": {
      get: {
        tags: ["Subscriptions"],
        summary: "Platform revenue dashboard (by period)",
        ...auth(["Admin"]),
        responses: ok("Revenue by today/yesterday/thisWeek/thisMonth/lastMonth/allTime"),
      },
    },
    "/subscriptions": {
      post: {
        tags: ["Subscriptions"],
        summary: "Create subscription",
        ...auth(["Admin"]),
        ...body({
          packageId: { type: "integer" },
          shopIds: { type: "array", items: { type: "integer" } },
        }, ["packageId"]),
        responses: ok("Created subscription", {}),
      },
    },
    "/subscriptions/by-shops": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscriptions for admin's shops",
        ...auth(["Admin"]),
        responses: list("Subscriptions"),
      },
    },
    "/subscriptions/assign-shops": {
      put: {
        tags: ["Subscriptions"],
        summary: "Assign shops to existing subscription",
        ...auth(["Admin"]),
        ...body({
          subscriptionId: { type: "integer" },
          shopIds: { type: "array", items: { type: "integer" } },
          mpesaCode: { type: "string" },
        }, ["subscriptionId", "shopIds"]),
        responses: ok("Updated subscription"),
      },
    },
    "/subscriptions/{id}": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscription",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Subscription"),
      },
      delete: {
        tags: ["Subscriptions"],
        summary: "Delete subscription",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/subscriptions/{id}/extend": {
      put: {
        tags: ["Subscriptions"],
        summary: "Extend subscription end date",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ days: { type: "integer" }, reason: { type: "string" } }, ["days"]),
        responses: ok("Extended"),
      },
    },
    "/subscriptions/{id}/licence": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscription licence details",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Licence"),
      },
    },
    "/subscriptions/{id}/verify": {
      put: {
        tags: ["Subscriptions"],
        summary: "Verify subscription payment transaction",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ transactionCode: { type: "string" } }, ["transactionCode"]),
        responses: ok("Verified"),
      },
    },

    // ── Admin management ──────────────────────────────────────────────────────
    "/admin/admins": {
      get: {
        tags: ["Admin"],
        summary: "List all admins (super-admin)",
        ...auth(["Admin"]),
        parameters: [...paginationParams, searchParam],
        responses: list("Admins"),
      },
    },
    "/admin/admins/by-subscription": {
      get: {
        tags: ["Admin"],
        summary: "List admins filtered by subscription status",
        ...auth(["Admin"]),
        parameters: [{ name: "status", in: "query", schema: { type: "string" } }, ...paginationParams],
        responses: list("Admins"),
      },
    },
    "/admin/admins/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update admin (super-admin)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ isActive: { type: "boolean" }, referralCredit: { type: "number" } }),
        responses: ok("Updated"),
      },
    },

    // ── Attendants ────────────────────────────────────────────────────────────
    "/attendants": {
      get: {
        tags: ["Attendants"],
        summary: "List attendants",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Attendants"),
      },
      post: {
        tags: ["Attendants"],
        summary: "Create attendant",
        ...auth(["Admin"]),
        ...body({
          name: { type: "string" },
          phone: { type: "string" },
          pin: { type: "string" },
          shopIds: { type: "array", items: { type: "integer" } },
          permissionIds: { type: "array", items: { type: "integer" } },
        }, ["name", "pin"]),
        responses: ok("Created attendant", {}),
      },
    },
    "/attendants/{id}": {
      get: {
        tags: ["Attendants"],
        summary: "Get attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Attendant"),
      },
      put: {
        tags: ["Attendants"],
        summary: "Update attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, pin: { type: "string" }, isActive: { type: "boolean" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Attendants"],
        summary: "Delete attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/attendants/{id}/shops": {
      put: {
        tags: ["Attendants"],
        summary: "Update attendant shop assignments",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ shopIds: { type: "array", items: { type: "integer" } } }, ["shopIds"]),
        responses: ok("Updated"),
      },
    },

    // ── Permissions ───────────────────────────────────────────────────────────
    "/permissions": {
      get: {
        tags: ["Permissions"],
        summary: "List available permissions",
        ...auth(["Admin"]),
        responses: list("Permissions"),
      },
      post: {
        tags: ["Permissions"],
        summary: "Create permission",
        ...auth(["Admin"]),
        ...body({ key: { type: "string" }, description: { type: "string" } }, ["key"]),
        responses: ok("Created", {}),
      },
    },
    "/permissions/{id}": {
      put: {
        tags: ["Permissions"],
        summary: "Update permission",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ key: { type: "string" }, description: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Permissions"],
        summary: "Delete permission",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Reports ───────────────────────────────────────────────────────────────
    "/reports/sales": {
      get: {
        tags: ["Reports"],
        summary: "Sales analysis report",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "groupBy", in: "query", schema: { type: "string", enum: ["day", "week", "month"] } },
        ],
        responses: ok("Sales report data"),
      },
    },
    "/reports/purchases": {
      get: {
        tags: ["Reports"],
        summary: "Purchase analysis report",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: ok("Purchase report data"),
      },
    },
    "/reports/top-products": {
      get: {
        tags: ["Reports"],
        summary: "Top selling products",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: list("Top products with sales totals"),
      },
    },
    "/reports/stock": {
      get: {
        tags: ["Reports"],
        summary: "Stock valuation report",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: ok("Stock valuation"),
      },
    },
    "/reports/cashflow": {
      get: {
        tags: ["Reports"],
        summary: "Cashflow report",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: ok("Cashflow totals"),
      },
    },
    "/reports/statement": {
      get: {
        tags: ["Reports"],
        summary: "Customer or supplier account statement",
        ...auth(["Admin"]),
        parameters: [
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "supplierId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: ok("Account statement"),
      },
    },
    "/reports/purchase-monthly": {
      get: {
        tags: ["Reports"],
        summary: "Monthly purchase analysis",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Monthly purchase totals"),
      },
    },
    "/reports/monthly-product-sales": {
      get: {
        tags: ["Reports"],
        summary: "Monthly sales per product",
        ...auth(["Admin"]),
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "integer" } },
          { name: "productId", in: "query", required: true, schema: { type: "integer" } },
          { name: "year", in: "query", schema: { type: "integer" } },
        ],
        responses: list("Monthly product sales"),
      },
    },
    "/reports/stock-count-yearly/{productId}": {
      get: {
        tags: ["Reports"],
        summary: "Yearly stock count history for a product",
        ...auth(["Admin"]),
        parameters: [idParam("productId")],
        responses: list("Yearly stock counts"),
      },
    },

    // ── Communications ────────────────────────────────────────────────────────
    "/communications": {
      get: {
        tags: ["Communications"],
        summary: "List communications",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Communications"),
      },
      post: {
        tags: ["Communications"],
        summary: "Create communication",
        ...auth(["Admin"]),
        ...body({
          shopId: { type: "integer" },
          subject: { type: "string" },
          message: { type: "string" },
          recipientType: { type: "string", enum: ["all", "customers", "specific"] },
          recipientIds: { type: "array", items: { type: "integer" } },
        }, ["shopId", "subject", "message"]),
        responses: ok("Created", {}),
      },
    },
    "/communications/{id}": {
      get: {
        tags: ["Communications"],
        summary: "Get communication",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Communication"),
      },
      delete: {
        tags: ["Communications"],
        summary: "Delete communication",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Email Templates ───────────────────────────────────────────────────────
    "/email-templates": {
      get: {
        tags: ["Email Templates"],
        summary: "List email templates",
        ...auth(["Admin"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }],
        responses: list("Email templates"),
      },
      post: {
        tags: ["Email Templates"],
        summary: "Create email template",
        ...auth(["Admin"]),
        ...body({
          shopId: { type: "integer" },
          name: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        }, ["shopId", "name", "subject", "body"]),
        responses: ok("Created", {}),
      },
    },
    "/email-templates/{id}": {
      get: {
        tags: ["Email Templates"],
        summary: "Get email template",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Email template"),
      },
      put: {
        tags: ["Email Templates"],
        summary: "Update email template",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ subject: { type: "string" }, body: { type: "string" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Email Templates"],
        summary: "Delete email template",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Sync ──────────────────────────────────────────────────────────────────
    "/sync/{shopId}": {
      get: {
        tags: ["Sync"],
        summary: "Pull all sync data for a shop (offline client bootstrap)",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          idParam("shopId"),
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: ok("Sync payload"),
      },
    },
    "/sync/{shopId}/push": {
      post: {
        tags: ["Sync"],
        summary: "Push offline changes from client",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId")],
        ...body({ changes: { type: "array" } }, ["changes"]),
        responses: ok("Sync result"),
      },
    },

    // ── Activities ────────────────────────────────────────────────────────────
    "/activities": {
      get: {
        tags: ["Activities"],
        summary: "List activity log",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "userId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Activity log entries"),
      },
    },
  },
};
