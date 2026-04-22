# Pointify Database Schema

---

## identity.ts

### admins
The shop owner. Logs in with email + password. Full access, no permissions needed.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| email | text | unique, login credential |
| phone | text | |
| username | text | display name in the UI |
| password | text | |
| attendant_id | integer | auto-created attendant for this admin |
| primary_shop_id | integer | default shop |
| affiliate_id | integer | set if registered via affiliate link |
| referred_by_id | integer | which admin referred this one |
| referral_credit | numeric(14,2) | offsets subscription payments |
| otp | text | |
| otp_expiry | bigint | unix ms |
| email_verified | boolean | |
| phone_verified | boolean | |
| email_verification_date | timestamp | |
| auto_print | boolean | auto-print receipts, default true |
| platform | text | ios / android / web |
| app_version | text | |
| last_seen | timestamp | |
| created_at | timestamp | |

### attendants
Cashier / staff. Logs in with PIN + password at the POS.  
Every admin gets one auto-created attendant for sale attribution — these have no PIN or password and cannot log in.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| username | text | display name on receipts |
| pin | text | null on admin-owned attendants |
| password | text | null on admin-owned attendants |
| permissions | text[] | e.g. ["sales","reports"]. null on admin-owned |
| admin_id | integer | owning admin |
| shop_id | integer | one attendant, one shop |
| last_seen | timestamp | |
| created_at | timestamp | |

---

## shop.ts

### shops
A single physical or virtual location operated by an admin. One admin can own multiple shops.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| address | text | physical address |
| receipt_header | text | address/text printed on customer receipts |
| category | integer | FK → shop_categories.id |
| admin_id | integer | owning admin |
| subscription_id | integer | active subscription (circular FK) |
| location_lat | real | GPS latitude |
| location_lng | real | GPS longitude |
| currency | text | |
| contact | text | |
| tax_rate | numeric(6,2) | VAT / sales-tax % applied to taxable products |
| paybill_till | text | M-Pesa till number |
| paybill_account | text | M-Pesa account |
| receipt_email | text | email receipts are sent from |
| backup_email | text | email for data backups |
| backup_interval | text | how often backups run |
| backup_date | timestamp | last backup time |
| show_stock_online | boolean | |
| show_price_online | boolean | |
| warehouse | boolean | is this shop a warehouse |
| allow_backup | boolean | default true |
| track_batches | boolean | enables batch/expiry tracking |
| online_selling | boolean | default true |
| negative_selling | boolean | allow sales below zero stock, default false |
| created_at | timestamp | |

---

## subscriptions.ts

### packages
Subscription plans available to admins.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| title | text | |
| description | text | |
| duration_value | integer | e.g. 1, 3, 12 |
| duration_unit | text | days / weeks / months / years |
| amount | numeric(14,2) | local currency |
| amount_usd | numeric(14,2) | USD equivalent |
| discount | numeric(6,2) | |
| is_active | boolean | |
| sort_order | integer | display order |
| type | text | trial / production |
| shops | integer | max shops this plan covers |

### package_features
One row per feature per package.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| package_id | integer | FK → packages, cascades on delete |
| feature | text | |

### subscriptions
A billing record created when an admin subscribes.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| admin_id | integer | owning admin |
| package_id | integer | FK → packages |
| mpesa_code | text | M-Pesa payment reference |
| amount | numeric(14,2) | amount charged |
| invoice_no | text | |
| is_active | boolean | |
| is_paid | boolean | |
| currency | text | default kes |
| start_date | timestamp | |
| end_date | timestamp | |
| created_at | timestamp | |

### subscription_shops
Maps one subscription to the shops it covers (multi-branch plans).

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| subscription_id | integer | FK → subscriptions, cascades on delete |
| shop_id | integer | |

---

## catalog.ts

### product_categories
| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| admin_id | integer | FK → admins |

