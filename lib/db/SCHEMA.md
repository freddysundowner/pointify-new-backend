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
| sync_mode | text | online / offline / hybrid |
| sync_interval | integer | seconds between syncs |
| otp | text | |
| otp_expiry | bigint | unix ms |
| email_verified | boolean | |
| phone_verified | boolean | |
| email_verification_date | timestamp | |
| auto_print | boolean | auto-print receipts, default true |
| platform | text | ios / android / web |
| app_version | text | |
| last_app_rating_date | timestamp | |
| last_subscription_reminder | timestamp | |
| last_subscription_reminder_count | integer | |
| last_seen | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

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
| sync | boolean | |
