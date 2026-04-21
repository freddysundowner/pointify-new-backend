# Pointify Database Schema

**Stack:** PostgreSQL · Drizzle ORM · drizzle-zod · Zod v4  
**Package:** `@workspace/db` at `lib/db/`  
**Push command:** `pnpm --filter @workspace/db run push-force`

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

## identity.ts

> **Admin** = shop owner. Logs in with email + password. Has full access — no permission restrictions.  
> **Attendant** = cashier / staff. Logs in with PIN + password at the POS.  
>
> Every admin gets one attendant auto-created on registration. That attendant is used purely for **POS attribution** — when the admin makes a sale themselves, it is recorded under their attendant identity. These auto-attendants are **not login accounts**: their `pin` and `password` are null.

### `attendants`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| username | text NOT NULL | display name on receipts and reports |
| pin | text | 4-digit PIN used with password to log in. **Null** on admin-owned attendants |
| password | text | **Null** on admin-owned attendants |
| permissions | text[] | e.g. `["sales","reports","expenses"]`. Null on admin-owned attendants |
| admin_id | integer | FK → admins.id (plain int — circular) |
| shop_id | integer | FK → shops.id — one attendant is always tied to one shop |
| last_seen | timestamp | |
| created_at | timestamp | |
| sync | boolean | |

### `admins`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| email | text NOT NULL UNIQUE | login credential |
| phone | text NOT NULL | |
| username | text | display name shown in the app UI |
| password | text NOT NULL | |
| attendant_id | integer | FK → attendants.id (plain int — circular) — the auto-created attendant |
| primary_shop_id | integer | FK → shops.id (plain int) — the admin's default shop |
| affiliate_id | integer | FK → affiliates.id — set if registered via an affiliate link |
| referred_by_id | integer | FK → admins.id — self-referential, which admin referred this one |
| referral_credit | numeric(14,2) | credit earned from referrals; applied to offset subscription payments |
| sync_mode | text | `online` / `offline` / `hybrid` — controls data sync behaviour |
| sync_interval | integer | sync polling interval in seconds |
| otp | text | verification OTP (text to preserve leading zeros) |
| otp_expiry | bigint | Unix ms timestamp when the OTP expires |
| email_verified | boolean | |
| phone_verified | boolean | |
| email_verification_date | timestamp | |
| auto_print | boolean | default true — auto-print receipts after each sale |
| platform | text | `ios` / `android` / `web` |
| app_version | text | installed app version string |
| last_app_rating_date | timestamp | last time the admin was prompted for an app-store rating |
| last_subscription_reminder | timestamp | |
| last_subscription_reminder_count | integer | |
| last_seen | timestamp | |
| created_at | timestamp | |
| sync | boolean | |