### products
Defines what a product IS. One record per product per shop. Stock levels live in `inventory`, not here.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| buying_price | numeric(14,2) | |
| selling_price | numeric(14,2) | |
| wholesale_price | numeric(14,2) | |
| dealer_price | numeric(14,2) | |
| min_selling_price | numeric(14,2) | |
| max_discount | numeric(14,2) | |
| product_category_id | integer | FK → product_categories |
| measure_unit | text | |
| manufacturer | text | |
| supplier_id | integer | FK → suppliers |
| shop_id | integer | FK → shops |
| created_by_id | integer | FK → attendants |
| description | text | |
| thumbnail_url | text | |
| images | text[] | |
| barcode | text | |
| sku | text | model / reference code |
| product_type | text | product / bundle / virtual / service |
| is_deleted | boolean | |
| manage_by_price | boolean | |
| is_taxable | boolean | |
| expiry_date | timestamp | fallback when batch tracking is off |
| created_at | timestamp | |

### inventory
Per-shop stock record. Always created alongside its product (1:1 with products).  
Single source of truth for stock levels — never products.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| updated_by_id | integer | FK → attendants |
| quantity | numeric(14,4) | current stock |
| reorder_level | numeric(14,4) | alert threshold |
| last_count | numeric(14,4) | last physical count qty |
| last_count_date | timestamp | |
| status | text | active / low / out_of_stock |
| created_at | timestamp | |

### batches
Individual stock lots per product per shop. Used when `shop.track_batches = true`.  
`inventory.quantity` = SUM of all batch quantities when batch tracking is on.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| buying_price | numeric(14,2) | cost for this lot |
| quantity | numeric(14,4) | remaining in this batch |
| total_quantity | numeric(14,4) | original received qty |
| expiration_date | timestamp | |
| batch_code | text | unique |
| created_at | timestamp | |

### product_serials
Individual unit serials for serialised products (phones, laptops, etc.).  
Serial tracking is implicit — if a product has rows here, it is serialised.  
Sales line items reference the serial sold.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| serial_number | text | |
| status | text | available / sold / returned / void |
| created_at | timestamp | |

### bundle_items
Defines the components that make up a bundle product.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | the bundle product |
| component_product_id | integer | the component product |
| quantity | numeric(14,4) | how many of this component |
| created_at | timestamp | |

### adjustments
Audit log of manual stock changes outside of sales or purchases.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| adjusted_by_id | integer | FK → attendants |
| type | text | add / remove |
| quantity_before | numeric(14,4) | |
| quantity_after | numeric(14,4) | |
| quantity_adjusted | numeric(14,4) | |
| reason | text | |
| created_at | timestamp | |

### bad_stocks
Records damaged, expired, or lost stock written off.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| written_off_by_id | integer | FK → attendants |
| quantity | numeric(14,4) | |
| unit_price | numeric(14,2) | |
| reason | text | |
| created_at | timestamp | |

### stock_counts + stock_count_items
A physical stock count session with its line items.

| stock_counts | Type | Notes |
|---|---|---|
| id | serial PK | |
| conducted_by_id | integer | FK → attendants |
| shop_id | integer | FK → shops |
| created_at | timestamp | |

| stock_count_items | Type | Notes |
|---|---|---|
| id | serial PK | |
| stock_count_id | integer | FK → stock_counts, cascades |
| product_id | integer | FK → products |
| physical_count | numeric(14,4) | what was physically counted |
| system_count | numeric(14,4) | what the system recorded |
| variance | numeric(14,4) | difference |
| created_at | timestamp | |

### stock_requests + stock_request_items
A shop requests stock from a warehouse.

| stock_requests | Type | Notes |
|---|---|---|
| id | serial PK | |
| requested_by_id | integer | FK → attendants |
| accepted_by_id | integer | FK → attendants |
| approved_by_id | integer | FK → attendants |
| status | text | pending / processed / correction / void / completed |
| from_shop_id | integer | requesting shop |
| warehouse_id | integer | supplying warehouse |
| total_value | numeric(14,2) | |
| invoice_number | text | unique |
| accepted_at | timestamp | |
| dispatched_at | timestamp | |
| created_at | timestamp | |

| stock_request_items | Type | Notes |
|---|---|---|
| id | serial PK | |
| stock_request_id | integer | FK → stock_requests, cascades |
| product_id | integer | FK → products |
| quantity_requested | numeric(14,4) | |
| quantity_received | numeric(14,4) | |

---

## sales.ts

### Overview

Sales flow: `sales` → `sale_items` → `sale_item_batches` (if batch tracking on)  
Payment flow: `sales` ← `sale_payments` (one row per instalment / method)  
Return flow: `sale_returns` → `sale_return_items` → back-references `sale_items`

