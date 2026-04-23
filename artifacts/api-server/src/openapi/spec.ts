// ── Reusable helpers ─────────────────────────────────────────────────────────

const bearer = {
  BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
};

const paginationParams = [
  { name: "page",  in: "query", description: "Page number (1-based)", schema: { type: "integer", default: 1, minimum: 1 } },
  { name: "limit", in: "query", description: "Results per page",      schema: { type: "integer", default: 20, minimum: 1, maximum: 200 } },
];

const searchParam = { name: "search", in: "query", description: "Full-text search term", schema: { type: "string" } };
const shopIdQuery = { name: "shopId", in: "query", required: false, description: "Filter by shop ID", schema: { type: "integer" } };
const fromParam  = { name: "from", in: "query", description: "Start date (ISO 8601)", schema: { type: "string", format: "date-time" } };
const toParam    = { name: "to",   in: "query", description: "End date (ISO 8601)",   schema: { type: "string", format: "date-time" } };

const idParam = (name = "id", description = "Record ID") => ({
  name, in: "path", required: true, description, schema: { type: "integer" },
});

const auth = (roles: string[]) => ({
  "x-roles": roles,
  security: [{ BearerAuth: [] }],
  "x-security-note": `Required roles: ${roles.join(" | ")}`,
});

// ── Response helpers ─────────────────────────────────────────────────────────

function dataResp(description: string, props: Record<string, unknown> = {}, required?: string[]) {
  const schema: any = { type: "object", properties: props };
  if (required?.length) schema.required = required;
  return {
    200: {
      description,
      content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, data: schema } } } },
    },
  };
}

function listResp(description: string, itemProps: Record<string, unknown> = {}) {
  return {
    200: {
      description,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: { type: "object", properties: itemProps } },
              meta: {
                type: "object",
                properties: {
                  total:      { type: "integer", description: "Total records matching the query" },
                  page:       { type: "integer", description: "Current page" },
                  limit:      { type: "integer", description: "Results per page" },
                  totalPages: { type: "integer", description: "Total pages" },
                },
              },
            },
          },
        },
      },
    },
  };
}

function createdResp(description: string, props: Record<string, unknown> = {}) {
  return {
    201: {
      description,
      content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, data: { type: "object", properties: props } } } } },
    },
  };
}

const noContentResp = { 204: { description: "Success — no content returned" } };

const errResp = {
  400: { description: "Bad request — validation or business rule error", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: false }, error: { type: "string" } } } } } },
  401: { description: "Unauthorized — missing or invalid token" },
  403: { description: "Forbidden — insufficient role or ownership" },
  404: { description: "Record not found" },
  409: { description: "Conflict — duplicate value" },
};

function body(props: Record<string, unknown>, required?: string[], description?: string) {
  const schema: any = { type: "object", properties: props };
  if (required?.length) schema.required = required;
  return {
    requestBody: {
      required: true,
      description: description ?? "Request body",
      content: { "application/json": { schema } },
    },
  };
}

// ── Reusable schema fragments ────────────────────────────────────────────────

const moneyStr   = { type: "string", description: "Numeric string (e.g. \"1500.00\")", example: "1500.00" };
const isoDate    = { type: "string", format: "date-time", example: "2026-04-23T08:00:00.000Z" };
const boolFlag   = (desc: string) => ({ type: "boolean", description: desc });
const intId      = (desc: string) => ({ type: "integer", description: desc });
const strField   = (desc: string, example?: string) => ({ type: "string", description: desc, ...(example ? { example } : {}) });

// Common output-only fields
const recordId   = { id: { type: "integer", description: "Auto-generated primary key", readOnly: true } };
const timestamps = {
  createdAt: { ...isoDate, description: "Creation timestamp", readOnly: true },
  updatedAt: { ...isoDate, description: "Last update timestamp", readOnly: true },
};

// ── Shared item schemas ──────────────────────────────────────────────────────

const saleItemInput = {
  type: "object",
  required: ["productId", "quantity"],
  properties: {
    productId:  { type: "integer", description: "Product ID" },
    quantity:   { type: "number",  description: "Quantity sold", minimum: 0.001 },
    unitPrice:  { type: "number",  description: "Selling price per unit (overrides product default)" },
    price:      { type: "number",  description: "Alias for unitPrice" },
    costPrice:  { type: "number",  description: "Cost price for profit calculation", default: 0 },
    discount:   { type: "number",  description: "Per-line discount amount",          default: 0 },
    saleType:   { type: "string",  description: "Override sale type for this line (Retail | Wholesale | Dealer)" },
  },
};

const purchaseItemInput = {
  type: "object",
  required: ["productId", "quantity"],
  properties: {
    productId:   { type: "integer", description: "Product ID" },
    quantity:    { type: "number",  description: "Quantity received", minimum: 0.001 },
    buyingPrice: { type: "number",  description: "Unit buying price" },
    unitPrice:   { type: "number",  description: "Alias for buyingPrice" },
    discount:    { type: "number",  description: "Per-line discount", default: 0 },
    expiryDate:  { type: "string",  format: "date", description: "Batch expiry date (optional)" },
    batchCode:   { type: "string",  description: "Batch code / lot number" },
  },
};

const orderItemInput = {
  type: "object",
  required: ["productId", "quantity"],
  properties: {
    productId: { type: "integer", description: "Product ID" },
    quantity:  { type: "number",  description: "Ordered quantity" },
    price:     { type: "number",  description: "Unit price" },
  },
};

const returnItemInput = {
  type: "object",
  required: ["productId", "quantity"],
  properties: {
    productId:  { type: "integer", description: "Product ID" },
    saleItemId: { type: "integer", description: "Original sale item ID (sale returns only)" },
    purchaseItemId: { type: "integer", description: "Original purchase item ID (purchase returns only)" },
    quantity:   { type: "number",  description: "Returned quantity" },
    unitPrice:  { type: "number",  description: "Unit price for refund calculation" },
  },
};

const stockCountItemInput = {
  type: "object",
  required: ["productId"],
  properties: {
    productId:     { type: "integer", description: "Product ID" },
    physicalCount: { type: "number",  description: "Physically counted quantity",  default: 0 },
    systemCount:   { type: "number",  description: "System quantity at count time", default: 0 },
  },
};

const transferItemInput = {
  type: "object",
  required: ["productId", "quantity"],
  properties: {
    productId: { type: "integer", description: "Product ID" },
    quantity:  { type: "number",  description: "Transfer quantity" },
    unitPrice: { type: "number",  description: "Unit price for valuation", default: 0 },
  },
};

const stockRequestItemInput = {
  type: "object",
  required: ["productId"],
  properties: {
    productId: { type: "integer", description: "Product ID" },
    quantity:  { type: "number",  description: "Requested quantity", default: 1 },
  },
};

const walletChangeBody = {
  amount:           { type: "number",  description: "Transaction amount (positive)" },
  paymentNo:        { type: "string",  description: "Reference number (e.g. invoice)" },
  paymentReference: { type: "string",  description: "External payment reference" },
  paymentType:      { type: "string",  description: "Payment method label (e.g. M-Pesa, Cash)" },
};

// ── Subscription info object returned on every shop response ────────────────
const subscriptionInfoSchema = {
  type: "object",
  description: "Active subscription summary — included on every shop object",
  properties: {
    subscriptionId: { type: "integer",  description: "Subscription record ID (null when status is none)", nullable: true },
    type:           { type: "string",   description: "trial | production | null", nullable: true },
    status:         { type: "string",   description: "active | expired | none", enum: ["active", "expired", "none"] },
    isActive:       { type: "boolean",  description: "Whether the subscription is marked active" },
    isPaid:         { type: "boolean",  description: "Whether payment has been confirmed" },
    startDate:      { ...isoDate,       description: "Subscription start (ISO 8601)", nullable: true },
    endDate:        { ...isoDate,       description: "Subscription expiry (ISO 8601)", nullable: true },
    daysRemaining:  { type: "integer",  description: "Days until expiry (negative = already expired)" },
    isExpired:      { type: "boolean",  description: "True when endDate is in the past" },
    packageId:      { type: "integer",  description: "Package ID", nullable: true },
    packageTitle:   { type: "string",   description: "Human-readable plan name", nullable: true },
  },
};

