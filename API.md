# Pointify POS — API Reference

> **Stack**: Express 5 · Drizzle ORM · PostgreSQL · Zod v4  
> **Base URL**: `/api`  
> All request bodies and responses are JSON.  
> All monetary amounts are strings (PostgreSQL `numeric` → JSON string) with 2 decimal places.  
> All quantities are strings with up to 4 decimal places.  
> Timestamps are ISO-8601 UTC strings.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Shops](#3-shops)
4. [Catalog — Products & Categories](#4-catalog--products--categories)
5. [Inventory](#5-inventory)
6. [Batches](#6-batches)
7. [Product Serials](#7-product-serials)
8. [Customers](#8-customers)
9. [Suppliers](#9-suppliers)
10. [Orders](#10-orders)
11. [Sales](#11-sales)
12. [Purchases](#12-purchases)
13. [Transfers](#13-transfers)
14. [Stock Operations](#14-stock-operations)
15. [Finance](#15-finance)
16. [Subscriptions](#16-subscriptions)
17. [Affiliates](#17-affiliates)
18. [Communication](#18-communication)
19. [Activities](#19-activities)
20. [System](#20-system)
21. [Attendants](#21-attendants)
22. [Reports](#22-reports)
23. [Sync — Offline Data Dump](#23-sync--offline-data-dump)

---

## 1. Conventions

### Authentication Headers

Every protected endpoint requires a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Four token types exist:

| Token type | Who | How obtained |
|---|---|---|
| **Admin token** | Shop owner | `POST /api/auth/admin/login` |
| **Attendant token** | Cashier / staff | `POST /api/auth/attendant/login` |
| **Customer token** | Online storefront customer | `POST /api/auth/customer/login` or `POST /api/auth/customer/register` |
| **Affiliate token** | Referral partner | `POST /api/affiliates/login` |

### Roles & Permissions

- **Admin** — full access to all endpoints for their own shops and data. No permission checks.
- **Attendant** — limited access. Each attendant's `permissions` column is a string array of `"key.subkey"` tokens (e.g. `"pos.can_sell"`, `"stocks.view_products"`). Guarded endpoints list the exact token(s) required.

The full permission tree is:

| Group | Sub-permissions |
|---|---|
| `pos` | `can_sell` · `can_sell_to_dealer_&_wholesaler` · `discount` · `edit_price` · `set_sale_date` |
| `stocks` | `view_products` · `add_products` · `view_buying_price` · `stock_summary` · `view_purchases` · `add_purchases` · `stock_count` · `badstock` · `transfer` · `return` · `delete_purchase_invoice` |
| `products` | `add` · `edit` · `delete` · `adjust_stock` · `view_adjustment_history` |
| `sales` | `view_sales` · `return` · `delete` · `view_profit` |
| `reports` | `sales` · `dues` · `productsales` · `discoutedsales` · `debtors` · `purchases` · `expenses` · `stocktake` · `netprofit` · `stockreport` · `productmovement` · `profitanalysis` |
| `purchases` | `edit_buying_price` |
| `accounts` | `cashflow` |
| `expenses` | `manage` |
| `suppliers` | `manage` |
| `customers` | `manage` · `deposit` |
| `shop` | `manage` · `switch` |
| `attendants` | `manage` · `view` |
| `usage` | `manage` |
| `support` | `manage` |

Two groups are conditionally added based on the shop's configuration:

| Group | Condition | Sub-permissions |
|---|---|---|
| `production` | `shop.production = true` | `delete` · `change_status` · `edit` · `adjust_stock` · `view_adjustment_history` |
| `warehouse` | `shop.warehouse = true` | `invoice_delete` · `show_buying_price` · `show_available_stock` · `view_buying_price` · `create_orders` · `view_orders` · `return` · `accept_warehouse_orders` |

**How to check permissions in code**: parse the attendant's `permissions` array and check for the required `"key.subkey"` string. Admin tokens bypass all permission checks.

### Standard Error Response

```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:

| Code | Meaning |
|---|---|
| 400 | Validation error — check `message` |
| 401 | Missing or invalid token |
| 403 | Token valid but insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict — unique constraint violation |
| 422 | Business rule violation (e.g. insufficient stock) |
| 500 | Internal server error |

### Standard Success Response (single resource)

```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Success Response (list)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

### Pagination Query Params (all list endpoints)

| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `50` | Items per page (max 200) |
| `search` | — | Full-text search where supported |
| `from` | — | ISO date — filter from (inclusive) |
| `to` | — | ISO date — filter to (inclusive) |
| `sort` | `created_at` | Sort field |
| `order` | `desc` | `asc` or `desc` |

---

## 2. Authentication

### POST /api/auth/admin/register

Register a new admin account. Sends an OTP to the provided email for verification.

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✓ | Must be unique |
| `phone` | string | ✓ | |
| `password` | string | ✓ | Min 6 chars, store as bcrypt hash |
| `username` | string | ✗ | Display name |
| `affiliateCode` | string | ✗ | Affiliate referral code → sets `admins.affiliate_id` |
| `referredBy` | integer | ✗ | ID of referring admin → sets `admins.referred_by_id` |

**Response** `201`:

```json
{ "success": true, "data": { "admin": { ... }, "token": "<jwt>" } }
```

**Side Effects** (single transaction):
1. Insert row into `admins`.
2. Auto-create one row in `attendants` with `username` = admin's username, no PIN/password. Link back: `admins.attendant_id` = new attendant ID, `attendants.admin_id` = new admin ID.
3. If `affiliateCode` provided: look up `affiliates.code`, set `admins.affiliate_id`.
4. If `referredBy` provided: verify the referring admin exists, set `admins.referred_by_id`. **Referral credit**: when the referred admin pays their **first subscription**, increment `admins.referral_credit` on the referring admin by a configured amount (see Settings for `referral_credit_amount`). This increment happens inside `POST /api/subscriptions/:id/pay`, not at registration.
5. Generate OTP, set `admins.otp` and `admins.otp_expiry` (15 minutes from now in Unix ms), send email.

---

### POST /api/auth/admin/verify-email

Verify admin email with the OTP sent on registration.

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✓ | |
| `otp` | string | ✓ | 6-digit code |

**Response** `200`:

```json
{ "success": true, "data": { "token": "<jwt>" } }
```

**Side Effects**: Set `admins.email_verified = true`, `admins.email_verification_date = now()`, clear `admins.otp` and `admins.otp_expiry`.

---

### POST /api/auth/admin/resend-otp

Resend email verification OTP.

**Auth**: Public

**Request Body**: `{ "email": "string" }`

**Side Effects**: Generate new OTP, update `admins.otp` and `admins.otp_expiry`, send email.

---

### POST /api/auth/admin/login

**Auth**: Public

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `email` | string | ✓ |
| `password` | string | ✓ |

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "admin": { ... },
    "token": "<jwt>",
    "shop": { ... }
  }
}
```

**Side Effects**: Update `admins.last_seen`.

**Guard**: If `admins.email_verified = false`, return `403` with code `EMAIL_NOT_VERIFIED` and a message prompting the user to verify their email. Do not issue a token.

---

### POST /api/auth/admin/forgot-password

Send password reset OTP.

**Auth**: Public

**Request Body**: `{ "email": "string" }`

**Side Effects**: Generate OTP, set `admins.otp` / `otp_expiry`, send email.

---

### POST /api/auth/admin/reset-password

**Auth**: Public

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `email` | string | ✓ |
| `otp` | string | ✓ |
| `newPassword` | string | ✓ |

**Side Effects**: Update `admins.password` (bcrypt hash), clear OTP fields.

---

### POST /api/auth/admin/logout

**Auth**: Admin token

**Side Effects**: Invalidate token (server-side blacklist or short TTL approach).

---

### POST /api/auth/attendant/login

Login a cashier/staff at the POS.

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `pin` | string | ✓ | |
| `password` | string | ✓ | |
| `shopId` | integer | ✓ | Must match `attendants.shop_id` |

**Response** `200`:

```json
{ "success": true, "data": { "attendant": { ... }, "token": "<jwt>", "shop": { ... } } }
```

**Side Effects**: Update `attendants.last_seen`.

**Guard**: If the matched attendant has `pin IS NULL` (it is an admin-owned attribution attendant, not a login account), return `401` with code `NOT_A_LOGIN_ACCOUNT`.

---

### POST /api/auth/attendant/logout

**Auth**: Attendant token

---

### GET /api/auth/me

Return the currently authenticated user (admin or attendant).

**Auth**: Admin or Attendant token

**Response** `200`: Full admin or attendant object depending on token type.

---

### PUT /api/auth/me/last-seen

Update the authenticated user's `last_seen` timestamp. Called by the mobile/desktop app on startup and periodically while active.

**Auth**: Admin or Attendant token

**Request Body**: None.

**Side Effects**: Set `admins.last_seen = NOW()` (or `attendants.last_seen`) in a single query.

---

### POST /api/auth/customer/register

Self-registration for online customers via the public storefront. Creates a `type = online` customer account.

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `email` | string | ✓ | Must be unique within the shop |
| `password` | string | ✓ | Min 6 chars, stored as bcrypt hash |
| `phone` | string | ✗ | |
| `shopId` | integer | ✓ | The shop (storefront) the customer is registering for |

**Response** `201`:

```json
{ "success": true, "data": { "customer": { ... }, "token": "<jwt>" } }
```

**Side Effects**: Insert `customers` (`type = online`). Auto-assign `customer_no` (next sequential number for the shop).

---

### GET /api/auth/customer/me

Return the currently authenticated online customer's profile.

**Auth**: Customer token

**Response** `200`: Full customer object.

---

### POST /api/auth/customer/login

Login for online customers (`customers.type = online`). Used by the public storefront, not the POS.

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✓ | |
| `password` | string | ✓ | |

**Response** `200`:

```json
{ "success": true, "data": { "customer": { ... }, "token": "<jwt>" } }
```

**Side Effects**: None.

---

### POST /api/auth/customer/forgot-password

Send password-reset OTP to the customer's email.

**Auth**: Public

**Request Body**: `{ "email": "string" }`

**Side Effects**: Generate OTP, set `customers.otp` and `customers.otp_expiry` (15 min), send email.

---

### POST /api/auth/customer/reset-password

**Auth**: Public

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `email` | string | ✓ |
| `otp` | string | ✓ |
| `newPassword` | string | ✓ |

**Side Effects**: Update `customers.password` (bcrypt hash), clear OTP fields.

---

## 3. Shops

### GET /api/shops

List all shops owned by the authenticated admin.

**Auth**: Admin

**Response** `200`: Array of shop objects.

---

### POST /api/shops

Create a new shop for the authenticated admin.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `address` | string | ✗ | |
| `receiptHeader` | string | ✗ | Text printed on receipts |
| `category` | integer | ✗ | FK → `shop_categories.id` |
| `currency` | string | ✗ | e.g. `KES`, `USD` |
| `contact` | string | ✗ | Phone shown on receipts |
| `taxRate` | string | ✗ | VAT % e.g. `"16.00"`, default `"0"` |
| `locationLat` | number | ✗ | GPS latitude |
| `locationLng` | number | ✗ | GPS longitude |
| `paybillTill` | string | ✗ | M-Pesa till number |
| `paybillAccount` | string | ✗ | M-Pesa account |
| `warehouse` | boolean | ✗ | Is this shop a warehouse hub |
| `production` | boolean | ✗ | Runs a production/manufacturing line — unlocks `production` permission group |
| `trackBatches` | boolean | ✗ | Enable batch/expiry tracking |
| `negativeSelling` | boolean | ✗ | Allow sales when stock = 0 |
| `onlineSelling` | boolean | ✗ | Default `true` |

**Response** `201`: Created shop object.

**Side Effects**: Sets `shops.admin_id` to the authenticated admin ID.

---

### GET /api/shops/:shopId

**Auth**: Admin (owns shop) or Attendant (assigned to shop)

**Response** `200`: Full shop object.

---

### PUT /api/shops/:shopId

Update shop settings.

**Auth**: Admin (owns shop)

**Request Body**: Any subset of shop fields listed above.

---

### DELETE /api/shops/:shopId

Delete a shop. Only allowed if no sales, purchases, or inventory rows reference it.

**Auth**: Admin (owns shop)

---

### DELETE /api/shops/:shopId/data

Wipe all transactional data for a shop (sales, purchases, inventory, etc.) without deleting the shop record itself. Used for resetting demo/test shops.

**Auth**: Super-Admin

**Side Effects**: Deletes all rows in `sales`, `sale_items`, `sale_payments`, `purchases`, `purchase_items`, `purchase_payments`, `inventory`, `batches`, `product_serials`, `adjustments`, `bad_stocks`, `stock_counts`, `stock_count_items`, `cashflows`, `expenses`, `transfers`, `transfer_items` where `shop_id = shopId`. Does **not** delete the shop, products, attendants, customers, or suppliers.

---

### GET /api/shops/by-referral/:referralId

List all shops whose admin was referred by the given admin ID.

**Auth**: Admin (super-admin)

**Response** `200`: Array of shop objects with admin info.

---

### POST /api/shops/:shopId/redeem-usage

Redeem usage credits against a shop (e.g. promotional free trial days).

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `credits` | integer | ✓ | Number of days/usage credits to apply |

**Side Effects**: Extend `shops.subscription_id` end date by `credits` days or insert a trial extension record.

---

### PUT /api/shops/:shopId/backup-interval

Set the automatic backup sync interval for this shop (used by mobile app).

**Auth**: Admin (owns shop)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `intervalMinutes` | integer | ✓ | Sync interval in minutes |

---

## 4. Catalog — Products & Categories

### Product Categories

#### GET /api/shops/:shopId/categories

List all product categories for the shop's admin.

**Auth**: Admin or Attendant

**Response** `200`: Array of category objects.

---

#### POST /api/shops/:shopId/categories

**Auth**: Admin

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `name` | string | ✓ |

**Side Effects**: Sets `product_categories.admin_id` from the shop's admin.

---

#### PUT /api/categories/:id

**Auth**: Admin

**Request Body**: `{ "name": "string" }`

---

#### DELETE /api/categories/:id

**Auth**: Admin

**Note**: If products reference this category, set `products.category = null` (no cascade delete).

---

### Products

#### GET /api/shops/:shopId/products

List all non-deleted products for this shop.

**Auth**: Admin or Attendant

**Query Params** (in addition to standard pagination):

| Param | Description |
|---|---|
| `category` | Filter by category ID |
| `type` | `product` \| `bundle` \| `virtual` \| `service` |
| `supplierId` | Filter by supplier |
| `lowStock` | `true` — only products where inventory status = `low` or `out_of_stock` |
| `barcode` | Exact barcode lookup |
| `sku` | Exact SKU lookup |

**Response** `200`: Array of product objects each joined with their `inventory` row for this shop.

---

#### POST /api/shops/:shopId/products

Create a product. Automatically creates one `inventory` row for this shop.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `buyingPrice` | string | ✗ | numeric(14,2) |
| `sellingPrice` | string | ✗ | |
| `wholesalePrice` | string | ✗ | |
| `dealerPrice` | string | ✗ | |
| `minSellingPrice` | string | ✗ | Floor price for discounts |
| `maxDiscount` | string | ✗ | Max discount % allowed |
| `category` | integer | ✗ | FK → `product_categories.id` |
| `measureUnit` | string | ✗ | e.g. `pcs`, `kg`, `litres` |
| `manufacturer` | string | ✗ | |
| `supplier` | integer | ✗ | FK → `suppliers.id` |
| `barcode` | string | ✗ | |
| `sku` | string | ✗ | |
| `type` | string | ✗ | `product`\|`bundle`\|`virtual`\|`service`, default `product` |
| `description` | string | ✗ | |
| `thumbnailUrl` | string | ✗ | |
| `images` | string[] | ✗ | Array of URLs |
| `isTaxable` | boolean | ✗ | |
| `manageByPrice` | boolean | ✗ | Manage stock by value not qty |
| `expiryDate` | string | ✗ | ISO date |
| `reorderLevel` | string | ✗ | Stock threshold for low-stock alert |
| `initialStock` | string | ✗ | Initial quantity to set in inventory |

**Response** `201`: Product object with embedded inventory.

**Side Effects**:
1. Insert into `products`.
2. Insert into `inventory` with `product_id`, `shop_id`, `quantity = initialStock ?? "0"`, `status = "active"`.

---

#### GET /api/products/:id

**Auth**: Admin or Attendant

**Response** `200`: Product with inventory row, batch count, and serial count.

---

#### PUT /api/products/:id

Update product fields. Does **not** update inventory quantity (use stock adjustments for that).

**Auth**: Admin or Attendant

**Request Body**: Any subset of product fields listed above (excluding `initialStock`).

---

#### DELETE /api/products/:id

Soft delete — sets `is_deleted = true`. Does not remove from DB.

**Auth**: Admin or Attendant

**Note**: Products with active sales or purchase records can be soft-deleted but not hard-deleted.

---

#### POST /api/shops/:shopId/products/bulk-import

Import multiple products at once (e.g. from CSV).

**Auth**: Admin or Attendant

**Request Body**:

```json
{ "products": [ { ...same fields as POST /products... }, ... ] }
```

**Response** `200`: `{ "created": 45, "skipped": 2, "errors": [] }`

---

### Bundle Items

#### GET /api/products/:id/bundle-items

List the components of a bundle product.

**Auth**: Admin or Attendant

---

#### POST /api/products/:id/bundle-items

Add a component to a bundle.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `componentProductId` | integer | ✓ | Must be in same shop |
| `quantity` | string | ✓ | numeric(14,4) |

---

#### PUT /api/bundle-items/:id

Update component quantity.

**Auth**: Admin or Attendant

**Request Body**: `{ "quantity": "string" }`

---

#### DELETE /api/bundle-items/:id

Remove a component from a bundle.

**Auth**: Admin or Attendant

---

### Product History

Per-product movement and performance analytics, all scoped to a single `productId`.

#### GET /api/products/:id/sales-history

All sale line items for this product across all time (or filtered by date).

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `shopId` + pagination

**Response** `200`: Paginated list of `sale_items` rows joined with sale date, receipt number, attendant name, and customer name.

---

#### GET /api/products/:id/purchases-history

All purchase line items for this product.

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `shopId` + pagination

**Response** `200`: Paginated list of `purchase_items` rows joined with purchase date, purchase number, and supplier name.

---

#### GET /api/products/:id/stock-history

Stock movement history for this product — all events that changed its quantity (sales, purchases, adjustments, transfers, bad stocks, stock counts).

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `shopId` + pagination

**Response** `200`: Paginated list `{ date, type, quantityChange, quantityAfter, reference }`.

---

#### GET /api/products/:id/summary

Aggregated performance summary for this product.

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `shopId`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalUnitsSold": 340,
    "totalRevenue": "...",
    "totalUnitsPurchased": 500,
    "totalPurchaseCost": "...",
    "currentStock": 160,
    "stockValue": "...",
    "grossProfit": "..."
  }
}
```

---

### Measure Units

A global (non-shop-scoped) lookup table of unit-of-measure labels (`pcs`, `kg`, `litres`, `crates`, etc.) rendered as a dropdown when creating products.

#### GET /api/measures

**Auth**: Admin or Attendant

**Response** `200`: Array of `{ id, name, abbreviation, isActive }`.

---

#### POST /api/measures

**Auth**: Super-Admin

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `name` | string | ✓ |
| `abbreviation` | string | ✗ |

---

#### GET /api/measures/:id

**Auth**: Admin or Attendant

---

#### PUT /api/measures/:id / DELETE /api/measures/:id

**Auth**: Super-Admin. Cannot delete a measure referenced by a product.

---

## 5. Inventory

### GET /api/shops/:shopId/inventory

Full inventory list for the shop.

**Auth**: Admin or Attendant

**Query Params**:

| Param | Description |
|---|---|
| `status` | `active` \| `low` \| `out_of_stock` |

---

### GET /api/inventory/:id

Single inventory record.

**Auth**: Admin or Attendant

---

### PUT /api/inventory/:id

Update reorder level and status only. Use stock adjustments to change `quantity`.

**Auth**: Admin

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `reorderLevel` | string | ✗ |
| `status` | string | ✗ |

---

## 6. Batches

Batches are stock lots per product per shop. Used when `shop.track_batches = true`.

### GET /api/shops/:shopId/batches

**Auth**: Admin or Attendant

**Query Params**:

| Param | Description |
|---|---|
| `productId` | Filter to one product |
| `expiringSoon` | `true` — batches expiring within 30 days |
| `expired` | `true` — already expired |

---

### POST /api/shops/:shopId/batches

Manually create a batch (without going through a purchase).

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | integer | ✓ | |
| `batchCode` | string | ✗ | Unique lot reference |
| `buyingPrice` | string | ✗ | Cost per unit for this lot |
| `quantity` | string | ✓ | Units in this lot |
| `totalQuantity` | string | ✓ | Same as quantity initially |
| `expirationDate` | string | ✗ | ISO date |

**Side Effects**: Increment `inventory.quantity` for this product/shop.

---

### GET /api/batches/:id

**Auth**: Admin or Attendant

---

### PUT /api/batches/:id

Update batch fields (quantity, expiry, etc.).

**Auth**: Admin

---

### DELETE /api/batches/:id

**Auth**: Admin. Only allowed if `batch.quantity = 0`.

---

## 7. Product Serials

Serial numbers for individual physical units (phones, laptops, high-value items).

### GET /api/shops/:shopId/serials

**Auth**: Admin or Attendant

**Query Params**:

| Param | Description |
|---|---|
| `productId` | Filter to one product |
| `status` | `available` \| `sold` \| `returned` \| `void` |
| `serialNumber` | Exact match lookup |

---

### POST /api/shops/:shopId/serials

Register a new serial number.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | integer | ✓ | |
| `serialNumber` | string | ✓ | Must be unique per shop |
| `status` | string | ✗ | Default `available` |

---

### GET /api/serials/:id

**Auth**: Admin or Attendant

---

### PUT /api/serials/:id

**Auth**: Admin

**Request Body**: `{ "status": "available | sold | returned | void" }`

---

## 8. Customers

### GET /api/shops/:shopId/customers

**Auth**: Admin or Attendant

**Query Params**: Standard pagination + `search` (name, phone, email) + `type` (retail|wholesale|dealer|online) + `hasDebt` (true — outstanding_balance > 0)

---

### POST /api/shops/:shopId/customers

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `phone` | string | ✗ | |
| `email` | string | ✗ | |
| `address` | string | ✗ | |
| `type` | string | ✗ | `retail`\|`wholesale`\|`dealer`\|`online` |
| `creditLimit` | string | ✗ | Max credit allowed. Null = no credit |
| `password` | string | ✗ | Only for `type = online`. Hash with bcrypt |

**Side Effects**:
1. Auto-increment `customers.customer_no` per shop (query max + 1).
2. Set `customers.created_by_id` to the authenticated attendant ID.

---

### GET /api/customers/:id

**Auth**: Admin or Attendant

---

### PUT /api/customers/:id

**Auth**: Admin or Attendant

---

### DELETE /api/customers/:id

**Auth**: Admin. Hard delete only allowed when **both** conditions hold: `outstanding_balance = 0` AND no `sales` rows reference this customer. Return `422` with a clear message if either condition fails.

---

### Customer Wallet

#### GET /api/customers/:id/wallet-transactions

Wallet transaction history.

**Auth**: Admin or Attendant

---

#### POST /api/customers/:id/wallet/deposit

Customer deposits pre-paid credit.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | string | ✓ | |
| `paymentType` | string | ✓ | `cash`\|`mpesa`\|`card`\|`bank` |
| `paymentReference` | string | ✗ | M-Pesa code, bank ref, etc. |
| `handledBy` | integer | ✗ | Attendant ID. Defaults to authenticated user |

**Side Effects** (all in one transaction):
1. Insert into `customer_wallet_transactions` with `type = deposit`.
2. Increment `customers.wallet` by amount.

---

#### POST /api/customers/:id/wallet/withdraw

Customer withdraws wallet credit.

**Auth**: Admin

**Request Body**: Same as deposit.

**Side Effects**: Insert transaction with `type = withdraw`, decrement `customers.wallet`.

---

#### POST /api/customers/:id/wallet/payment

Apply wallet credit to pay off an outstanding credit sale.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `saleId` | integer | ✓ | The credit sale to pay off |
| `amount` | string | ✓ | Must be ≤ customer wallet balance |

**Side Effects**:
1. Insert transaction `type = payment`.
2. Decrement `customers.wallet`.
3. Decrement `customers.outstanding_balance`.
4. Decrement `sales.outstanding_balance`.
5. Increment `sales.amount_paid`.
6. Insert into `sale_payments` with `payment_type = wallet`.

---

### Customer Extras

#### GET /api/customers/by-number

Look up a customer by their auto-generated `customer_no` within a shop.

**Auth**: Admin or Attendant

**Query Params**: `shopId` (required), `no` (required)

**Response** `200`: Single customer object.

---

#### DELETE /api/sale-payments/:id

Delete a single payment row from `sale_payments`. Only allowed when the associated sale is not fully settled (i.e. the payment being removed is a partial payment that can be reversed).

**Auth**: Admin

**Side Effects**: Delete the `sale_payments` row, increment `sales.outstanding_balance` by the deleted amount, decrement `sales.amount_paid`, and if the customer was a credit customer increment `customers.outstanding_balance`.

---

#### GET /api/shops/:shopId/customers/analysis

Per-customer purchase frequency and revenue analytics for a shop.

**Auth**: Admin

**Query Params**: `from` + `to` (ISO dates) + pagination

**Response** `200`: Array of `{ customerId, name, totalSales, totalRevenue, lastPurchaseDate }`.

---

#### GET /api/shops/:shopId/customers/overdue

Customers with credit sales whose `dueDate` has passed and still have an outstanding balance.

**Auth**: Admin or Attendant

**Query Params**: Pagination + `daysOverdue` (filter to customers overdue by at least N days)

**Response** `200`: Paginated list with `{ customerId, name, phone, outstandingBalance, dueDate, daysOverdue }`.

---

#### GET /api/shops/:shopId/customers/debtors/export

Export the full debtor list to Excel (`.xlsx`).

**Auth**: Admin

**Response** `200`: Binary `.xlsx` file download (`Content-Disposition: attachment`).

---

#### POST /api/shops/:shopId/customers/bulk-import

Import customers from an uploaded CSV or Excel file.

**Auth**: Admin

**Request**: `multipart/form-data` with a single `file` field (`.csv` or `.xlsx`).

**Response** `200`: `{ imported, skipped, errors[] }` — rows that already existed (matched by `phone` or `email`) are skipped.

---

## 9. Suppliers

### GET /api/shops/:shopId/suppliers

**Auth**: Admin or Attendant

---

### POST /api/shops/:shopId/suppliers

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `phone` | string | ✗ | |
| `email` | string | ✗ | |
| `address` | string | ✗ | |

---

### GET /api/suppliers/:id

**Auth**: Admin or Attendant

---

### PUT /api/suppliers/:id

**Auth**: Admin

---

### DELETE /api/suppliers/:id

**Auth**: Admin. Only if no purchases reference this supplier.

---

### POST /api/shops/:shopId/suppliers/bulk-import

Import suppliers from an uploaded CSV or Excel file.

**Auth**: Admin

**Request**: `multipart/form-data` with a single `file` field (`.csv` or `.xlsx`).

**Response** `200`: `{ imported, skipped, errors[] }` — rows matched by `name` are skipped as duplicates.

---

### Supplier Wallet

#### GET /api/suppliers/:id/wallet-transactions

**Auth**: Admin or Attendant

---

#### POST /api/suppliers/:id/wallet/deposit

Pre-pay a supplier (advance payment).

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | string | ✓ | |
| `paymentType` | string | ✓ | `cash`\|`mpesa`\|`bank`\|`cheque` |
| `paymentReference` | string | ✗ | |

**Side Effects**: Insert `supplier_wallet_transactions` (type=`deposit`), increment `suppliers.wallet`.

---

#### POST /api/suppliers/:id/wallet/payment

Pay against outstanding balance from a purchase.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `purchaseId` | integer | ✓ | |
| `amount` | string | ✓ | |
| `paymentType` | string | ✓ | |
| `paymentReference` | string | ✗ | |

**Side Effects** (one transaction):
1. Insert `supplier_wallet_transactions` (type=`payment`).
2. Decrement `suppliers.outstanding_balance`.
3. Decrement `purchases.outstanding_balance`.
4. Increment `purchases.amount_paid`.
5. Insert into `purchase_payments`.

---

## 10. Orders

Pre-sale orders placed by customers before fulfillment. Converted to sales upon completion.

### GET /api/shops/:shopId/orders

**Auth**: Admin or Attendant

**Query Params**: Pagination + `status` (pending|completed|cancelled) + `customerId`

---

### POST /api/shops/:shopId/orders

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | integer | ✗ | |
| `orderNote` | string | ✗ | |
| `items` | array | ✓ | At least one item |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | |
| `items[].unitPrice` | string | ✓ | Price at time of order |

**Side Effects**:
1. Insert into `orders` with auto-generated `order_no`.
2. Insert into `order_items` for each item.
3. Set `orders.attendant_id` from authenticated user.

---

### GET /api/orders/:id

**Auth**: Admin or Attendant

---

### PUT /api/orders/:id

Update order details while still `pending`.

**Auth**: Admin or Attendant

---

### DELETE /api/orders/:id

Cancel an order (sets `status = cancelled`).

**Auth**: Admin or Attendant

---

### POST /api/orders/:id/fulfill

Convert an order to a sale. Returns the created sale.

**Auth**: Admin or Attendant

**Request Body**: Same structure as `POST /api/shops/:shopId/sales` (payment info, discounts, etc.). The `orderId` field links them.

**Side Effects**:
1. Creates a full sale record (see Sales section).
2. Sets `orders.status = completed`.
3. Sets `sales.order_id = orderId`.

---

## 11. Sales

The core transaction. A sale reduces inventory and records revenue.

### GET /api/shops/:shopId/sales

**Auth**: Admin or Attendant

**Query Params**: Pagination + `status` + `paymentType` + `saleType` + `customerId` + `attendantId` + `from` + `to`

---

### POST /api/shops/:shopId/sales

Create a completed sale (POS checkout).

**Auth**: Admin or Attendant  

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `customerId` | integer | ✗ | |
| `orderId` | integer | ✗ | If converting from an order |
| `saleType` | string | ✗ | `Retail`\|`Wholesale`\|`Dealer`\|`Order`. Default `Retail` |
| `paymentType` | string | ✓ | `cash`\|`credit`\|`mpesa`\|`card`\|`bank`\|`split` |
| `saleNote` | string | ✗ | |
| `dueDate` | string | ✗ | Required when `paymentType = credit` |
| `saleDiscount` | string | ✗ | Whole-sale discount amount, default `"0"` |
| `items` | array | ✓ | At least one item |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | |
| `items[].unitPrice` | string | ✓ | Final price (after item discount) |
| `items[].costPrice` | string | ✗ | Buying price snapshot for profit calc |
| `items[].lineDiscount` | string | ✗ | Per-item discount, default `"0"` |
| `items[].tax` | string | ✗ | Tax applied to this line |
| `items[].serialId` | integer | ✗ | For serialised products |
| `items[].batchAllocations` | array | ✗ | For batch-tracked shops |
| `items[].batchAllocations[].batchId` | integer | ✓ | |
| `items[].batchAllocations[].quantityTaken` | string | ✓ | |
| `payments` | array | ✗ | Required unless `paymentType = credit` |
| `payments[].paymentType` | string | ✓ | `cash`\|`mpesa`\|`card`\|`bank`\|`wallet` |
| `payments[].amount` | string | ✓ | |
| `payments[].paymentReference` | string | ✗ | M-Pesa code, bank ref |

**Response** `201`: Full sale object with items, payments, and receipt number.

**Side Effects** (all in one DB transaction):
1. Insert `sales` row with auto-generated `receipt_no`. Calculate and store all totals.
2. Insert `sale_items` rows. For each item decrement `inventory.quantity`.
3. If `serialId` set: update `product_serials.status = sold`.
4. If `batchAllocations` provided: insert `sale_item_batches`, decrement `batches.quantity`.
5. Insert `sale_payments` rows. Calculate running balance for each.
6. If `paymentType = credit`: set `sales.outstanding_balance = totalWithDiscount`, increment `customers.outstanding_balance`.
7. If `paymentType = wallet`: decrement `customers.wallet`.
8. Re-evaluate `inventory.status` for each product (`active`/`low`/`out_of_stock`).
9. Log an entry in `activities` (`action = "created sale"`).

---

### GET /api/sales/:id

**Auth**: Admin or Attendant

**Response** `200`: Sale with items, payments, and return history.

---

### POST /api/sales/:id/void

Void a sale (sets `sales.status = voided`). Cannot void a sale with payments received against credit.

**Auth**: Admin or Attendant

**Side Effects** (one transaction):
1. Set `sales.status = voided`.
2. Restore `inventory.quantity` for each item.
3. If serialised items: set `product_serials.status = available`.
4. If batch items: restore `batches.quantity`.
5. If was credit sale: decrement `customers.outstanding_balance`.
6. Log activity.

---

### POST /api/sales/:id/payments

Record a partial payment against a credit sale.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | string | ✓ | Must be ≤ `sales.outstanding_balance` |
| `paymentType` | string | ✓ | |
| `paymentReference` | string | ✗ | |

**Side Effects**:
1. Insert `sale_payments` row.
2. Decrement `sales.outstanding_balance`.
3. Increment `sales.amount_paid`.
4. Decrement `customers.outstanding_balance`.
5. If fully paid: set `sales.status = cashed`.

---

### PUT /api/sales/:id

Update a sale's metadata (note, sale date, or attendant attribution). Does **not** allow changing items or payment type after creation — void and re-create for structural changes.

**Auth**: Admin

**Request Body**: Any subset of `{ saleNote, saleDate, attendantId }`.

---

### DELETE /api/sales/:id

Hard-delete a sale and all its items and payments. Restores inventory. Only allowed for sales in `voided` status.

**Auth**: Admin

**Side Effects**: Restore `inventory.quantity`, restore batch quantities, restore serial statuses, delete `sale_items`, `sale_payments`, `sale_returns`, `sale_return_items`, then delete the `sales` row.

---

### POST /api/sales/:id/returns

Create a return / refund against a completed sale.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `refundAmount` | string | ✓ | |
| `refundMethod` | string | ✓ | `cash`\|`mpesa`\|`card`\|`bank`\|`store_credit` |
| `refundReference` | string | ✗ | |
| `reason` | string | ✗ | |
| `items` | array | ✓ | Items being returned |
| `items[].saleItemId` | integer | ✓ | |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | |
| `items[].unitPrice` | string | ✓ | |

**Side Effects**:
1. Insert `sale_returns` with auto-generated `return_no`.
2. Insert `sale_return_items`.
3. Restore `inventory.quantity` for each returned product.
4. Update `sale_items.status = returned` for fully returned items.
5. If `refundMethod = store_credit`: increment `customers.wallet`, insert `customer_wallet_transactions` (type=`refund`).
6. Log activity.

---

### Sale Returns — Read / Update / Delete

#### GET /api/shops/:shopId/sale-returns

List all returns for a shop.

**Auth**: Admin or Attendant

**Query Params**: Pagination + `saleId` + `customerId` + `attendantId` + `productId` + `from` + `to`

---

#### GET /api/sale-returns/:id

**Auth**: Admin or Attendant

**Response** `200`: Return object with `sale_return_items`.

---

#### PUT /api/sale-returns/:id

Correct metadata on an existing return (e.g. reason or refund reference). Does not allow changing items — delete and re-create for structural changes.

**Auth**: Admin

**Request Body**: Any subset of `{ reason, refundReference, refundMethod }`.

---

#### DELETE /api/sale-returns/:id

Delete a sale return. Re-deducts the previously restored inventory (i.e. reverses the return reversal).

**Auth**: Admin

**Side Effects**: Delete `sale_return_items`, restore inventory back to post-sale state, restore serial/batch state, then delete `sale_returns` row.

---

## 12. Purchases

Receiving stock from a supplier. Mirrors a sale in the opposite direction — money goes out, stock comes in.

### GET /api/shops/:shopId/purchases

**Auth**: Admin or Attendant

**Query Params**: Pagination + `supplierId` + `paymentType` + `from` + `to`

---

### POST /api/shops/:shopId/purchases

Record a new purchase (stock received from supplier).

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `supplierId` | integer | ✗ | |
| `paymentType` | string | ✓ | `cash`\|`credit`\|`mpesa`\|`bank` |
| `items` | array | ✓ | At least one item |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | |
| `items[].unitPrice` | string | ✓ | |
| `items[].lineDiscount` | string | ✗ | Default `"0"` |
| `items[].batchCode` | string | ✗ | Supplier's lot reference |
| `items[].expiryDate` | string | ✗ | ISO date for this lot |
| `payments` | array | ✗ | Required when `paymentType ≠ credit` |
| `payments[].paymentType` | string | ✓ | |
| `payments[].amount` | string | ✓ | |
| `payments[].paymentReference` | string | ✗ | |

**Response** `201`: Full purchase object.

**Side Effects** (one DB transaction):
1. Insert `purchases` with auto-generated `purchase_no`. Compute `total_amount`.
2. Insert `purchase_items`.
3. If `shop.track_batches = true` and `batchCode` provided: insert `batches`, set `purchase_items.batch_id`.
4. Increment `inventory.quantity` for each product.
5. If `paymentType = credit`: set `purchases.outstanding_balance = totalAmount`, increment `suppliers.outstanding_balance`.
6. Insert `purchase_payments` if payments provided.
7. Log activity.

---

### GET /api/purchases/:id

**Auth**: Admin or Attendant

---

### POST /api/purchases/:id/payments

Record a payment to the supplier against a credit purchase.

**Auth**: Admin

**Request Body**: Same structure as sale payments.

**Side Effects**: Same logic as `POST /suppliers/:id/wallet/payment` (see Suppliers section).

---

### PUT /api/purchases/:id

Update a purchase's metadata (note, purchase date, or attendant attribution). Does **not** allow changing items — delete and re-create for structural changes.

**Auth**: Admin

**Request Body**: Any subset of `{ purchaseNote, purchaseDate, attendantId }`.

---

### DELETE /api/purchases/:id

Hard-delete a purchase. Restores inventory. Only allowed when `outstanding_balance = 0` (fully paid or not on credit).

**Auth**: Admin

**Side Effects**: Decrement `inventory.quantity` for each item, decrement batch quantities if applicable, delete `purchase_items`, `purchase_payments`, then delete `purchases` row.

---

### POST /api/purchases/:id/returns

Return goods to supplier.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `refundAmount` | string | ✓ | |
| `refundMethod` | string | ✓ | `cash`\|`mpesa`\|`bank`\|`cheque`\|`credit_note` |
| `refundReference` | string | ✗ | |
| `reason` | string | ✗ | |
| `items` | array | ✓ | |
| `items[].purchaseItemId` | integer | ✓ | |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | |
| `items[].unitPrice` | string | ✓ | |

**Side Effects** (one DB transaction):
1. Insert `purchase_returns` with auto-generated `return_no`.
2. Insert `purchase_return_items`.
3. Decrement `inventory.quantity` for each returned product.
4. If the returned item had a linked batch (`purchase_items.batch_id`): decrement `batches.quantity` by the returned amount.
5. Decrement `purchases.outstanding_balance` by `refundAmount`.
6. Decrement `suppliers.outstanding_balance` by `refundAmount`.
7. If `refundMethod = credit_note`: no cash movement — supplier reduces what you owe them. Stop here.
8. If `refundMethod = cash | mpesa | bank | cheque`: insert a `supplier_wallet_transactions` row (`type = refund`) and increment `suppliers.wallet`.

---

### Purchase Returns — Read / Update / Delete

#### GET /api/shops/:shopId/purchase-returns

List all purchase returns for a shop.

**Auth**: Admin or Attendant

**Query Params**: Pagination + `purchaseId` + `supplierId` + `from` + `to`

---

#### GET /api/purchase-returns/:id

**Auth**: Admin or Attendant

**Response** `200`: Return object with `purchase_return_items`.

---

#### PUT /api/purchase-returns/:id

Correct metadata (reason, refund reference, or method) on an existing return.

**Auth**: Admin

**Request Body**: Any subset of `{ reason, refundReference, refundMethod }`.

---

#### DELETE /api/purchase-returns/:id

Delete a purchase return. Re-increments the inventory that was decremented by the original return (i.e. reverses the return reversal).

**Auth**: Admin

**Side Effects**: Delete `purchase_return_items`, restore `inventory.quantity`, restore batch quantities, restore `suppliers.outstanding_balance` if refund was applied, then delete `purchase_returns` row.

---

## 13. Transfers

Move stock from one shop to another. Inventory is updated at both shops in the same transaction.

### GET /api/shops/:shopId/transfers

List outbound and inbound transfers for this shop.

**Auth**: Admin or Attendant

**Query Params**: Pagination + `direction` (`sent`|`received`) + `from` + `to`

---

### POST /api/transfers

Create a stock transfer.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `fromShopId` | integer | ✓ | Source shop (must belong to same admin, or a warehouse) |
| `toShopId` | integer | ✓ | Destination shop |
| `transferNote` | string | ✗ | |
| `items` | array | ✓ | |
| `items[].productId` | integer | ✓ | |
| `items[].quantity` | string | ✓ | Must be ≤ available stock at fromShop |
| `items[].unitPrice` | string | ✗ | Snapshot of buying_price |

**Response** `201`: Transfer object with `transfer_no`.

**Side Effects** (one DB transaction):
1. Insert `product_transfers` with auto-generated `transfer_no`.
2. Insert `transfer_items`.
3. Decrement `inventory.quantity` at `from_shop_id` for each product.
4. Increment `inventory.quantity` at `to_shop_id` for each product.
5. If `fromShop.warehouse = true`: also create a `purchases` record at `toShop` (with `purchase_id` linking back), insert `purchase_items` to track the cost of received goods.
6. Log activity at both shops.

---

### GET /api/transfers/:id

**Auth**: Admin or Attendant

---

### GET /api/products/:id/transfer-history

All transfers (sent and received) involving a specific product.

**Auth**: Admin or Attendant

**Query Params**: `shopId` + `from` + `to` + pagination

**Response** `200`: Paginated list of `transfer_items` joined with transfer metadata (date, from/to shop names, transfer number, attendant).

---

## 14. Stock Operations

### Stock Adjustments

Manual changes to inventory outside of sales or purchases (e.g. damage, miscounts, corrections).

#### POST /api/shops/:shopId/adjustments

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | integer | ✓ | |
| `type` | string | ✓ | `add` \| `remove` |
| `quantity` | string | ✓ | Amount to add or remove |
| `reason` | string | ✗ | |

**Side Effects**:
1. Insert `adjustments`. Capture `quantity_before`, `quantity_after`, `quantity_adjusted`.
2. Update `inventory.quantity` accordingly.
3. Re-evaluate `inventory.status`.
4. Log activity.

---

#### GET /api/shops/:shopId/adjustments

**Auth**: Admin or Attendant

**Query Params**: Pagination + `productId` + `type` + `from` + `to`

---

### Bad Stock (Write-offs)

Damaged, expired, or lost stock written off permanently.

#### POST /api/shops/:shopId/bad-stocks

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `productId` | integer | ✓ | |
| `quantity` | string | ✓ | |
| `unitPrice` | string | ✓ | Cost price of written-off units |
| `reason` | string | ✓ | |

**Side Effects**: Insert `bad_stocks`, decrement `inventory.quantity`, re-evaluate `inventory.status`, log activity.

---

#### GET /api/shops/:shopId/bad-stocks

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `productId` + pagination

---

#### DELETE /api/bad-stocks/:id

Delete a bad stock write-off record. Restores inventory.

**Auth**: Admin

**Side Effects**: Delete `bad_stocks` row, increment `inventory.quantity` by the written-off amount, re-evaluate `inventory.status`.

---

#### GET /api/shops/:shopId/bad-stocks/summary

Aggregated bad stock totals — total quantity and value written off, grouped by product or date.

**Auth**: Admin

**Query Params**: `from` + `to` + `groupBy` (`product`|`day`|`month`, default `product`)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalQuantity": 55,
    "totalValue": "...",
    "breakdown": [{ "productId": 1, "name": "...", "quantity": 10, "value": "..." }]
  }
}
```

---

#### GET /api/shops/:shopId/bad-stocks/analysis

Time-series analysis of bad stock write-offs, used for trend charts.

**Auth**: Admin

**Query Params**: `from` + `to` + `groupBy` (`day`|`week`|`month`)

**Response** `200`: Array of `{ period, totalQuantity, totalValue }` data points.

---

### Stock Counts

Physical count sessions — compare system quantity vs physical count.

#### POST /api/shops/:shopId/stock-counts

Start a new count session.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | array | ✓ | |
| `items[].productId` | integer | ✓ | Unique per session |
| `items[].physicalCount` | string | ✓ | What was physically counted |
| `apply` | boolean | ✗ | Default `false`. When `true`, immediately apply the count (update inventory). When `false`, save as a record only — inventory unchanged until `POST /stock-counts/:id/apply` is called. |

**Side Effects**:
1. Insert `stock_counts`.
2. Insert `stock_count_items`. For each item capture `system_count` = current `inventory.quantity`, `variance = physicalCount - systemCount`.
3. Always update `inventory.last_count` and `inventory.last_count_date` for each product.
4. If `apply = true`: also update `inventory.quantity = physicalCount` and re-evaluate `inventory.status` for each item.

---

#### GET /api/shops/:shopId/stock-counts

**Auth**: Admin or Attendant

---

#### GET /api/stock-counts/:id

**Auth**: Admin or Attendant

---

#### DELETE /api/stock-counts/:id

Delete a stock count session. Only allowed if the count has **not** been applied (i.e. `applied = false`).

**Auth**: Admin

**Side Effects**: Delete `stock_count_items`, then delete `stock_counts` row. Does **not** affect `inventory.last_count` or `inventory.last_count_date` because those were already updated at creation time (they track the last time a count was initiated, not applied).

---

#### GET /api/shops/:shopId/stock-counts/product-filter

Find products by their counting status within a shop. Useful for identifying products that need to be counted.

**Auth**: Admin or Attendant

**Query Params** (at least one required):

| Param | Type | Description |
|---|---|---|
| `neverCounted` | boolean | Products with no `stock_count_items` rows in this shop |
| `countedToday` | boolean | Products counted today (`inventory.last_count_date = today`) |
| `notCountedToday` | boolean | Products with a `last_count_date` before today (or null) |
| `searchName` | string | Filter by product name within the results |

**Response** `200`: Array of inventory rows with product info.

---

#### POST /api/stock-counts/:id/apply

Apply a previously saved stock count to inventory. Idempotent — safe to call again if the count was already applied (check counts against current inventory values before updating).

**Auth**: Admin or Attendant

**Request Body**: None.

**Side Effects**: For each `stock_count_items` row in this count: set `inventory.quantity = physical_count`, set `inventory.last_count = physical_count`, set `inventory.last_count_date = now()`, re-evaluate `inventory.status`. All updates in a single transaction.

---

### Stock Requests

A shop requests stock from a warehouse shop.

#### POST /api/shops/:shopId/stock-requests

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `warehouseId` | integer | ✓ | Must be a shop with `warehouse = true` |
| `items` | array | ✓ | |
| `items[].productId` | integer | ✓ | Unique per request |
| `items[].quantityRequested` | string | ✓ | |

**Side Effects**: Insert `stock_requests` (status=`pending`) and `stock_request_items`. Auto-generate `invoice_number`.

---

#### GET /api/shops/:shopId/stock-requests

**Auth**: Admin or Attendant

**Query Params**: `status` + `warehouseId` + pagination

---

#### GET /api/stock-requests/:id

**Auth**: Admin or Attendant

---

#### PUT /api/stock-requests/:id

Update the metadata or item quantities on a pending stock request. Only allowed when `status = pending`.

**Auth**: Admin or Attendant

**Request Body**: Any subset of `{ items[].stockRequestItemId, items[].quantityRequested }` or top-level request note.

---

#### DELETE /api/stock-requests/:id

Cancel and delete a pending stock request. Only allowed when `status = pending`.

**Auth**: Admin

**Side Effects**: Delete `stock_request_items`, then delete `stock_requests` row.

---

#### DELETE /api/stock-requests/:id/items/:itemId

Remove a single product line from a pending stock request.

**Auth**: Admin or Attendant

---

#### GET /api/stock-requests/by-product/:productId

All stock requests that include a specific product.

**Auth**: Admin or Attendant

**Query Params**: `shopId` + `status` + pagination

---

#### PUT /api/stock-requests/:id/status

Manually set the status of a stock request.

**Auth**: Admin

**Request Body**: `{ "status": "pending" | "processed" | "completed" | "cancelled" }`

---

#### PUT /api/stock-requests/:id/accept

Warehouse accepts the request and confirms available quantities.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `items[].stockRequestItemId` | integer | ✓ |
| `items[].quantityReceived` | string | ✓ |

**Side Effects**: Set `status = processed`, set `accepted_by_id`, set `accepted_at`, update `quantity_received` on each item.

---

#### PUT /api/stock-requests/:id/dispatch

Warehouse dispatches (ships) the goods.

**Auth**: Admin

**Side Effects**: Set `status = completed`, set `dispatched_at`, set `approved_by_id` to the authenticated attendant/admin. Then create a `product_transfer` from warehouse to requesting shop (triggers inventory update at both ends in the same transaction).

---

## 15. Finance

### Expense Categories

#### GET /api/shops/:shopId/expense-categories

**Auth**: Admin or Attendant

---

#### POST /api/shops/:shopId/expense-categories

**Auth**: Admin

**Request Body**: `{ "name": "string" }`

---

#### PUT /api/expense-categories/:id / DELETE /api/expense-categories/:id

**Auth**: Admin

---

### Expenses

#### GET /api/shops/:shopId/expenses

**Auth**: Admin or Attendant

**Query Params**: Pagination + `categoryId` + `isRecurring` + `from` + `to`

---

#### POST /api/shops/:shopId/expenses

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string | ✗ | |
| `amount` | string | ✓ | |
| `categoryId` | integer | ✗ | |
| `isRecurring` | boolean | ✗ | Default `false` |
| `frequency` | string | ✗ | `daily`\|`weekly`\|`monthly`. Required if `isRecurring = true` |

**Side Effects**: Insert `expenses` with auto-generated `expense_no`. If `isRecurring = true`, set `next_occurrence_at` based on frequency.

---

#### GET /api/expenses/:id / PUT /api/expenses/:id / DELETE /api/expenses/:id

**Auth**: Admin

---

#### GET /api/shops/:shopId/expenses/stats

Aggregated expense statistics for the shop — total spend, top categories, month-over-month trend.

**Auth**: Admin

**Query Params**: `from` + `to`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalExpenses": "...",
    "topCategories": [{ "categoryId": 1, "name": "Rent", "total": "..." }],
    "trend": [{ "period": "2024-01", "total": "..." }]
  }
}
```

---

#### GET /api/expense-categories/:categoryId/transactions

All expense entries for a specific category.

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + pagination

**Response** `200`: Paginated list of `expenses` rows filtered by `category_id`.

---

### Banks

Bank accounts with running balances.

#### GET /api/shops/:shopId/banks

**Auth**: Admin

---

#### POST /api/shops/:shopId/banks

**Auth**: Admin

**Request Body**: `{ "name": "string", "balance": "string" }`

---

#### PUT /api/banks/:id / DELETE /api/banks/:id

**Auth**: Admin. Delete only if `balance = 0`.

---

#### GET /api/banks/:id/transactions

Full transaction history for a bank account (all cashflow entries linked to this bank).

**Auth**: Admin

**Query Params**: Pagination + `from` + `to` + `type` (`cashin`|`cashout`)

**Response** `200`: Paginated list of cashflow rows joined with category info, ordered by `created_at DESC`.

---

### Cashflow Categories

#### GET /api/shops/:shopId/cashflow-categories

**Auth**: Admin or Attendant

**Query Params**: `type` (`cashin`|`cashout`)

---

#### POST /api/shops/:shopId/cashflow-categories

**Auth**: Admin

**Request Body**: `{ "name": "string", "type": "cashin | cashout" }`

---

### Cashflows

The main money ledger — every cash-in and cash-out event.

#### GET /api/shops/:shopId/cashflows

**Auth**: Admin or Attendant

**Query Params**: Pagination + `categoryId` + `bankId` + `from` + `to`

---

#### POST /api/shops/:shopId/cashflows

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `description` | string | ✓ | |
| `amount` | string | ✓ | |
| `categoryId` | integer | ✗ | Determines cashin/cashout type |
| `bankId` | integer | ✗ | If set, updates bank balance |

**Side Effects**:
1. Insert `cashflows` with auto-generated `cashflow_no`.
2. If `bankId` set: increment (cashin) or decrement (cashout) `banks.balance` in same transaction.

---

#### GET /api/cashflows/:id / DELETE /api/cashflows/:id

**Auth**: Admin

---

#### PUT /api/cashflows/:id

Update the description, amount, category, or bank link on an existing cashflow entry.

**Auth**: Admin

**Request Body**: Any subset of `{ description, amount, categoryId, bankId }`.

**Side Effects**: If `bankId` or `amount` changes, reverse the old bank balance adjustment and apply the new one in the same transaction.

---

#### GET /api/shops/:shopId/cashflows/total-by-category

Total cashin and cashout grouped by category for a date range. Used for the cashflow summary dashboard.

**Auth**: Admin or Attendant

**Query Params**: `from` + `to` + `type` (`cashin`|`cashout`)

**Response** `200`:
```json
{
  "success": true,
  "data": [{ "categoryId": 1, "categoryName": "Sales", "type": "cashin", "total": "..." }]
}
```

---

### Custom Payment Methods

Shop-defined payment methods (beyond the standard enum) shown in the POS checkout screen (e.g. "Equity Bank Paybill", "Till Number 123456").

#### GET /api/shops/:shopId/payment-methods

**Auth**: Admin or Attendant

**Response** `200`: Array of `{ id, name, description, isActive }`.

---

#### POST /api/shops/:shopId/payment-methods

**Auth**: Admin

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `name` | string | ✓ |
| `description` | string | ✗ |

---

#### GET /api/payment-methods/:id

**Auth**: Admin or Attendant

---

#### PUT /api/payment-methods/:id / DELETE /api/payment-methods/:id

**Auth**: Admin. Cannot delete a method that has been used in a `sale_payments` row.

---

## 16. Subscriptions

### Packages (Plans)

#### GET /api/packages

List all active subscription plans.

**Auth**: Public

**Response** `200`: Array of packages each with their `package_features`.

---

#### POST /api/packages

Create a new plan (super-admin only).

**Auth**: Super-Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✓ | |
| `description` | string | ✗ | |
| `durationValue` | integer | ✓ | e.g. `1`, `3`, `12` |
| `durationUnit` | string | ✓ | `days`\|`weeks`\|`months`\|`years` |
| `amount` | string | ✓ | Local currency |
| `amountUsd` | string | ✓ | USD |
| `discount` | string | ✗ | Default `"0"` |
| `type` | string | ✓ | `trial`\|`production` |
| `shops` | integer | ✗ | Max shops this plan covers |
| `features` | string[] | ✗ | Feature descriptions |

**Side Effects**: Insert `packages`. Insert `package_features` for each feature.

---

#### PUT /api/packages/:id

Update a plan.

**Auth**: Super-Admin

**Request Body**: Any subset of package fields listed above.

**Side Effects**: Update `packages`. Sync `package_features` (delete removed, insert new).

---

#### DELETE /api/packages/:id

**Auth**: Super-Admin. Not allowed if any `subscriptions` reference this package.

---

### Subscriptions

#### GET /api/admin/subscriptions

List the authenticated admin's subscriptions.

**Auth**: Admin

---

#### POST /api/subscriptions

Initiate a new subscription (generate invoice, not yet paid).

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `packageId` | integer | ✓ | |
| `shopIds` | integer[] | ✗ | Shops to activate under this subscription |
| `currency` | string | ✗ | Default `kes` |

**Side Effects**:
1. Insert `subscriptions` (`is_active = false`, `is_paid = false`).
2. Calculate `start_date = now()`, `end_date = start_date + package duration`.
3. Insert `subscription_shops` rows.
4. Auto-generate `invoice_no`.

---

#### POST /api/subscriptions/:id/pay

Mark a subscription as paid after verifying payment.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `paymentReference` | string | ✗ | M-Pesa code, bank ref |
| `amount` | string | ✓ | Actual amount paid |

**Side Effects** (one DB transaction):
1. Set `subscriptions.is_paid = true`, `is_active = true`, `payment_reference`.
2. For each shop in `subscription_shops`: set `shops.subscription_id = subscription.id`.
3. **Affiliate commission**: look up `admins.affiliate_id`. If set, check `affiliates` record. Calculate `commission_amount = affiliates.commission% × amount`. Insert `awards` (`type = earnings`, `award_type = subscription`). Increment `affiliates.wallet`. Insert `affiliate_transactions` (`type = subscription`, `is_completed = true` — earnings are immediately settled).
4. **Referral credit**: if `admins.referral_credit > 0`, apply it as a discount: effective payment = `amount − referral_credit` (floor at 0). Deduct the used amount from `admins.referral_credit` in the same transaction.

---

#### GET /api/subscriptions/:id

**Auth**: Admin (owns this subscription)

---

#### PUT /api/subscriptions/:id/extend

Manually extend a subscription's end date (super-admin or admin with override permission).

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `days` | integer | ✓ | Number of days to extend |
| `reason` | string | ✗ | Internal note |

**Side Effects**: Add `days` to `subscriptions.end_date`. If subscription was inactive, set `is_active = true`.

---

#### GET /api/subscriptions/:id/licence

Return the licence details for an active subscription (used by the mobile app to verify the subscription on-device).

**Auth**: Admin (owns this subscription)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "invoiceNo": "INV1234567",
    "isActive": true,
    "isPaid": true,
    "startDate": "...",
    "endDate": "...",
    "package": { "title": "...", "type": "production" },
    "shops": [{ "id": 1, "name": "Main Shop" }]
  }
}
```

---

#### PUT /api/subscriptions/:id/verify

Manually verify and activate a subscription after confirming payment through a non-automated channel (e.g. bank transfer).

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `paymentReference` | string | ✓ | Bank ref, M-Pesa code, etc. |
| `amount` | string | ✓ | Amount confirmed |

**Side Effects**: Same as `POST /api/subscriptions/:id/pay`.

---

#### GET /api/admin/subscriptions/stats

Platform-wide subscription statistics dashboard.

**Auth**: Super-Admin

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalActive": 420,
    "totalTrial": 130,
    "totalExpired": 55,
    "totalRevenue": "...",
    "byPackage": [{ "packageId": 1, "title": "...", "count": 200 }]
  }
}
```

---

#### GET /api/admin/subscriptions/summary

Paginated list of all subscriptions across all admins for the super-admin portal.

**Auth**: Super-Admin

**Query Params**: Pagination + `status` (`active`|`trial`|`expired`|`unpaid`) + `packageId` + `from` + `to`

**Response** `200`: Paginated list of subscription rows each joined with admin and package info.

---

### Payment Gateways

These endpoints handle initiating and confirming subscription payments via M-Pesa, Stripe, and Paystack.

---

#### POST /api/subscriptions/:id/pay/mpesa

Initiate an M-Pesa STK push to pay for a subscription.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `phone` | string | ✓ | Subscriber's M-Pesa phone number (format: `2547XXXXXXXX`) |

**Side Effects**:
1. Call Safaricom STK Push API with `amount = subscriptions.amount` (or USD equivalent).
2. Store the `CheckoutRequestID` on the subscription row for callback matching.
3. Return `{ checkoutRequestId, customerMessage }` — payment not yet confirmed. Confirmation happens via the M-Pesa callback below.

---

#### POST /api/payments/mpesa/validation

M-Pesa C2B validation webhook — called by Safaricom before debiting the customer.

**Auth**: Public (Safaricom IP-whitelisted)

**Response** `200`: `{ "ResultCode": 0, "ResultDesc": "Accepted" }` always — reject only for known fraud signals.

---

#### POST /api/payments/mpesa/confirmation

M-Pesa C2B confirmation webhook — called by Safaricom after a successful C2B payment.

**Auth**: Public (Safaricom IP-whitelisted)

**Side Effects**:
1. Match the payment to a pending subscription using `CheckoutRequestID` or `BillRefNumber`.
2. Call the same logic as `POST /api/subscriptions/:id/pay` to activate the subscription.
3. Log the transaction in `affiliate_transactions` and fire affiliate commission if applicable.

---

#### POST /api/payments/mpesa/callback

M-Pesa STK push result callback — called by Safaricom after an STK push completes or fails.

**Auth**: Public (Safaricom IP-whitelisted)

**Side Effects**:
1. Parse `Body.stkCallback.ResultCode`. `0` = success, anything else = failure.
2. On success: activate the subscription (same as `POST /api/subscriptions/:id/pay`).
3. On failure: update the subscription row with `payment_failed = true` and log the error reason.

---

#### POST /api/subscriptions/:id/pay/stripe

Create a Stripe Checkout Session for a subscription payment.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `successUrl` | string | ✓ | Redirect URL after successful payment |
| `cancelUrl` | string | ✓ | Redirect URL if user cancels |

**Response** `200`: `{ "checkoutUrl": "https://checkout.stripe.com/..." }` — redirect the user to this URL.

**Side Effects**: Create a Stripe Checkout Session with `metadata.subscriptionId`. Store the Stripe session ID on the subscription row.

---

#### POST /api/payments/stripe/webhook

Stripe webhook for payment events.

**Auth**: Public (verified via `Stripe-Signature` header using webhook secret)

**Events handled**:
- `checkout.session.completed` → activate subscription (same as `POST /api/subscriptions/:id/pay`).
- `payment_intent.payment_failed` → mark subscription payment as failed.

---

#### POST /api/subscriptions/:id/pay/paystack

Initiate a Paystack payment for a subscription.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✓ | Customer email for the transaction |
| `callbackUrl` | string | ✗ | Redirect after payment |

**Response** `200`: `{ "authorizationUrl": "https://checkout.paystack.com/...", "reference": "..." }` — redirect the user to `authorizationUrl`.

**Side Effects**: Initialize a Paystack transaction with `metadata.subscriptionId`. Store the Paystack reference on the subscription row.

---

#### POST /api/payments/paystack/webhook

Paystack webhook for payment events.

**Auth**: Public (verified via `x-paystack-signature` header using secret key)

**Events handled**:
- `charge.success` → match by `data.reference`, activate subscription (same as `POST /api/subscriptions/:id/pay`).

---

### Affiliate M-Pesa Payout

#### POST /api/admin/affiliate-transactions/:id/payout-mpesa

Trigger an M-Pesa B2C payout to the affiliate for an approved withdrawal.

**Auth**: Super-Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `phone` | string | ✓ | Affiliate's registered M-Pesa phone number |

**Side Effects**:
1. Call Safaricom B2C API with `Amount = affiliate_transactions.amount`.
2. On B2C callback success: call `PUT /api/admin/affiliate-transactions/:id/complete` logic (decrement wallet, mark completed).
3. On failure: log the failure reason — do not decrement wallet.

---

## 17. Affiliates

### Affiliate Portal (Self-Service)

#### POST /api/affiliates/register

**Auth**: Public

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | |
| `email` | string | ✓ | Used as login credential — must be unique |
| `password` | string | ✓ | Min 6 chars, stored as bcrypt hash |
| `phone` | string | ✗ | |
| `address` | string | ✗ | |
| `country` | string | ✗ | |

**Side Effects**: Insert `affiliates` (`is_active = false` until a super-admin approves via `PUT /api/admin/affiliates/:id`). Auto-generate unique `affiliates.code`.

---

#### POST /api/affiliates/login

**Auth**: Public

**Request Body**: `{ "email": "string", "password": "string" }`

**Response** `200`: `{ "affiliate": { ... }, "token": "<jwt>" }`

---

#### GET /api/affiliates/me

**Auth**: Affiliate token

---

#### PUT /api/affiliates/me

Update profile.

**Auth**: Affiliate token

---

#### GET /api/affiliates/me/awards

Earning history.

**Auth**: Affiliate token

**Query Params**: Pagination + `from` + `to`

---

#### GET /api/affiliates/me/transactions

Full wallet transaction history.

**Auth**: Affiliate token

---

#### POST /api/affiliates/me/withdraw

Request payout.

**Auth**: Affiliate token

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | string | ✓ | Must be ≤ `affiliates.wallet` |
| `paymentType` | string | ✓ | Preferred payout method |
| `paymentReference` | string | ✗ | Bank account, M-Pesa number, etc. |

**Side Effects**: Insert `affiliate_transactions` (`type = withdraw`, `is_completed = false`). **Do NOT decrement `affiliates.wallet` yet** — wallet is only decremented when an admin approves the withdrawal (`is_completed = true`).

---

### Affiliate Admin Management

#### GET /api/admin/affiliates

List all affiliates.

**Auth**: Admin (super-admin)

---

#### POST /api/admin/affiliates

Create an affiliate account directly.

**Auth**: Admin (super-admin)

**Request Body**: Same as register + optional `isActive: true`.

---

#### PUT /api/admin/affiliates/:id

Approve, block, or update affiliate.

**Auth**: Admin (super-admin)

**Request Body**: Any affiliate fields + `isActive` + `commission`.

---

#### POST /api/admin/affiliates/:id/award

Issue a manual award (non-subscription bonus).

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | string | ✓ | |
| `commissionAmount` | string | ✓ | |
| `type` | string | ✓ | `earnings` |
| `awardType` | string | ✓ | `open_shop` or custom label |
| `shopId` | integer | ✗ | |

**Side Effects**: Insert `awards`, increment `affiliates.wallet`, insert `affiliate_transactions`.

---

#### PUT /api/admin/affiliate-transactions/:id/complete

Mark a withdrawal as completed (payment sent).

**Auth**: Admin (super-admin)

**Side Effects** (one DB transaction):
1. Set `affiliate_transactions.is_completed = true`.
2. Decrement `affiliates.wallet` by `affiliate_transactions.amount`. Never let wallet go below 0 — validate before update.

---

## 18. Communication

### Email HTML Templates

Seeded library of HTML layouts used for transactional and campaign emails. No shop or admin scope — these are platform-level resources.

#### GET /api/admin/email-templates

List all email templates.

**Auth**: Admin (super-admin)

**Response**: `{ data: EmailTemplate[] }`

---

#### POST /api/admin/email-templates

Create a new HTML template.

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | Human-readable label e.g. `"Welcome Email"` |
| `slug` | string | ✓ | URL-safe unique key e.g. `"welcome-email"` — must be unique |
| `htmlContent` | string | ✓ | Full HTML body — use `{placeholder}` tokens |
| `category` | string | ✓ | `transactional` \| `marketing` \| `billing` |
| `placeholders` | string[] | ✗ | List of token names present in htmlContent |

---

#### GET /api/admin/email-templates/:id

**Auth**: Admin (super-admin)

---

#### PUT /api/admin/email-templates/:id

**Auth**: Admin (super-admin)

**Request Body**: Same fields as POST, all optional.

---

#### DELETE /api/admin/email-templates/:id

**Auth**: Admin (super-admin)

---

### SMS / Email Send Log

One row is written here after every individual SMS or email sent anywhere in the system (OTP, bulk, campaign, etc.).

#### GET /api/admin/communications

List send log with filtering.

**Auth**: Admin (super-admin)

**Query Params**:

| Param | Notes |
|---|---|
| `type` | `sms` \| `email` |
| `status` | `sent` \| `failed` |
| `contact` | exact phone or email filter |
| `from` | ISO date — filter by `created_at >=` |
| `to` | ISO date — filter by `created_at <=` |
| `page` | default 1 |
| `limit` | default 20 |

**Response**: `{ data: Communication[], total, page, limit }`

---

#### POST /api/admin/communications/send

Send a single SMS or email and log the result.

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string | ✓ | Phone number (SMS) or email address |
| `body` | string | ✓ | Message text or HTML |
| `type` | string | ✗ | `sms` \| `email`, default `sms` |
| `subject` | string | ✗ | Required when `type = email` |

**Side Effects**:
1. Normalise phone (Kenyan format) for SMS or validate email for email.
2. Call the gateway (`sendSms` / `sendEmail`).
3. Insert a `communications` row with `status = sent` or `failed` and `failed_reason` if applicable.

---

#### POST /api/admin/communications/:id/resend

Retry a previously failed send using the original `contact` and `message`.

**Auth**: Admin (super-admin)

**Side Effects**:
1. Fetch the `communications` row by `id`.
2. Re-call the gateway with the same `type`, `contact`, and `message`.
3. Update the existing row's `status` and `failed_reason`.

---

#### POST /api/admin/communications/bulk-sms

Send the same SMS to all admins matching a subscription segment.

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `userType` | string | ✓ | `trial_active` \| `trial_expired` \| `production_active` \| `production_expired` |
| `message` | string | ✓ | SMS body text |
| `chunkSize` | integer | ✗ | Batch size per gateway burst, default 50 |
| `delay` | integer | ✗ | Milliseconds between batches, default 3000 |

**Side Effects**:
1. Fetch all admins matching `userType` via subscription join.
2. Send in chunks with delay.
3. Insert one `communications` row per recipient.

**Response**: `{ total, sent, failed, userType }`

---

### Email/SMS Campaign Templates

Reusable campaign definitions scoped to an admin. Can be sent immediately or scheduled.

#### GET /api/admin/email-messages

**Auth**: Admin (super-admin)

---

#### POST /api/admin/email-messages

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | Internal label |
| `subject` | string | ✓ | |
| `body` | string | ✓ | HTML or plain text |
| `type` | string | ✗ | `email`\|`sms`, default `email` |
| `audience` | string | ✗ | `subscribers`\|`all`\|`expired`\|`dormant`\|`custom` |
| `audienceEmails` | string | ✗ | Comma-separated for `custom` |
| `isScheduled` | boolean | ✗ | |
| `interval` | string | ✗ | `daily`\|`once_weekly`\|`monthly` |
| `campaign` | string | ✗ | Campaign label |

---

#### PUT /api/admin/email-messages/:id / DELETE /api/admin/email-messages/:id

**Auth**: Admin (super-admin)

---

#### POST /api/admin/email-messages/:id/send

Dispatch campaign immediately.

**Auth**: Admin (super-admin)

**Side Effects**:
1. Determine recipients based on `audience` field.
2. Send emails/SMS — each dispatch also inserts a `communications` row.
3. Insert `emails_sent` row (`recipient_count = n`).
4. Increment `email_messages.sent_count`.

---

#### GET /api/admin/emails-sent

Campaign dispatch history.

**Auth**: Admin (super-admin)

---

### SMS Credits

SMS credits are stored on `admins.sms_credit`. Every SMS sent deducts 1 credit. Admins top up via M-Pesa. All balance changes are recorded in `sms_credit_transactions`.

#### GET /api/sms/balance

Get the calling admin's current SMS credit balance.

**Auth**: Admin

**Response**: `{ "sms_credit": 42 }`

---

#### POST /api/sms/top-up

Purchase SMS credits via M-Pesa.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | ✓ | Amount in KES |
| `phone` | string | ✓ | M-Pesa phone number — defaults to admin's phone if omitted |
| `credits` | integer | ✓ | Number of credits to purchase |

**Side Effects**:
1. Initiate M-Pesa STK push for `amount`.
2. On payment callback confirmation: increment `admins.sms_credit += credits`.
3. Insert `sms_credit_transactions` row with `type = "top_up"`, `amount = credits`, `balance_after = new_balance`.

---

#### GET /api/sms/transactions

Admin's full SMS credit ledger (top-ups, deductions, refunds).

**Auth**: Admin

**Query Params**: `type` (`top_up` | `deduction` | `adjustment` | `refund`), `from`, `to`, pagination

**Response**: `{ data: SmsCreditTransaction[], total, page, limit }`

---

#### POST /api/admin/sms/adjust-credits

Manually adjust an admin's SMS credit balance (super-admin only).

**Auth**: Admin (super-admin)

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `adminId` | integer | ✓ | Target admin |
| `amount` | integer | ✓ | Positive to add, negative to deduct |
| `description` | string | ✗ | Reason for adjustment |

**Side Effects**:
1. Update `admins.sms_credit` by `amount`.
2. Insert `sms_credit_transactions` row with `type = "adjustment"`.

---

## 19. Activities

Audit log of attendant actions per shop.

### GET /api/shops/:shopId/activities

**Auth**: Admin or Attendant

**Query Params**: Pagination + `attendantId` + `from` + `to` + `search` (searches `action` and `details`)

**Response** `200`: Array of activity objects with attendant name.

---

## 20. System

### Shop Categories

Global reference list of business types (Supermarket, Pharmacy, etc.).

#### GET /api/system/shop-categories

**Auth**: Public

---

#### POST /api/system/shop-categories

**Auth**: Super-Admin

**Request Body**: `{ "name": "string", "isActive": true }`

---

#### PUT /api/system/shop-categories/:id / DELETE /api/system/shop-categories/:id

**Auth**: Super-Admin

---

### Settings

Platform-wide key/value configuration store.

#### GET /api/system/settings

**Auth**: Admin (super-admin)

**Response** `200`: Array of all settings.

---

#### GET /api/system/settings/:name

**Auth**: Admin (super-admin)

**Response** `200`: `{ "name": "...", "setting": <any JSON> }`

---

#### PUT /api/system/settings/:name

Create or update a setting.

**Auth**: Super-Admin

**Request Body**: `{ "setting": <any JSON value> }`

**Side Effects**: Upsert `settings` row. Must manually set `updated_at = new Date()` (not auto-managed by Drizzle).

---

### Shop Metrics

#### GET /api/system/shop-metrics

Platform-wide shop and admin metrics for the super-admin dashboard.

**Auth**: Super-Admin

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalShops": 1200,
    "totalAdmins": 850,
    "activeSubscriptions": 420,
    "trialSubscriptions": 130,
    "expiredSubscriptions": 55,
    "newShopsThisMonth": 34,
    "newAdminsThisMonth": 28,
    "totalRevenue": "...",
    "revenueThisMonth": "..."
  }
}
```

---

### Admin Management

Super-admin operations for managing all admin accounts on the platform.

#### GET /api/admin/admins

Paginated list of all admin accounts.

**Auth**: Super-Admin

**Query Params**: Pagination + `search` (email, phone, username) + `subscriptionStatus` (`active`|`trial`|`expired`|`none`)

**Response** `200`: Paginated list of admin objects each with their primary shop and current subscription status.

---

#### GET /api/admin/admins/by-subscription

Filter admins by subscription status. Useful for bulk SMS targeting.

**Auth**: Super-Admin

**Query Params**: `status` (`trial_active`|`trial_expired`|`production_active`|`production_expired`) + pagination

**Response** `200`: Paginated list of admin objects with phone numbers for SMS campaigns.

---

#### PUT /api/admin/admins/:id

Update any admin account (e.g. correct email, reset phone, toggle flags).

**Auth**: Super-Admin

**Request Body**: Any subset of admin fields (`email`, `phone`, `username`, `emailVerified`, `smsCredit`).

---

#### DELETE /api/admin/admins/:id

Delete an admin account and all their associated data.

**Auth**: Super-Admin

**Note**: This is destructive. Confirm the admin has no active subscriptions before proceeding. Cascades to shops, attendants, products, sales, and all related data per the schema `onDelete: cascade` rules.

---

## 21. Attendants

Cashier / staff accounts scoped to a single shop. Every admin also has one auto-created attendant used purely for sale attribution (no PIN, no password, no permissions).

---

### GET /api/permissions

Return the full master list of permission groups from the `permissions` table. The admin UI reads this to render the checklist when editing an attendant's profile. The frontend filters conditional groups (`condition = "warehouse"` or `"production"`) based on the current shop's flags before rendering.

**Auth**: Admin

**Response** `200`:

```json
[
  {
    "id": 1,
    "key": "pos",
    "label": "Point of Sale",
    "values": ["can_sell", "can_sell_to_dealer_&_wholesaler", "discount", "edit_price", "set_sale_date"],
    "condition": null,
    "sortOrder": 0
  },
  {
    "id": 14,
    "key": "warehouse",
    "label": "Warehouse",
    "values": ["invoice_delete", "show_buying_price", "show_available_stock", "view_buying_price", "create_orders", "view_orders", "return", "accept_warehouse_orders"],
    "condition": "warehouse",
    "sortOrder": 13
  }
]
```

> **Seed data**: On first deployment populate this table with all 14 default groups from the permission tree (see Conventions section). The `condition` column controls whether a group is visible in the UI — the server always checks the token regardless of condition.

---

### GET /api/shops/:shopId/attendants

List all attendants for this shop, excluding the auto-created admin attribution attendant.

**Auth**: Admin or Attendant

**Response** `200`: Array of attendant objects. Each object includes `permissions: string[]`.

---

### POST /api/shops/:shopId/attendants

Create a new attendant for this shop.

**Auth**: Admin or Attendant

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | ✓ | Display name on receipts |
| `pin` | string | ✓ | Numeric PIN used at POS login |
| `password` | string | ✓ | Password used alongside PIN |

**Response** `201`: Attendant object with `permissions: []` (empty — admin assigns permissions separately).

**Side Effects**: Sets `attendants.admin_id` and `attendants.shop_id` from the authenticated admin and the path param.

---

### GET /api/attendants/:id

**Auth**: Admin

**Response** `200`: Full attendant object including `permissions: string[]`.

---

### PUT /api/attendants/:id

Update username, PIN, or password.

**Auth**: Admin

**Request Body**:

| Field | Type | Required |
|---|---|---|
| `username` | string | ✗ |
| `pin` | string | ✗ |
| `password` | string | ✗ |

---

### DELETE /api/attendants/:id

**Auth**: Admin. Cannot delete the auto-created admin attribution attendant (`admins.attendant_id`).

---

### GET /api/attendants/:id/permissions

Return this attendant's currently assigned permission tokens.

**Auth**: Admin

**Response** `200`:

```json
{
  "attendantId": 12,
  "permissions": ["pos.can_sell", "stocks.view_products", "customers.manage"]
}
```

---

### PUT /api/attendants/:id/permissions

Replace the attendant's full permission set. The admin sends the complete list of tokens they want the attendant to have — the server overwrites `attendants.permissions` with this array.

**Auth**: Admin

**Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `permissions` | string[] | ✓ | Array of `"group.subkey"` tokens. Send `[]` to revoke all. |

**Validation**: Each token must match a known group key and a value within that group from the `permissions` master table. Unknown tokens are rejected with `400`.

**Response** `200`:

```json
{
  "attendantId": 12,
  "permissions": ["pos.can_sell", "stocks.view_products", "customers.manage"]
}
```

**Side Effects**: Overwrites `attendants.permissions` in a single update. The next time this attendant's token is used or they log in, the new permissions take effect immediately.

---

### How the client uses permissions

1. **Login** (`POST /api/auth/attendant/login`) → response includes `attendant.permissions: string[]`.
2. Flutter / ReactJS stores the array in local state / secure storage.
3. Client checks `permissions.includes("pos.can_sell")` before showing the Sell button, etc.
4. Server middleware independently checks the same token on each guarded request — the client-side check is for UI only, not security.
5. Admins skip all permission checks — their token carries a role flag, not a permissions array.

---

## 22. Reports

All report endpoints are **read-only** and return aggregated data for a given shop and time range. Every endpoint accepts the standard `from` / `to` ISO date query params and is paginated where the result set can be large.

**Auth**: Admin or Attendant for all report endpoints.

---

### GET /api/shops/:shopId/reports/sales

Daily sales summary — total revenue, number of transactions, average transaction value, breakdown by payment type.

**Query Params**: `from` · `to` · `groupBy` (`day`|`week`|`month`, default `day`)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totals": { "revenue": "...", "transactions": 120, "avgTransaction": "..." },
    "byPaymentType": { "cash": "...", "mpesa": "...", "card": "...", "bank": "...", "credit": "..." },
    "series": [ { "date": "2024-01-01", "revenue": "...", "transactions": 8 } ]
  }
}
```

---

### GET /api/shops/:shopId/reports/profit

Net profit report — revenue minus cost of goods sold and expenses.

**Query Params**: `from` · `to`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "revenue": "...",
    "costOfGoods": "...",
    "grossProfit": "...",
    "expenses": "...",
    "netProfit": "..."
  }
}
```

---

### GET /api/shops/:shopId/reports/profit-analysis

Gross profit broken down by product or category. Useful for identifying high-margin vs low-margin items.

**Query Params**: `from` · `to` · `groupBy` (`product`|`category`, default `product`) · pagination

**Response** `200`: Paginated list. Each row: `{ productId, productName, unitsSold, revenue, costOfGoods, grossProfit, margin% }`.

---

### GET /api/shops/:shopId/reports/product-sales

Units sold and revenue per product for the period.

**Query Params**: `from` · `to` · `categoryId` · `search` · pagination

**Response** `200`: Paginated list. Each row: `{ productId, productName, quantity, revenue, saleType }`.

---

### GET /api/shops/:shopId/reports/discounted-sales

All sales or sale items where a discount was applied.

**Query Params**: `from` · `to` · pagination

**Response** `200`: Paginated list of sale rows that have `sale_discount > 0` or any `sale_items.line_discount > 0`.

---

### GET /api/shops/:shopId/reports/purchases

Purchases summary — total spend, by supplier, by product.

**Query Params**: `from` · `to` · `supplierId` · pagination

**Response** `200`: Paginated list of `purchases` rows with totals.

---

### GET /api/shops/:shopId/reports/expenses

Expenses summary — total spend by category and period.

**Query Params**: `from` · `to` · `categoryId` · pagination

**Response** `200`: Paginated list of `expenses` rows with category totals.

---

### GET /api/shops/:shopId/reports/stock

Current stock levels across all products. Snapshot at time of request.

**Query Params**: `status` (`active`|`low`|`out_of_stock`) · `categoryId` · `search` · pagination

**Response** `200`: Paginated list. Each row: `{ productId, productName, quantity, reorderLevel, status, buyingPrice, sellingPrice }`.

---

### GET /api/shops/:shopId/reports/stock-movement

Product movement history — how stock changed over time (sales, purchases, adjustments, transfers).

**Query Params**: `from` · `to` · `productId` · pagination

**Response** `200`: Paginated list. Each row: `{ date, type (sale|purchase|adjustment|transfer|bad_stock), quantityChange, quantityAfter, reference }`.

---

### GET /api/shops/:shopId/reports/debtors

Customers with an outstanding balance — money owed to the shop.

**Query Params**: `from` · `to` · `search` · pagination

**Response** `200`: Paginated list of `customers` where `outstanding_balance > 0`. Each row includes all credit sales for that customer in the period.

---

### GET /api/shops/:shopId/reports/dues

Suppliers the shop owes money to (credit purchases not yet fully paid).

**Query Params**: `search` · pagination

**Response** `200`: Paginated list of `suppliers` where `outstanding_balance > 0` with a breakdown of the unpaid purchases.

---

### GET /api/shops/:shopId/reports/profit/yearly/:year

Monthly net profit breakdown for a full calendar year. Returns 12 monthly rows with revenue, COGS, bad stock write-off value, expenses, and net profit per month.

**Auth**: Admin

**Path Param**: `year` — 4-digit year e.g. `2024`.

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "months": [
      { "month": 1, "totalSales": "...", "profitOnSales": "...", "badStockValue": "...", "totalExpenses": "...", "netProfit": "..." }
    ],
    "yearTotals": { "totalSales": "...", "netProfit": "..." }
  }
}
```

---

### GET /api/shops/:shopId/reports/stock-value

Total current stock value (quantity × buying price) and estimated gross profit (quantity × selling–buying price difference) across all products.

**Auth**: Admin or Attendant

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalStockValue": "...",
    "profitEstimate": "...",
    "productCount": 120,
    "outOfStockCount": 5
  }
}
```

---

### GET /api/shops/:shopId/reports/stock-count-analysis

Cross-session analysis of stock count results — total variances, most over-counted and under-counted products, and value discrepancy.

**Auth**: Admin

**Query Params**: `from` + `to`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "sessionsReviewed": 12,
    "totalVarianceQty": -34,
    "totalVarianceValue": "...",
    "topDiscrepancies": [{ "productId": 1, "name": "...", "totalVariance": -8 }]
  }
}
```

---

### GET /api/shops/:shopId/reports/out-of-stock/export

Export a list of all current out-of-stock (or low-stock) products to an Excel (.xlsx) file for purchase ordering.

**Auth**: Admin

**Query Params**: `status` (`out_of_stock`|`low`, default `out_of_stock`)

**Response** `200`: Binary `.xlsx` file download with headers `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="out-of-stock.xlsx"`.

Columns: Product Name · SKU · Category · Current Qty · Reorder Level · Buying Price · Preferred Supplier.

---

### GET /api/shops/:shopId/reports/backup

Send the shop's current data dump as an email attachment to the admin's registered email. Used as a simple backup mechanism.

**Auth**: Admin

**Side Effects**: Generates a JSON snapshot of the shop's core tables (products, inventory, sales, purchases, customers, suppliers) and sends it via the transactional email service.

**Response** `200`: `{ "success": true, "message": "Backup sent to admin@example.com" }`

---

## 23. Sync — Offline Data Dump

The Pointify POS supports **offline-first** operation on mobile and desktop. This section covers the data-sync endpoints that let a local device download a full shop snapshot and push back accumulated offline changes.

---

### GET /api/sync/:shopId

Download a complete data dump for a shop — all products, inventory, customers, suppliers, sale/purchase records, settings, and lookup tables. The mobile/desktop app uses this to seed its local SQLite database on first install or after a reset.

**Auth**: Admin or Attendant

**Response** `200`: A large JSON object keyed by table name:
```json
{
  "success": true,
  "data": {
    "products": [...],
    "inventory": [...],
    "customers": [...],
    "suppliers": [...],
    "sales": [...],
    "saleItems": [...],
    "purchases": [...],
    "purchaseItems": [...],
    "categories": [...],
    "measures": [...],
    "paymentMethods": [...],
    "cashflowCategories": [...],
    "expenseCategories": [...],
    "settings": { ... },
    "syncMeta": { "generatedAt": "2024-01-01T00:00:00Z", "shopId": 1 }
  }
}
```

---

### POST /api/sync/dump

Push a batch of offline changes from the local device to the server. The client sends all locally created/updated records since the last sync. The server applies them in the correct dependency order inside a transaction.

**Auth**: Admin or Attendant token

**Request Body**:
```json
{
  "shopId": 1,
  "syncedAt": "2024-01-01T12:00:00Z",
  "sales": [...],
  "saleItems": [...],
  "purchases": [...],
  "purchaseItems": [...],
  "customers": [...],
  "expenses": [...],
  "cashflows": [...],
  "adjustments": [...],
  "badStocks": [...]
}
```

**Side Effects**: For each record: upsert by local device-generated ID (treated as idempotent). After each upsert, apply the same inventory/balance side effects as the individual REST endpoints. Return a `conflicts` array for records that could not be applied cleanly (e.g. insufficient stock at time of sync).

**Response** `200`:
```json
{ "success": true, "applied": 42, "skipped": 0, "conflicts": [] }
```

---

### POST /api/sync/dump/online

Upload a full export file (`.json` or `.csv`) from a standalone desktop database for import into the online account. Accepts `multipart/form-data` with a `file` field.

**Auth**: Admin

**Request Body**: `multipart/form-data`, field `file` — the export file.

**Response** `200`: `{ "success": true, "imported": { "sales": 120, "purchases": 45, ... } }`

---

### DELETE /api/sync/:shopId

Remove any temporary dump files generated for this shop on the server (cleanup after download).

**Auth**: Admin or Attendant

**Response** `200`: `{ "success": true }`

---

### GET /api/sync/database/init

Returns the minimal bootstrap data needed to initialize a fresh local database (lookup tables only — measures, categories, settings, payment methods). Does **not** include transaction history.

**Auth**: Admin or Attendant

**Response** `200`: Subset of the full dump containing only reference/lookup tables.

---

### GET /api/sync/checkupdate/desktop

Check whether a new version of the desktop app is available.

**Auth**: Public (or Admin token)

**Query Params**: `version` — the client's current semver string e.g. `1.4.2`

**Response** `200`:
```json
{ "hasUpdate": true, "latestVersion": "1.5.0", "downloadUrl": "https://..." }
```

---

## Appendix — Key Business Rules

### Cached Totals — Always Update in the Same Transaction

Several parent records cache derived totals. These **must** be kept in sync:

| Cached field | Updated when |
|---|---|
| `sales.amount_paid` | Sale payment added |
| `sales.outstanding_balance` | Sale payment added or sale created on credit |
| `sales.mpesa_total / bank_total / card_total` | Sale payment of that type added |
| `customers.outstanding_balance` | Credit sale created or payment received |
| `customers.wallet` | Wallet deposit/withdraw/payment/refund |
| `suppliers.outstanding_balance` | Credit purchase created or payment made |
| `suppliers.wallet` | Wallet deposit/withdraw |
| `purchases.amount_paid` | Purchase payment added |
| `purchases.outstanding_balance` | Purchase payment added |
| `affiliates.wallet` | **Incremented** when an award is created (subscription commission or manual bonus). **Decremented only when an admin approves a withdrawal** (`is_completed = true`), never on withdrawal request. |
| `banks.balance` | Cashflow linked to bank created or deleted |
| `email_messages.sent_count` | Campaign dispatched |

### Inventory Status Thresholds

After any inventory change, re-evaluate `inventory.status`:

```
quantity <= 0             → out_of_stock
quantity <= reorder_level → low
otherwise                 → active
```

### Auto-generated Reference Numbers

All reference numbers follow a consistent pattern and must be unique within their table:

| Field | Example |
|---|---|
| `sales.receipt_no` | `REC1234567` |
| `purchases.purchase_no` | `PUR1234567` |
| `orders.order_no` | `ORD1234567` |
| `expenses.expense_no` | `EXP1234567` |
| `cashflows.cashflow_no` | `CF1234567` |
| `product_transfers.transfer_no` | `TRF1234567` |
| `sale_returns.return_no` | `RET1234567` |
| `purchase_returns.return_no` | `PRR1234567` |
| `stock_requests.invoice_number` | `SR1234567` |
| `awards.payment_no` | `AWD1234567` |
| `subscriptions.invoice_no` | `INV1234567` |

### Circular Foreign Keys

These pairs reference each other. Both sides are plain integers (no `.references()`) to avoid circular dependency issues at the DB level. The application layer must maintain referential integrity:

| Table A | Field | Table B | Field | Why plain integer |
|---|---|---|---|---|
| `admins` | `attendant_id` | `attendants` | `admin_id` | True bidirectional reference — each row links to the other |
| `shops` | `admin_id` | `admins` | `primary_shop_id` | True bidirectional reference — shop owns admin, admin defaults to shop |
| `shops` | `subscription_id` | `subscription_shops` | `shop_id` | `shops.subscription_id` is a **denormalized cache** of the active subscription. Shops must be insertable before any subscription exists, so this cannot be a real FK. `subscription_shops.shop_id` IS a real FK to `shops.id`. |

### Soft Delete — Products

Products are never hard-deleted. Set `is_deleted = true`. All product list endpoints must filter `WHERE is_deleted = false` by default. Add a query param `includeDeleted=true` for admin views.

### Batch Traceability Chain

When `shop.track_batches = true`, the full traceability chain is:

```
purchases → purchase_items → batches → sale_item_batches → sale_items → sales
```

- Creating a purchase item with `batch_code` → creates a `batches` row → `purchase_items.batch_id` is set.
- Creating a sale item for a batch-tracked product → creates `sale_item_batches` rows → `batches.quantity` decremented per allocation.

### Credit Flow

```
paymentType = credit
  → sales.outstanding_balance = totalWithDiscount
  → customers.outstanding_balance += totalWithDiscount

POST /sales/:id/payments
  → sale_payments row inserted
  → sales.outstanding_balance -= amount
  → sales.amount_paid += amount
  → customers.outstanding_balance -= amount
  → if sales.outstanding_balance = 0: sales.status = cashed
```

### Affiliate Commission Flow

```
POST /subscriptions/:id/pay
  → subscriptions.is_paid = true
  → look up admins.affiliate_id
  → commission_amount = affiliates.commission% × subscriptions.amount
  → INSERT awards (type=earnings, award_type=subscription)
  → affiliates.wallet += commission_amount
  → INSERT affiliate_transactions (type=subscription)
```
