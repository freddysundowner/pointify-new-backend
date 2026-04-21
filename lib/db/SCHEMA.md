# Pointify Database Schema

**Stack:** PostgreSQL · Drizzle ORM · drizzle-zod · Zod v4  
**Package:** `@workspace/db` at `lib/db/`  
**Push command:** `pnpm --filter @workspace/db run push-force`

---

## Domain overview

| File | Tables | Purpose |
|---|---|---|
| `system.ts` | `shop_categories`, `settings` | Global reference and config data |
| `identity.ts` | `admins`, `attendants` | Shop owners and POS staff |
| `shop.ts` | `shops` | Physical/virtual shop locations |
| `subscriptions.ts` | `packages`, `package_features`, `subscriptions`, `subscription_shops` | Billing plans and active subscriptions |
| `affiliates.ts` | `affiliates`, `awards`, `award_shops`, `affiliate_transactions` | Referral partner network |
| `customers.ts` | `customers` | Shop customers |
| `suppliers.ts` | `suppliers` | Product suppliers |
| `catalog.ts` | `product_categories`, `attributes`, `attribute_variants`, `products`, `batches` | Product catalogue |
| `inventory.ts` | `inventory`, `bundle_items`, `adjustments`, `bad_stocks`, `stock_counts`, `stock_count_items`, `stock_requests`, `stock_request_items` | Stock tracking and warehouse ops |
| `orders.ts` | `orders`, `order_items` | Online/pre-orders before fulfilment |
| `sales.ts` | `sales`, `sale_items`, `sale_item_batches`, `sale_payments`, `sale_returns`, `sale_return_items` | POS sales and returns |
| `purchases.ts` | `purchases`, `purchase_items`, `purchase_payments`, `purchase_returns`, `purchase_return_items` | Stock purchasing from suppliers |
| `transfers.ts` | `product_transfers`, `transfer_items` | Inter-shop stock transfers |
| `finance.ts` | `expense_categories`, `cashflow_categories`, `expenses`, `banks`, `cashflows`, `user_payments` | Financial tracking |
| `communication.ts` | `email_messages`, `emails_sent`, `activities` | Email campaigns and audit log |

---

## Conventions

- **FK property names** drop the `Id` suffix: `shopId` → `shop`, `createdById` → `createdBy`.  
  DB column names keep the `_id` suffix: `shop_id`, `created_by_id`.
- **Boolean fields** use the `is_` prefix: `isActive`, `isWarehouse`, `isPaid`.
- **Circular FKs** (admin↔attendant, shop↔subscription) are plain `integer` columns with no `.references()` to avoid boot-order conflicts.
- **Monetary values** use `numeric(14, 2)` — never `float` or `real`.
- **Quantities** use `numeric(14, 4)` to support fractional units (kg, litres).
- **OTPs** are stored as `text` (leading zeros must be preserved).
- **OTP expiry** is a Unix timestamp in milliseconds stored as `bigint`.
- All tables have a `sync: boolean` column (used by offline-sync logic).

---

## system.ts

### `shop_categories`
System-wide business-type labels for shops (e.g. Supermarket, Pharmacy).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| is_active | boolean | default true |
| sync | boolean | |

### `settings`
Free-form key/value config store. `setting` is JSONB to hold any structure.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL UNIQUE | the config key |
| setting | jsonb | any structure |
| sync | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## identity.ts

> **Admin** = shop owner. Logs in with email + password. Has full access — no permission restrictions.  
> **Attendant** = cashier / staff. Logs in with PIN + password at the POS.  
> Every admin gets one attendant auto-created on registration for POS attribution (so sales made by the owner are recorded under their attendant). These auto-attendants are not login accounts — their `pin` and `password` are null.

### `attendants`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| username | text NOT NULL | display name on receipts and reports |
| pin | text | 4-digit PIN. **Null** on auto-created admin attendants |
| password | text | **Null** on auto-created admin attendants |
| permissions | text[] | e.g. `["sales","reports","expenses"]`. Null on admin attendants |
| admin_id | integer | FK → admins.id (plain int, circular) |
| shop_id | integer | FK → shops.id — one attendant, one shop |
| last_seen | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

