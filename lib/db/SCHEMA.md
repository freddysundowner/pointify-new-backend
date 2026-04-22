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

**API notes:**
- Scoped per admin — an admin only sees their own categories. Always filter by `admin_id`.
- Categories are shared across all of an admin's shops (not per-shop).

---

### products
Defines what a product IS. One record per product per shop. Stock levels live in `inventory`, not here.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| buying_price | numeric(14,2) | cost price / purchase price |
| selling_price | numeric(14,2) | default retail price |
| wholesale_price | numeric(14,2) | wholesale tier price |
| dealer_price | numeric(14,2) | dealer tier price |
| min_selling_price | numeric(14,2) | floor price — no sale_item.unit_price can go below this |
| max_discount | numeric(14,2) | maximum discount allowed as a percentage |
| product_category_id | integer | FK → product_categories |
| measure_unit | text | e.g. kg, pcs, litres |
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
| is_deleted | boolean | soft delete — never hard delete products with sales history |
| manage_by_price | boolean | if true, inventory changes are tracked by value not qty |
| is_taxable | boolean | if true, apply shop.tax_rate to this product's sale_items |
| expiry_date | timestamp | fallback when batch tracking is off |
| created_at | timestamp | |

**API notes:**
- Products are per-shop (`shop_id`). A product in Shop A and the same product in Shop B are two separate rows.
- When creating a product, always create its `inventory` record in the same transaction. The product without an inventory row is incomplete.
- `is_deleted = true` is the only way to remove a product — hard delete will break sales history. Filter out `is_deleted = true` in all listing endpoints.
- `min_selling_price` must be enforced at the API layer when building a sale: reject any `sale_items.unit_price` below this value.
- `max_discount` is a percentage cap on `line_discount`. Validate at sale creation.
- For bundles (`product_type = bundle`): when a bundle is sold, also decrement inventory for each component in `bundle_items` by (component.quantity × sold quantity).
- For virtual / service products: skip inventory decrement on sale — they have no physical stock.
- `is_taxable`: if true, compute `sale_items.tax = shop.tax_rate / 100 × unit_price × quantity`.

---

### inventory
Per-shop stock record. Always created alongside its product (1:1 with products).  
Single source of truth for stock levels — never products.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| updated_by_id | integer | FK → attendants |
| quantity | numeric(14,4) | current stock — this is the number to read and update |
| reorder_level | numeric(14,4) | alert threshold — trigger low stock alert when quantity ≤ this |
| last_count | numeric(14,4) | quantity recorded during last physical stock count |
| last_count_date | timestamp | when last_count was taken |
| status | text | active / low / out_of_stock |
| created_at | timestamp | |

**API notes:**
- `quantity` is the single source of truth for stock. Never read or display product stock from anywhere else.
- `status` should be auto-computed and updated whenever `quantity` changes: `quantity = 0` → out_of_stock, `quantity ≤ reorder_level` → low, else → active.
- When `shop.track_batches = true`: `inventory.quantity` must always equal `SUM(batches.quantity)` for that product+shop. Update both in the same transaction whenever stock changes.
- Never allow `quantity` to go below 0 unless `shop.negative_selling = true`.

---

### batches
Individual stock lots per product per shop. Used when `shop.track_batches = true`.  
`inventory.quantity` = SUM of all batch quantities when batch tracking is on.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| buying_price | numeric(14,2) | cost for this specific lot — may differ from product.buying_price |
| quantity | numeric(14,4) | remaining stock in this batch |
| total_quantity | numeric(14,4) | original quantity received — never changes after insert |
| expiration_date | timestamp | used for FEFO ordering and expiry alerts |
| batch_code | text | unique — can be supplier lot number or auto-generated |
| created_at | timestamp | |

**API notes:**
- Batches are only relevant when `shop.track_batches = true`. Ignore this table otherwise.
- `total_quantity` is set once at insert and never updated — it is the audit record of what arrived. `quantity` is what remains.
- FEFO (First Expiry First Out): always allocate from the batch with the earliest `expiration_date` first when selling.
- A batch with `quantity = 0` is exhausted — filter it out from available stock queries.
- When a batch is added (purchase received), increment `inventory.quantity` by the batch's quantity in the same transaction.
- `buying_price` on the batch is the correct cost to use for `sale_items.cost_price` when batch tracking is on — not `product.buying_price`.
- Cannot delete a batch that has been referenced in `sale_item_batches` — the FK will block it.

---

### product_serials
Individual unit serials for serialised products (phones, laptops, etc.).  
Serial tracking is implicit — if a product has rows here, it is serialised.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| serial_number | text | IMEI, serial no, licence key, etc. |
| status | text | available / sold / returned / void |
| created_at | timestamp | |

