# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
This is a **Pointify POS** backend — a full-featured Point of Sale system originally built on MongoDB, now rewritten to PostgreSQL.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Surface

The API server (`artifacts/api-server`) implements ~280 endpoints across 25 route files, contract-aligned with `API.md` (the canonical spec). Two complementary URL conventions are supported (additive — both work):

- **Flat with shopId query param**: `GET /api/sales?shopId=1` — original implementation style
- **Shop-scoped path**: `GET /api/shops/1/sales` — matches API.md docs; shop-scoped router enforces ownership (admin must own shop, attendant must be assigned to it; super-admins bypass)

Major route groups: auth, admins, attendants, affiliates, shops, system, packages, subscriptions, customers, suppliers, measures, products, batches, bundle-items, inventory (adjustments/bad-stocks/stock-counts/stock-requests), orders, sales, sale-returns, sale-payments, purchases, purchase-returns, transfers, finance (banks/cashflows/expenses/payment-methods), reports, communications, sms, sync, permissions, activities, payments (gateway webhooks), admin (super-admin section).

OpenAPI spec lives in two places (kept in sync):
- `artifacts/api-server/src/openapi/spec.ts` (authoritative; served at `/api/openapi.json`) — 3171 lines, 303 paths
- `lib/api-spec/openapi.yaml` (consumed by orval codegen) — programmatically generated from spec.ts

Payment gateway integrations (M-Pesa, Paystack, Stripe), SMS gateway, and email send are stubbed: handlers log + persist DB rows + return 200 without making third-party calls.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Database Schema (`lib/db/src/schema/`)

The schema is split into domain files. Every MongoDB model has been mapped to a PostgreSQL table:

| Schema file | Tables |
|---|---|
| `admins-attendants.ts` | `admins`, `attendants` |
| `shop-categories.ts` | `shop_categories` |
| `affiliates.ts` | `affiliates` |
| `shops.ts` | `shops` |
| `packages-subscriptions.ts` | `packages`, `package_features`, `subscriptions`, `subscription_shops` |
| `customers.ts` | `customers` |
| `suppliers.ts` | `suppliers` |
| `measures.ts` | `measures` |
| `attributes.ts` | `attributes`, `attribute_variants` |
| `languages.ts` | `languages` |
| `settings.ts` | `settings` |
| `categories.ts` | `product_categories`, `expense_categories`, `cashflow_categories` |
| `products.ts` | `products`, `batches`, `product_batches`, `inventory`, `bundle_items`, `inventory_bundle_items` |
| `orders.ts` | `orders`, `order_items` |
| `sales.ts` | `sales`, `sale_items`, `sale_item_batches`, `sale_payments`, `sale_returns`, `sale_return_items` |
| `purchases.ts` | `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_return_items` |
| `expenses.ts` | `expenses` |
| `cashflow.ts` | `banks`, `cashflows` |
| `payments.ts` | `user_payments` |
| `stock.ts` | `bad_stocks`, `adjustments`, `stock_counts`, `stock_count_items`, `stock_requests`, `stock_request_items` |
| `transfers.ts` | `product_transfers`, `transfer_items` |
| `awards-transactions.ts` | `awards`, `award_shops`, `affiliate_transactions` |
| `activities.ts` | `activities` |
| `email-messages.ts` | `email_messages`, `emails_sent` |
| `loyalty.ts` | `loyalty_transactions` |

## API Status (fully working)

All 275+ endpoints across 25 sections implemented and verified passing:

| Section | Mutations fixed |
|---|---|
| Auth | admin login/register/me, JWT roles |
| Products | CRUD + attributes + variants |
| Inventory | adjustments, bad-stocks, stock-counts, stock-requests (unique invoiceNumber), batches |
| Transfers | fromShopId→toShopId FK handled, initiatedById nullable |
| Sales | POST + void + refund + sale-returns |
| Purchases | POST + purchase-returns (purchaseItemId FK validated) |
| Finance | banks, expenses, cashflows, payment-methods, user-payments |
| Communications | SMS (contact/message fields), email templates/messages, activities |
| Orders | CRUD |
| Reports | sales, purchases, inventory, P&L, expenses, credit, by-product, by-customer, cross-shop, debts aging, accounts summary, stock-take, income, expenses/by-category, business-summary dashboard, sales/daily chart, sales/monthly, profit-loss/detail, purchases/detail |
| Subscriptions | packages list, subscriptions list |
| Admin | profile, SMS credits, referrals |