### `admins`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| email | text NOT NULL UNIQUE | login credential |
| phone | text NOT NULL | |
| username | text | display name in the UI |
| password | text NOT NULL | |
| attendant_id | integer | FK → attendants.id (plain int, circular) — auto-created attendant |
| primary_shop_id | integer | FK → shops.id (plain int) — default shop |
| affiliate_id | integer | FK → affiliates.id — set if registered via affiliate link |
| referred_by_id | integer | FK → admins.id — self-referential referral |
| referral_credit | numeric(14,2) | credit earned from referrals; offsets subscription payments |
| sync_mode | text | `online` / `offline` / `hybrid` — controls data sync behaviour |
| sync_interval | integer | sync polling interval in seconds |
| otp | text | verification OTP (text to preserve leading zeros) |
| otp_expiry | bigint | Unix ms timestamp when the OTP expires |
| email_verified | boolean | |
| phone_verified | boolean | |
| email_verification_date | timestamp | |
| auto_print | boolean | default true — auto-print receipts |
| platform | text | `ios` / `android` / `web` |
| app_version | text | installed app version |
| last_app_rating_date | timestamp | last time the admin was prompted for an app-store rating |
| last_subscription_reminder | timestamp | |
| last_subscription_reminder_count | integer | |
| last_seen | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

---

## shop.ts

> A shop is a single physical or virtual location operated by an Admin. One admin can own multiple shops.

### `shops`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| address | text | physical address |
| receipt_address | text | address line printed on receipts (may differ from shop address) |
| shop_category_id | integer | FK → shop_categories.id |
| admin_id | integer | FK → admins.id (plain int, circular) |
| subscription_id | integer | FK → subscriptions.id (plain int, circular) — active subscription |
| affiliate_id | integer | FK → affiliates.id (plain int) |
| location_lat | real | GPS latitude |
| location_lng | real | GPS longitude |
| currency | text | e.g. `KES`, `USD` |
| contact | text | phone number |
| tax_rate | numeric(6,2) | VAT/sales-tax percentage for taxable products |
| paybill_till | text | M-Pesa paybill or till number |
| paybill_account | text | M-Pesa account number |
| receipt_email | text | email to receive receipt copies |
| warehouse_email | text | email for warehouse notifications |
| backup_email | text | email for data backups |
| backup_interval | text | backup frequency |
| backup_date | timestamp | last backup date |
| show_stock_online | boolean | show stock levels on online storefront |
| show_price_online | boolean | show prices on online storefront |
| is_warehouse | boolean | this shop acts as a warehouse for other shops |
| is_production | boolean | this is a manufacturing/production unit, not retail |
| allow_backup | boolean | default true |
| use_warehouse | boolean | this shop pulls stock from a warehouse |
| track_batches | boolean | enable batch/lot tracking for products |
| allow_online_selling | boolean | default true |
| allow_negative_selling | boolean | allow sales when stock is zero |
| delete_warning_count | integer | soft-delete safety counter |
| created_at | timestamp | |
| sync | boolean | |

---

## subscriptions.ts

> A **package** is a billing plan offered by Pointify (e.g. "Monthly Pro — KES 2,500").  
> A **subscription** is a record of an admin purchasing a package for a shop. One subscription can cover multiple shops via `subscription_shops`.

### `packages`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| title | text NOT NULL | plan display name |
| description | text | |
| duration_value | integer NOT NULL | numeric duration (e.g. 1, 3, 12) |
| duration_unit | text NOT NULL | `days` / `weeks` / `months` / `years` |
| amount | numeric(14,2) NOT NULL | price in local currency |
| amount_usd | numeric(14,2) NOT NULL | price in USD |
| discount | numeric(6,2) | percentage discount |
| is_active | boolean | default true |
| sort_order | integer | display ordering |
| type | text NOT NULL | `trial` / `production` |
| max_shops | integer | maximum shops covered |
| sync | boolean | |

### `package_features`
Feature bullet points for a package (e.g. "Unlimited products").

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| package_id | integer NOT NULL | FK → packages.id (cascade delete) |
| feature | text NOT NULL | |

