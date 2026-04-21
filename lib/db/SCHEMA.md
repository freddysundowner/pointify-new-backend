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