// ────────────────────────────────────────────────────────────────────────────

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Pointify POS API",
    version: "2.0.0",
    description: `
## Pointify POS — REST API

Use the **Authorize** button (top-right) and enter \`Bearer <token>\` to authenticate.

### Token types
| Role | How to obtain | Where to use |
|---|---|---|
| **Admin** | \`POST /auth/admin/login\` | Shop management, products, reports, subscriptions |
| **Attendant** | \`POST /auth/attendant/login\` | POS operations (sales, inventory, orders) |
| **Customer** | \`POST /auth/customer/login\` | Online storefront, wallet |
| **Affiliate** | \`POST /affiliates/login\` | Affiliate dashboard |

### Common conventions
- All amounts (prices, totals) are **numeric strings** in the response (e.g. \`"1500.00"\`) so precision is never lost in JSON.
- Paginated endpoints return \`{ success, data[], meta: { total, page, limit, totalPages } }\`.
- Errors return \`{ success: false, error: "Human-readable message" }\`.
- Required fields are marked in each request body schema.
- Optional fields can be omitted entirely or set to \`null\` to clear them.
    `.trim(),
  },
  servers: [{ url: "/api", description: "Current server" }],
  components: {
    securitySchemes: bearer,
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error:   { type: "string",  example: "Product category not found" },
        },
      },
      PaginatedMeta: {
        type: "object",
        properties: {
          total:      { type: "integer" },
          page:       { type: "integer" },
          limit:      { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      SubscriptionInfo: subscriptionInfoSchema,
      SaleItemInput:         { ...saleItemInput },
      PurchaseItemInput:     { ...purchaseItemInput },
      OrderItemInput:        { ...orderItemInput },
      ReturnItemInput:       { ...returnItemInput },
      StockCountItemInput:   { ...stockCountItemInput },
      TransferItemInput:     { ...transferItemInput },
      StockRequestItemInput: { ...stockRequestItemInput },
    },
  },
  tags: [
    { name: "Auth",             description: "Admin, attendant, and customer authentication" },
    { name: "Shops",            description: "Shop management — each admin can own multiple shops" },
    { name: "Shop Categories",  description: "Global shop category catalog (e.g. Retail, Restaurant)" },
    { name: "Settings",         description: "Per-shop JSON settings store" },
    { name: "Measures",         description: "Unit-of-measure catalog (kg, pcs, litres …)" },
    { name: "Product Categories", description: "Admin-scoped product category tree" },
    { name: "Products",         description: "Product catalog — includes pricing, variants, bundles, images" },
    { name: "Inventory",        description: "Current stock levels per product/shop" },
    { name: "Adjustments",      description: "Manual stock adjustments (add / remove)" },
    { name: "Bad Stocks",       description: "Damaged/expired stock write-offs" },
    { name: "Stock Counts",     description: "Physical stock-count sessions and variance tracking" },
    { name: "Stock Requests",   description: "Inter-shop stock requisition from a warehouse" },
    { name: "Transfers",        description: "Product transfers between shops/warehouses" },
    { name: "Customers",        description: "Customer profiles, credit limits, and wallet accounts" },
    { name: "Orders",           description: "Online / pre-orders that can be fulfilled into sales" },
    { name: "Sales",            description: "POS sales transactions including items and payments" },
    { name: "Sale Returns",     description: "Customer refund/return processing" },
    { name: "Purchases",        description: "Supplier purchase orders and GRNs" },
    { name: "Purchase Returns", description: "Return of goods to supplier" },
    { name: "Suppliers",        description: "Supplier directory and credit/wallet management" },
    { name: "Expenses",         description: "Operational expense recording" },
    { name: "Cashflow",         description: "Cashflow entries linked to bank accounts" },
    { name: "Banks",            description: "Bank/cashbox accounts" },
    { name: "Payment Methods",  description: "Global POS payment method catalog (Cash, M-Pesa, Card …)" },
    { name: "User Payments",    description: "Generic payment records (customer/supplier settlements)" },
    { name: "Affiliates",       description: "Affiliate partner portal and commission management" },
    { name: "Subscriptions",    description: "Shop subscription billing lifecycle" },
    { name: "Packages",         description: "Subscription plan catalog" },
    { name: "Admin",            description: "Admin profile management" },
    { name: "Attendants",       description: "POS staff management and PIN authentication" },
    { name: "Permissions",      description: "Attendant permission catalog" },
    { name: "Reports",          description: "Business analytics and summary reports" },
    { name: "Communications",   description: "SMS / email notification settings" },
    { name: "Email Templates",  description: "Transactional email template management" },
    { name: "System",           description: "Super-admin system configuration" },
    { name: "Sync",             description: "Offline-sync endpoints" },
    { name: "Activities",       description: "Audit log / activity feed" },
  ],
  paths: {

    // ── Health ────────────────────────────────────────────────────────────────
    "/healthz": {
      get: {
        tags: ["Auth"],
        summary: "Health check",
        description: "Returns 200 when the server is up. No authentication required.",
        responses: { 200: { description: "Server is healthy" } },
      },
    },

    // ── Admin Auth ────────────────────────────────────────────────────────────
    "/auth/admin/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new admin account",
        description: "Creates an admin account and sends a 6-digit OTP to the provided email for verification.",
        ...body({
          name:         { type: "string", description: "Full name",                        example: "Jane Doe" },
          email:        { type: "string", format: "email",                                 example: "jane@example.com" },
          password:     { type: "string", format: "password", minLength: 6,                example: "MyStr0ngPass!" },
          phone:        { type: "string", description: "Phone number (optional)",          example: "+254712345678" },
          referralCode: { type: "string", description: "Affiliate referral code (optional)", example: "ABC123" },
        }, ["name", "email", "password"]),
        responses: {
          ...createdResp("Admin registered — OTP sent to email", {
            id:      intId("Admin ID"),
            email:   { type: "string" },
            otp:     { type: "string", description: "6-digit OTP — only included in non-production environments" },
            message: { type: "string" },
          }),
          ...errResp,
        },
      },
    },
    "/auth/admin/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email with OTP",
        description: "Confirms the admin's email address using the OTP sent during registration or via resend-otp.",
        ...body({
          email: { type: "string", format: "email" },
          otp:   { ...strField("6-digit OTP from email") },
        }, ["email", "otp"]),
        responses: {
          ...dataResp("Email verified", { message: { type: "string" } }),
          400: { description: "Invalid or expired OTP" },
        },
      },
    },
    "/auth/admin/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Resend email verification OTP",
        ...body({ email: { type: "string", format: "email" } }, ["email"]),
        responses: {
          ...dataResp("OTP resent", { message: { type: "string" }, otp: { type: "string", description: "Development only" } }),
          404: { description: "Admin not found" },
        },
      },
    },
    "/auth/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin login",
        description: "Returns a JWT bearer token valid for 30 days.",
        ...body({
          email:    { type: "string", format: "email",    example: "jane@example.com" },
          password: { type: "string", format: "password", example: "MyStr0ngPass!" },
        }, ["email", "password"]),
        responses: {
          ...dataResp("Login successful", {
            id:           intId("Admin ID"),
            email:        { type: "string" },
            username:     { type: "string" },
            phone:        { type: "string" },
            isSuperAdmin: { type: "boolean", description: "True for the configured SUPER_ADMIN_EMAIL" },
            token:        { ...strField("JWT bearer token — include as `Authorization: Bearer <token>`") },
          }),
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/auth/admin/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset OTP",
        ...body({ email: { type: "string", format: "email" } }, ["email"]),
        responses: {
          ...dataResp("OTP sent", { message: { type: "string" }, otp: { type: "string", description: "Development only" } }),
          404: { description: "No account with that email" },
        },
      },
    },
    "/auth/admin/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with OTP (email)",
        ...body({
          email:    { type: "string", format: "email" },
          otp:      { ...strField("OTP from forgot-password email") },
          password: { type: "string", format: "password", minLength: 6 },
        }, ["email", "otp", "password"]),
        responses: {
          ...dataResp("Password updated", { message: { type: "string" } }),
          400: { description: "Invalid or expired OTP" },
        },
      },
    },
    "/auth/admin/reset-password-sms": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with OTP (SMS / phone)",
        ...body({
          phone:    { ...strField("Registered phone number") },
          otp:      { ...strField("OTP from SMS") },
          password: { type: "string", format: "password", minLength: 6 },
        }, ["phone", "otp", "password"]),
        responses: {
          ...dataResp("Password updated", { message: { type: "string" } }),
          400: { description: "Invalid or expired OTP" },
        },
      },
    },
    "/auth/admin/logout": {
      post: {
        tags: ["Auth"],
        summary: "Admin logout (stateless — invalidates client token)",
        ...auth(["Admin"]),
        responses: { ...dataResp("Logged out", { message: { type: "string" } }) },
      },
    },
    "/auth/admin/save-local": {
      post: {
        tags: ["Auth"],
        summary: "Mark credentials saved locally (mobile offline cache)",
        ...auth(["Admin"]),
        responses: { ...dataResp("Acknowledged", { message: { type: "string" } }) },
      },
    },

    // ── Attendant Auth ────────────────────────────────────────────────────────
    "/auth/attendant/login": {
      post: {
        tags: ["Auth"],
        summary: "Attendant PIN login",
        description: "Authenticates an attendant using their 4-digit PIN and shop ID.",
        ...body({
          pin:    { ...strField("4-digit attendant PIN") },
          shopId: intId("Shop the attendant belongs to"),
        }, ["pin", "shopId"]),
        responses: {
          ...dataResp("Login successful", {
            id:       intId("Attendant ID"),
            username: { type: "string" },
            token:    { ...strField("JWT bearer token") },
          }),
          401: { description: "Invalid PIN or shop" },
        },
      },
    },
    "/auth/attendant/logout": {
      post: {
        tags: ["Auth"],
        summary: "Attendant logout",
        ...auth(["Attendant"]),
        responses: { ...dataResp("Logged out", { message: { type: "string" } }) },
      },
    },

    // ── Me ────────────────────────────────────────────────────────────────────
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        description: "Returns the authenticated user's profile. Works for Admin and Attendant tokens.",
        ...auth(["Admin", "Attendant"]),
        responses: {
          ...dataResp("Current user profile", {
            id:           intId("User ID"),
            email:        { type: "string" },
            username:     { type: "string" },
            role:         { type: "string", enum: ["admin", "attendant"] },
            isSuperAdmin: { type: "boolean", description: "Admin only" },
          }),
        },
      },
    },
    "/auth/me/last-seen": {
      put: {
        tags: ["Auth"],
        summary: "Update last-seen timestamp",
        description: "Call on app foreground to keep activity timestamps current.",
        ...auth(["Admin", "Attendant"]),
        responses: { ...dataResp("Updated", { message: { type: "string" } }) },
      },
    },

    // ── Customer Auth ─────────────────────────────────────────────────────────
    "/auth/customer/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a customer (online storefront)",
        ...body({
          name:     { ...strField("Customer full name") },
          shopId:   intId("Shop the customer belongs to"),
          email:    { type: "string", format: "email", description: "Customer email (optional)" },
          phone:    { ...strField("Phone number (optional)") },
          password: { type: "string", format: "password", description: "Password (optional — required for login)" },
        }, ["name", "shopId"]),
        responses: {
          ...createdResp("Customer registered", { id: intId("Customer ID"), name: { type: "string" }, email: { type: "string" } }),
          ...errResp,
        },
      },
    },
    "/auth/customer/login": {
      post: {
        tags: ["Auth"],
        summary: "Customer login",
        ...body({
          emailOrPhone: { ...strField("Email or phone number") },
          password:     { type: "string", format: "password" },
          shopId:       intId("Shop ID"),
        }, ["emailOrPhone", "password", "shopId"]),
        responses: {
          ...dataResp("Login successful", { token: { type: "string" }, id: intId("Customer ID") }),
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/auth/customer/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Customer forgot password",
        ...body({
          emailOrPhone: { ...strField("Registered email or phone") },
          shopId:       intId("Shop ID"),
        }, ["emailOrPhone", "shopId"]),
        responses: { ...dataResp("OTP sent", { message: { type: "string" }, otp: { type: "string", description: "Dev only" } }) },
      },
    },
    "/auth/customer/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Customer reset password",
        ...body({
          emailOrPhone: { ...strField("Registered email or phone") },
          shopId:       intId("Shop ID"),
          otp:          { ...strField("OTP from reset email/SMS") },
          password:     { type: "string", format: "password", minLength: 6 },
        }, ["emailOrPhone", "shopId", "otp", "password"]),
        responses: { ...dataResp("Password updated", { message: { type: "string" } }), 400: { description: "Invalid/expired OTP" } },
      },
    },
    "/auth/customer/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current customer profile",
        ...auth(["Customer"]),
        responses: { ...dataResp("Customer profile", { id: intId("Customer ID"), name: { type: "string" }, email: { type: "string" }, wallet: moneyStr }) },
      },
    },

    // ── Shops ─────────────────────────────────────────────────────────────────
    "/shops": {
      get: {
        tags: ["Shops"],
        summary: "List all shops for the authenticated admin",
        description: "Returns every shop owned by the admin, each enriched with a `subscriptionInfo` object showing the current trial/plan status.",
        ...auth(["Admin"]),
        responses: {
          ...dataResp("Shops list", {
            id:               intId("Shop ID"),
            name:             strField("Shop name"),
            address:          strField("Physical address"),
            currency:         strField("ISO 4217 currency code", "KES"),
            contact:          strField("Contact phone number"),
            taxRate:          { ...moneyStr, description: "VAT/tax rate as a percentage string" },
            subscriptionInfo: subscriptionInfoSchema,
          }),
        },
      },
      post: {
        tags: ["Shops"],
        summary: "Create a new shop",
        description: "Creates the shop and automatically starts a 14-day free trial subscription (configurable via system settings).",
        ...auth(["Admin"]),
        ...body({
          name:                { ...strField("Shop name"), },
          categoryId:          { ...intId("Shop category ID (optional)") },
          address:             { ...strField("Physical address") },
          receiptAddress:      { ...strField("Address shown on receipt (defaults to address)") },
          currency:            { ...strField("ISO 4217 currency code", "KES") },
          phone:               { ...strField("Contact phone number") },
          taxRate:             { type: "number", description: "Tax/VAT rate as a percentage", default: 0 },
          paybillTill:         { ...strField("M-Pesa paybill or till number") },
          paybillAccount:      { ...strField("M-Pesa account number") },
          receiptEmail:        { type: "string", format: "email", description: "Email to send receipts to" },
          warehouseEmail:      { type: "string", format: "email", description: "Warehouse notification email" },
          backupEmail:         { type: "string", format: "email", description: "Email to receive data backups" },
          backupInterval:      { ...strField("Backup frequency (daily | weekly | monthly)") },
          locationLat:         { type: "number", description: "GPS latitude" },
          locationLng:         { type: "number", description: "GPS longitude" },
          showStockOnline:     { ...boolFlag("Show stock levels on the online storefront") },
          showPriceOnline:     { ...boolFlag("Show prices on the online storefront") },
          isWarehouse:         { ...boolFlag("Mark this shop as a warehouse (stock source)") },
          allowBackup:         { ...boolFlag("Enable automatic data backups") },
          useWarehouse:        { ...boolFlag("This shop draws stock from a warehouse") },
          trackBatches:        { ...boolFlag("Enable batch/lot tracking") },
          allowOnlineSelling:  { ...boolFlag("Enable online orders for this shop") },
          allowNegativeSelling:{ ...boolFlag("Allow sales when stock is zero (negative inventory)") },
          isProduction:        { ...boolFlag("Mark as live/production shop") },
        }, ["name"]),
        responses: {
          ...createdResp("Shop created", { id: intId("Shop ID"), name: { type: "string" } }),
          ...errResp,
        },
      },
    },
    "/shops/by-referral/{referralId}": {
      get: {
        tags: ["Shops"],
        summary: "Get shop by referral ID (public)",
        description: "Fetches minimal shop info for the referral/affiliate link flow. No authentication required.",
        parameters: [idParam("referralId", "Shop referral ID")],
        responses: { ...dataResp("Shop info", { id: intId("Shop ID"), name: { type: "string" } }), 404: { description: "Shop not found" } },
      },
    },
    "/shops/{shopId}": {
      get: {
        tags: ["Shops"],
        summary: "Get a single shop",
        description: "Returns full shop details including `subscriptionInfo`.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId", "Shop ID")],
        responses: {
          ...dataResp("Shop details", {
            id: intId("Shop ID"), name: strField("Shop name"),
            subscriptionInfo: subscriptionInfoSchema,
          }),
          404: { description: "Shop not found" }, 403: { description: "Access denied" },
        },
      },
      put: {
        tags: ["Shops"],
        summary: "Update shop",
        description: "All fields are optional. Only provided fields are updated.",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        ...body({
          name:                strField("Shop name"),
          categoryId:          intId("Shop category ID"),
          address:             strField("Physical address"),
          receiptAddress:      strField("Receipt address"),
          currency:            strField("ISO 4217 currency code", "KES"),
          phone:               strField("Contact phone"),
          taxRate:             { type: "number", description: "Tax rate %" },
          paybillTill:         strField("M-Pesa paybill/till"),
          paybillAccount:      strField("M-Pesa account"),
          receiptEmail:        { type: "string", format: "email" },
          warehouseEmail:      { type: "string", format: "email" },
          backupEmail:         { type: "string", format: "email" },
          backupInterval:      strField("daily | weekly | monthly"),
          locationLat:         { type: "number" },
          locationLng:         { type: "number" },
          showStockOnline:     { type: "boolean" },
          showPriceOnline:     { type: "boolean" },
          isWarehouse:         { type: "boolean" },
          allowBackup:         { type: "boolean" },
          useWarehouse:        { type: "boolean" },
          trackBatches:        { type: "boolean" },
          allowOnlineSelling:  { type: "boolean" },
          allowNegativeSelling:{ type: "boolean" },
          isProduction:        { type: "boolean" },
        }),
        responses: { ...dataResp("Shop updated"), ...errResp },
      },
      delete: {
        tags: ["Shops"],
        summary: "Delete shop",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        responses: { ...noContentResp, 403: errResp[403], 404: errResp[404] },
      },
    },
    "/shops/{shopId}/data": {
      delete: {
        tags: ["Shops"],
        summary: "Clear all shop data (irreversible)",
        description: "Removes all transactional data linked to this shop without deleting the shop record itself.",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        responses: { ...dataResp("Shop data cleared", { message: { type: "string" }, shopId: intId("Shop ID") }), ...errResp },
      },
    },
    "/shops/{shopId}/redeem-usage": {
      post: {
        tags: ["Shops"],
        summary: "Redeem subscription usage credit",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        responses: { ...dataResp("Usage redeemed", { message: { type: "string" } }), ...errResp },
      },
    },
    "/shops/{shopId}/backup-interval": {
      put: {
        tags: ["Shops"],
        summary: "Update backup interval",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        ...body({ interval: strField("daily | weekly | monthly | never") }, ["interval"]),
        responses: { ...dataResp("Updated"), ...errResp },
      },
    },

    // ── Shop Categories ───────────────────────────────────────────────────────
    "/shop-categories": {
      get: {
        tags: ["Shop Categories"],
        summary: "List shop categories (public)",
        parameters: [...paginationParams, searchParam],
        responses: listResp("Shop categories", { id: intId("ID"), name: strField("Category name"), icon: strField("Icon name/URL") }),
      },
      post: {
        tags: ["Shop Categories"],
        summary: "Create shop category",
        ...auth(["Admin"]),
        ...body({ name: strField("Category name"), icon: strField("Icon identifier (optional)") }, ["name"]),
        responses: { ...createdResp("Created", { id: intId("ID"), name: { type: "string" } }), ...errResp },
      },
    },
    "/shop-categories/{id}": {
      get: {
        tags: ["Shop Categories"],
        summary: "Get shop category",
        parameters: [idParam()],
        responses: { ...dataResp("Category"), 404: errResp[404] },
      },
      put: {
        tags: ["Shop Categories"],
        summary: "Update shop category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Category name"), icon: strField("Icon identifier") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Shop Categories"],
        summary: "Delete shop category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },

    // ── Settings (per-shop) ───────────────────────────────────────────────────
    "/settings/{shopId}": {
      get: {
        tags: ["Settings"],
        summary: "Get shop settings",
        description: "Returns the JSONB settings blob for the shop. Creates an empty record if none exists yet.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("shopId", "Shop ID")],
        responses: { ...dataResp("Settings object (free-form JSON)") },
      },
      put: {
        tags: ["Settings"],
        summary: "Update shop settings",
        description: "Deep-merges the provided object into the existing settings. Existing keys not in the request body are preserved.",
        ...auth(["Admin"]),
        parameters: [idParam("shopId", "Shop ID")],
        requestBody: {
          required: true,
          description: "Settings key-value pairs to merge (any JSON object)",
          content: { "application/json": { schema: { type: "object", additionalProperties: true, example: { theme: "dark", allowCredit: true } } } },
        },
        responses: { ...dataResp("Merged settings"), ...errResp },
      },
    },

    // ── Measures ──────────────────────────────────────────────────────────────
    "/measures": {
      get: {
        tags: ["Measures"],
        summary: "List units of measure",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, searchParam],
        responses: listResp("Measures", { id: intId("ID"), name: strField("Unit name", "kg") }),
      },
      post: {
        tags: ["Measures"],
        summary: "Create unit of measure",
        ...auth(["Admin"]),
        ...body({ name: strField("Unit name (e.g. kg, pcs, litres)") }, ["name"]),
        responses: { ...createdResp("Created"), ...errResp },
      },
    },
    "/measures/{id}": {
      get: {
        tags: ["Measures"],
        summary: "Get measure",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Measure"), 404: errResp[404] },
      },
      put: {
        tags: ["Measures"],
        summary: "Update measure",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("New unit name") }, ["name"]),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Measures"],
        summary: "Delete measure",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },

    // ── Product Categories ────────────────────────────────────────────────────
    "/product-categories": {
      get: {
        tags: ["Product Categories"],
        summary: "List product categories",
        description: "Returns categories owned by the authenticated admin.",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, searchParam],
        responses: listResp("Product categories", { id: intId("ID"), name: strField("Category name"), admin: intId("Owner admin ID") }),
      },
      post: {
        tags: ["Product Categories"],
        summary: "Create product category",
        ...auth(["Admin"]),
        ...body({ name: strField("Category name (must be unique per admin)") }, ["name"]),
        responses: {
          ...createdResp("Created", { id: intId("ID"), name: { type: "string" }, admin: intId("Admin ID") }),
          ...errResp,
        },
      },
    },
    "/product-categories/{id}": {
      get: {
        tags: ["Product Categories"],
        summary: "Get product category",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Category"), 404: errResp[404] },
      },
      put: {
        tags: ["Product Categories"],
        summary: "Rename product category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("New category name") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Product Categories"],
        summary: "Delete product category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },

    // ── Products ──────────────────────────────────────────────────────────────
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams, searchParam,
          shopIdQuery,
          { name: "categoryId", in: "query", description: "Filter by product category", schema: { type: "integer" } },
        ],
        responses: listResp("Products", {
          id:             intId("Product ID"),
          name:           strField("Product name"),
          barcode:        strField("Barcode / SKU"),
          buyingPrice:    moneyStr,
          sellingPrice:   moneyStr,
          wholesalePrice: moneyStr,
          dealerPrice:    moneyStr,
          measureUnit:    strField("Unit of measure"),
          manufacturer:   strField("Manufacturer/brand"),
          productType:    strField("product | service | bundle"),
          isDeleted:      boolFlag("Soft-deleted flag"),
          shop:           intId("Shop ID"),
          category:       intId("Category ID"),
          supplier:       intId("Supplier ID"),
          thumbnailUrl:   strField("Thumbnail image URL/data"),
          createdAt:      isoDate,
        }),
      },
      post: {
        tags: ["Products"],
        summary: "Create a product",
        ...auth(["Admin", "Attendant"]),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "shopId"],
                properties: {
                  name:           { type: "string",  description: "Product name",                                       example: "Premium Milk 500ml" },
                  shopId:         { type: "integer", description: "Shop this product belongs to",                        example: 1 },
                  categoryId:     { type: "integer", description: "Product category ID (optional)",                      example: 3 },
                  barcode:        { type: "string",  description: "Barcode / SKU (optional)",                            example: "6001068024061" },
                  serialNumber:   { type: "string",  description: "Serial number (optional)",                            example: "SN-00123" },
                  buyingPrice:    { type: "number",  description: "Unit buying/cost price",                              example: 45 },
                  sellingPrice:   { type: "number",  description: "Default retail selling price",                        example: 60 },
                  wholesalePrice: { type: "number",  description: "Wholesale selling price",                             example: 55 },
                  dealerPrice:    { type: "number",  description: "Dealer selling price",                                example: 50 },
                  measureUnit:    { type: "string",  description: "Unit of measure (e.g. pcs, kg, litres)",              example: "pcs" },
                  manufacturer:   { type: "string",  description: "Manufacturer or brand name",                         example: "Brookside Dairy" },
                  supplierId:     { type: "integer", description: "Default supplier ID (optional)",                      example: 2 },
                  description:    { type: "string",  description: "Product description",                                 example: "Full-cream pasteurised milk, 500 ml tetra pack" },
                  alertQuantity:  { type: "number",  description: "Low-stock alert threshold",                           example: 10 },
                  expiryDate:     { type: "string",  format: "date", description: "Product expiry date",                 example: "2026-12-31" },
                  type:           { type: "string",  enum: ["product", "service", "bundle"], description: "Product type", example: "product" },
                },
              },
            },
          },
        },
        responses: {
          ...createdResp("Product created", { id: intId("Product ID"), name: { type: "string" } }),
          ...errResp,
        },
      },
    },
    "/products/search": {
      get: {
        tags: ["Products"],
        summary: "Quick product search",
        description: "Returns up to 20 matches — optimised for POS autocomplete.",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "q",      in: "query", required: true,  description: "Search term", schema: { type: "string" } },
          { name: "shopId", in: "query", required: true,  description: "Shop to search within", schema: { type: "integer" } },
        ],
        responses: listResp("Matched products"),
      },
    },
    "/products/bulk-import": {
      post: {
        tags: ["Products"],
        summary: "Bulk import products",
        description: "Inserts an array of product objects in a single request.",
        ...auth(["Admin"]),
        ...body({
          shopId:   intId("Shop to import into"),
          products: {
            type: "array",
            description: "Array of product objects",
            items: {
              type: "object",
              required: ["name"],
              properties: {
                name:           strField("Product name"),
                categoryId:     intId("Category ID (optional)"),
                barcode:        strField("Barcode"),
                buyingPrice:    { type: "number" },
                sellingPrice:   { type: "number" },
                wholesalePrice: { type: "number" },
                dealerPrice:    { type: "number" },
                measureUnit:    strField("Unit of measure"),
                manufacturer:   strField("Manufacturer"),
                supplierId:     intId("Supplier ID"),
                description:    strField("Description"),
                type:           { type: "string", enum: ["product", "service", "bundle"] },
              },
            },
          },
        }, ["shopId", "products"]),
        responses: {
          ...dataResp("Import summary", {
            created:  intId("Number of products created"),
            skipped:  intId("Number of rows skipped due to errors"),
            errors:   { type: "array", items: { type: "string" } },
            products: { type: "array" },
          }),
          ...errResp,
        },
      },
    },
    "/products/attributes": {
      get: {
        tags: ["Products"],
        summary: "List product attributes (colour, size, etc.)",
        ...auth(["Admin", "Attendant"]),
        responses: dataResp("Attributes with variants"),
      },
      post: {
        tags: ["Products"],
        summary: "Create product attribute",
        ...auth(["Admin"]),
        ...body({
          title:     strField("Display title, e.g. 'Colour'"),
          name:      strField("Machine-readable key, e.g. 'color'"),
          inputType: strField("select | radio | text | checkbox"),
          type:      strField("Attribute type (optional)"),
          status:    strField("active | inactive"),
        }, ["title", "name"]),
        responses: { ...createdResp("Attribute created"), ...errResp },
      },
    },
    "/products/attributes/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get attribute with variants",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Attribute"), 404: errResp[404] },
      },
    },
    "/products/attributes/{id}/variants": {
      post: {
        tags: ["Products"],
        summary: "Add variant to attribute",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          name:   strField("Variant value, e.g. 'Red'"),
          status: strField("active | inactive"),
        }, ["name"]),
        responses: { ...createdResp("Variant added"), ...errResp },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get product by ID",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Product with category"), 404: errResp[404] },
      },
      put: {
        tags: ["Products"],
        summary: "Update product",
        description: "Only provided fields are updated.",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          name:           strField("Product name"),
          categoryId:     intId("Category ID (set to null to clear)"),
          barcode:        strField("Barcode"),
          serialNumber:   strField("Serial number"),
          buyingPrice:    { type: "number" },
          sellingPrice:   { type: "number" },
          wholesalePrice: { type: "number" },
          dealerPrice:    { type: "number" },
          measureUnit:    strField("Unit of measure"),
          manufacturer:   strField("Manufacturer"),
          supplierId:     intId("Supplier ID"),
          description:    strField("Description"),
          alertQuantity:  { type: "number" },
          type:           { type: "string", enum: ["product", "service", "bundle"] },
        }),
        responses: { ...dataResp("Updated product"), ...errResp },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete product",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/products/{id}/image": {
      put: {
        tags: ["Products"],
        summary: "Upload product thumbnail",
        description: "Send as `multipart/form-data` with a field named `image` (max 5 MB).",
        ...auth(["Admin"]),
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["image"], properties: { image: { type: "string", format: "binary", description: "Image file (JPEG/PNG/WebP, max 5 MB)" } } } } },
        },
        responses: { ...dataResp("Thumbnail updated", { imageUrl: strField("Data URL of stored image") }), ...errResp },
      },
    },
    "/products/{id}/images": {
      post: {
        tags: ["Products"],
        summary: "Upload additional product images",
        description: "Send as `multipart/form-data` with field(s) named `images` (max 10 files, 5 MB each).",
        ...auth(["Admin"]),
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", required: ["images"], properties: { images: { type: "array", items: { type: "string", format: "binary" }, description: "Up to 10 image files" } } } } },
        },
        responses: { ...dataResp("Images uploaded", { images: { type: "array", items: { type: "string" } } }), ...errResp },
      },
    },
    "/products/{id}/serials": {
      get: {
        tags: ["Products"],
        summary: "List serial numbers for a product",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: dataResp("Serial numbers"),
      },
      post: {
        tags: ["Products"],
        summary: "Add serial numbers to a product",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          shopId:  intId("Shop to assign serials to"),
          serials: { type: "array", items: { type: "string" }, description: "Array of serial number strings" },
        }, ["shopId", "serials"]),
        responses: { ...createdResp("Serials added"), ...errResp },
      },
    },
    "/products/{id}/bundle-items": {
      get: {
        tags: ["Products"],
        summary: "List bundle components",
        description: "Returns the component products of a bundle-type product.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: dataResp("Bundle items"),
      },
      post: {
        tags: ["Products"],
        summary: "Add component to bundle",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          componentProductId: intId("Product ID of the component"),
          quantity:           { type: "number", description: "Component quantity per bundle unit" },
        }, ["componentProductId", "quantity"]),
        responses: { ...createdResp("Component added"), ...errResp },
      },
    },
    "/products/{id}/sales-history": {
      get: {
        tags: ["Products"],
        summary: "Product sales history",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), shopIdQuery, fromParam, toParam, ...paginationParams],
        responses: listResp("Sale line items for this product"),
      },
    },
    "/products/{id}/purchases-history": {
      get: {
        tags: ["Products"],
        summary: "Product purchase history",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), shopIdQuery, fromParam, toParam, ...paginationParams],
        responses: listResp("Purchase line items for this product"),
      },
    },
    "/products/{id}/stock-history": {
      get: {
        tags: ["Products"],
        summary: "Product stock adjustment & write-off history",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), shopIdQuery],
        responses: dataResp("Adjustment and bad-stock events"),
      },
    },
    "/products/{id}/transfer-history": {
      get: {
        tags: ["Products"],
        summary: "Product transfer history",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), shopIdQuery, ...paginationParams],
        responses: listResp("Transfer line items for this product"),
      },
    },
    "/products/{id}/summary": {
      get: {
        tags: ["Products"],
        summary: "Product performance summary",
        description: "Returns aggregated sales, purchases, and current stock for a single product.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), shopIdQuery],
        responses: dataResp("Product summary", {
          product:      { type: "object" },
          sales:        { type: "object", properties: { totalSoldQty: moneyStr, totalSoldValue: moneyStr, saleCount: intId("Count") } },
          purchases:    { type: "object", properties: { totalPurchasedQty: moneyStr, totalPurchasedValue: moneyStr, purchaseCount: intId("Count") } },
          currentStock: { ...moneyStr, description: "Current inventory quantity" },
          stockValue:   { ...moneyStr, description: "currentStock × buyingPrice" },
        }),
      },
    },

    // ── Inventory ─────────────────────────────────────────────────────────────
    "/inventory": {
      get: {
        tags: ["Inventory"],
        summary: "List inventory records",
        description: "Each record represents the stock level of one product in one shop.",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams, shopIdQuery,
          { name: "productId", in: "query", description: "Filter by product", schema: { type: "integer" } },
        ],
        responses: listResp("Inventory records", {
          id:        intId("Record ID"),
          shop:      intId("Shop ID"),
          product:   intId("Product ID"),
          quantity:  moneyStr,
          ...timestamps,
        }),
      },
    },
    "/inventory/item/{id}": {
      get: {
        tags: ["Inventory"],
        summary: "Get inventory record by ID",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Inventory record"), 404: errResp[404] },
      },
    },
    "/inventory/batches": {
      get: {
        tags: ["Inventory"],
        summary: "List product batches",
        description: "Batch records track expiry dates and lot numbers for perishable/tracked products.",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams, shopIdQuery,
          { name: "productId", in: "query", description: "Filter by product", schema: { type: "integer" } },
        ],
        responses: listResp("Batches", {
          id:             intId("Batch ID"),
          shop:           intId("Shop ID"),
          product:        intId("Product ID"),
          quantity:       moneyStr,
          expirationDate: isoDate,
        }),
      },
    },

    // ── Adjustments ───────────────────────────────────────────────────────────
    "/inventory/adjustments": {
      get: {
        tags: ["Adjustments"],
        summary: "List stock adjustments",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Adjustments"),
      },
      post: {
        tags: ["Adjustments"],
        summary: "Create stock adjustment",
        description: "Use to correct stock levels. Provide `quantityBefore` + `quantityAfter` for an explicit change, or just `quantity` for the final target.",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:         intId("Shop ID"),
          productId:      intId("Product ID"),
          quantityBefore: { type: "number", description: "Stock quantity before adjustment (alternative: omit and use quantity)" },
          quantityAfter:  { type: "number", description: "Stock quantity after adjustment" },
          quantity:       { type: "number", description: "Shorthand: set this as the new quantity (uses 0 as quantityBefore)" },
          reason:         strField("Reason for adjustment (e.g. 'Damaged', 'Counted')"),
          type:           { type: "string", enum: ["add", "remove"], description: "Inferred from before/after if omitted" },
        }, ["shopId", "productId"]),
        responses: { ...createdResp("Adjustment recorded"), ...errResp },
      },
    },
    "/inventory/adjustments/{id}": {
      delete: {
        tags: ["Adjustments"],
        summary: "Delete adjustment",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Bad Stocks ────────────────────────────────────────────────────────────
    "/inventory/bad-stocks": {
      get: {
        tags: ["Bad Stocks"],
        summary: "List bad-stock / write-off records",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Bad stock records"),
      },
      post: {
        tags: ["Bad Stocks"],
        summary: "Record damaged / expired stock write-off",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:    intId("Shop ID"),
          productId: intId("Product ID"),
          quantity:  { type: "number", description: "Quantity written off" },
          unitPrice: { type: "number", description: "Unit cost for loss valuation (defaults to 0)" },
          reason:    strField("Write-off reason (e.g. 'Expired', 'Damaged')"),
        }, ["shopId", "productId", "quantity", "reason"]),
        responses: { ...createdResp("Write-off recorded"), ...errResp },
      },
    },
    "/inventory/bad-stocks/{id}": {
      delete: {
        tags: ["Bad Stocks"],
        summary: "Delete bad-stock record",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Stock Counts ──────────────────────────────────────────────────────────
    "/inventory/stock-counts": {
      get: {
        tags: ["Stock Counts"],
        summary: "List stock-count sessions",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Stock-count sessions with items"),
      },
      post: {
        tags: ["Stock Counts"],
        summary: "Start a new stock-count session",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId: intId("Shop being counted"),
          items:  { type: "array", description: "Products counted in this session", items: stockCountItemInput },
        }, ["shopId", "items"]),
        responses: { ...createdResp("Stock count created"), ...errResp },
      },
    },
    "/inventory/stock-counts/product-search": {
      get: {
        tags: ["Stock Counts"],
        summary: "Search products for counting",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "shopId", in: "query", required: true,  schema: { type: "integer" }, description: "Shop ID" },
          { name: "q",      in: "query", required: false, schema: { type: "string"  }, description: "Search term (name or barcode)" },
        ],
        responses: dataResp("Matching products"),
      },
    },
    "/inventory/stock-counts/product-filter": {
      get: {
        tags: ["Stock Counts"],
        summary: "List all products for counting with current inventory",
        ...auth(["Admin", "Attendant"]),
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "integer" } }],
        responses: dataResp("Products with inventory"),
      },
    },
    "/inventory/stock-counts/by-product/{productId}": {
      get: {
        tags: ["Stock Counts"],
        summary: "Count history for a specific product",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("productId", "Product ID"), ...paginationParams],
        responses: listResp("Stock-count items"),
      },
    },
    "/inventory/stock-counts/{id}": {
      get: {
        tags: ["Stock Counts"],
        summary: "Get stock-count session",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Stock-count session with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Stock Counts"],
        summary: "Delete stock-count session",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },
    "/inventory/stock-counts/{id}/items": {
      post: {
        tags: ["Stock Counts"],
        summary: "Add items to an existing stock-count session",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ items: { type: "array", items: stockCountItemInput } }, ["items"]),
        responses: { ...createdResp("Items added"), ...errResp },
      },
    },
    "/inventory/stock-counts/{id}/apply": {
      post: {
        tags: ["Stock Counts"],
        summary: "Apply stock-count results",
        description: "Converts count variances into stock adjustments and updates inventory quantities.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Applied", { applied: intId("Adjustments created") }), ...errResp },
      },
    },

    // ── Stock Requests ────────────────────────────────────────────────────────
    "/inventory/stock-requests": {
      get: {
        tags: ["Stock Requests"],
        summary: "List stock requests",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Stock requests with items"),
      },
      post: {
        tags: ["Stock Requests"],
        summary: "Create stock request",
        description: "Requests stock from a warehouse shop.",
        ...auth(["Admin", "Attendant"]),
        ...body({
          fromShopId:  intId("Requesting shop ID"),
          warehouseId: intId("Warehouse shop ID"),
          items:       { type: "array", items: stockRequestItemInput },
        }, ["fromShopId", "warehouseId", "items"]),
        responses: { ...createdResp("Stock request created"), ...errResp },
      },
    },
    "/inventory/stock-requests/by-product/{productId}": {
      get: {
        tags: ["Stock Requests"],
        summary: "Stock request history for a product",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam("productId", "Product ID"), ...paginationParams],
        responses: listResp("Stock request items"),
      },
    },
    "/inventory/stock-requests/{id}": {
      get: {
        tags: ["Stock Requests"],
        summary: "Get stock request",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Stock request with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Stock Requests"],
        summary: "Delete stock request",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },
    "/inventory/stock-requests/{id}/approve": {
      put: {
        tags: ["Stock Requests"],
        summary: "Approve (process) stock request",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Updated"), 404: errResp[404] },
      },
    },
    "/inventory/stock-requests/{id}/reject": {
      put: {
        tags: ["Stock Requests"],
        summary: "Reject / void stock request",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Updated"), 404: errResp[404] },
      },
    },
    "/inventory/stock-requests/{id}/accept": {
      post: {
        tags: ["Stock Requests"],
        summary: "Accept stock request (warehouse confirms)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Accepted"), 404: errResp[404] },
      },
    },
    "/inventory/stock-requests/{id}/dispatch": {
      post: {
        tags: ["Stock Requests"],
        summary: "Mark stock request as dispatched",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Dispatched"), 404: errResp[404] },
      },
    },
    "/inventory/stock-requests/{id}/status": {
      put: {
        tags: ["Stock Requests"],
        summary: "Update stock request status (free-form)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ status: strField("pending | processed | void | completed") }, ["status"]),
        responses: { ...dataResp("Updated"), ...errResp },
      },
    },
    "/inventory/stock-requests/{id}/items/{itemId}": {
      delete: {
        tags: ["Stock Requests"],
        summary: "Remove item from stock request",
        ...auth(["Admin"]),
        parameters: [idParam(), idParam("itemId", "Request item ID")],
        responses: { ...noContentResp },
      },
    },

    // ── Transfers ─────────────────────────────────────────────────────────────
    "/transfers": {
      get: {
        tags: ["Transfers"],
        summary: "List product transfers",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Transfers with items"),
      },
      post: {
        tags: ["Transfers"],
        summary: "Create product transfer",
        ...auth(["Admin", "Attendant"]),
        ...body({
          fromShopId: intId("Source shop ID"),
          toShopId:   intId("Destination shop ID"),
          note:       strField("Transfer note / reference (optional)"),
          items:      { type: "array", items: transferItemInput },
        }, ["fromShopId", "toShopId", "items"]),
        responses: { ...createdResp("Transfer created"), ...errResp },
      },
    },
    "/transfers/{id}": {
      get: {
        tags: ["Transfers"],
        summary: "Get transfer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Transfer with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Transfers"],
        summary: "Delete transfer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Customers ─────────────────────────────────────────────────────────────
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, searchParam, shopIdQuery],
        responses: listResp("Customers", {
          id:          intId("Customer ID"),
          customerNo:  intId("Sequential customer number"),
          name:        strField("Full name"),
          phone:       strField("Phone number"),
          email:       strField("Email address"),
          address:     strField("Address"),
          type:        strField("retail | wholesale | dealer | online | verified"),
          creditLimit: moneyStr,
          wallet:      moneyStr,
          shop:        intId("Shop ID"),
          createdAt:   isoDate,
        }),
      },
      post: {
        tags: ["Customers"],
        summary: "Create customer",
        ...auth(["Admin", "Attendant"]),
        ...body({
          name:        { type: "string",  description: "Customer full name",                          example: "John Kamau" },
          shopId:      { type: "integer", description: "Shop ID",                                     example: 1 },
          phone:       { type: "string",  description: "Phone number",                                example: "+254712345678" },
          email:       { type: "string",  format: "email", description: "Email (optional)",           example: "john.kamau@gmail.com" },
          address:     { type: "string",  description: "Delivery/billing address (optional)",         example: "Westlands, Nairobi" },
          creditLimit: { type: "number",  description: "Maximum credit allowed (optional)",           example: 5000 },
          type:        { type: "string",  enum: ["retail", "wholesale", "dealer", "online"],          example: "retail" },
        }, ["name", "shopId", "phone"]),
        responses: { ...createdResp("Customer created", { id: intId("Customer ID"), customerNo: intId("Sequential no.") }), ...errResp },
      },
    },
    "/customers/by-number": {
      get: {
        tags: ["Customers"],
        summary: "Look up customer by number or phone",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          { name: "customerNo", in: "query", schema: { type: "integer" }, description: "Customer sequential number" },
          { name: "phone",      in: "query", schema: { type: "string"  }, description: "Phone number" },
          shopIdQuery,
        ],
        responses: { ...dataResp("Customer"), 404: errResp[404] },
      },
    },
    "/customers/bulk-import": {
      post: {
        tags: ["Customers"],
        summary: "Bulk import customers",
        ...auth(["Admin", "Attendant"]),
        ...body({
          customers: {
            type: "array",
            items: {
              type: "object", required: ["name", "shopId"],
              properties: {
                name:        strField("Name"),
                shopId:      intId("Shop ID"),
                phone:       strField("Phone"),
                email:       strField("Email"),
                address:     strField("Address"),
                creditLimit: { type: "number" },
                type:        strField("retail | wholesale | dealer"),
              },
            },
          },
        }, ["customers"]),
        responses: { ...dataResp("Import summary", { created: intId("Created"), skipped: intId("Skipped"), errors: { type: "array" } }), ...errResp },
      },
    },
    "/customers/{id}": {
      get: {
        tags: ["Customers"],
        summary: "Get customer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Customer"), 404: errResp[404] },
      },
      put: {
        tags: ["Customers"],
        summary: "Update customer",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({
          name:        strField("Name"),
          phone:       strField("Phone"),
          email:       strField("Email"),
          address:     strField("Address"),
          creditLimit: { type: "number" },
          type:        strField("retail | wholesale | dealer"),
        }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Customers"],
        summary: "Delete customer",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/customers/{id}/verify": {
      put: {
        tags: ["Customers"],
        summary: "Verify customer (mark as verified)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Verified", { message: { type: "string" } }), 404: errResp[404] },
      },
    },
    "/customers/{id}/wallet": {
      get: {
        tags: ["Customers"],
        summary: "Get wallet transactions (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), ...paginationParams],
        responses: listResp("Wallet transactions"),
      },
      post: {
        tags: ["Customers"],
        summary: "Top up wallet (legacy endpoint)",
        description: "Use `/customers/{id}/wallet/deposit` for new integrations.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" } }, ["amount"]),
        responses: { ...dataResp("Wallet updated", { wallet: moneyStr }), ...errResp },
      },
    },
    "/customers/{id}/wallet-transactions": {
      get: {
        tags: ["Customers"],
        summary: "Get wallet transactions (alias)",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), ...paginationParams],
        responses: listResp("Wallet transactions"),
      },
    },
    "/customers/{id}/wallet/deposit": {
      post: {
        tags: ["Customers"],
        summary: "Deposit to customer wallet",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number", description: "Amount to deposit (positive)" }, ...walletChangeBody }, ["amount"]),
        responses: { ...dataResp("Wallet updated", { wallet: moneyStr, transaction: { type: "object" } }), ...errResp },
      },
    },
    "/customers/{id}/wallet/withdraw": {
      post: {
        tags: ["Customers"],
        summary: "Withdraw from customer wallet",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number", description: "Amount to withdraw (positive)" }, ...walletChangeBody }, ["amount"]),
        responses: { ...dataResp("Wallet updated", { wallet: moneyStr, transaction: { type: "object" } }), ...errResp },
      },
    },
    "/customers/{id}/wallet/payment": {
      post: {
        tags: ["Customers"],
        summary: "Apply wallet to outstanding balance",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number", description: "Amount to deduct" }, ...walletChangeBody }, ["amount"]),
        responses: { ...dataResp("Wallet updated"), ...errResp },
      },
    },

    // ── Orders ────────────────────────────────────────────────────────────────
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams, shopIdQuery,
          { name: "status", in: "query", schema: { type: "string" }, description: "pending | processing | shipped | delivered | completed | cancelled" },
        ],
        responses: listResp("Orders with items"),
      },
      post: {
        tags: ["Orders"],
        summary: "Create order",
        description: "Creates a pending order. Use `POST /orders/{id}/fulfill` to convert it into a sale.",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:     intId("Shop ID"),
          customerId: intId("Customer ID (optional)"),
          note:       strField("Order note (optional)"),
          items:      { type: "array", items: orderItemInput },
        }, ["shopId", "items"]),
        responses: { ...createdResp("Order created"), ...errResp },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get order",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Order with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Orders"],
        summary: "Delete order",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },
    "/orders/{id}/status": {
      put: {
        tags: ["Orders"],
        summary: "Update order status",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({
          status:   strField("pending | processing | shipped | delivered | completed | cancelled"),
          shipping: { type: "object", description: "Shipping details (required when status = shipped)" },
          reason:   strField("Cancellation reason (required when status = cancelled)"),
        }, ["status"]),
        responses: { ...dataResp("Updated order"), ...errResp },
      },
    },
    "/orders/{id}/fulfill": {
      post: {
        tags: ["Orders"],
        summary: "Fulfill order → create sale",
        description: "Converts the order into a completed sale, deducts inventory, and triggers receipt notifications.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Order fulfilled", { order: { type: "object" }, sale: { type: "object" } }), ...errResp },
      },
    },

    // ── Sales ─────────────────────────────────────────────────────────────────
    "/sales": {
      get: {
        tags: ["Sales"],
        summary: "List sales (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [
          ...paginationParams, shopIdQuery, fromParam, toParam,
          { name: "customerId", in: "query", schema: { type: "integer" }, description: "Filter by customer" },
        ],
        responses: listResp("Sales with items and payments", {
          id:                 intId("Sale ID"),
          receiptNo:          strField("Auto-generated receipt number"),
          totalAmount:        moneyStr,
          totalWithDiscount:  moneyStr,
          amountPaid:         moneyStr,
          outstandingBalance: moneyStr,
          saleDiscount:       moneyStr,
          paymentType:        strField("Payment method name"),
          saleType:           strField("Retail | Wholesale | Dealer"),
          status:             strField("cashed | credit | refunded | voided"),
          shop:               intId("Shop ID"),
          customer:           intId("Customer ID"),
          attendant:          intId("Attendant ID"),
          createdAt:          isoDate,
        }),
      },
      post: {
        tags: ["Sales"],
        summary: "Record a sale",
        description: "Creates the sale, its line items, and (if amountPaid > 0 and attendant token used) a payment record. Also triggers receipt email and SMS notifications.",
        ...auth(["Admin", "Attendant"]),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "items"],
                properties: {
                  shopId:        { type: "integer", description: "Shop ID",                                                               example: 1 },
                  customerId:    { type: "integer", description: "Customer ID (optional — for credit/loyalty tracking)",                  example: 5 },
                  paymentMethod: { type: "string",  description: "Must match an active payment method name",                             example: "Cash" },
                  amountPaid:    { type: "number",  description: "Amount tendered (defaults to order total)",                            example: 500 },
                  discount:      { type: "number",  description: "Order-level discount amount",                                          example: 20 },
                  note:          { type: "string",  description: "Sale note or memo",                                                    example: "Customer requested gift wrap" },
                  saleType:      { type: "string",  enum: ["Retail", "Wholesale", "Dealer"],                                             example: "Retail" },
                  items: {
                    type: "array",
                    description: "At least one line item required",
                    items: saleItemInput,
                    example: [
                      { productId: 7, quantity: 3, unitPrice: 60 },
                      { productId: 12, quantity: 1, unitPrice: 350, discount: 20 },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          ...createdResp("Sale recorded", {
            id:                 intId("Sale ID"),
            receiptNo:          strField("Receipt number"),
            totalAmount:        moneyStr,
            outstandingBalance: moneyStr,
            status:             strField("cashed | credit"),
            items:              { type: "array" },
          }),
          ...errResp,
        },
      },
    },
    "/sales/cross-shop": {
      get: {
        tags: ["Sales"],
        summary: "Cross-shop sales summary",
        description: "Returns aggregated sale totals grouped by shop. Useful for multi-shop dashboards.",
        ...auth(["Admin"]),
        parameters: [fromParam, toParam],
        responses: dataResp("Cross-shop totals"),
      },
    },
    "/sales/{id}": {
      get: {
        tags: ["Sales"],
        summary: "Get sale",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Sale with items and payments"), 404: errResp[404] },
      },
      put: {
        tags: ["Sales"],
        summary: "Update sale (note / discount only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          note:     strField("Updated sale note"),
          discount: { type: "number", description: "Updated order-level discount" },
        }),
        responses: { ...dataResp("Updated sale"), ...errResp },
      },
      delete: {
        tags: ["Sales"],
        summary: "Void sale",
        description: "Marks the sale as voided. Does not reverse inventory.",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/sales/{id}/void": {
      post: {
        tags: ["Sales"],
        summary: "Void sale (explicit POST)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Voided sale"), 404: errResp[404] },
      },
    },
    "/sales/{id}/refund": {
      post: {
        tags: ["Sales"],
        summary: "Mark sale as refunded",
        description: "Changes status to 'refunded'. For itemised refunds use POST /sale-returns.",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Refunded sale"), 404: errResp[404] },
      },
    },
    "/sales/{id}/payments": {
      post: {
        tags: ["Sales"],
        summary: "Record additional payment on credit sale",
        description: "Reduces the outstanding balance. Updates sale status to 'cashed' when fully paid.",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        ...body({
          amount:    { type: "number", description: "Payment amount" },
          method:    strField("Payment method name (must exist in catalog)"),
          reference: strField("Transaction reference (optional)"),
        }, ["amount", "method"]),
        responses: { ...createdResp("Payment recorded"), ...errResp },
      },
    },

    // ── Sale Returns ──────────────────────────────────────────────────────────
    "/sale-returns": {
      get: {
        tags: ["Sale Returns"],
        summary: "List sale returns",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Sale returns with items"),
      },
      post: {
        tags: ["Sale Returns"],
        summary: "Process customer return / refund",
        ...auth(["Admin", "Attendant"]),
        ...body({
          saleId:       intId("Original sale ID"),
          shopId:       intId("Shop ID"),
          items:        { type: "array", items: returnItemInput, description: "Items being returned" },
          reason:       strField("Return reason"),
          refundMethod: { type: "string", description: "Refund method (cash | wallet | bank)", default: "cash" },
        }, ["saleId", "shopId", "items"]),
        responses: { ...createdResp("Return processed"), ...errResp },
      },
    },
    "/sale-returns/{id}": {
      get: {
        tags: ["Sale Returns"],
        summary: "Get sale return",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Sale return with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Sale Returns"],
        summary: "Delete sale return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Purchases ─────────────────────────────────────────────────────────────
    "/purchases": {
      get: {
        tags: ["Purchases"],
        summary: "List purchases / GRNs (paginated)",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams, shopIdQuery, fromParam, toParam,
          { name: "supplierId", in: "query", schema: { type: "integer" }, description: "Filter by supplier" },
        ],
        responses: listResp("Purchases with items and payments"),
      },
      post: {
        tags: ["Purchases"],
        summary: "Create purchase / GRN",
        description: "Records stock received from a supplier. Automatically triggers a purchase order email to the supplier.",
        ...auth(["Admin"]),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "items"],
                properties: {
                  shopId:      { type: "integer", description: "Shop receiving the goods",                     example: 1 },
                  supplierId:  { type: "integer", description: "Supplier ID (optional)",                       example: 2 },
                  amountPaid:  { type: "number",  description: "Amount paid upfront (0 = full credit)",        example: 0 },
                  note:        { type: "string",  description: "Purchase note or reference",                   example: "Invoice #INV-2026-001" },
                  paymentType: { type: "string",  description: "cash | bank | mpesa | credit",                 example: "cash" },
                  items: {
                    type: "array",
                    description: "Products being received",
                    items: purchaseItemInput,
                    example: [
                      { productId: 7,  quantity: 50, buyingPrice: 45 },
                      { productId: 12, quantity: 20, buyingPrice: 280, batchCode: "BATCH-A1", expiryDate: "2027-06-30" },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          ...createdResp("Purchase created", {
            id:                 intId("Purchase ID"),
            purchaseNo:         strField("Auto-generated purchase number"),
            totalAmount:        moneyStr,
            outstandingBalance: moneyStr,
            items:              { type: "array" },
          }),
          ...errResp,
        },
      },
    },
    "/purchases/{id}": {
      get: {
        tags: ["Purchases"],
        summary: "Get purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Purchase with items and payments"), 404: errResp[404] },
      },
      put: {
        tags: ["Purchases"],
        summary: "Update purchase note",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ note: strField("Updated note") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Purchases"],
        summary: "Delete purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/purchases/{id}/payments": {
      post: {
        tags: ["Purchases"],
        summary: "Record payment against purchase",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          amount: { type: "number" },
          method: strField("Payment method"),
        }, ["amount", "method"]),
        responses: { ...createdResp("Payment recorded"), ...errResp },
      },
    },

    // ── Purchase Returns ──────────────────────────────────────────────────────
    "/purchase-returns": {
      get: {
        tags: ["Purchase Returns"],
        summary: "List purchase returns",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Purchase returns with items"),
      },
      post: {
        tags: ["Purchase Returns"],
        summary: "Return goods to supplier",
        ...auth(["Admin", "Attendant"]),
        ...body({
          purchaseId:   intId("Original purchase ID"),
          shopId:       intId("Shop ID"),
          items:        { type: "array", items: returnItemInput },
          reason:       strField("Return reason"),
          refundMethod: { type: "string", default: "cash" },
        }, ["purchaseId", "shopId", "items"]),
        responses: { ...createdResp("Return created"), ...errResp },
      },
    },
    "/purchase-returns/{id}": {
      get: {
        tags: ["Purchase Returns"],
        summary: "Get purchase return",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Purchase return with items"), 404: errResp[404] },
      },
      delete: {
        tags: ["Purchase Returns"],
        summary: "Delete purchase return",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Suppliers ─────────────────────────────────────────────────────────────
    "/suppliers": {
      get: {
        tags: ["Suppliers"],
        summary: "List suppliers (paginated)",
        ...auth(["Admin"]),
        parameters: [...paginationParams, searchParam, shopIdQuery],
        responses: listResp("Suppliers", {
          id:      intId("Supplier ID"),
          name:    strField("Supplier name"),
          phone:   strField("Phone"),
          email:   strField("Email"),
          address: strField("Address"),
          wallet:  moneyStr,
          shop:    intId("Shop ID"),
        }),
      },
      post: {
        tags: ["Suppliers"],
        summary: "Create supplier",
        ...auth(["Admin"]),
        ...body({
          name:    { type: "string",  description: "Supplier / company name",    example: "Unilever Kenya Ltd" },
          shopId:  { type: "integer", description: "Shop ID",                    example: 1 },
          phone:   { type: "string",  description: "Contact phone (optional)",   example: "+254700123456" },
          email:   { type: "string",  format: "email",                           example: "orders@unilever.co.ke" },
          address: { type: "string",  description: "Address (optional)",         example: "Industrial Area, Nairobi" },
        }, ["name", "shopId"]),
        responses: { ...createdResp("Supplier created"), ...errResp },
      },
    },
    "/suppliers/bulk-import": {
      post: {
        tags: ["Suppliers"],
        summary: "Bulk import suppliers",
        ...auth(["Admin"]),
        ...body({
          suppliers: {
            type: "array",
            items: {
              type: "object", required: ["name", "shopId"],
              properties: {
                name: strField("Name"), shopId: intId("Shop ID"),
                phone: strField("Phone"), email: strField("Email"), address: strField("Address"),
              },
            },
          },
        }, ["suppliers"]),
        responses: { ...dataResp("Import summary"), ...errResp },
      },
    },
    "/suppliers/{id}": {
      get: {
        tags: ["Suppliers"],
        summary: "Get supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Supplier"), 404: errResp[404] },
      },
      put: {
        tags: ["Suppliers"],
        summary: "Update supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Name"), phone: strField("Phone"), email: strField("Email"), address: strField("Address") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Suppliers"],
        summary: "Delete supplier",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/suppliers/{id}/wallet": {
      get: {
        tags: ["Suppliers"],
        summary: "List supplier wallet transactions",
        ...auth(["Admin"]),
        parameters: [idParam(), ...paginationParams],
        responses: listResp("Wallet transactions"),
      },
      post: {
        tags: ["Suppliers"],
        summary: "Top up supplier wallet (legacy)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" } }, ["amount"]),
        responses: { ...dataResp("Wallet updated", { wallet: moneyStr }), ...errResp },
      },
    },
    "/suppliers/{id}/wallet-transactions": {
      get: {
        tags: ["Suppliers"],
        summary: "List supplier wallet transactions (alias)",
        ...auth(["Admin"]),
        parameters: [idParam(), ...paginationParams],
        responses: listResp("Wallet transactions"),
      },
    },
    "/suppliers/{id}/wallet/deposit": {
      post: {
        tags: ["Suppliers"],
        summary: "Deposit to supplier wallet",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, ...walletChangeBody }, ["amount"]),
        responses: { ...dataResp("Wallet updated"), ...errResp },
      },
    },
    "/suppliers/{id}/wallet/payment": {
      post: {
        tags: ["Suppliers"],
        summary: "Record supplier payment (debit wallet)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ amount: { type: "number" }, ...walletChangeBody }, ["amount"]),
        responses: { ...dataResp("Wallet updated"), ...errResp },
      },
    },

    // ── Finance: Expense Categories ───────────────────────────────────────────
    "/finance/expense-categories": {
      get: {
        tags: ["Expenses"],
        summary: "List expense categories",
        ...auth(["Admin", "Attendant"]),
        parameters: [shopIdQuery],
        responses: dataResp("Expense categories"),
      },
      post: {
        tags: ["Expenses"],
        summary: "Create expense category",
        ...auth(["Admin"]),
        ...body({ name: strField("Category name"), shopId: intId("Shop ID") }, ["name", "shopId"]),
        responses: { ...createdResp("Created"), ...errResp },
      },
    },
    "/finance/expense-categories/{id}": {
      put: {
        tags: ["Expenses"],
        summary: "Update expense category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Category name") }, ["name"]),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete expense category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Finance: Expenses ─────────────────────────────────────────────────────
    "/finance/expenses": {
      get: {
        tags: ["Expenses"],
        summary: "List expenses (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery, fromParam, toParam],
        responses: listResp("Expenses", {
          id:          intId("Expense ID"),
          expenseNo:   strField("Auto-generated reference"),
          description: strField("Description"),
          amount:      moneyStr,
          category:    intId("Expense category ID"),
          isRecurring: boolFlag("Recurring expense"),
          frequency:   strField("daily | weekly | monthly"),
          createdAt:   isoDate,
        }),
      },
      post: {
        tags: ["Expenses"],
        summary: "Record an expense",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:      intId("Shop ID"),
          amount:      { type: "number", description: "Expense amount" },
          description: strField("What the expense was for (optional)"),
          categoryId:  intId("Expense category ID (optional)"),
          isRecurring: boolFlag("Mark as a recurring expense"),
          frequency:   { type: "string", enum: ["daily", "weekly", "monthly"], description: "Recurrence interval (if isRecurring)" },
        }, ["shopId", "amount"]),
        responses: { ...createdResp("Expense recorded"), ...errResp },
      },
    },
    "/finance/expenses/{id}": {
      get: {
        tags: ["Expenses"],
        summary: "Get expense",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Expense"), 404: errResp[404] },
      },
      put: {
        tags: ["Expenses"],
        summary: "Update expense",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ description: strField("Description"), amount: { type: "number" }, categoryId: intId("Category ID") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Expenses"],
        summary: "Delete expense",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Finance: Cashflow Categories ──────────────────────────────────────────
    "/finance/cashflow-categories": {
      get: {
        tags: ["Cashflow"],
        summary: "List cashflow categories",
        ...auth(["Admin", "Attendant"]),
        parameters: [shopIdQuery],
        responses: dataResp("Cashflow categories"),
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create cashflow category",
        ...auth(["Admin"]),
        ...body({
          name:   strField("Category name"),
          shopId: intId("Shop ID"),
          type:   strField("inflow | outflow"),
        }, ["name", "shopId", "type"]),
        responses: { ...createdResp("Created"), ...errResp },
      },
    },
    "/finance/cashflow-categories/{id}": {
      put: {
        tags: ["Cashflow"],
        summary: "Update cashflow category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Name") }, ["name"]),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Cashflow"],
        summary: "Delete cashflow category",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Finance: Cashflows ────────────────────────────────────────────────────
    "/finance/cashflows": {
      get: {
        tags: ["Cashflow"],
        summary: "List cashflow entries (paginated)",
        ...auth(["Admin", "Attendant"]),
        parameters: [...paginationParams, shopIdQuery, fromParam, toParam],
        responses: listResp("Cashflow entries"),
      },
      post: {
        tags: ["Cashflow"],
        summary: "Record cashflow entry",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:      intId("Shop ID"),
          description: strField("Description / narration"),
          amount:      { type: "number" },
          categoryId:  intId("Cashflow category ID (optional)"),
          bankId:      intId("Bank account ID (optional)"),
        }, ["shopId", "description", "amount"]),
        responses: { ...createdResp("Cashflow entry created"), ...errResp },
      },
    },
    "/finance/cashflows/{id}": {
      get: {
        tags: ["Cashflow"],
        summary: "Get cashflow entry",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Cashflow entry"), 404: errResp[404] },
      },
      delete: {
        tags: ["Cashflow"],
        summary: "Delete cashflow entry",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── Finance: Banks ────────────────────────────────────────────────────────
    "/finance/banks": {
      get: {
        tags: ["Banks"],
        summary: "List bank / cashbox accounts",
        ...auth(["Admin", "Attendant"]),
        parameters: [shopIdQuery],
        responses: dataResp("Banks"),
      },
      post: {
        tags: ["Banks"],
        summary: "Create bank account",
        ...auth(["Admin"]),
        ...body({
          name:    strField("Account name (e.g. 'Main Cash', 'Equity Bank')"),
          shopId:  intId("Shop ID"),
          balance: { type: "number", description: "Opening balance (defaults to 0)" },
        }, ["name", "shopId"]),
        responses: { ...createdResp("Created"), ...errResp },
      },
    },
    "/finance/banks/{id}": {
      get: {
        tags: ["Banks"],
        summary: "Get bank account",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam()],
        responses: { ...dataResp("Bank account"), 404: errResp[404] },
      },
      put: {
        tags: ["Banks"],
        summary: "Update bank account",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Account name"), balance: { type: "number" } }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Banks"],
        summary: "Delete bank account",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },
    "/finance/banks/{id}/transactions": {
      get: {
        tags: ["Banks"],
        summary: "List bank transactions",
        ...auth(["Admin", "Attendant"]),
        parameters: [idParam(), ...paginationParams, fromParam, toParam],
        responses: listResp("Bank cashflow transactions"),
      },
    },

    // ── Payment Methods ───────────────────────────────────────────────────────
    "/finance/payment-methods": {
      get: {
        tags: ["Payment Methods"],
        summary: "List payment methods (POS catalog)",
        description: "Returns the global list of payment methods (Cash, M-Pesa, Card, etc.). Available to all authenticated POS users.",
        ...auth(["Admin", "Attendant"]),
        responses: dataResp("Payment methods", {
          id:          intId("ID"),
          name:        strField("Method name (used in sale/purchase paymentType)"),
          description: strField("Optional description"),
          isActive:    boolFlag("Whether this method is available at POS"),
          sortOrder:   intId("Display sort order"),
        }),
      },
      post: {
        tags: ["Payment Methods"],
        summary: "Create payment method (super-admin only)",
        ...auth(["Admin"]),
        ...body({
          name:        strField("Method name"),
          description: strField("Description (optional)"),
          isActive:    boolFlag("Active by default"),
          sortOrder:   intId("Display order (lower = first)"),
        }, ["name"]),
        responses: { ...createdResp("Created"), ...errResp },
      },
    },
    "/finance/payment-methods/{id}": {
      put: {
        tags: ["Payment Methods"],
        summary: "Update payment method (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ name: strField("Name"), description: strField("Description"), isActive: boolFlag("Active"), sortOrder: intId("Sort order") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Payment Methods"],
        summary: "Delete payment method (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },

    // ── User Payments ─────────────────────────────────────────────────────────
    "/finance/user-payments": {
      get: {
        tags: ["User Payments"],
        summary: "List user payments (paginated)",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams, shopIdQuery,
          { name: "type", in: "query", schema: { type: "string" }, description: "customer | supplier" },
        ],
        responses: listResp("User payment records"),
      },
      post: {
        tags: ["User Payments"],
        summary: "Record user payment",
        ...auth(["Admin", "Attendant"]),
        ...body({
          shopId:      intId("Shop ID"),
          amount:      { type: "number" },
          type:        strField("customer | supplier"),
          customerId:  intId("Customer ID (if type = customer)"),
          supplierId:  intId("Supplier ID (if type = supplier)"),
          paymentType: strField("Payment method"),
          mpesaCode:   strField("M-Pesa transaction code (optional)"),
        }, ["shopId", "amount", "type"]),
        responses: { ...createdResp("Payment recorded"), ...errResp },
      },
    },

    // ── Affiliates ────────────────────────────────────────────────────────────
    "/affiliates/register": {
      post: {
        tags: ["Affiliates"],
        summary: "Register affiliate partner",
        ...body({
          name:     strField("Full name"),
          email:    { type: "string", format: "email" },
          password: { type: "string", format: "password" },
          phone:    strField("Phone (optional)"),
          address:  strField("Address (optional)"),
          country:  strField("Country (optional)"),
        }, ["name", "email", "password"]),
        responses: { ...createdResp("Affiliate registered"), 409: { description: "Email already registered" } },
      },
    },
    "/affiliates/login": {
      post: {
        tags: ["Affiliates"],
        summary: "Affiliate login",
        ...body({ email: { type: "string", format: "email" }, password: { type: "string", format: "password" } }, ["email", "password"]),
        responses: { ...dataResp("Login successful", { token: strField("JWT token"), affiliate: { type: "object" } }), 401: { description: "Invalid credentials" } },
      },
    },
    "/affiliates/me": {
      get: {
        tags: ["Affiliates"],
        summary: "Get affiliate profile",
        ...auth(["Affiliate"]),
        responses: dataResp("Affiliate profile"),
      },
      put: {
        tags: ["Affiliates"],
        summary: "Update affiliate profile",
        ...auth(["Affiliate"]),
        ...body({ name: strField("Name"), phone: strField("Phone"), address: strField("Address"), country: strField("Country") }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
    },
    "/affiliates/me/awards": {
      get: {
        tags: ["Affiliates"],
        summary: "Affiliate's commission awards",
        ...auth(["Affiliate"]),
        parameters: [...paginationParams, fromParam, toParam],
        responses: listResp("Awards"),
      },
    },
    "/affiliates/me/transactions": {
      get: {
        tags: ["Affiliates"],
        summary: "Affiliate's wallet transactions",
        ...auth(["Affiliate"]),
        parameters: [...paginationParams],
        responses: listResp("Wallet transactions"),
      },
    },
    "/affiliates/me/withdraw": {
      post: {
        tags: ["Affiliates"],
        summary: "Request wallet withdrawal",
        ...auth(["Affiliate"]),
        ...body({
          amount:           { type: "number", description: "Amount to withdraw" },
          paymentType:      { type: "string", description: "mpesa | bank | paypal", default: "mpesa" },
          paymentReference: strField("External reference (optional)"),
          phone:            strField("M-Pesa phone number (optional)"),
          accountName:      strField("Bank account name (optional)"),
          accountNumber:    strField("Bank account number (optional)"),
        }, ["amount"]),
        responses: { ...createdResp("Withdrawal requested"), ...errResp },
      },
    },
    "/affiliates/awards": {
      get: {
        tags: ["Affiliates"],
        summary: "List all awards (admin)",
        ...auth(["Admin"]),
        parameters: [...paginationParams, { name: "affiliateId", in: "query", schema: { type: "integer" } }],
        responses: listResp("Awards"),
      },
      post: {
        tags: ["Affiliates"],
        summary: "Create award (super-admin only)",
        ...auth(["Admin"]),
        ...body({
          affiliateId: intId("Affiliate ID"),
          amount:      { type: "number" },
          type:        strField("subscription | referral | bonus"),
          awardType:   strField("Award sub-type"),
          shopId:      intId("Related shop ID (optional)"),
        }, ["affiliateId", "amount", "type"]),
        responses: { ...createdResp("Award created"), ...errResp },
      },
    },
    "/affiliates/transactions": {
      get: {
        tags: ["Affiliates"],
        summary: "List affiliate transactions",
        ...auth(["Affiliate"]),
        parameters: [...paginationParams],
        responses: listResp("Affiliate wallet transactions"),
      },
    },
    "/affiliates": {
      get: {
        tags: ["Affiliates"],
        summary: "List all affiliates (super-admin only)",
        ...auth(["Admin"]),
        parameters: [...paginationParams],
        responses: listResp("Affiliates"),
      },
    },
    "/affiliates/{id}": {
      get: {
        tags: ["Affiliates"],
        summary: "Get affiliate (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Affiliate"), 404: errResp[404] },
      },
    },
    "/affiliates/{id}/block": {
      put: {
        tags: ["Affiliates"],
        summary: "Block affiliate (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Blocked", { message: { type: "string" } }), ...errResp },
      },
    },
    "/affiliates/{id}/unblock": {
      put: {
        tags: ["Affiliates"],
        summary: "Unblock affiliate (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Unblocked", { message: { type: "string" } }), ...errResp },
      },
    },

    // ── Packages ──────────────────────────────────────────────────────────────
    "/packages": {
      get: {
        tags: ["Packages"],
        summary: "List active subscription packages (public)",
        description: "Returns all active packages ordered by sortOrder. No authentication required.",
        responses: dataResp("Active packages", {
          id:            intId("Package ID"),
          title:         strField("Display name", "Business Monthly"),
          description:   strField("Plan description"),
          type:          strField("trial | production"),
          durationValue: intId("Duration quantity"),
          durationUnit:  strField("days | weeks | months | years"),
          amount:        moneyStr,
          amountUsd:     moneyStr,
          discount:      moneyStr,
          maxShops:      intId("Max shops allowed (null = unlimited)"),
          isActive:      boolFlag("Package is available for purchase"),
          sortOrder:     intId("Display order"),
          packageFeatures: { type: "array", items: { type: "object", properties: { feature: strField("Feature description") } } },
        }),
      },
      post: {
        tags: ["Packages"],
        summary: "Create package (super-admin only)",
        ...auth(["Admin"]),
        ...body({
          title:         strField("Display name"),
          description:   strField("Plan description (optional)"),
          durationValue: { type: "integer", description: "Duration quantity" },
          durationUnit:  { type: "string",  enum: ["days", "weeks", "months", "years"] },
          amount:        { type: "number",  description: "Price in local currency (KES)" },
          amountUsd:     { type: "number",  description: "Price in USD" },
          type:          { type: "string",  enum: ["trial", "production"] },
          shops:         { type: "integer", description: "Max shops (omit for unlimited)" },
          discount:      { type: "number",  description: "Percentage discount", default: 0 },
          sortOrder:     { type: "integer", description: "Display order",        default: 0 },
        }, ["title", "durationValue", "durationUnit", "amount", "amountUsd", "type"]),
        responses: { ...createdResp("Package created"), ...errResp },
      },
    },
    "/packages/{id}": {
      get: {
        tags: ["Packages"],
        summary: "Get package",
        parameters: [idParam()],
        responses: { ...dataResp("Package with features"), 404: errResp[404] },
      },
      put: {
        tags: ["Packages"],
        summary: "Update package (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          title:         strField("Display name"),
          description:   strField("Description"),
          durationValue: { type: "integer" },
          durationUnit:  { type: "string", enum: ["days", "weeks", "months", "years"] },
          amount:        { type: "number" },
          amountUsd:     { type: "number" },
          isActive:      boolFlag("Activate or deactivate"),
          sortOrder:     { type: "integer" },
          discount:      { type: "number" },
        }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Packages"],
        summary: "Delete package (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/packages/{id}/features": {
      post: {
        tags: ["Packages"],
        summary: "Add features to package (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ features: { type: "array", items: { type: "string" }, description: "Array of feature description strings" } }, ["features"]),
        responses: { ...createdResp("Features added"), ...errResp },
      },
    },

    // ── Subscriptions ─────────────────────────────────────────────────────────
    "/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "List subscriptions for this admin",
        description: "Super-admin can pass `adminId` to view another admin's subscriptions.",
        ...auth(["Admin"]),
        parameters: [
          ...paginationParams,
          { name: "adminId", in: "query", schema: { type: "integer" }, description: "Super-admin only: filter by admin" },
        ],
        responses: listResp("Subscriptions with package and shops"),
      },
      post: {
        tags: ["Subscriptions"],
        summary: "Create subscription",
        description: "Creates a new subscription for one or more shops. Payment is handled separately via `POST /subscriptions/{id}/pay`.",
        ...auth(["Admin"]),
        ...body({
          packageId:  intId("Package to subscribe to"),
          shopIds:    { type: "array", items: { type: "integer" }, description: "IDs of shops to include in this subscription" },
          mpesaCode:  strField("M-Pesa transaction code (optional — for immediate payment confirmation)"),
          currency:   { type: "string", description: "Currency code", default: "kes" },
        }, ["packageId", "shopIds"]),
        responses: {
          ...createdResp("Subscription created", {
            id:        intId("Subscription ID"),
            startDate: isoDate,
            endDate:   isoDate,
            isPaid:    boolFlag("Whether payment confirmed"),
            isActive:  boolFlag("Whether subscription is active"),
            invoiceNo: strField("Auto-generated invoice number"),
          }),
          ...errResp,
        },
      },
    },
    "/subscriptions/assign-shops": {
      put: {
        tags: ["Subscriptions"],
        summary: "Assign shops to a subscription",
        description: "Replaces the current shop list for the subscription.",
        ...auth(["Admin"]),
        ...body({
          subscriptionId: intId("Subscription ID"),
          shopIds:        { type: "array", items: { type: "integer" }, description: "New list of shop IDs" },
        }, ["subscriptionId", "shopIds"]),
        responses: { ...dataResp("Shop assignments updated"), ...errResp },
      },
    },
    "/subscriptions/admin/summary": {
      get: {
        tags: ["Subscriptions"],
        summary: "Platform subscription summary (super-admin only)",
        ...auth(["Admin"]),
        parameters: [fromParam, toParam],
        responses: dataResp("Summary", { total: intId("Total"), active: intId("Active"), revenue: moneyStr }),
      },
    },
    "/subscriptions/{id}": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscription",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Subscription with package and shops"), 404: errResp[404] },
      },
      put: {
        tags: ["Subscriptions"],
        summary: "Update subscription (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          isActive: boolFlag("Activate or deactivate"),
          isPaid:   boolFlag("Mark as paid"),
          endDate:  { ...isoDate, description: "Override expiry date" },
        }),
        responses: { ...dataResp("Updated"), ...errResp },
      },
      delete: {
        tags: ["Subscriptions"],
        summary: "Delete subscription (super-admin only)",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp },
      },
    },
    "/subscriptions/{id}/pay": {
      post: {
        tags: ["Subscriptions"],
        summary: "Initiate / confirm subscription payment",
        description: `
**Gateway path:** Provide \`paymentGatewayId\` to initiate an online payment. Returns a \`pending\` state with a \`checkoutUrl\` or \`checkoutRequestId\` depending on the gateway.

**Manual path:** Omit \`paymentGatewayId\` and provide a \`paymentReference\` or \`mpesaCode\` to record a manual payment immediately.
        `.trim(),
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          paymentGatewayId:  intId("Payment gateway ID (optional — triggers online payment flow)"),
          paymentMethod:     strField("Manual payment method label (used when no gateway)"),
          paymentReference:  strField("External reference / transaction ID"),
          mpesaCode:         strField("M-Pesa confirmation code"),
          phone:             strField("Phone number for M-Pesa STK push (required for some gateways)"),
        }),
        responses: {
          ...dataResp("Payment initiated or confirmed", {
            subscription: { type: "object" },
            payment: {
              type: "object",
              properties: {
                gateway:           strField("Gateway identifier or 'manual'"),
                status:            strField("pending | completed"),
                checkoutUrl:       strField("Redirect URL (online gateways)"),
                checkoutRequestId: strField("M-Pesa STK push request ID"),
                externalRef:       strField("Internal payment reference for callback matching"),
                amount:            intId("Amount charged"),
                currency:          strField("Currency code"),
              },
            },
          }),
          ...errResp,
        },
      },
    },
    "/subscriptions/{id}/pay/mpesa": {
      post: {
        tags: ["Subscriptions"],
        summary: "Pay via M-Pesa STK push",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          phone:     strField("Subscriber phone number for STK push"),
          mpesaCode: strField("Provide to confirm an already-paid M-Pesa transaction"),
        }),
        responses: { ...dataResp("M-Pesa payment initiated"), ...errResp },
      },
    },
    "/subscriptions/{id}/pay/paystack": {
      post: {
        tags: ["Subscriptions"],
        summary: "Pay via Paystack",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ email: { type: "string", format: "email", description: "Customer email for Paystack checkout" } }),
        responses: { ...dataResp("Paystack checkout URL"), ...errResp },
      },
    },
    "/subscriptions/{id}/pay/stripe": {
      post: {
        tags: ["Subscriptions"],
        summary: "Pay via Stripe Checkout",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Stripe Checkout session URL"), ...errResp },
      },
    },

    // ── Attendants ────────────────────────────────────────────────────────────
    "/attendants": {
      get: {
        tags: ["Attendants"],
        summary: "List attendants",
        ...auth(["Admin"]),
        parameters: [...paginationParams, shopIdQuery],
        responses: listResp("Attendants (PIN and password excluded)", {
          id:          intId("Attendant ID"),
          username:    strField("Display name"),
          shop:        intId("Shop ID"),
          admin:       intId("Admin ID"),
          permissions: { type: "array", items: { type: "string" }, description: "Permission keys" },
          createdAt:   isoDate,
        }),
      },
      post: {
        tags: ["Attendants"],
        summary: "Create attendant",
        description: "Creates a POS staff account. A random 4-digit PIN is auto-generated if `pin` is omitted. A welcome email (with PIN) is sent to the admin.",
        ...auth(["Admin"]),
        ...body({
          username:    strField("Attendant display name"),
          shopId:      intId("Shop this attendant works in"),
          pin:         strField("4-digit PIN (auto-generated if omitted)"),
          permissions: { type: "array", items: { type: "string" }, description: "Permission keys (see GET /attendants/permissions)" },
        }, ["username", "shopId"]),
        responses: { ...createdResp("Attendant created"), ...errResp },
      },
    },
    "/attendants/permissions": {
      get: {
        tags: ["Permissions"],
        summary: "List available permission keys",
        description: "Returns the full catalog of permission keys that can be assigned to attendants.",
        ...auth(["Admin"]),
        responses: dataResp("Permissions catalog"),
      },
    },
    "/attendants/{id}": {
      get: {
        tags: ["Attendants"],
        summary: "Get attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...dataResp("Attendant"), 404: errResp[404] },
      },
      put: {
        tags: ["Attendants"],
        summary: "Update attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({
          username:    strField("Display name"),
          pin:         strField("New 4-digit PIN"),
          shopId:      intId("Reassign to different shop"),
          permissions: { type: "array", items: { type: "string" } },
        }),
        responses: { ...dataResp("Updated attendant"), ...errResp },
      },
      delete: {
        tags: ["Attendants"],
        summary: "Delete attendant",
        ...auth(["Admin"]),
        parameters: [idParam()],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/attendants/{id}/permissions": {
      put: {
        tags: ["Permissions"],
        summary: "Replace attendant permissions",
        ...auth(["Admin"]),
        parameters: [idParam()],
        ...body({ permissions: { type: "array", items: { type: "string" } } }, ["permissions"]),
        responses: { ...dataResp("Permissions updated", { message: { type: "string" } }), ...errResp },
      },
    },

    // ── Reports ───────────────────────────────────────────────────────────────
    "/reports/sales": {
      get: {
        tags: ["Reports"],
        summary: "Sales summary",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Sales summary", { totalSales: intId("Count"), totalRevenue: moneyStr, totalPaid: moneyStr, totalOutstanding: moneyStr, totalDiscount: moneyStr }),
      },
    },
    "/reports/sales/by-product": {
      get: {
        tags: ["Reports"],
        summary: "Sales grouped by product",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Product sales rows"),
      },
    },
    "/reports/sales/by-customer": {
      get: {
        tags: ["Reports"],
        summary: "Sales grouped by customer",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Customer sales rows"),
      },
    },
    "/reports/sales/by-attendant": {
      get: {
        tags: ["Reports"],
        summary: "Sales grouped by attendant",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Attendant sales rows"),
      },
    },
    "/reports/sales/by-payment-method": {
      get: {
        tags: ["Reports"],
        summary: "Sales grouped by payment method",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Payment method rows"),
      },
    },
    "/reports/profit": {
      get: {
        tags: ["Reports"],
        summary: "Profit summary",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Profit summary", { revenue: moneyStr, cost: moneyStr, profit: moneyStr, margin: strField("Profit margin %") }),
      },
    },
    "/reports/profit/yearly/{year}": {
      get: {
        tags: ["Reports"],
        summary: "Monthly profit breakdown for a year",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, { name: "year", in: "path", required: true, schema: { type: "integer" }, description: "4-digit year, e.g. 2026" }],
        responses: dataResp("Monthly profit rows"),
      },
    },
    "/reports/profit-analysis": {
      get: {
        tags: ["Reports"],
        summary: "Profit trend analysis",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Trend rows"),
      },
    },
    "/reports/purchases": {
      get: {
        tags: ["Reports"],
        summary: "Purchases summary",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Purchases summary"),
      },
    },
    "/reports/expenses": {
      get: {
        tags: ["Reports"],
        summary: "Expenses summary",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Expenses summary"),
      },
    },
    "/reports/stock": {
      get: {
        tags: ["Reports"],
        summary: "Current stock levels summary",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Stock summary"),
      },
    },
    "/reports/stock-value": {
      get: {
        tags: ["Reports"],
        summary: "Stock valuation report",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Stock value summary"),
      },
    },
    "/reports/stock-movement": {
      get: {
        tags: ["Reports"],
        summary: "Stock movement (adjustments + transfers)",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Stock movement rows"),
      },
    },
    "/reports/stock-count-analysis": {
      get: {
        tags: ["Reports"],
        summary: "Stock count variance analysis",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Count analysis rows"),
      },
    },
    "/reports/top-products": {
      get: {
        tags: ["Reports"],
        summary: "Top-selling products",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Top products"),
      },
    },
    "/reports/product-sales": {
      get: {
        tags: ["Reports"],
        summary: "All products with sales figures",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Product sales rows"),
      },
    },
    "/reports/monthly-product-sales": {
      get: {
        tags: ["Reports"],
        summary: "Monthly product sales breakdown",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Monthly rows"),
      },
    },
    "/reports/debtors": {
      get: {
        tags: ["Reports"],
        summary: "Customers with outstanding balances",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Debtor list"),
      },
    },
    "/reports/dues": {
      get: {
        tags: ["Reports"],
        summary: "Outstanding credit sales",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Due sales"),
      },
    },
    "/reports/discounted-sales": {
      get: {
        tags: ["Reports"],
        summary: "Sales where a discount was applied",
        ...auth(["Admin"]),
        parameters: [shopIdQuery, fromParam, toParam],
        responses: dataResp("Discounted sales"),
      },
    },
    "/reports/out-of-stock/export": {
      get: {
        tags: ["Reports"],
        summary: "Export out-of-stock products",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Out-of-stock rows"),
      },
    },
    "/reports/backup": {
      get: {
        tags: ["Reports"],
        summary: "Full data backup snapshot",
        ...auth(["Admin"]),
        parameters: [shopIdQuery],
        responses: dataResp("Backup snapshot"),
      },
    },

    // ── System (super-admin) ──────────────────────────────────────────────────
    "/system/settings": {
      get: {
        tags: ["System"],
        summary: "List all system settings (super-admin only)",
        description: "Returns the full key/value store. Each row has a `name` (key) and a JSONB `setting` object.",
        ...auth(["Admin"]),
        parameters: [...paginationParams, searchParam],
        responses: listResp("System settings"),
      },
    },
    "/system/settings/{name}": {
      get: {
        tags: ["System"],
        summary: "Get system setting by key",
        description: "Common keys: `email`, `sms`, `mpesa`, `trial`, `platform`.",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" }, description: "Setting key" }],
        responses: dataResp("Setting object"),
      },
      put: {
        tags: ["System"],
        summary: "Create or update system setting (super-admin only)",
        description: "Deep-merges the provided object into the existing setting. Keys not in the request body are preserved.\n\n**Common setting keys and their schemas:**\n\n`email` → `{ provider, apiKey, fromName, fromAddress, replyTo }`\n\n`sms` → `{ provider, apiKey, endpoint, senderId }`\n\n`trial` → `{ days: number }` — controls the default free trial length\n\n`mpesa` → `{ shortCode, consumerKey, consumerSecret, passkey, callbackUrl }`",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object", additionalProperties: true,
                example: { days: 14 },
              },
            },
          },
        },
        responses: { ...dataResp("Setting updated"), ...errResp },
      },
      delete: {
        tags: ["System"],
        summary: "Delete system setting (super-admin only)",
        ...auth(["Admin"]),
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
        responses: { ...noContentResp, 404: errResp[404] },
      },
    },
    "/system/shop-categories": {
      get: {
        tags: ["System"],
        summary: "List shop categories (system view)",
        parameters: [...paginationParams, searchParam],
        responses: listResp("Shop categories"),
      },
    },
    "/system/shop-categories/{id}": {
      get: {
        tags: ["System"],
        summary: "Get shop category (system view)",
        parameters: [idParam()],
        responses: { ...dataResp("Shop category"), 404: errResp[404] },
      },
    },
    "/system/shop-metrics": {
      get: {
        tags: ["System"],
        summary: "Platform metrics (super-admin only)",
        description: "Returns global shop and admin counts.",
        ...auth(["Admin"]),
        responses: dataResp("Platform metrics", { shops: intId("Total shops"), admins: intId("Total admins"), generatedAt: isoDate }),
      },
    },

    // ── Payment webhooks ──────────────────────────────────────────────────────
    "/payments/mpesa/callback": {
      post: { tags: ["Communications"], summary: "M-Pesa STK callback (legacy)", responses: { 200: { description: "Accepted" } } },
    },
    "/payments/mpesa/validation": {
      post: { tags: ["Communications"], summary: "M-Pesa validation webhook (legacy)", responses: { 200: { description: "Accepted" } } },
    },
    "/payments/mpesa/confirmation": {
      post: { tags: ["Communications"], summary: "M-Pesa confirmation webhook (legacy)", responses: { 200: { description: "Accepted" } } },
    },
    "/payments/paystack/webhook": {
      post: { tags: ["Communications"], summary: "Paystack webhook (legacy stub)", responses: { 200: { description: "Received" } } },
    },
    "/payments/stripe/webhook": {
      post: { tags: ["Communications"], summary: "Stripe webhook (legacy stub)", responses: { 200: { description: "Received" } } },
    },
    "/payments/{gateway}/callback/{ref}": {
      post: {
        tags: ["Communications"],
        summary: "Per-transaction gateway callback",
        description: "Called by a payment gateway after a charge completes. The `ref` must match an internal `pay_intent:<ref>` record.",
        parameters: [
          { name: "gateway", in: "path", required: true, schema: { type: "string" }, description: "Gateway identifier (e.g. sunpay, mpesa)" },
          { name: "ref",     in: "path", required: true, schema: { type: "string" }, description: "External reference from the original charge" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status:    strField("Payment status from gateway (success | failed)"),
                  mpesaRef:  strField("M-Pesa confirmation code (optional)"),
                  reference: strField("Transaction reference (optional)"),
                },
              },
            },
          },
        },
        responses: { ...dataResp("Callback processed"), 400: { description: "Gateway mismatch" }, 404: { description: "Intent not found" } },
      },
    },
    "/payments/{gateway}/webhook": {
      post: {
        tags: ["Communications"],
        summary: "Account-wide gateway webhook (signature-verified)",
        description: "Receives webhook events from a gateway. Signature is verified using the credentials of the matching payment gateway record.",
        parameters: [
          { name: "gateway", in: "path", required: true, schema: { type: "string" }, description: "Gateway identifier" },
        ],
        responses: { ...dataResp("Webhook processed"), 401: { description: "Invalid signature" }, 404: { description: "Intent not found" } },
      },
    },

    // ── Shop-scoped aliases (legacy frontend compat) ──────────────────────────
    "/shops/{shopId}/products": {
      get: { tags: ["Products"], summary: "Products for shop (shop-scoped alias)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, searchParam], responses: listResp("Products") },
    },
    "/shops/{shopId}/products/{id}": {
      get:    { tags: ["Products"],   summary: "Get product (shop-scoped)",    ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Product") },
      put:    { tags: ["Products"],   summary: "Update product (shop-scoped)", ...auth(["Admin"]),              parameters: [idParam("shopId"), idParam()], ...body({}), responses: dataResp("Updated") },
      delete: { tags: ["Products"],   summary: "Delete product (shop-scoped)", ...auth(["Admin"]),              parameters: [idParam("shopId"), idParam()], responses: noContentResp },
    },
    "/shops/{shopId}/sales": {
      get:  { tags: ["Sales"], summary: "Sales for shop",    ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, fromParam, toParam], responses: listResp("Sales") },
      post: { tags: ["Sales"], summary: "Record sale (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({}), responses: createdResp("Sale recorded") },
    },
    "/shops/{shopId}/sales/{id}": {
      get:    { tags: ["Sales"], summary: "Get sale (shop-scoped)",   ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Sale") },
      delete: { tags: ["Sales"], summary: "Void sale (shop-scoped)",  ...auth(["Admin"]),              parameters: [idParam("shopId"), idParam()], responses: noContentResp },
    },
    "/shops/{shopId}/sales/{id}/void":     { post: { tags: ["Sales"], summary: "Void sale (shop-scoped)",   ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Voided") } },
    "/shops/{shopId}/sales/{id}/refund":   { post: { tags: ["Sales"], summary: "Refund sale (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Refunded") } },
    "/shops/{shopId}/sales/{id}/payments": { post: { tags: ["Sales"], summary: "Add payment (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), idParam()], ...body({ amount: { type: "number" }, method: { type: "string" } }, ["amount", "method"]), responses: createdResp("Payment recorded") } },
    "/shops/{shopId}/customers": {
      get:  { tags: ["Customers"], summary: "Customers for shop",          ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, searchParam], responses: listResp("Customers") },
      post: { tags: ["Customers"], summary: "Create customer (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({}), responses: createdResp("Customer created") },
    },
    "/shops/{shopId}/customers/{id}": {
      get:    { tags: ["Customers"], summary: "Get customer (shop-scoped)",    ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Customer") },
      put:    { tags: ["Customers"], summary: "Update customer (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), idParam()], ...body({}), responses: dataResp("Updated") },
      delete: { tags: ["Customers"], summary: "Delete customer (shop-scoped)", ...auth(["Admin"]),              parameters: [idParam("shopId"), idParam()], responses: noContentResp },
    },
    "/shops/{shopId}/suppliers": {
      get:  { tags: ["Suppliers"], summary: "Suppliers for shop",           ...auth(["Admin"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Suppliers") },
      post: { tags: ["Suppliers"], summary: "Create supplier (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], ...body({}), responses: createdResp("Supplier created") },
    },
    "/shops/{shopId}/suppliers/{id}": {
      get:    { tags: ["Suppliers"], summary: "Get supplier (shop-scoped)",    ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Supplier") },
      put:    { tags: ["Suppliers"], summary: "Update supplier (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], ...body({}), responses: dataResp("Updated") },
      delete: { tags: ["Suppliers"], summary: "Delete supplier (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: noContentResp },
    },
    "/shops/{shopId}/purchases": {
      get:  { tags: ["Purchases"], summary: "Purchases for shop",           ...auth(["Admin"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Purchases") },
      post: { tags: ["Purchases"], summary: "Create purchase (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], ...body({}), responses: createdResp("Purchase created") },
    },
    "/shops/{shopId}/purchases/{id}": {
      get:    { tags: ["Purchases"], summary: "Get purchase (shop-scoped)",    ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: dataResp("Purchase") },
      delete: { tags: ["Purchases"], summary: "Delete purchase (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), idParam()], responses: noContentResp },
    },
    "/shops/{shopId}/inventory": {
      get: { tags: ["Inventory"], summary: "Inventory for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Inventory") },
    },
    "/shops/{shopId}/expenses": {
      get:  { tags: ["Expenses"], summary: "Expenses for shop",           ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams, fromParam, toParam], responses: listResp("Expenses") },
      post: { tags: ["Expenses"], summary: "Record expense (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({ amount: { type: "number" }, description: { type: "string" } }, ["amount"]), responses: createdResp("Expense recorded") },
    },
    "/shops/{shopId}/orders": {
      get:  { tags: ["Orders"], summary: "Orders for shop",    ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Orders") },
      post: { tags: ["Orders"], summary: "Create order (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], ...body({}), responses: createdResp("Order created") },
    },
    "/shops/{shopId}/attendants": {
      get: { tags: ["Attendants"], summary: "Attendants for shop", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: listResp("Attendants") },
    },
    "/shops/{shopId}/stock-counts": {
      get: { tags: ["Stock Counts"], summary: "Stock counts for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Stock counts") },
    },
    "/shops/{shopId}/stock-counts/product-search": {
      get: { tags: ["Stock Counts"], summary: "Search products for counting (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), { name: "q", in: "query", schema: { type: "string" } }], responses: dataResp("Products") },
    },
    "/shops/{shopId}/stock-counts/product-filter": {
      get: { tags: ["Stock Counts"], summary: "Filter products for counting (shop-scoped)", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId")], responses: dataResp("Products") },
    },
    "/shops/{shopId}/stock-requests": {
      get: { tags: ["Stock Requests"], summary: "Stock requests for shop", ...auth(["Admin", "Attendant"]), parameters: [idParam("shopId"), ...paginationParams], responses: listResp("Stock requests") },
    },
    "/shops/{shopId}/reports/sales": {
      get: { tags: ["Reports"], summary: "Sales summary (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), fromParam, toParam], responses: dataResp("Sales summary") },
    },
    "/shops/{shopId}/reports/profit": {
      get: { tags: ["Reports"], summary: "Profit summary (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), fromParam, toParam], responses: dataResp("Profit summary") },
    },
    "/shops/{shopId}/reports/profit-analysis": {
      get: { tags: ["Reports"], summary: "Monthly profit analysis (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Rows") },
    },
    "/shops/{shopId}/reports/product-sales": {
      get: { tags: ["Reports"], summary: "Sales by product (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Rows") },
    },
    "/shops/{shopId}/reports/top-products": {
      get: { tags: ["Reports"], summary: "Top products (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Rows") },
    },
    "/shops/{shopId}/reports/monthly-product-sales": {
      get: { tags: ["Reports"], summary: "Monthly product sales (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Rows") },
    },
    "/shops/{shopId}/reports/discounted-sales": {
      get: { tags: ["Reports"], summary: "Discounted sales (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Sales") },
    },
    "/shops/{shopId}/reports/purchases": {
      get: { tags: ["Reports"], summary: "Purchases summary (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Summary") },
    },
    "/shops/{shopId}/reports/expenses": {
      get: { tags: ["Reports"], summary: "Expenses summary (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Summary") },
    },
    "/shops/{shopId}/reports/stock": {
      get: { tags: ["Reports"], summary: "Stock summary (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Summary") },
    },
    "/shops/{shopId}/reports/stock-movement": {
      get: { tags: ["Reports"], summary: "Stock movement (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Adjustments") },
    },
    "/shops/{shopId}/reports/debtors": {
      get: { tags: ["Reports"], summary: "Debtors (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Customers") },
    },
    "/shops/{shopId}/reports/dues": {
      get: { tags: ["Reports"], summary: "Outstanding dues (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Sales") },
    },
    "/shops/{shopId}/reports/profit/yearly/{year}": {
      get: { tags: ["Reports"], summary: "Yearly profit (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId"), { name: "year", in: "path", required: true, schema: { type: "integer" } }], responses: dataResp("Yearly data") },
    },
    "/shops/{shopId}/reports/stock-value": {
      get: { tags: ["Reports"], summary: "Stock value (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Summary") },
    },
    "/shops/{shopId}/reports/stock-count-analysis": {
      get: { tags: ["Reports"], summary: "Stock count analysis (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Stock counts") },
    },
    "/shops/{shopId}/reports/out-of-stock/export": {
      get: { tags: ["Reports"], summary: "Out-of-stock export (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Rows") },
    },
    "/shops/{shopId}/reports/backup": {
      get: { tags: ["Reports"], summary: "Backup snapshot (shop-scoped)", ...auth(["Admin"]), parameters: [idParam("shopId")], responses: dataResp("Snapshot") },
    },
  },
};