### `subscriptions`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| admin_id | integer NOT NULL | FK → admins.id (plain int) |
| shop_id | integer NOT NULL | FK → shops.id (primary shop for this subscription) |
| package_id | integer NOT NULL | FK → packages.id |
| mpesa_code | text | M-Pesa payment reference |
| amount | numeric(14,2) | amount paid |
| invoice_no | text | invoice reference |
| type | text | |
| is_active | boolean | default false |
| commission | numeric(14,2) | affiliate commission on this subscription |
| currency | text | default `kes` |
| is_paid | boolean | default false |
| start_date | timestamp NOT NULL | |
| end_date | timestamp | null = no expiry |
| created_at | timestamp | |
| sync | boolean | |

### `subscription_shops`
Links additional shops to a subscription (multi-branch plans).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| subscription_id | integer NOT NULL | FK → subscriptions.id (cascade delete) |
| shop_id | integer NOT NULL | FK → shops.id (plain int) |

---

## affiliates.ts

> An **affiliate** is a referral partner external to Pointify who earns commission when admins they referred subscribe.  
> **Awards** are commission payments earned. **Affiliate transactions** record wallet withdrawals and subscription credits.

### `affiliates`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| phone_number | text | |
| email | text | |
| address | text | |
| country | text | |
| password | text | login password |
| commission | numeric(10,2) | commission rate %, default 20 |
| wallet | numeric(14,2) | accumulated earnings balance |
| is_blocked | boolean | |
| is_active | boolean | |
| code | text UNIQUE | referral code used in sign-up links |
| otp | text | |
| otp_expiry | bigint | Unix ms |
| created_at | timestamp | |
| sync | boolean | |

### `awards`
A commission payment record for an affiliate.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| total_amount | numeric(14,2) | gross amount |
| balance | numeric(14,2) | remaining unpaid balance |
| mpesa_code | text | |
| payment_no | text UNIQUE | auto-generated reference (e.g. `REC1234`) |
| currency | text | default `kes` |
| type | text NOT NULL | `earnings` / `usage` |
| award_type | text | `open_shop` / `subscription` |
| shop_id | integer | FK → shops.id (plain int) |
| owner_id | integer | FK → affiliates.id — the benefiting affiliate |
| affiliate_id | integer | FK → affiliates.id — the source/referring affiliate |
| from_admin_id | integer | FK → admins.id — admin who triggered the award |
| created_at | timestamp | |
| sync | boolean | |

### `award_shops`
Shops associated with a particular award.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| award_id | integer NOT NULL | FK → awards.id (cascade delete) |
| shop_id | integer NOT NULL | FK → shops.id (plain int) |

### `affiliate_transactions`
Wallet movements for an affiliate (withdrawals or subscription credits).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| amount | numeric(14,2) | transaction amount |
| affiliate_amount | numeric(14,2) | affiliate's share |
| balance | numeric(14,2) | wallet balance after transaction |
| trans_id | text | external transaction ID |
| mpesa_code | text | |
| type | text NOT NULL | `withdraw` / `subscription` |
| is_completed | boolean | |
| affiliate_id | integer | FK → affiliates.id |
| admin_id | integer | FK → admins.id |
| created_at | timestamp | |
| sync | boolean | |

---

## customers.ts

### `customers`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| phone_number | text | |
| email | text | |
| address | text | |
| password | text | for customer portal login |
| type | text | `retail` / `wholesale` / `dealer` |
| credit_limit | numeric(14,2) | max outstanding credit allowed |
| wallet | numeric(14,2) | prepaid wallet balance |
| shop_id | integer | FK → shops.id |
| created_by_id | integer | FK → attendants.id |
| customer_no | integer UNIQUE | auto-generated customer number |
| otp | text | |
| otp_expiry | bigint | Unix ms |
| created_at | timestamp | |
| sync | boolean | |

---

## suppliers.ts

### `suppliers`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| phone_number | text | |
| email | text | |
| address | text | |
| wallet | numeric(14,2) | credit balance with supplier |
| shop_id | integer NOT NULL | FK → shops.id |
| created_at | timestamp | |
| sync | boolean | |

---

## catalog.ts

### `product_categories`
Admin-scoped product categories.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| admin_id | integer NOT NULL | FK → admins.id |
| sync | boolean | |