**API notes:**
- A product is considered serialised if it has any rows in this table — no flag needed on the product itself.
- On sale: validate serial exists, belongs to the correct product, and `status = available`. Set `status = sold` after sale is confirmed.
- On return: set `status = returned`. It can then be resold (set back to `available` when restocked).
- `void` is for serials that are damaged, lost, or otherwise removed from saleable stock.
- Only one serial can map to one `sale_items` row at a time — enforce this at the API layer.

---

### bundle_items
Defines the components that make up a bundle product.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | the bundle product (product_type = bundle) |
| component_product_id | integer | FK → products — the component |
| quantity | numeric(14,4) | how many units of this component per bundle |
| created_at | timestamp | |

**API notes:**
- When selling a bundle, deduct stock from each component: for each `bundle_items` row, decrement `inventory.quantity` by `bundle_items.quantity × sale_items.quantity`.
- A component product can belong to multiple bundles.
- Do not allow a bundle to reference itself as a component (circular bundle).
- When checking stock availability for a bundle, check each component's `inventory.quantity` is sufficient before allowing the sale.

---

### adjustments
Audit log of manual stock changes made outside of sales or purchases.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| adjusted_by_id | integer | FK → attendants |
| type | text | add / remove |
| quantity_before | numeric(14,4) | snapshot before adjustment |
| quantity_after | numeric(14,4) | snapshot after adjustment |
| quantity_adjusted | numeric(14,4) | the delta |
| reason | text | |
| created_at | timestamp | |

**API notes:**
- Adjustments are the correct route for manual corrections, damage write-offs found during a count, or initial stock loading.
- Always populate `quantity_before` from the current `inventory.quantity` before applying the change.
- After inserting an adjustment, update `inventory.quantity` in the same transaction: add for `type = add`, subtract for `type = remove`.
- `quantity_after` = `quantity_before + quantity_adjusted` (add) or `quantity_before - quantity_adjusted` (remove). Store both for auditability.
- If batch tracking is on, also update the relevant batch quantity and note the batch in the reason or use a separate flow.

---

### bad_stocks
Records damaged, expired, or lost stock written off.

| Field | Type | Notes |
|---|---|---|
| id | serial PK | |
| product_id | integer | FK → products |
| shop_id | integer | FK → shops |
| written_off_by_id | integer | FK → attendants |
| quantity | numeric(14,4) | units written off |
| unit_price | numeric(14,2) | cost value of each written-off unit |
| reason | text | damaged / expired / lost |
| created_at | timestamp | |

**API notes:**
- Writing off bad stock must also decrement `inventory.quantity` by the written-off quantity in the same transaction.
- `unit_price` is used to calculate the financial loss: `quantity × unit_price` = value written off. Use `product.buying_price` or `batch.buying_price` if batches are tracked.
- If batch tracking is on, identify and decrement the specific batch being written off.

---

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
| physical_count | numeric(14,4) | what was physically counted on the floor |
| system_count | numeric(14,4) | what inventory.quantity showed at count time |
| variance | numeric(14,4) | physical_count − system_count |
| created_at | timestamp | |

**API notes:**
- `system_count` must be captured at the time the count item is created — snapshot `inventory.quantity` then. Do not derive it later.
- `variance` = `physical_count − system_count`. Positive = more stock than expected (unrecorded receive). Negative = stock missing (theft, unrecorded sale, damage).
- Applying a stock count: update `inventory.quantity = physical_count` and set `inventory.last_count = physical_count` + `inventory.last_count_date = now()` for each item.
- Stock count application is optional — a count can be saved as a record without applying it. Provide a separate "apply count" endpoint.

---

### stock_requests + stock_request_items
A shop requests stock from a warehouse shop.

| stock_requests | Type | Notes |
|---|---|---|
| id | serial PK | |
| requested_by_id | integer | FK → attendants — who raised the request |
| accepted_by_id | integer | FK → attendants — who accepted at the warehouse |
| approved_by_id | integer | FK → attendants — who approved dispatch |
| status | text | pending / processed / correction / void / completed |
| from_shop_id | integer | the requesting shop |
| warehouse_id | integer | the supplying warehouse (shop where warehouse = true) |
| total_value | numeric(14,2) | value of goods requested |
| invoice_number | text | unique |
| accepted_at | timestamp | |
| dispatched_at | timestamp | |
| created_at | timestamp | |

| stock_request_items | Type | Notes |
|---|---|---|
| id | serial PK | |
| stock_request_id | integer | FK → stock_requests, cascades |
| product_id | integer | FK → products |
| quantity_requested | numeric(14,4) | how many the shop asked for |
| quantity_received | numeric(14,4) | how many were actually sent (may differ) |