All monetary amounts are `numeric(14,2)`. All quantities are `numeric(14,4)` to support fractional units (kg, litres).

---

### sales
The top-level record for every transaction. Created once and generally never edited after the fact.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| receipt_no | text | unique — generate before insert (e.g. REC-20240101-0001) |
| total_amount | numeric(14,2) | NOT NULL — SUM(unit_price × quantity − line_discount) across all sale_items |
| total_with_discount | numeric(14,2) | NOT NULL — total_amount − sale_discount (what the customer actually owes) |
| total_tax | numeric(14,2) | SUM(tax) across all sale_items |
| sale_discount | numeric(14,2) | bill-level discount applied after line discounts |
| amount_paid | numeric(14,2) | cached — SUM(sale_payments.amount). Update on every payment insert |
| mpesa_total | numeric(14,2) | cached — SUM of sale_payments where payment_type = mpesa |
| bank_total | numeric(14,2) | cached — SUM of sale_payments where payment_type = bank |
| card_total | numeric(14,2) | cached — SUM of sale_payments where payment_type = card |
| outstanding_balance | numeric(14,2) | cached — total_with_discount − amount_paid. Key field for credit tracking |
| sale_type | text | Retail / Dealer / Wholesale / Order — default Retail |
| payment_type | text | cash / credit / mpesa / card / bank / split — set split when multiple methods used |
| status | text | cashed / credit / refunded / voided — default cashed |
| sale_note | text | internal note, not shown on customer receipt |
| due_date | timestamp | required when payment_type = credit. The date repayment is expected |
| shop_id | integer | FK → shops NOT NULL |
| customer_id | integer | FK → customers — nullable for walk-in sales |
| attendant_id | integer | FK → attendants — who processed the sale |
| order_id | integer | FK → orders — set if this sale was created from an order |
| created_at | timestamp | |

**API notes:**
- Creating a sale is a single database transaction: insert `sales` + all `sale_items` + `sale_item_batches` (if applicable) + initial `sale_payments` (if not credit) atomically. Roll back everything if any step fails.
- Cached fields (`amount_paid`, `mpesa_total`, `bank_total`, `card_total`, `outstanding_balance`) must be recalculated and updated on the `sales` row every time a `sale_payments` row is inserted or deleted.
- `status` should be updated automatically: if `outstanding_balance = 0` → cashed. If `outstanding_balance > 0` → credit. Do not let the client set status directly.
- `negative_selling`: check `shop.negative_selling` before allowing a sale that would take `inventory.quantity` below zero. Reject if false.
- After a sale is created, decrement `inventory.quantity` for each product sold. If `shop.track_batches = true`, also decrement the relevant `batches.quantity` rows used.
- If a serial product is sold, update `product_serials.status` from `available` → `sold`.

---

### sale_items
One row per product line on a sale. Prices are locked at the moment of sale.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer | FK → sales, cascade delete |
| product_id | integer | FK → products |
| attendant_id | integer | FK → attendants — who sold this item (for commission). Defaults to sales.attendant_id |
| serial_id | integer | FK → product_serials — only set for serialised products |
| quantity | numeric(14,4) | NOT NULL |
| unit_price | numeric(14,2) | NOT NULL — snapshot of the price at time of sale. Do NOT use product.selling_price for reports |
| cost_price | numeric(14,2) | snapshot of buying_price at time of sale. Used for profit calculations. Source: product.buying_price or batch.buying_price if batches used |
| tax | numeric(14,2) | tax amount for this line — compute from shop.tax_rate × unit_price if product.is_taxable |
| line_discount | numeric(14,2) | item-level discount amount |
| sale_note | text | per-item note |
| sale_type | text | Retail / Dealer / Wholesale — which price tier was applied |
| status | text | cashed / returned — updated when a return is processed for this item |
| created_at | timestamp | |

**API notes:**
- `unit_price` must be set from the correct price tier: Retail → `product.selling_price`, Wholesale → `product.wholesale_price`, Dealer → `product.dealer_price`. Never let the client send an arbitrary price without validating against `product.min_selling_price`.
- `cost_price` must be set at insert time: use `batch.buying_price` if batch tracking is on (FEFO batch), otherwise `product.buying_price`.
- Gross profit per item = (`unit_price` − `cost_price`) × `quantity` − `line_discount`.
- `serial_id`: validate the serial exists, belongs to the correct product, and its status is `available` before inserting. Set `product_serials.status = sold` after insert.