### `attributes`
Product attribute definitions (e.g. Color, Size). `title` and `name` are JSONB i18n maps `{ en: "Color", sw: "Rangi" }`.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| title | jsonb NOT NULL | i18n display label |
| name | jsonb NOT NULL | i18n machine name |
| input_type | text | `Dropdown` / `Radio` / `Checkbox` |
| type | text | `attribute` / `extra` |
| status | text | `show` / `hide` |
| sync | boolean | |
| created_at / updated_at | timestamp | |

### `attribute_variants`
The selectable values for an attribute (e.g. Red, Blue for Color).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| attribute_id | integer NOT NULL | FK → attributes.id (cascade delete) |
| name | jsonb | i18n name |
| status | text | `show` / `hide` |

### `products`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| buying_price | numeric(14,2) | cost price |
| selling_price | numeric(14,2) | default retail price |
| wholesale_price | numeric(14,2) | |
| dealer_price | numeric(14,2) | |
| min_selling_price | numeric(14,2) | floor price (discount limit) |
| max_discount | numeric(14,2) | maximum allowed discount |
| quantity | numeric(14,4) | current stock level |
| last_count | numeric(14,4) | stock level at last stock count |
| reorder_level | numeric(14,4) | low-stock alert threshold |
| product_category_id | integer | FK → product_categories.id |
| measure_unit | text | free-text unit (e.g. `kg`, `box`, `piece`) |
| manufacturer | text | |
| supplier_id | integer | FK → suppliers.id |
| shop_id | integer | FK → shops.id |
| created_by_id | integer NOT NULL | FK → attendants.id |
| admin_id | integer | FK → admins.id |
| description | text | |
| thumbnail_url | text | |
| images | text[] | array of image URLs |
| barcode | text | |
| serial_number | text | |
| product_type | text | `product` / `bundle` / `virtual` / `service` |
| is_deleted | boolean | soft delete |
| is_virtual | boolean | |
| is_bundle | boolean | |
| manage_by_price | boolean | price-based stock management |
| is_taxable | boolean | VAT applies |
| last_count_date | timestamp | |
| expiry_date | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

### `batches`
Stock batches/lots for products (used when `track_batches` is enabled on the shop).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products.id |
| shop_id | integer | FK → shops.id |
| buying_price | numeric(14,2) | cost price for this batch |
| quantity | numeric(14,4) | remaining quantity |
| total_quantity | numeric(14,4) | original quantity received |
| expiration_date | timestamp | |
| batch_code | text UNIQUE | auto-generated (e.g. `BCH-123456`) |
| created_at | timestamp | |
| sync | boolean | |

---

## inventory.ts

### `inventory`
Per-shop stock record for a product. One row per product-shop combination.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products.id |
| shop_id | integer | FK → shops.id |
| updated_by_id | integer NOT NULL | FK → attendants.id |
| quantity | numeric(14,4) | current stock level |
| last_count | numeric(14,4) | quantity at last stock count |
| reorder_level | numeric(14,4) | low-stock threshold |
| is_bundle | boolean | |
| type | text | `in` / `out` / `adjustment` |
| status | text | `active` / `low` / `out_of_stock` |
| barcode | text | auto-generated UUID barcode |
| last_count_date | timestamp | |
| expiry_date | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

### `bundle_items`
Component products that make up a bundle.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| inventory_id | integer | FK → inventory.id |
| product_id | integer | FK → products.id — the bundle product |
| component_product_id | integer | FK → products.id — the component |
| quantity | numeric(14,4) | quantity of component per bundle |
| created_at | timestamp | |
| sync | boolean | |

### `adjustments`
Audit log of manual stock adjustments.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer NOT NULL | FK → products.id |
| shop_id | integer NOT NULL | FK → shops.id |
| type | text | `add` / `remove` |
| quantity_before | numeric(14,4) NOT NULL | |
| quantity_after | numeric(14,4) NOT NULL | |
| quantity_adjusted | numeric(14,4) NOT NULL | |
| created_at | timestamp | |
| sync | boolean | |

