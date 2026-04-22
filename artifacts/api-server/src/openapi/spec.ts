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

    // ── System (global config) ────────────────────────────────────────────────
    "/system/settings": {
      get: {
        tags: ["System"],
        summary: "List global system settings",
        description: "Paginated list of all global key/value settings (e.g. mpesa, smtp, email). Super-admin only.",
        ...auth(["Admin"]),
        parameters: [...paginationParams, searchParam],
        responses: list("Global settings"),
      },
    },
    "/system/settings/{name}": {
      get: {
        tags: ["System"],
        summary: "Get a global setting by name",
        description: "Returns `{ name, setting: {} }` if the setting does not yet exist.",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Setting"),
      },
      put: {
        tags: ["System"],
        summary: "Upsert a global setting (shallow-merge JSONB)",
        description: "Body may be the raw value object or `{ setting: {...} }`. Existing keys are preserved and overwritten only by incoming keys.",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        ...body({ setting: { type: "object", additionalProperties: true } }),
        responses: ok("Updated setting"),
      },
      delete: {
        tags: ["System"],
        summary: "Delete a global setting",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Deleted"),
      },
    },
    "/system/shop-categories": {
      get: {
        tags: ["System"],
        summary: "List shop categories (system alias)",
        parameters: [...paginationParams, searchParam],
        responses: list("Shop categories"),
      },
    },
    "/system/shop-categories/{id}": {
      get: {
        tags: ["System"],
        summary: "Get shop category by id (system alias)",
        parameters: [idParam()],
        responses: ok("Shop category"),
      },
    },
    "/system/shop-metrics": {
      get: {
        tags: ["System"],
        summary: "Platform-wide metrics",
        description: "Counts of shops and admins. Super-admin only.",
        ...auth(["Admin"]),
        responses: ok("Platform metrics", {
          shops: { type: "integer" },
          admins: { type: "integer" },
          generatedAt: { type: "string", format: "date-time" },
        }),
      },
    },

    // ── Email Templates ───────────────────────────────────────────────────────
    "/email-templates": {
      get: {
        tags: ["Email Templates"],
        summary: "List all email templates (defaults merged with overrides)",
        description: "Returns every template, marking which ones have been customized via `isOverridden`.",
        ...auth(["Admin"]),
        responses: list("Email templates"),
      },
    },
    "/email-templates/defaults": {
      get: {
        tags: ["Email Templates"],
        summary: "List built-in default templates only",
        ...auth(["Admin"]),
        responses: list("Default templates"),
      },
    },
    "/email-templates/seed": {
      post: {
        tags: ["Email Templates"],
        summary: "Seed default templates into the database",
        description: "Inserts any default templates that aren't yet stored. Pass `?overwrite=true` (or `{ overwrite: true }`) to replace existing rows.",
        ...auth(["Admin"]),
        responses: ok("Seed result", {
          created: { type: "array", items: { type: "string" } },
          updated: { type: "array", items: { type: "string" } },
          skipped: { type: "array", items: { type: "string" } },
          totalDefaults: { type: "integer" },
        }),
      },
    },
    "/email-templates/{key}/preview": {
      get: {
        tags: ["Email Templates"],
        summary: "Preview a template rendered with sample data",
        description: "Default `format=html` returns a renderable HTML page (open in a browser). Use `format=json` for a JSON payload, `format=text` for plain text. Any extra query parameters override sample variables (e.g. `?adminName=Bob&shopName=Test`).",
        ...auth(["Admin"]),
        parameters: [
          { name: "key", in: "path", required: true, schema: { type: "string" } },
          { name: "format", in: "query", required: false, schema: { type: "string", enum: ["html", "json", "text"] } },
        ],
        responses: ok("Rendered preview"),
      },
      post: {
        tags: ["Email Templates"],
        summary: "Preview a template with custom variables",
        ...auth(["Admin"]),
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        ...body({ variables: { type: "object", additionalProperties: true } }),
        responses: ok("Rendered preview"),
      },
    },
    "/email-templates/{key}": {
      get: {
        tags: ["Email Templates"],
        summary: "Get a single template (override or default)",
        ...auth(["Admin"]),
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Email template"),
      },
      put: {
        tags: ["Email Templates"],
        summary: "Save / update a template",
        description: "For built-in keys you can send only the fields you want to change. Custom keys must include `subject` and `html`.",
        ...auth(["Admin"]),
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        ...body({
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          variables: { type: "array", items: { type: "string" } },
        }),
        responses: ok("Updated template"),
      },
      delete: {
        tags: ["Email Templates"],
        summary: "Remove the override and revert to the built-in default",
        ...auth(["Admin"]),
        parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Reverted"),
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
      get: {
        tags: ["Products"],
        summary: "Get bundle item",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: ok("Bundle item"),
      },
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
          paymentMethod: { type: "string", description: "Must match the `name` of an active row in the global /payment-methods catalog (case-insensitive — e.g. 'Cash', 'M-Pesa', 'Bank Transfer', 'Card'). Stored canonically on sales.paymentType and the matching sale_payments row. Defaults to 'Cash' if omitted. Unknown values return 400." },
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
          method: { type: "string", description: "Must match the `name` of an active row in the global /payment-methods catalog (case-insensitive). Stored canonically on sale_payments.paymentType. Unknown values return 400." },
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

    // ── Payment Methods (POS catalog — global, super-admin controlled) ───────
    "/payment-methods": {
      get: {
        tags: ["Payment Methods"],
        summary: "List payment methods (POS checkout labels)",
        description: "Global list of POS checkout-marking options (Cash, M-Pesa, Bank Transfer, Card). Pure labels — no integration. Read-only for any authenticated user; only the super-admin may create / update / delete.",
        ...auth(["Admin", "Attendant"]),
        responses: list("Payment methods"),
      },
      post: {
        tags: ["Payment Methods"],
        summary: "Create payment method (super-admin only)",
        ...auth(["SuperAdmin"]),
        ...body({
          name: { type: "string" },
          description: { type: "string" },
          isActive: { type: "boolean" },
          sortOrder: { type: "integer" },
        }, ["name"]),
        responses: ok("Created", {}),
      },
    },
    "/payment-methods/{id}": {
      put: {
        tags: ["Payment Methods"],
        summary: "Update payment method (super-admin only)",
        ...auth(["SuperAdmin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, description: { type: "string" }, isActive: { type: "boolean" }, sortOrder: { type: "integer" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Payment Methods"],
        summary: "Delete payment method (super-admin only)",
        ...auth(["SuperAdmin"]),
        parameters: [idParam()],
        responses: { 204: { description: "Deleted" } },
      },
    },

    // ── Payment Gateways (online charge providers — super-admin only) ────────
    "/admin/payment-gateways": {
      get: {
        tags: ["Payment Gateways"],
        summary: "List payment gateways (with credentials)",
        description: "Online providers Pointify uses to charge admins for subscriptions and SMS credits (SunPay, Stripe, Paystack, M-Pesa Daraja). Returns full rows including config — super-admin only.",
        ...auth(["SuperAdmin"]),
        responses: list("Payment gateways"),
      },
      post: {
        tags: ["Payment Gateways"],
        summary: "Create payment gateway",
        ...auth(["SuperAdmin"]),
        ...body({
          name: { type: "string", description: "Friendly label, e.g. 'SunPay M-Pesa'" },
          gateway: { type: "string", enum: ["sunpay"], description: "Adapter that dispatches the charge. Currently only 'sunpay' is wired; stripe / paystack / mpesa adapters are stubbed and will be enabled as they are implemented." },
          config: { type: "object", description: "Adapter-specific credentials. SunPay: { apiKey, baseUrl?, webhookSecret? }" },
          isActive: { type: "boolean" },
        }, ["name","gateway"]),
        responses: ok("Created", {}),
      },
    },
    "/admin/payment-gateways/catalog": {
      get: {
        tags: ["Payment Gateways"],
        summary: "List supported gateway types and their config schema",
        description: "Returns every gateway adapter the server can dispatch to (e.g. SunPay) along with the credential fields each one expects. Use this to render the 'add payment gateway' form in the super-admin UI: pick a `gateway`, then render the `configFields` it requires.",
        ...auth(["SuperAdmin"]),
        responses: ok("Gateway catalog"),
      },
    },
    "/admin/payment-gateways/active": {
      get: {
        tags: ["Payment Gateways"],
        summary: "List active gateways for admin pickers",
        description: "Returns only id/name/gateway (no credentials) for active gateways. Use this to populate the gateway picker on subscription / SMS top-up screens.",
        ...auth(["Admin"]),
        responses: list("Active payment gateways"),
      },
    },
    "/admin/payment-gateways/{id}": {
      put: {
        tags: ["Payment Gateways"],
        summary: "Update payment gateway",
        ...auth(["SuperAdmin"]),
        parameters: [idParam()],
        ...body({ name: { type: "string" }, gateway: { type: "string", enum: ["sunpay","stripe","paystack","mpesa"] }, config: { type: "object" }, isActive: { type: "boolean" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Payment Gateways"],
        summary: "Delete payment gateway",
        ...auth(["SuperAdmin"]),
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
      get: {
        tags: ["Admin"],
        summary: "Get admin by ID (super-admin)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Admin"),
      },
      put: {
        tags: ["Admin"],
        summary: "Update admin (super-admin)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ isActive: { type: "boolean" }, referralCredit: { type: "number" } }),
        responses: ok("Updated"),
      },
      delete: {
        tags: ["Admin"],
        summary: "Hard-delete admin and all related data (super-admin)",
        description: "Same destructive cascade as DELETE /admin/account, but invoked by a super-admin against any admin id. Wipes shops, products, sales, customers, suppliers, finance, subscriptions, attendants and communications in one transaction, then sends an account_deleted email.",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Account deleted (returns deleted admin summary)"),
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
      delete: {
        tags: ["Sync"],
        summary: "Delete shop sync state (admin only)",
        ...auth(["Admin"]),
        parameters: [idParam("shopId")],
        responses: { 204: { description: "Deleted" } },
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
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams,
          { name: "shopId", in: "query", schema: { type: "integer" } },
          { name: "userId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: list("Activity log entries"),
      },
      post: {
        tags: ["Activities"],
        summary: "Record activity",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId: { type: "integer" },
          action: { type: "string" },
          entityType: { type: "string" },
          entityId: { type: "integer" },
          metadata: { type: "object" },
        }, ["action"]),
        responses: ok("Created", {}),
      },
    },
    "/activities/recent": {
      get: {
        tags: ["Activities"],
        summary: "Recent activity feed",
        ...auth(["Admin", "Attendant"]),
        parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }],
        responses: list("Recent activities"),
      },
    },
    "/shops/{shopId}/activities": {
      get: {
        tags: ["Activities"],
        summary: "List activities scoped to shop",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId"), ...paginationParams],
        responses: list("Activities for shop"),
      },
    },

    // ── Sync (additional) ─────────────────────────────────────────────────────
    "/sync/dump": {
      post: {
        tags: ["Sync"],
        summary: "Bulk dump offline-collected data",
        ...auth(["Admin", "Attendant"]),
        ...body({ shopId: { type: "integer" }, payload: { type: "object" } }, ["shopId", "payload"]),
        responses: ok("Dump accepted"),
      },
    },
    "/sync/dump/online": {
      post: {
        tags: ["Sync"],
        summary: "Bulk dump online (real-time mode)",
        ...auth(["Admin", "Attendant"]),
        ...body({ shopId: { type: "integer" }, payload: { type: "object" } }, ["shopId", "payload"]),
        responses: ok("Dump accepted"),
      },
    },
    "/sync/database/init": {
      get: {
        tags: ["Sync"],
        summary: "Database init schema/seed for offline desktop client",
        ...auth(["Admin", "Attendant"]),
        responses: ok("Init payload (sql/json)"),
      },
    },
    "/sync/checkupdate/desktop": {
      get: {
        tags: ["Sync"],
        summary: "Check for desktop client updates",
        responses: ok("Latest desktop version metadata"),
      },
    },

    // ── Customers (additional) ────────────────────────────────────────────────
    "/customers/by-number": {
      get: {
        tags: ["Customers"],
        summary: "Lookup customer by customerNo",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "customerNo", in: "query", required: false, schema: { type: "integer" } },
          { name: "phone", in: "query", required: false, schema: { type: "string" } },
          { name: "shopId", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: ok("Customer or null"),
      },
    },
    "/customers/bulk-import": {
      post: {
        tags: ["Customers"],
        summary: "Bulk import customers",
        ...auth(["Admin", "Attendant"]),
        ...body({ customers: { type: "array", items: { type: "object" } }, shopId: { type: "integer" } }, ["customers"]),
        responses: ok("Import summary"),
      },
    },
    "/customers/{id}/wallet-transactions": {
      get: {
        tags: ["Customers"],
        summary: "List customer wallet ledger",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), ...paginationParams],
        responses: list("Wallet ledger"),
      },
    },
    "/customers/{id}/wallet/deposit": {
      post: {
        tags: ["Customers"],
        summary: "Deposit into customer wallet",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }, ["amount"]),
        responses: ok("Wallet updated"),
      },
    },
    "/customers/{id}/wallet/withdraw": {
      post: {
        tags: ["Customers"],
        summary: "Withdraw from customer wallet",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }, ["amount"]),
        responses: ok("Wallet updated"),
      },
    },
    "/customers/{id}/wallet/payment": {
      post: {
        tags: ["Customers"],
        summary: "Apply wallet payment to outstanding sale balance",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, saleId: { type: "integer" } }, ["amount"]),
        responses: ok("Payment applied"),
      },
    },

    // ── Suppliers (additional) ────────────────────────────────────────────────
    "/suppliers/bulk-import": {
      post: {
        tags: ["Suppliers"],
        summary: "Bulk import suppliers",
        ...auth(["Admin"]),
        ...body({ suppliers: { type: "array", items: { type: "object" } }, shopId: { type: "integer" } }, ["suppliers"]),
        responses: ok("Import summary"),
      },
    },
    "/suppliers/{id}/wallet-transactions": {
      get: {
        tags: ["Suppliers"],
        summary: "List supplier wallet ledger",
        ...auth(["Admin"]),
        parameters: [idParam(), ...paginationParams],
        responses: list("Wallet ledger"),
      },
    },
    "/suppliers/{id}/wallet/deposit": {
      post: {
        tags: ["Suppliers"],
        summary: "Deposit into supplier wallet",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, note: { type: "string" } }, ["amount"]),
        responses: ok("Wallet updated"),
      },
    },
    "/suppliers/{id}/wallet/payment": {
      post: {
        tags: ["Suppliers"],
        summary: "Apply wallet payment to supplier purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, purchaseId: { type: "integer" } }, ["amount"]),
        responses: ok("Payment applied"),
      },
    },

    // ── Products (additional) ─────────────────────────────────────────────────
    "/products/attributes": {
      get: { tags: ["Products"], summary: "List product attributes", ...auth(["Admin", "Attendant"]), responses: list("Attributes") },
      post: {
        tags: ["Products"], summary: "Create product attribute", ...auth(["Admin"]),
        ...body({ name: { type: "string" } }, ["name"]),
        responses: ok("Created", {}),
      },
    },
    "/products/attributes/{id}": {
      get: { tags: ["Products"], summary: "Get attribute with variants", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Attribute") },
    },
    "/products/attributes/{id}/variants": {
      post: {
        tags: ["Products"], summary: "Add variant to attribute", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ value: { type: "string" } }, ["value"]),
        responses: ok("Created", {}),
      },
    },
    "/products/bulk-import": {
      post: {
        tags: ["Products"], summary: "Bulk import products", ...auth(["Admin"]),
        ...body({ products: { type: "array", items: { type: "object" } }, shopId: { type: "integer" } }, ["products"]),
        responses: ok("Import summary"),
      },
    },
    "/products/{id}/sales-history": {
      get: { tags: ["Products"], summary: "Sales history for a product", ...auth(["Admin", "Attendant"]), parameters: [idParam(), ...paginationParams], responses: list("Sale items for product") },
    },
    "/products/{id}/purchases-history": {
      get: { tags: ["Products"], summary: "Purchases history for a product", ...auth(["Admin", "Attendant"]), parameters: [idParam(), ...paginationParams], responses: list("Purchase items for product") },
    },
    "/products/{id}/stock-history": {
      get: { tags: ["Products"], summary: "Stock movement history", ...auth(["Admin", "Attendant"]), parameters: [idParam(), ...paginationParams], responses: list("Adjustments / movements") },
    },
    "/products/{id}/transfer-history": {
      get: { tags: ["Products"], summary: "Transfer history for product", ...auth(["Admin", "Attendant"]), parameters: [idParam(), ...paginationParams], responses: list("Transfers") },
    },
    "/products/{id}/summary": {
      get: { tags: ["Products"], summary: "Aggregated product summary (sales, purchases, stock value)", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Summary") },
    },
    "/products/{id}/images": {
      post: {
        tags: ["Products"], summary: "Upload multiple product images", ...auth(["Admin"]),
        parameters: [idParam()],
        requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } } } } } } },
        responses: ok("Image URLs"),
      },
    },
    "/products/{id}/bundle-items": {
      get: { tags: ["Products"], summary: "List bundle items for product", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: list("Bundle items") },
      post: {
        tags: ["Products"], summary: "Add bundle item to product", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ bundledProductId: { type: "integer" }, quantity: { type: "number" } }, ["bundledProductId", "quantity"]),
        responses: ok("Created", {}),
      },
    },

    // ── Inventory (mounted at /inventory) ─────────────────────────────────────
    "/inventory/item/{id}": {
      get: { tags: ["Inventory"], summary: "Get inventory item by id", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Inventory record") },
    },
    "/inventory/batches": {
      get: { tags: ["Inventory"], summary: "List inventory batches", ...auth(["Admin", "Attendant"]), parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Batches") },
    },
    "/inventory/adjustments": {
      get: { tags: ["Adjustments"], summary: "List adjustments", ...auth(["Admin", "Attendant"]), parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Adjustments") },
      post: {
        tags: ["Adjustments"], summary: "Create adjustment", ...auth(["Admin", "Attendant"]),
        ...body({ productId: { type: "integer" }, shopId: { type: "integer" }, quantity: { type: "number" }, type: { type: "string" }, reason: { type: "string" } }, ["productId", "shopId", "quantity", "type"]),
        responses: ok("Created", {}),
      },
    },
    "/inventory/adjustments/{id}": {
      delete: { tags: ["Adjustments"], summary: "Delete adjustment", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/inventory/bad-stocks": {
      get: { tags: ["Bad Stocks"], summary: "List bad stocks", ...auth(["Admin", "Attendant"]), parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Bad stocks") },
      post: {
        tags: ["Bad Stocks"], summary: "Record bad stock", ...auth(["Admin", "Attendant"]),
        ...body({ productId: { type: "integer" }, shopId: { type: "integer" }, quantity: { type: "number" }, reason: { type: "string" } }, ["productId", "shopId", "quantity"]),
        responses: ok("Created", {}),
      },
    },
    "/inventory/bad-stocks/{id}": {
      delete: { tags: ["Bad Stocks"], summary: "Delete bad stock", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/inventory/stock-counts": {
      get: { tags: ["Stock Counts"], summary: "List stock counts (inventory router)", ...auth(["Admin", "Attendant"]), parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Stock counts") },
      post: {
        tags: ["Stock Counts"], summary: "Create stock count", ...auth(["Admin", "Attendant"]),
        ...body({ shopId: { type: "integer" }, title: { type: "string" }, items: { type: "array" } }, ["shopId"]),
        responses: ok("Created", {}),
      },
    },
    "/inventory/stock-counts/product-search": {
      get: { tags: ["Stock Counts"], summary: "Search products for counting", ...auth(["Admin", "Attendant"]), parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Products") },
    },
    "/inventory/stock-counts/product-filter": {
      get: { tags: ["Stock Counts"], summary: "Filter products for counting", ...auth(["Admin", "Attendant"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Products") },
    },
    "/inventory/stock-counts/by-product/{productId}": {
      get: { tags: ["Stock Counts"], summary: "Stock count history per product", ...auth(["Admin", "Attendant"]), parameters: [idParam("productId")], responses: list("Stock counts") },
    },
    "/inventory/stock-counts/{id}": {
      get: { tags: ["Stock Counts"], summary: "Get stock count", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Stock count with items") },
      delete: { tags: ["Stock Counts"], summary: "Delete stock count", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/inventory/stock-counts/{id}/items": {
      post: {
        tags: ["Stock Counts"], summary: "Add items to stock count", ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ items: { type: "array", items: { type: "object", properties: { productId: { type: "integer" }, physicalCount: { type: "number" } } } } }, ["items"]),
        responses: ok("Items added"),
      },
    },
    "/inventory/stock-counts/{id}/apply": {
      post: { tags: ["Stock Counts"], summary: "Apply stock count adjustments to inventory", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Applied") },
    },
    "/inventory/stock-requests": {
      get: { tags: ["Stock Requests"], summary: "List stock requests", ...auth(["Admin", "Attendant"]), parameters: [...paginationParams, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: list("Stock requests") },
      post: {
        tags: ["Stock Requests"], summary: "Create stock request", ...auth(["Admin", "Attendant"]),
        ...body({ fromShopId: { type: "integer" }, warehouseId: { type: "integer" }, items: { type: "array" } }, ["fromShopId", "items"]),
        responses: ok("Created", {}),
      },
    },
    "/inventory/stock-requests/by-product/{productId}": {
      get: { tags: ["Stock Requests"], summary: "Requests by product", ...auth(["Admin", "Attendant"]), parameters: [idParam("productId")], responses: list("Stock requests") },
    },
    "/inventory/stock-requests/{id}": {
      get: { tags: ["Stock Requests"], summary: "Get stock request", ...auth(["Admin", "Attendant"]), parameters: [idParam()], responses: ok("Stock request") },
      delete: { tags: ["Stock Requests"], summary: "Delete stock request", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/inventory/stock-requests/{id}/approve": {
      put: { tags: ["Stock Requests"], summary: "Approve stock request", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Approved") },
    },
    "/inventory/stock-requests/{id}/reject": {
      put: { tags: ["Stock Requests"], summary: "Reject stock request", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Rejected") },
    },
    "/inventory/stock-requests/{id}/status": {
      put: {
        tags: ["Stock Requests"], summary: "Update stock request status", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ status: { type: "string" } }, ["status"]),
        responses: ok("Updated"),
      },
    },
    "/inventory/stock-requests/{id}/accept": {
      post: { tags: ["Stock Requests"], summary: "Accept stock request (warehouse)", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Accepted") },
    },
    "/inventory/stock-requests/{id}/dispatch": {
      post: { tags: ["Stock Requests"], summary: "Dispatch accepted stock request", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Dispatched") },
    },
    "/inventory/stock-requests/{id}/items/{itemId}": {
      delete: { tags: ["Stock Requests"], summary: "Remove item from stock request", ...auth(["Admin"]), parameters: [idParam(), idParam("itemId")], responses: { 204: { description: "Deleted" } } },
    },

    // ── Orders (additional) ───────────────────────────────────────────────────
    "/orders/{id}/fulfill": {
      post: {
        tags: ["Orders"], summary: "Fulfill order — convert to sale, deduct stock", ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ paymentMethod: { type: "string" }, amountPaid: { type: "number" } }),
        responses: ok("Fulfilled — sale created"),
      },
    },
    "/orders/{id}/status": {
      put: {
        tags: ["Orders"], summary: "Update order status", ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ status: { type: "string" } }, ["status"]),
        responses: ok("Updated"),
      },
    },

    // ── Finance (additional) ──────────────────────────────────────────────────
    "/finance/banks/{id}/transactions": {
      get: { tags: ["Banks"], summary: "List bank transactions", ...auth(["Admin", "Attendant"]), parameters: [idParam(), ...paginationParams, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Bank transactions") },
    },

    // ── Admin (additional) ────────────────────────────────────────────────────
    "/admin/profile": {
      get: { tags: ["Admin"], summary: "Current admin profile", ...auth(["Admin"]), responses: ok("Admin profile") },
      put: {
        tags: ["Admin"],
        summary: "Update current admin profile (any safe field)",
        description: "Updates only the fields present in the request body. Sensitive fields (password, smsCredit, referralCredit, isSuperAdmin, FKs) are ignored. Changing email or phone resets the corresponding verification flag.",
        ...auth(["Admin"]),
        ...body({
          username: { type: "string" },
          name: { type: "string", description: "Alias for username" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          shop: { type: "integer", description: "Default primary shop id" },
          autoPrint: { type: "boolean" },
          saleSmsEnabled: { type: "boolean", description: "Master SMS opt-in: enables per-sale receipt SMS to customers AND the daily summary SMS to the admin." },
          platform: { type: "string" },
          appVersion: { type: "string" },
        }),
        responses: ok("Updated admin profile"),
      },
    },
    "/admin/profile/password": {
      put: {
        tags: ["Admin"], summary: "Change password", ...auth(["Admin"]),
        ...body({ currentPassword: { type: "string" }, newPassword: { type: "string" } }, ["currentPassword", "newPassword"]),
        responses: ok("Password updated"),
      },
    },
    "/admin/account": {
      delete: {
        tags: ["Admin"],
        summary: "Permanently delete the current admin's account and all related data",
        description: "Wipes the admin and EVERY record they own (shops, products, sales, customers, suppliers, finance, subscriptions, attendants, communications, etc.) inside a single transaction, then sends an account_deleted confirmation email. This action cannot be undone.",
        ...auth(["Admin"]),
        responses: ok("Account deleted (returns deleted admin summary)"),
      },
    },
    "/admin/sms-credits": {
      get: { tags: ["Admin"], summary: "Get SMS credit balance", ...auth(["Admin"]), responses: ok("Balance") },
    },
    "/admin/sms-credits/topup": {
      post: {
        tags: ["Admin"], summary: "Top-up SMS credits", ...auth(["Admin"]),
        ...body({ amount: { type: "number" }, credits: { type: "integer" }, phone: { type: "string" } }, ["amount", "credits"]),
        responses: ok("Top-up recorded"),
      },
    },
    "/admin/referrals": {
      get: { tags: ["Admin"], summary: "List referral signups for current admin", ...auth(["Admin"]), responses: list("Referrals") },
    },
    "/admin/all": {
      get: { tags: ["Admin"], summary: "List all admins (super-admin)", ...auth(["Admin"]), parameters: [...paginationParams, searchParam], responses: list("Admins") },
    },
        "/admin/shops": {
      get: { tags: ["Admin"], summary: "List shops across admins (super-admin)", ...auth(["Admin"]), parameters: [...paginationParams, { name: "adminId", in: "query", schema: { type: "integer" } }], responses: list("Shops") },
    },
    "/admin/affiliates": {
      get: { tags: ["Affiliates"], summary: "List affiliates (super-admin)", ...auth(["Admin"]), parameters: [...paginationParams, searchParam], responses: list("Affiliates") },
      post: {
        tags: ["Affiliates"], summary: "Create affiliate (super-admin)", ...auth(["Admin"]),
        ...body({ name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, commission: { type: "number" } }, ["name", "email"]),
        responses: ok("Created", {}),
      },
    },
    "/admin/affiliates/{id}": {
      get: { tags: ["Affiliates"], summary: "Get affiliate (super-admin)", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Affiliate") },
      put: { tags: ["Affiliates"], summary: "Update affiliate", ...auth(["Admin"]), parameters: [idParam()], ...body({ commission: { type: "number" } }), responses: ok("Updated") },
    },
    "/admin/affiliates/{id}/award": {
      post: {
        tags: ["Affiliates"], summary: "Award affiliate commission", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, reason: { type: "string" } }, ["amount"]),
        responses: ok("Award recorded"),
      },
    },
    "/admin/affiliate-transactions/{id}/complete": {
      put: { tags: ["Affiliates"], summary: "Mark affiliate transaction completed", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Completed") },
    },
    "/admin/affiliate-transactions/{id}/payout-mpesa": {
      post: {
        tags: ["Affiliates"], summary: "Trigger M-Pesa payout for affiliate transaction", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ phone: { type: "string" } }),
        responses: ok("Payout initiated"),
      },
    },
    "/admin/communications": {
      get: { tags: ["Communications"], summary: "Platform communications log (super-admin)", ...auth(["Admin"]), parameters: [...paginationParams], responses: list("Communications") },
    },
    "/admin/communications/send": {
      post: {
        tags: ["Communications"], summary: "Send platform-wide communication", ...auth(["Admin"]),
        ...body({ subject: { type: "string" }, message: { type: "string" }, channel: { type: "string", enum: ["email", "sms", "in_app"] }, recipientType: { type: "string", enum: ["all", "admins", "customers", "specific"] }, recipientIds: { type: "array", items: { type: "integer" } }, to: { type: "string" }, body: { type: "string" }, type: { type: "string" } }, ["message"]),
        responses: ok("Sent"),
      },
    },
    "/admin/communications/bulk-sms": {
      post: {
        tags: ["Communications"], summary: "Send bulk SMS (super-admin)", ...auth(["Admin"]),
        ...body({ message: { type: "string" }, recipients: { type: "array", items: { type: "string" } } }, ["message", "recipients"]),
        responses: ok("Bulk SMS dispatched"),
      },
    },
    "/admin/communications/{id}/resend": {
      post: { tags: ["Communications"], summary: "Resend a communication", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Resent") },
    },
    "/admin/email-templates": {
      get: { tags: ["Email Templates"], summary: "List platform email templates", ...auth(["Admin"]), responses: list("Templates") },
      post: {
        tags: ["Email Templates"], summary: "Create platform email template", ...auth(["Admin"]),
        ...body({ name: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, ["name", "subject", "body"]),
        responses: ok("Created", {}),
      },
    },
    "/admin/email-templates/{id}": {
      get: { tags: ["Email Templates"], summary: "Get platform template", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Template") },
      put: { tags: ["Email Templates"], summary: "Update template", ...auth(["Admin"]), parameters: [idParam()], ...body({ subject: { type: "string" }, body: { type: "string" } }), responses: ok("Updated") },
      delete: { tags: ["Email Templates"], summary: "Delete template", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/admin/email-messages": {
      get: { tags: ["Email Templates"], summary: "List queued/email messages", ...auth(["Admin"]), parameters: [...paginationParams], responses: list("Messages") },
      post: {
        tags: ["Email Templates"], summary: "Queue email message", ...auth(["Admin"]),
        ...body({ to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, templateId: { type: "integer" } }, ["to", "subject"]),
        responses: ok("Queued", {}),
      },
    },
    "/admin/email-messages/{id}": {
      put: { tags: ["Email Templates"], summary: "Update email message", ...auth(["Admin"]), parameters: [idParam()], ...body({ subject: { type: "string" }, body: { type: "string" } }), responses: ok("Updated") },
      delete: { tags: ["Email Templates"], summary: "Delete email message", ...auth(["Admin"]), parameters: [idParam()], responses: { 204: { description: "Deleted" } } },
    },
    "/admin/email-messages/{id}/send": {
      post: { tags: ["Email Templates"], summary: "Send queued email", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Sent") },
    },
    "/admin/emails-sent": {
      get: { tags: ["Email Templates"], summary: "Sent emails log", ...auth(["Admin"]), parameters: [...paginationParams], responses: list("Sent emails") },
    },
    "/admin/sms/adjust-credits": {
      post: {
        tags: ["Admin"], summary: "Adjust SMS credits for any admin (super-admin)", ...auth(["Admin"]),
        ...body({ adminId: { type: "integer" }, shopId: { type: "integer" }, delta: { type: "integer" }, reason: { type: "string" }, amount: { type: "integer" }, description: { type: "string" } }, ["delta"]),
        responses: ok("Adjusted"),
      },
    },
    // ── Affiliates (self-service) ─────────────────────────────────────────────
    "/affiliates/register": {
      post: {
        tags: ["Affiliates"], summary: "Register as affiliate",
        ...body({ name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, password: { type: "string" } }, ["name", "email", "password"]),
        responses: ok("Registered", {}),
      },
    },
    "/affiliates/login": {
      post: {
        tags: ["Affiliates"], summary: "Affiliate login",
        ...body({ email: { type: "string" }, password: { type: "string" } }, ["email", "password"]),
        responses: ok("JWT token + affiliate"),
      },
    },
    "/affiliates/me": {
      get: { tags: ["Affiliates"], summary: "Current affiliate profile", ...auth(["Affiliate"]), responses: ok("Profile") },
      put: { tags: ["Affiliates"], summary: "Update affiliate profile", ...auth(["Affiliate"]), ...body({ name: { type: "string" }, phone: { type: "string" } }), responses: ok("Updated") },
    },
    "/affiliates/me/awards": {
      get: { tags: ["Affiliates"], summary: "Affiliate's own awards", ...auth(["Affiliate"]), parameters: [...paginationParams], responses: list("Awards") },
    },
    "/affiliates/me/transactions": {
      get: { tags: ["Affiliates"], summary: "Affiliate's own transactions", ...auth(["Affiliate"]), parameters: [...paginationParams], responses: list("Transactions") },
    },
    "/affiliates/me/withdraw": {
      post: {
        tags: ["Affiliates"], summary: "Request withdrawal", ...auth(["Affiliate"]),
        ...body({ amount: { type: "number" }, phone: { type: "string" }, accountName: { type: "string" }, accountNumber: { type: "string" }, paymentType: { type: "string" } }, ["amount"]),
        responses: ok("Withdrawal requested"),
      },
    },
    "/affiliates/awards": {
      post: {
        tags: ["Affiliates"], summary: "Create award (admin)", ...auth(["Admin"]),
        ...body({ affiliateId: { type: "integer" }, amount: { type: "number" }, reason: { type: "string" } }, ["affiliateId", "amount"]),
        responses: ok("Created", {}),
      },
    },
    "/affiliates/transactions": {
      get: { tags: ["Affiliates"], summary: "List affiliate transactions (self)", ...auth(["Affiliate"]), parameters: [...paginationParams], responses: list("Transactions") },
    },
    "/affiliates/{id}/block": {
      put: { tags: ["Affiliates"], summary: "Block affiliate", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Blocked") },
    },
    "/affiliates/{id}/unblock": {
      put: { tags: ["Affiliates"], summary: "Unblock affiliate", ...auth(["Admin"]), parameters: [idParam()], responses: ok("Unblocked") },
    },

    // ── SMS ───────────────────────────────────────────────────────────────────
    "/sms/balance": {
      get: { tags: ["Communications"], summary: "Current SMS credit balance", ...auth(["Admin"]), responses: ok("Balance") },
    },
    "/sms/top-up": {
      post: {
        tags: ["Communications"],
        summary: "Initiate SMS credit top-up via SunPay M-Pesa STK push",
        description: "Triggers an STK push. Provide EITHER `credits` (number of SMSes — charge = credits × pricePerCredit) OR `amount` (KES to spend — credits awarded = floor(amount / pricePerCredit)). `pricePerCredit` is the global setting `system/settings/sms_pricing` (default 1 KES). Credits are added only after SunPay confirms payment.",
        ...auth(["Admin"]),
        ...body({ credits: { type: "integer", minimum: 1, description: "Number of SMSes to buy. Mutually exclusive with `amount`." }, amount: { type: "integer", minimum: 1, description: "KES to spend. Mutually exclusive with `credits`. Credits awarded = floor(amount / pricePerCredit)." }, paymentGatewayId: { type: "integer", description: "id of an active payment_gateways row (e.g. SunPay) used to charge the admin" }, phone: { type: "string", description: "Defaults to admin.phone" } }, ["paymentGatewayId"]),
        responses: { 201: { description: "STK push initiated — returns externalRef for polling" } },
      },
    },
    "/sms/top-up/{ref}": {
      get: {
        tags: ["Communications"],
        summary: "Check status of a SunPay top-up",
        description: "Returns the intent state. If still pending, polls SunPay so credits are applied without waiting for the webhook.",
        ...auth(["Admin"]),
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Top-up status"),
      },
    },
    "/sms/transactions": {
      get: {
        tags: ["Communications"], summary: "List SMS credit transactions", ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "type", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }],
        responses: list("Transactions"),
      },
    },

    // ── Subscriptions (additional) ────────────────────────────────────────────
    "/subscriptions/{id}/pay": {
      post: {
        tags: ["Subscriptions"],
        summary: "Pay subscription via a configured payment gateway",
        description: "Charges the admin via the chosen payment_gateways row. Currently supports SunPay (M-Pesa STK push). Returns status='pending' until the gateway webhook confirms.",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          paymentGatewayId: { type: "integer", description: "id of an active payment_gateways row" },
          phone: { type: "string", description: "Required for SunPay / M-Pesa gateways" },
          paymentReference: { type: "string" },
        }, ["paymentGatewayId"]),
        responses: ok("Payment recorded or STK push initiated"),
      },
    },
    "/subscriptions/{id}/pay/mpesa": {
      post: {
        tags: ["Subscriptions"], summary: "Pay subscription via M-Pesa STK push", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ phone: { type: "string" }, mpesaCode: { type: "string" } }),
        responses: ok("STK push initiated or payment confirmed"),
      },
    },
    "/subscriptions/{id}/pay/paystack": {
      post: {
        tags: ["Subscriptions"], summary: "Pay subscription via Paystack", ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ email: { type: "string" } }),
        responses: ok("Checkout URL"),
      },
    },
    "/subscriptions/{id}/pay/stripe": {
      post: {
        tags: ["Subscriptions"], summary: "Pay subscription via Stripe", ...auth(["Admin"]),
        parameters: [idParam()],
        responses: ok("Checkout URL"),
      },
    },

    // ── Payments webhooks ─────────────────────────────────────────────────────
    "/payments/mpesa/callback": {
      post: { tags: ["Subscriptions"], summary: "M-Pesa STK callback (webhook)", responses: ok("Acknowledged") },
    },
    "/payments/mpesa/validation": {
      post: { tags: ["Subscriptions"], summary: "M-Pesa C2B validation (webhook)", responses: ok("Acknowledged") },
    },
    "/payments/mpesa/confirmation": {
      post: { tags: ["Subscriptions"], summary: "M-Pesa C2B confirmation (webhook)", responses: ok("Acknowledged") },
    },
    "/payments/paystack/webhook": {
      post: { tags: ["Subscriptions"], summary: "Paystack webhook", responses: ok("Acknowledged") },
    },
    "/payments/stripe/webhook": {
      post: { tags: ["Subscriptions"], summary: "Stripe webhook", responses: ok("Acknowledged") },
    },
    "/payments/sunpay/callback/{ref}": {
      post: {
        tags: ["Subscriptions"],
        summary: "SunPay per-transaction callback (plain, no signature)",
        description: "Called by SunPay for the specific top-up identified by externalRef. Credits the admin and writes the ledger row idempotently.",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: ok("Acknowledged"),
      },
    },
    "/payments/sunpay/webhook": {
      post: {
        tags: ["Subscriptions"],
        summary: "SunPay account-wide webhook (HMAC-SHA256 signed)",
        description: "X-Webhook-Signature header verified against system/settings/sunpay.webhookSecret. Routes SMSTOPUP-* refs into the credit flow.",
        responses: ok("Acknowledged"),
      },
    },

    // ── Reports (additional) ──────────────────────────────────────────────────
    "/reports/sales/by-product": {
      get: { tags: ["Reports"], summary: "Sales aggregated by product", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Rows") },
    },
    "/reports/sales/by-customer": {
      get: { tags: ["Reports"], summary: "Sales aggregated by customer", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Rows") },
    },
    "/reports/expenses": {
      get: { tags: ["Reports"], summary: "Expenses summary", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Summary") },
    },
    "/reports/profit-loss": {
      get: { tags: ["Reports"], summary: "Profit and loss report", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: ok("P&L") },
    },
    "/reports/inventory": {
      get: { tags: ["Reports"], summary: "Inventory valuation summary", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Summary") },
    },
    "/reports/credit": {
      get: { tags: ["Reports"], summary: "Outstanding credit summary", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Summary") },
    },
    "/reports/cross-shop": {
      get: { tags: ["Reports"], summary: "Cross-shop sales totals", ...auth(["Admin"]), parameters: [{ name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Per-shop totals") },
    },
    "/reports/discounted-sales": {
      get: { tags: ["Reports"], summary: "Discounted sales report", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: ok("Rows + summary") },
    },
    "/reports/stock-value": {
      get: { tags: ["Reports"], summary: "Stock value at cost and sale price", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Stock valuation rows") },
    },
    "/reports/stock-count-analysis": {
      get: { tags: ["Reports"], summary: "Stock count variance analysis", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: ok("Variance rows") },
    },
    "/reports/out-of-stock/export": {
      get: { tags: ["Reports"], summary: "Out-of-stock products export", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Export rows") },
    },
    "/reports/backup": {
      get: { tags: ["Reports"], summary: "Backup snapshot for a shop", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "integer" } }], responses: ok("Backup payload") },
    },
    "/reports/dues": {
      get: { tags: ["Reports"], summary: "Outstanding sales dues", ...auth(["Admin"]), parameters: [{ name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Rows + summary") },
    },
    "/reports/profit/yearly/{year}": {
      get: { tags: ["Reports"], summary: "Yearly profit per month", ...auth(["Admin"]), parameters: [{ name: "year", in: "path", required: true, schema: { type: "integer" } }, { name: "shopId", in: "query", schema: { type: "integer" } }], responses: ok("Months + totals") },
    },

    // ── Shop-scoped (mounted under /shops/{shopId}) ───────────────────────────
    "/shops/{shopId}/products": {
      get: { tags: ["Products"], summary: "List products for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, searchParam, { name: "category", in: "query", schema: { type: "integer" } }, { name: "barcode", in: "query", schema: { type: "string" } }], responses: list("Products") },
    },
    "/shops/{shopId}/products/bulk-import": {
      post: { tags: ["Products"], summary: "Bulk import products into shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({ products: { type: "array", items: { type: "object" } } }, ["products"]), responses: ok("Import summary") },
    },
    "/shops/{shopId}/categories": {
      get: { tags: ["Product Categories"], summary: "List categories for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Categories") },
    },
    "/shops/{shopId}/customers": {
      get: { tags: ["Customers"], summary: "List customers for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, searchParam], responses: list("Customers") },
    },
    "/shops/{shopId}/customers/overdue": {
      get: { tags: ["Customers"], summary: "Overdue customers", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Customers") },
    },
    "/shops/{shopId}/customers/analysis": {
      get: { tags: ["Customers"], summary: "Customer base analytics", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: ok("Stats") },
    },
    "/shops/{shopId}/customers/debtors/export": {
      get: { tags: ["Customers"], summary: "Export debtors", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: ok("Export rows") },
    },
    "/shops/{shopId}/customers/bulk-import": {
      post: { tags: ["Customers"], summary: "Bulk import customers into shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({ customers: { type: "array", items: { type: "object" } } }, ["customers"]), responses: ok("Import summary") },
    },
    "/shops/{shopId}/suppliers": {
      get: { tags: ["Suppliers"], summary: "List suppliers for shop", ...auth(["Admin"]), parameters: [idParam("shopId"), ...paginationParams, searchParam], responses: list("Suppliers") },
    },
    "/shops/{shopId}/suppliers/bulk-import": {
      post: { tags: ["Suppliers"], summary: "Bulk import suppliers into shop", ...auth(["Admin"]), parameters: [idParam("shopId")], ...body({ suppliers: { type: "array", items: { type: "object" } } }, ["suppliers"]), responses: ok("Import summary") },
    },
    "/shops/{shopId}/sales": {
      get: { tags: ["Sales"], summary: "List sales for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Sales") },
    },
    "/shops/{shopId}/sales/cross-shop": {
      get: { tags: ["Sales"], summary: "Cross-shop sales summary for this shop scope", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/sales/statement": {
      get: { tags: ["Sales"], summary: "Shop sales statement", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Sales") },
    },
    "/shops/{shopId}/sales/email-report": {
      post: { tags: ["Sales"], summary: "Email sales report (queued, stub)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: ok("Queued") },
    },
    "/shops/{shopId}/sale-returns": {
      get: { tags: ["Sale Returns"], summary: "List sale returns for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Sale returns") },
    },
    "/shops/{shopId}/purchases": {
      get: { tags: ["Purchases"], summary: "List purchases for shop", ...auth(["Admin"]), parameters: [idParam("shopId"), ...paginationParams, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Purchases") },
    },
    "/shops/{shopId}/purchases/monthly-analysis": {
      get: { tags: ["Purchases"], summary: "Monthly purchase analytics", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Months") },
    },
    "/shops/{shopId}/purchases/email-report": {
      post: { tags: ["Purchases"], summary: "Email purchases report (queued, stub)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Queued") },
    },
    "/shops/{shopId}/purchase-returns": {
      get: { tags: ["Purchase Returns"], summary: "List purchase returns for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Purchase returns") },
    },
    "/shops/{shopId}/orders": {
      get: { tags: ["Orders"], summary: "List orders for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Orders") },
    },
    "/shops/{shopId}/transfers": {
      get: { tags: ["Transfers"], summary: "List transfers for shop (in/out)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Transfers") },
    },
    "/shops/{shopId}/batches": {
      get: { tags: ["Inventory"], summary: "List batches for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Batches") },
    },
    "/shops/{shopId}/serials": {
      get: { tags: ["Products"], summary: "List serials for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Serials") },
    },
    "/shops/{shopId}/banks": {
      get: { tags: ["Banks"], summary: "List banks for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Banks") },
    },
    "/shops/{shopId}/expenses": {
      get: { tags: ["Expenses"], summary: "List expenses for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Expenses") },
    },
    "/shops/{shopId}/expenses/stats": {
      get: { tags: ["Expenses"], summary: "Expense statistics", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: ok("Stats") },
    },
    "/shops/{shopId}/expense-categories": {
      get: { tags: ["Expenses"], summary: "Expense categories for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Categories") },
    },
    "/shops/{shopId}/cashflows": {
      get: { tags: ["Cashflow"], summary: "Cashflows for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: list("Cashflows") },
    },
    "/shops/{shopId}/cashflows/total-by-category": {
      get: { tags: ["Cashflow"], summary: "Cashflow totals grouped by category", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Group rows") },
    },
    "/shops/{shopId}/cashflow-categories": {
      get: { tags: ["Cashflow"], summary: "Cashflow categories for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Categories") },
    },
    "/shops/{shopId}/payment-methods": {
      get: { tags: ["Payment Methods"], summary: "Payment methods for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Methods") },
    },
    "/shops/{shopId}/bad-stocks": {
      get: { tags: ["Bad Stocks"], summary: "Bad stocks for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Bad stocks") },
    },
    "/shops/{shopId}/bad-stocks/analysis": {
      get: { tags: ["Bad Stocks"], summary: "Bad stocks aggregated by product", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Group rows") },
    },
    "/shops/{shopId}/bad-stocks/summary": {
      get: { tags: ["Bad Stocks"], summary: "Bad stocks summary totals", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/adjustments": {
      get: { tags: ["Adjustments"], summary: "Adjustments for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Adjustments") },
    },
    "/shops/{shopId}/stock-counts": {
      get: { tags: ["Stock Counts"], summary: "Stock counts for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Stock counts") },
    },
    "/shops/{shopId}/stock-counts/product-search": {
      get: { tags: ["Stock Counts"], summary: "Search products for counting (shop)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), { name: "q", in: "query", schema: { type: "string" } }], responses: list("Products") },
    },
    "/shops/{shopId}/stock-counts/product-filter": {
      get: { tags: ["Stock Counts"], summary: "Filter products for counting (shop)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: list("Products") },
    },
    "/shops/{shopId}/stock-requests": {
      get: { tags: ["Stock Requests"], summary: "Stock requests for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: list("Stock requests") },
    },
    "/shops/{shopId}/attendants": {
      get: { tags: ["Attendants"], summary: "Attendants for shop", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Attendants") },
    },
    "/shops/{shopId}/reports/sales": {
      get: { tags: ["Reports"], summary: "Sales summary for shop", ...auth(["Admin"]), parameters: [idParam("shopId"), { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: ok("Summary") },
    },
    "/shops/{shopId}/reports/profit": {
      get: { tags: ["Reports"], summary: "Profit summary for shop", ...auth(["Admin"]), parameters: [idParam("shopId"), { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }], responses: ok("Profit") },
    },
    "/shops/{shopId}/reports/profit-analysis": {
      get: { tags: ["Reports"], summary: "Monthly profit analysis", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Rows") },
    },
    "/shops/{shopId}/reports/product-sales": {
      get: { tags: ["Reports"], summary: "Sales by product (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Rows") },
    },
    "/shops/{shopId}/reports/top-products": {
      get: { tags: ["Reports"], summary: "Top products (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Rows") },
    },
    "/shops/{shopId}/reports/monthly-product-sales": {
      get: { tags: ["Reports"], summary: "Monthly product sales (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Rows") },
    },
    "/shops/{shopId}/reports/discounted-sales": {
      get: { tags: ["Reports"], summary: "Discounted sales (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Sales") },
    },
    "/shops/{shopId}/reports/purchases": {
      get: { tags: ["Reports"], summary: "Purchases summary (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/reports/expenses": {
      get: { tags: ["Reports"], summary: "Expenses summary (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/reports/stock": {
      get: { tags: ["Reports"], summary: "Stock summary (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/reports/stock-movement": {
      get: { tags: ["Reports"], summary: "Stock movement (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Adjustments") },
    },
    "/shops/{shopId}/reports/debtors": {
      get: { tags: ["Reports"], summary: "Debtors (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Customers") },
    },
    "/shops/{shopId}/reports/dues": {
      get: { tags: ["Reports"], summary: "Outstanding sales dues (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Sales") },
    },
    "/shops/{shopId}/reports/profit/yearly/{year}": {
      get: { tags: ["Reports"], summary: "Yearly profit (shop)", ...auth(["Admin"]), parameters: [idParam("shopId"), { name: "year", in: "path", required: true, schema: { type: "integer" } }], responses: ok("Yearly") },
    },
    "/shops/{shopId}/reports/stock-value": {
      get: { tags: ["Reports"], summary: "Stock value (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Summary") },
    },
    "/shops/{shopId}/reports/stock-count-analysis": {
      get: { tags: ["Reports"], summary: "Stock count analysis (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: list("Stock counts") },
    },
    "/shops/{shopId}/reports/out-of-stock/export": {
      get: { tags: ["Reports"], summary: "Out-of-stock export (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Rows") },
    },
    "/shops/{shopId}/reports/backup": {
      get: { tags: ["Reports"], summary: "Backup snapshot (shop)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: ok("Snapshot") },
    },
  },
};