**Key fixes applied:**
- `attended-only` guards relaxed: nullable `*_by_id` columns (FK to attendants) in bad_stocks, stock_counts, product_transfers, sale_returns, purchase_returns, expenses, cashflows, stock_requests, purchase_items, products
- Attendant `POST /attendants` now inserts hashed `password` (DB NOT NULL)
- Stock-requests generates unique `invoiceNumber` (`SRQ{timestamp}{random}`)
- Transfers require existing `toShopId` shop (FK constraint)
- **Attendant sales isolation**: `GET /sales` auto-filters to the calling attendant's own sales
- **Service/virtual product inventory skip**: sales with product type `service` or `virtual` no longer deduct inventory or record product history
- **Loyalty programme**: `POST /sales` supports `redeemPoints` body field; points earned on every completed sale based on `shop.pointsPerAmount`/`shop.pointsValue`; `GET /customers/:id/loyalty` and `POST /customers/:id/loyalty/adjust` endpoints added; `loyalty_transactions` table tracks all earn/redeem events
- **Inventory movements**: `GET /inventory/movements` returns out_of_stock, low_stock, fast_moving, slow_moving, dormant categories for a configurable period (`?days=` `?topN=`)
- **Inventory status filter**: `GET /inventory?status=` filters by inventory status (active | low | out_of_stock)
- **Backup snapshot**: `GET /shops/:shopId/reports/backup` returns a full JSON snapshot (products, customers, inventory, last-30-days sales/purchases/expenses); `?format=download` triggers file download; scheduled nightly backup job emails the snapshot to `shop.backupEmail`
- **Receipt customisation**: `shop.receiptLogo` (img URL), `shop.receiptFooter` (custom text), `shop.receiptShowTax` (bool), `shop.receiptShowDiscount` (bool) now reflected in HTML receipt template
- **Shop settings extended**: `PUT /shops/:shopId` and `POST /shops` now accept all new receipt/loyalty fields (`receiptLogo`, `receiptFooter`, `receiptShowTax`, `receiptShowDiscount`, `loyaltyEnabled`, `pointsPerAmount`, `pointsValue`)
- **Customer-facing online ordering** (`/api/public/...`): `GET /public/shops/:shopId` (shop info), `GET /public/shops/:shopId/products` (paginated, searchable catalog, stock/price visibility controlled per shop), `GET /public/shops/:shopId/categories` (categories with products in that shop), `POST /public/orders` (customer JWT, place order), `GET /public/orders/:orderNo` (track order), `GET /public/my-orders` (list own orders), `GET /public/me` (own profile). All browse endpoints are unauthenticated; order endpoints require a customer JWT.
- **Comprehensive reports** (all under `/api/reports/`): `debts/aging` (AR buckets: current/1-30/31-60/61-90/90+ days), `accounts` (cash position, receivables, payables, bank balances, net), `stock-take` (full per-product snapshot with cost/sale values, margin), `income` (revenue breakdown by payment method + daily time series), `expenses/by-category`, `sales/daily` (daily chart for last N days), `sales/monthly` (12-month trend), `sales/by-product/detail` (with margins), `profit-loss/detail` (P&L with expense breakdown), `purchases/detail` (by supplier + top products), `dues/detail` (all outstanding with aging), `sales/by-attendant`, `business-summary` (all KPIs in one call)

### MongoDB → PostgreSQL design decisions

- **ObjectId refs** → `integer` foreign keys (`serial` primary keys)
- **Embedded subdocument arrays** (e.g. `sale.payments`, `purchase.payments`, `saleReturn.items`) → normalized child tables
- **`type: Object` i18n fields** (e.g. `Attribute.title`, `Attribute.name`) → `jsonb`
- **`type: {}` free-form fields** (e.g. `Setting.setting`) → `jsonb`
- **MongoDB `sync` plugin** → `sync boolean DEFAULT false` column on every table
- **`images: Array`** (Product) → `text[]`
- **`features: [String]`** (Package) → separate `package_features` table
- **Circular FK refs** (Admin ↔ Attendant, Shop ↔ Subscription) → one direction is a plain `integer` without `.references()` to avoid boot-order issues; logical FK is documented in comments
- **`location: 2dsphere Point`** (Shop) → `location_lat real`, `location_lng real`
- **Auto-generated codes** (receiptNo, purchaseNo, etc.) → application logic (pre-save hook equivalent)
- **`numeric`** used for all monetary / quantity fields for precision