### `bad_stocks`
Write-off records for damaged/expired/lost stock.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer NOT NULL | FK → products.id |
| shop_id | integer NOT NULL | FK → shops.id |
| written_off_by_id | integer NOT NULL | FK → attendants.id |
| quantity | numeric(14,4) NOT NULL | |
| unit_price | numeric(14,2) NOT NULL | value at time of write-off |
| reason | text NOT NULL | |
| created_at | timestamp | |
| sync | boolean | |

### `stock_counts`
A stock-take session (header record).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| conducted_by_id | integer NOT NULL | FK → attendants.id |
| shop_id | integer NOT NULL | FK → shops.id |
| created_at | timestamp | |
| sync | boolean | |

### `stock_count_items`
Individual product lines within a stock-take session.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| stock_count_id | integer NOT NULL | FK → stock_counts.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| physical_count | numeric(14,4) NOT NULL | counted by hand |
| system_count | numeric(14,4) NOT NULL | what the system recorded |
| variance | numeric(14,4) NOT NULL | physical − system |
| created_at | timestamp | |

### `stock_requests`
A request from a branch shop to pull stock from a warehouse.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| requested_by_id | integer NOT NULL | FK → attendants.id |
| accepted_by_id | integer | FK → attendants.id |
| approved_by_id | integer | FK → attendants.id |
| status | text | `pending` / `processed` / `correction` / `void` / `completed` |
| from_shop_id | integer NOT NULL | FK → shops.id — requesting shop |
| warehouse_id | integer NOT NULL | FK → shops.id — supplying warehouse |
| total_value | numeric(14,2) | total value of requested items |
| invoice_number | text UNIQUE | auto-generated (e.g. `INV123456`) |
| accepted_at | timestamp | |
| dispatched_at | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

### `stock_request_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| stock_request_id | integer NOT NULL | FK → stock_requests.id (cascade delete) |
| inventory_id | integer | FK → inventory.id |
| product_id | integer | FK → products.id |
| quantity_requested | numeric(14,4) NOT NULL | |
| quantity_received | numeric(14,4) | default 0 |
| sync | boolean | |

---

## orders.ts

> An order is a pre-sale created before the goods are physically collected or paid for (e.g. online order, layaway).

### `orders`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| receipt_no | text UNIQUE | auto-generated reference |
| status | text | `pending` / `processing` / `completed` / `cancelled` |
| shop_id | integer NOT NULL | FK → shops.id |
| customer_id | integer | FK → customers.id |
| created_at | timestamp | |
| sync | boolean | |

### `order_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| order_id | integer NOT NULL | FK → orders.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| quantity | numeric(14,4) NOT NULL | |
| unit_price | numeric(14,2) NOT NULL | price at time of order |
| sync | boolean | |

---

## sales.ts

### `sales`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| receipt_no | text UNIQUE | auto-generated |
| total_amount | numeric(14,2) NOT NULL | gross total before discount |
| total_with_discount | numeric(14,2) NOT NULL | net total after discount |
| total_tax | numeric(14,2) | VAT amount |
| mpesa_total | numeric(14,2) | portion paid via M-Pesa |
| bank_total | numeric(14,2) | portion paid via bank |
| amount_paid | numeric(14,2) | total received |
| sale_discount | numeric(14,2) | sale-level discount |
| outstanding_balance | numeric(14,2) | amount still owed (credit sales) |
| sale_type | text | `Retail` / `Dealer` / `Wholesale` / `Order` |
| payment_type | text | `cash` / `credit` / `wallet` / `mpesa` / `later` / `card` / `bank` / `split` |
| payment_tag | text | same enum as payment_type |
| status | text | `cashed` / `credit` / `refunded` / `voided` |
| order_ref | text | reference to originating order |
| sale_note | text | free-text note on the sale |
| due_date | timestamp | for credit sales — when payment is due |
| shop_id | integer NOT NULL | FK → shops.id |
| customer_id | integer | FK → customers.id |
| attendant_id | integer | FK → attendants.id — who made the sale |
| order_id | integer | FK → orders.id — originating order if any |
| batch_id | integer | FK → batches.id |
| created_at | timestamp | |
| sync | boolean | |

