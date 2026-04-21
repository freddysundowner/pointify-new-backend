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