---

### sale_item_batches
Records which batch(es) a sale item was fulfilled from. Only populated when `shop.track_batches = true`.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_item_id | integer | FK → sale_items, cascade delete |
| batch_id | integer | FK → batches |
| quantity_taken | numeric(14,4) | how many units taken from this batch |

**API notes:**
- Apply FEFO (First Expiry First Out): query batches for the product ordered by `expiration_date ASC`, fill each batch until `sale_item.quantity` is satisfied.
- After inserting, decrement `batches.quantity` for each row inserted here.
- SUM(quantity_taken) across all rows for a sale_item must equal `sale_items.quantity`.
- A batch with `quantity = 0` should not be allocated. Skip it in the FEFO loop.

---

### sale_payments
One row per payment instalment. A split payment (cash + M-Pesa) produces two rows on the same `sale_id`.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer | FK → sales, cascade delete |
| received_by_id | integer | FK → attendants NOT NULL — who physically received the payment |
| amount | numeric(14,2) | NOT NULL — the amount received in this instalment |
| balance | numeric(14,2) | change given back to the customer (cash payments only) |
| payment_no | text | internal sequential payment reference |
| payment_reference | text | external transaction reference — M-Pesa code, bank transfer ref, card auth code |
| payment_type | text | NOT NULL — cash / mpesa / card / bank / wallet |
| paid_at | timestamp | defaults to now() |

**API notes:**
- After every insert into `sale_payments`, recalculate and UPDATE `sales.amount_paid`, `sales.mpesa_total`, `sales.bank_total`, `sales.card_total`, `sales.outstanding_balance`, and `sales.status` in the same transaction.
- For credit sales, a payment row is added each time the customer makes a partial payment — this is how the outstanding balance reduces over time.
- `balance` (change): only relevant for cash payments. balance = amount_received − amount_owed (when customer overpays cash). Do not confuse with `outstanding_balance` on `sales`.
- Do not allow inserting a payment where `amount > sales.outstanding_balance` (overpayment). Validate before insert.

---

### sale_returns
Header record for a return/refund against a completed sale.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_id | integer | FK → sales NOT NULL |
| customer_id | integer | FK → customers — nullable |
| processed_by_id | integer | FK → attendants NOT NULL |
| shop_id | integer | FK → shops NOT NULL — denormalised for direct querying |
| refund_amount | numeric(14,2) | NOT NULL — total refund issued |
| refund_method | text | NOT NULL — cash / mpesa / card / bank / store_credit |
| refund_reference | text | transaction ref for mpesa/bank refunds |
| reason | text | reason for the return |
| return_no | text | NOT NULL unique — generate before insert (e.g. RTN-20240101-0001) |
| created_at | timestamp | |

**API notes:**
- Processing a return is a transaction: insert `sale_returns` + `sale_return_items` + restore `inventory.quantity` for returned products + update `sale_items.status = returned` for affected items + update `sales.status = refunded` if all items are returned.
- Partial returns are supported — only the returned items need `sale_items.status = returned`.
- If batch tracking is on, restore quantity back to the batch (or create an adjustment if the specific batch can no longer be identified).
- If a serialised product is returned, set `product_serials.status = returned`.
- `refund_amount` should be validated: cannot exceed the original `sales.total_with_discount`.

---

### sale_return_items
Line items for a return — which products were returned and how many.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| sale_return_id | integer | FK → sale_returns, cascade delete |
| sale_item_id | integer | FK → sale_items NOT NULL — links to the exact original line item |
| product_id | integer | FK → products — denormalised for direct querying |
| quantity | numeric(14,4) | NOT NULL — must not exceed original sale_items.quantity |
| unit_price | numeric(14,2) | NOT NULL — original selling price (from sale_items.unit_price) |

**API notes:**
- `quantity` must be ≤ `sale_items.quantity`. Validate before insert.
- Cannot return the same `sale_item_id` more than once across all return records (prevent double-return). Check existing `sale_return_items` for the same `sale_item_id` before inserting.
- After insert, increment `inventory.quantity` by the returned quantity for each product.