### `sale_items`
Individual product lines within a sale.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer | FK → sales.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| attendant_id | integer | FK → attendants.id |
| shop_id | integer NOT NULL | FK → shops.id |
| quantity | numeric(14,4) NOT NULL | |
| unit_price | numeric(14,2) NOT NULL | |
| tax | numeric(14,2) | line-level tax |
| line_discount | numeric(14,2) | |
| sale_note | text | |
| status | text | mirrors parent sale status |
| sale_type | text | mirrors parent sale type |
| payment_tag | text | |
| created_at | timestamp | |
| sync | boolean | |

### `sale_item_batches`
Batch allocations for a sale line (when batch tracking is on).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_item_id | integer NOT NULL | FK → sale_items.id (cascade delete) |
| batch_id | integer NOT NULL | FK → batches.id |
| quantity_taken | numeric(14,4) | quantity drawn from this batch |

### `sale_payments`
Individual payment instalments on a sale (supports split and partial payments).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer NOT NULL | FK → sales.id (cascade delete) |
| received_by_id | integer NOT NULL | FK → attendants.id |
| amount | numeric(14,2) NOT NULL | |
| balance | numeric(14,2) | remaining after this payment |
| payment_no | text | reference number |
| mpesa_code | text | |
| payment_type | text | |
| paid_at | timestamp | |

### `sale_returns`
Header record for a return/refund on a sale.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer NOT NULL | FK → sales.id |
| customer_id | integer | FK → customers.id |
| processed_by_id | integer NOT NULL | FK → attendants.id |
| shop_id | integer NOT NULL | FK → shops.id |
| refund_amount | numeric(14,2) NOT NULL | |
| reason | text | |
| return_no | text UNIQUE | auto-generated (e.g. `RTN-1234567`) |
| created_at | timestamp | |
| sync | boolean | |

### `sale_return_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_return_id | integer NOT NULL | FK → sale_returns.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| quantity | numeric(14,4) NOT NULL | |
| unit_price | numeric(14,2) NOT NULL | |

---

## purchases.ts

### `purchases`
A stock purchase from a supplier (goods received).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| purchase_no | text UNIQUE | auto-generated reference |
| total_amount | numeric(14,2) | |
| amount_paid | numeric(14,2) | |
| outstanding_balance | numeric(14,2) | amount still owed to supplier |
| payment_type | text NOT NULL | `cash` / `credit` / `mpesa` / `bank` |
| shop_id | integer NOT NULL | FK → shops.id |
| supplier_id | integer | FK → suppliers.id |
| created_by_id | integer | FK → attendants.id |
| created_at | timestamp | |
| sync | boolean | |

### `purchase_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| purchase_id | integer | FK → purchases.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| shop_id | integer | FK → shops.id |
| received_by_id | integer NOT NULL | FK → attendants.id |
| quantity | numeric(14,4) | |
| unit_price | numeric(14,2) NOT NULL | cost price at time of purchase |
| line_discount | numeric(14,2) | |
| created_at | timestamp | |
| sync | boolean | |

### `purchase_payments`
Payment instalments on a purchase (for credit purchases).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| purchase_id | integer NOT NULL | FK → purchases.id (cascade delete) |
| paid_by_id | integer NOT NULL | FK → attendants.id |
| amount | numeric(14,2) NOT NULL | |
| balance | numeric(14,2) | remaining after payment |
| payment_no | text | |
| paid_at | timestamp | |

### `purchase_returns`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| purchase_id | integer NOT NULL | FK → purchases.id |
| supplier_id | integer | FK → suppliers.id |
| processed_by_id | integer NOT NULL | FK → attendants.id |
| shop_id | integer NOT NULL | FK → shops.id |
| payment_type | text | |
| refund_amount | numeric(14,2) NOT NULL | |
| reason | text | |
| return_no | text UNIQUE | auto-generated (e.g. `RTN-1234`) |
| created_at | timestamp | |
| sync | boolean | |

### `purchase_return_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| purchase_return_id | integer NOT NULL | FK → purchase_returns.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| quantity | numeric(14,4) NOT NULL | |
| unit_price | numeric(14,2) NOT NULL | |

---

## transfers.ts

> Inter-shop stock transfers — moving goods from one shop (or warehouse) to another.

