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