**API notes:**
- Status flow: `pending` → `processed` (warehouse confirms) → `completed` (shop receives) or `void` (cancelled).
- `correction` status is used when the warehouse sends a different quantity than requested — `quantity_received` is updated and status set to correction before the shop acknowledges.
- When `completed`: increment `inventory.quantity` at `from_shop_id` by `quantity_received` for each item, and decrement `inventory.quantity` at `warehouse_id` in the same transaction.
- `total_value` = SUM(`quantity_requested × product.buying_price`) — computed at request creation, not updated after.
- Only shops with `warehouse = true` can be set as `warehouse_id`.

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

---

## customers.ts

### Overview

Two tables: `customers` (main record) and `customer_wallet_transactions` (audit log of wallet activity).

`wallet` = pre-paid store credit the customer has deposited (always ≥ 0).  
`outstanding_balance` = total unpaid debt from credit sales (cached from `sales`).  
These are two distinct concepts — never mix them.

---

### customers
One record per customer per shop. Customers are not shared across shops.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | serial PK | NO | |
| customer_no | integer | YES | sequential reference number, unique per shop. Auto-generate on insert |
| name | text | NO | |
| phone | text | YES | |
| email | text | YES | |
| address | text | YES | |
| password | text | YES | only set when type = online. Must be bcrypt hashed before insert |
| otp | text | YES | |
| otp_expiry | bigint | YES | unix ms — check against Date.now() |
| type | text | YES | retail / wholesale / dealer / online |
| credit_limit | numeric(14,2) | YES | max credit allowed. NULL = no credit for this customer |
| wallet | numeric(14,2) | YES | pre-paid store credit. default 0. never goes below 0 |
| outstanding_balance | numeric(14,2) | YES | cached — SUM(sales.outstanding_balance) for this customer |
| shop_id | integer | NO | FK → shops |
| created_by_id | integer | YES | FK → attendants |
| created_at | timestamp | YES | |

**API notes:**
- `customer_no` must be auto-generated at insert time: SELECT MAX(customer_no) WHERE shop_id = ? and increment by 1. Do this inside the insert transaction.
- `type` auto-sets the pricing tier at the POS: retail → `product.selling_price`, wholesale → `product.wholesale_price`, dealer → `product.dealer_price`. The attendant can still override per item.
- `credit_limit` enforcement: before creating a credit sale, check that `outstanding_balance + new_sale_amount ≤ credit_limit`. Reject if exceeded (unless credit_limit is NULL, which means no credit allowed at all).
- `outstanding_balance` must be updated (incremented) when a credit sale is created, and decremented when a `sale_payments` row is inserted against one of their credit sales.
- `wallet` must never go below 0 — validate before any deduction.
- Cannot delete a customer with `outstanding_balance > 0`. Block at the API layer.
- For online customers: `password` is required, `shop_id` is not required (online customers are global). `type = online`.
- `customerVerify` endpoint: check if phone or email already exists before creating — return `exists: true/false`.

---

### customer_wallet_transactions
Audit log of every change to a customer's wallet. One row per transaction.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | serial PK | NO | |
| customer_id | integer | NO | FK → customers |
| shop_id | integer | NO | FK → shops |
| handled_by_id | integer | YES | FK → attendants — who processed this transaction |
| type | text | NO | deposit / withdraw / payment / refund |
| amount | numeric(14,2) | NO | the transaction amount |
| balance | numeric(14,2) | NO | wallet balance after this transaction (running balance) |
| payment_no | text | YES | auto-generated reference (e.g. REC1234567) |
| payment_reference | text | YES | external ref — M-Pesa code, bank ref |
| payment_type | text | YES | cash / mpesa / card / bank |
| created_at | timestamp | YES | |

**API notes:**
- Every change to `customers.wallet` must be accompanied by an insert into this table in the same transaction — this is the audit trail.
- `balance` = `customers.wallet` value after the transaction is applied. Snapshot it at insert time.
- `type` meanings: `deposit` = customer pays money in (wallet increases). `withdraw` = customer takes money out (wallet decreases). `payment` = wallet used to settle a credit sale (wallet decreases, `sales.outstanding_balance` decreases). `refund` = refund credited to wallet (wallet increases).
- When `type = payment`: also update `sales.outstanding_balance` and `sales.amount_paid` for the sale being settled, and update `customers.outstanding_balance` — all in the same transaction.
- Wallet payment flow (paying off credit sales with wallet): apply to oldest unpaid credit sales first (ordered by `sales.created_at ASC`). If wallet amount exceeds all debt, remainder stays in wallet.
- `payment_no`: auto-generate if not provided (e.g. `REC` + random 7-digit number).