### `product_transfers`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| initiated_by_id | integer NOT NULL | FK → attendants.id |
| from_shop_id | integer NOT NULL | FK → shops.id |
| to_shop_id | integer NOT NULL | FK → shops.id |
| created_at | timestamp | |
| sync | boolean | |

### `transfer_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| transfer_id | integer NOT NULL | FK → product_transfers.id (cascade delete) |
| product_id | integer NOT NULL | FK → products.id |
| quantity | numeric(14,4) NOT NULL | |

---

## finance.ts

### `expense_categories`
Shop-scoped categories for expenses (e.g. Utilities, Rent, Salaries).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| shop_id | integer | FK → shops.id |
| created_at | timestamp | |
| sync | boolean | |

### `cashflow_categories`
Categories for cash-in / cash-out movements (e.g. Till Opening, Petty Cash).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| shop_id | integer | FK → shops.id |
| type | text NOT NULL | `cashin` / `cashout` |
| created_at | timestamp | |
| sync | boolean | |

### `expenses`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| description | text | |
| amount | numeric(14,2) | |
| shop_id | integer | FK → shops.id |
| recorded_by_id | integer NOT NULL | FK → attendants.id |
| category_id | integer | FK → expense_categories.id |
| is_recurring | boolean | auto-saves on a schedule |
| frequency | text | `daily` / `weekly` / `monthly` |
| next_occurrence_at | timestamp | when to auto-save next |
| created_at | timestamp | |
| sync | boolean | |

### `banks`
Bank accounts or mobile money wallets tracked per shop.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | account name |
| balance | numeric(14,2) NOT NULL | current balance |
| shop_id | integer NOT NULL | FK → shops.id |
| created_at | timestamp | |
| sync | boolean | |

### `cashflows`
Cash-in or cash-out movements recorded against a shop.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| description | text NOT NULL | |
| amount | numeric(14,2) NOT NULL | |
| category_id | integer | FK → cashflow_categories.id |
| recorded_by_id | integer NOT NULL | FK → attendants.id |
| shop_id | integer NOT NULL | FK → shops.id |
| bank_id | integer | FK → banks.id — associated bank account |
| created_at | timestamp | |
| sync | boolean | |

### `user_payments`
Wallet deposits, withdrawals, and payments for customers and suppliers.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| payment_no | text UNIQUE | auto-generated (e.g. `REC1234567`) |
| total_amount | numeric(14,2) | |
| balance | numeric(14,2) | wallet balance after transaction |
| mpesa_code | text | |
| payment_type | text | |
| type | text NOT NULL | `deposit` / `withdraw` / `payment` / `refund` |
| shop_id | integer | FK → shops.id |
| processed_by_id | integer | FK → attendants.id |
| customer_id | integer | FK → customers.id |
| supplier_id | integer | FK → suppliers.id |
| admin_id | integer | FK → admins.id |
| created_at | timestamp | |
| sync | boolean | |

---

## communication.ts

### `email_messages`
Email campaign templates.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | internal template name |
| subject | text NOT NULL | email subject line |
| body | text NOT NULL | email HTML/text body |
| is_scheduled | boolean | whether this sends on a schedule |
| interval | text | `daily` / `once_weekly` / `monthly` |
| campaign | text | campaign tag |
| type | text | |
| audience | text | `subscribers` / `all` / `expired` / `dormant` / `custom` |
| audience_address | text | comma-separated email addresses for `custom` audience |
| sent_count | integer | number of times this template has been sent |
| created_at | timestamp | |
| sync | boolean | |

### `emails_sent`
Log of each batch send (one row per send event).

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| subject | text NOT NULL | subject used (may differ from template if edited) |
| email_template_id | integer | FK → email_messages.id (set null on delete) |
| recipient_count | integer | number of recipients in this send |
| created_at | timestamp | |
| sync | boolean | |

### `activities`
Audit log of attendant actions within a shop.

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| action | text NOT NULL | description of the action taken |
| shop_id | integer NOT NULL | FK → shops.id |
| attendant_id | integer NOT NULL | FK → attendants.id |
| created_at | timestamp | |
| sync | boolean | |
