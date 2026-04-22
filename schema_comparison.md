# MongoDB → PostgreSQL Schema Comparison

Complete field-by-field comparison of every old MongoDB model against the new Drizzle/PostgreSQL table.
Notation: ✓ = same semantics (only casing changed), ➜ = renamed, ⊕ = added in PG, ✗ = removed.

---

## 1. `Admin` → `admins`

| MongoDB field | PG column | Notes |
|---|---|---|
| `_id` (ObjectId) | `id` (serial PK) | |
| `email` (String, unique) | `email` (text, unique) | ✓ |
| `phone` (String) | `phone` (text) | ✓ |
| `username` (String) | `username` (text) | ✓ |
| `password` (String) | `password` (text) | ✓ |
| `attendantId` (ObjectId) | `attendant_id` (integer) | ➜ plain int, circular FK |
| `primaryShop` (ObjectId) | `primary_shop_id` (integer) | ➜ |
| `affliate` (ObjectId) | `affiliate_id` (integer) | ➜ typo fixed |
| `referal` (ObjectId self-ref) | `referred_by_id` (integer) | ➜ |
| `referalCredit` (Number) | `referral_credit` (numeric) | ➜ typo fixed |
| `otp` (Number) | `otp` (text) | type changed: Number → text |
| `otp_expiry` (Number) | `otp_expiry` (bigint) | type changed |
| `emailVerified` (Boolean) | `email_verified` (boolean) | ➜ |
| `phoneVerified` (Boolean) | `phone_verified` (boolean) | ➜ |
| `emailVerificationDate` (Date) | `email_verification_date` (timestamp) | ➜ |
| `autoPrint` (Boolean) | `auto_print` (boolean) | ➜ |
| `platform` (String) | `platform` (text) | ✓ |
| `app_version` (String) | `app_version` (text) | ✓ |
| `last_seen` (Date) | `last_seen` (timestamp) | ✓ |
| `createdAt` (Date) | `created_at` (timestamp) | ➜ |
| `permissions` (String) | **REMOVED** | Admin permissions were stored as a JSON string; in PG only attendants have permissions |
| `status` (String: online/offline/hybrid) | **REMOVED** | Online/offline sync concept dropped |
| `syncInterval` (Number) | **REMOVED** | MongoDB sync concept dropped |
| `lastAppRatingDate` (Date) | **REMOVED** | Rating date tracked elsewhere or dropped |
| `lastSubscriptionReminder` (Date) | **REMOVED** | |
| `lastSubscriptionReminderCount` (Number) | **REMOVED** | |
| `sync` (Boolean) | **REMOVED** | MongoDB sync flag — not needed in PG |

---

## 2. `Attendant` → `attendants`

| MongoDB field | PG column | Notes |
|---|---|---|
| `_id` (ObjectId) | `id` (serial PK) | |
| `username` (String) | `username` (text) | ✓ |
| `uniqueDigits` (Number, unique) | `pin` (text) | ➜ **renamed** — this is the numeric PIN used at POS login |
| `password` (String) | `password` (text) | ✓ |
| `permissions` (Array) | `permissions` (text[]) | type changed: Array of strings → text[] |
| `adminId` (ObjectId) | `admin_id` (integer) | ➜ plain int, circular FK |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `last_seen` (Date) | `last_seen` (timestamp) | ✓ |
| `lastAppRatingDate` (Date) | **REMOVED** | |
| `sync` (Boolean) | **REMOVED** | |

---

## 3. `Shop` → `shops`

| MongoDB field | PG column | Notes |
|---|---|---|
| `_id` (ObjectId) | `id` (serial PK) | |
| `name` (String) | `name` (text) | ✓ |
| `address` (String) | `address` (text) | ✓ |
| `address_receipt` (String) | `receipt_header` (text) | ➜ renamed |
| `shopCategoryId` (ObjectId) | `shop_category_id` (integer) | ➜ |
| `adminId` (ObjectId) | `admin_id` (integer) | ➜ plain int, circular FK |
| `subscription` (ObjectId) | `subscription_id` (integer) | ➜ plain int, circular FK |
| `location` (GeoJSON Point) | `location_lat` (real) + `location_lng` (real) | ➜ GeoJSON replaced with two numeric columns |
| `currency` (String) | `currency` (text) | ✓ |
| `contact` (String) | `contact` (text) | ✓ |
| `tax` (Number) | `tax_rate` (numeric) | ➜ renamed |
| `paybill_till` (String) | `paybill_till` (text) | ✓ |
| `paybill_account` (String) | `paybill_account` (text) | ✓ |
| `backupInterval` (String) | `backup_interval` (text) | ➜ |
| `backupemail` (String) | `backup_email` (text) | ➜ |
| `backupdate` (Date) | `backup_date` (timestamp) | ➜ |
| `receiptemail` (String) | `receipt_email` (text) | ➜ |
| `showstockonline` (Boolean) | `show_stock_online` (boolean) | ➜ |
| `showpriceonline` (Boolean) | `show_price_online` (boolean) | ➜ |
| `warehouse` (Boolean) | `warehouse` (boolean) | ✓ |
| `production` (Boolean) | `production` (boolean) | ✓ |
| `allowBackup` (Boolean) | `allow_backup` (boolean) | ➜ |
| `trackbatches` (Boolean) | `track_batches` (boolean) | ➜ |
| `allowOnlineSelling` (Boolean) | `online_selling` (boolean) | ➜ renamed |
| `allownegativeselling` (Boolean) | `negative_selling` (boolean) | ➜ renamed |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `warehouseemail` (String) | **REMOVED** | |
| `deletewarning` (Number) | **REMOVED** | |
| `useWarehouse` (Boolean) | **REMOVED** | Logic derived from `warehouse` flag |
| `affliate` (ObjectId) | **REMOVED** | Affiliate link is at the admin level, not shop level |
| `sync` (Boolean) | **REMOVED** | |

---

## 4. `Product` → `products`

| MongoDB field | PG column | Notes |
|---|---|---|
| `_id` (ObjectId) | `id` (serial PK) | |
| `name` (String) | `name` (text) | ✓ |
| `buyingPrice` (Number) | `buying_price` (numeric) | ➜ |
| `sellingPrice` (Number) | `selling_price` (numeric) | ➜ |
| `wholesalePrice` (Number) | `wholesale_price` (numeric) | ➜ |
| `dealerPrice` (Number) | `dealer_price` (numeric) | ➜ |
| `minSellingPrice` (Number) | `min_selling_price` (numeric) | ➜ |
| `maxDiscount` (Number) | `max_discount` (numeric) | ➜ |
| `productCategoryId` (ObjectId) | `product_category_id` (integer) | ➜ |
| `measure` (String free-text) | **REMOVED** | Merged into `measure_unit` below |
| `measureUnit` (ObjectId → Measure) | `measure_unit` (text) | ➜ FK removed; now plain text |
| `manufacturer` (String) | `manufacturer` (text) | ✓ |
| `supplierId` (ObjectId) | `supplier_id` (integer) | ➜ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `created_by_id` (integer) | ➜ renamed |
| `description` (String) | `description` (text) | ✓ |
| `uploadImage` (String) | `thumbnail_url` (text) | ➜ renamed |
| `images` (Array) | `images` (text[]) | ✓ |
| `barcode` (String) | `barcode` (text) | ✓ |
| `productType` (String: product/bundle/virtual) | `product_type` (text) | ➜ |
| `deleted` (Boolean) | `is_deleted` (boolean) | ➜ renamed |
| `virtual` (Boolean) | **REMOVED** | Encoded in `product_type = 'virtual'` |
| `bundle` (Boolean) | **REMOVED** | Encoded in `product_type = 'bundle'` |
| `manageByPrice` (Boolean) | `manage_by_price` (boolean) | ➜ |
| `taxable` (Boolean) | `is_taxable` (boolean) | ➜ renamed |
| `expiryDate` (Date) | `expiry_date` (timestamp) | ➜ |
| `date` (Date) | `created_at` (timestamp) | ➜ renamed |
| `quantity` (Number) | **REMOVED** | Stock lives in `inventory` only |
| `lastCount` (Number) | **REMOVED** | Moved to `inventory.last_count` |
| `reorderLevel` (Number) | **REMOVED** | Moved to `inventory.reorder_level` |
| `lastcoundate` (Date) | **REMOVED** | Moved to `inventory.last_count_date` |
| `serialnumber` (String) | **REMOVED** | Moved to `product_serials` table |
| `batches` (Array of ObjectIds) | **REMOVED** | Relationship inverted — `batches.product_id` FK |
| `admin` (ObjectId) | **REMOVED** | Derivable via `shop → admin` |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `sku` (text) ⊕
- `created_at` replaces `date`

---

## 5. `Inventory` → `inventory`

| MongoDB field | PG column | Notes |
|---|---|---|
| `_id` (ObjectId) | `id` (serial PK) | |
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `reorderLevel` (Number) | `reorder_level` (numeric) | ➜ |
| `lastCount` (Number) | `last_count` (numeric) | ➜ |
| `lastcoundate` (Date) | `last_count_date` (timestamp) | ➜ |
| `status` (String) | `status` (text: active/low/out_of_stock) | ✓ |
| `attendant` (ObjectId) | `updated_by_id` (integer) | ➜ renamed |
| `bundle` (Boolean) | **REMOVED** | Moved to `products.product_type` |
| `bundleItems` (Array) | **REMOVED** | Moved to `bundle_items` table |
| `warehouse` (ObjectId) | **REMOVED** | Warehouse scope handled at shop level |
| `type` (String) | **REMOVED** | |
| `barcode` (String) | **REMOVED** | Barcode lives on `products` only |
| `expiryDate` (Date) | **REMOVED** | Expiry tracked on `batches` or `products` |
| `date` (Date) | `created_at` (timestamp) | ➜ |
| `sync` (Boolean) | **REMOVED** | |

**New tables decomposed from old inventory:**
- `bundle_items` ⊕ — explicit join table: `product_id`, `component_product_id`, `quantity`
- `product_serials` ⊕ — tracks individual unit serial numbers: `serial_number`, `status`

---

## 6. `Batch` → `batches`

| MongoDB field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `buyingPrice` (Number) | `buying_price` (numeric) | ➜ |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `totalQuantity` (Number) | `total_quantity` (numeric) | ➜ |
| `expirationDate` (Date) | `expiration_date` (timestamp) | ➜ |
| `batchCode` (String, unique) | `batch_code` (text, unique) | ➜ |
| `createdAt` (Date) | `created_at` (timestamp) | ➜ |
| `sync` (Boolean) | **REMOVED** | |

---

## 7. `Sale` → `sales`

| MongoDB field | PG column | Notes |
|---|---|---|
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `totalAmount` (Number) | `total_amount` (numeric) | ➜ |
| `totalWithDiscount` (Number) | `total_with_discount` (numeric) | ➜ |
| `totaltax` (Number) | `total_tax` (numeric) | ➜ |
| `saleDiscount` (Number) | `sale_discount` (numeric) | ➜ |
| `amountPaid` (Number) | `amount_paid` (numeric) | ➜ |
| `mpesaTotal` (Number) **"to be removed"** | `mpesa_total` (numeric) | kept, consolidated with `mpesaNewTotal` |
| `mpesaNewTotal` (Number) | **REMOVED** | Merged into `mpesa_total` |
| `bankTotal` (Number) | `bank_total` (numeric) | ➜ |
| `outstandingBalance` (Number) | `outstanding_balance` (numeric) | ➜ |
| `saleType` (String) | `sale_type` (text) | ➜ |
| `paymentType` (String) | `payment_type` (text) | ➜ |
| `status` (String) | `status` (text) | ✓ |
| `salesnote` (String) | `sale_note` (text) | ➜ renamed |
| `receiptNo` (String, unique) | `receipt_no` (text, unique) | ➜ |
| `duedate` (Date) | `due_date` (timestamp) | ➜ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `customerId` (ObjectId) | `customer_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `attendant_id` (integer) | ➜ |
| `orderId` (ObjectId) | `order_id` (integer) | ➜ |
| `items` (Array of ObjectIds) | **REMOVED** | Relationship is `sale_items.sale_id` FK |
| `payments` (embedded Array) | **REMOVED** | Moved to `sale_payments` table |
| `totalDiscount` (virtual getter) | **REMOVED** | Derivable from `sale_items.line_discount` |
| `batchId` (ObjectId) | **REMOVED** | Batch info at item level via `sale_item_batches` |
| `order` (String status) | **CHANGED** — now `order_id` (integer FK) | Semantics changed from status string to order reference |
| `paymentTag` (String) | **REMOVED** | Replaced by `payment_type` |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `card_total` (numeric) ⊕

**New PG tables decomposed from embedded arrays:**
- `sale_payments` ⊕ — normalized from `sales.payments` sub-array
- `sale_item_batches` ⊕ — normalized from `sale_items.batch` array

---

## 8. `SaleItem` → `sale_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `sale` (ObjectId) | `sale_id` (integer) | ➜ |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `unitPrice` (Number) | `unit_price` (numeric) | ➜ |
| `tax` (Number) | `tax` (numeric) | ✓ |
| `salesnote` (String) | `sale_note` (text) | ➜ renamed |
| `status` (String) | `status` (text) | ✓ |
| `saleType` (String) | `sale_type` (text) | ➜ |
| `attendantId` (ObjectId) | `attendant_id` (integer) | ➜ |
| `lineDiscount` (Number) | `line_discount` (numeric) | ➜ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `batch` (Array of ObjectIds) | **REMOVED** | Moved to `sale_item_batches` table |
| `shopId` (ObjectId) | **REMOVED** | Derivable via `sale.shop_id` |
| `paymentTag` (String) | **REMOVED** | |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `cost_price` (numeric) ⊕ — snapshot of buying price at time of sale
- `serial_id` (integer) ⊕ — FK to `product_serials` for serialised items

---

## 9. `SaleReturn` → `sale_returns` + `sale_return_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `saleId` (ObjectId) | `sale_id` (integer) | ➜ |
| `customerId` (ObjectId) | `customer_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `processed_by_id` (integer) | ➜ renamed |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `refundAmount` (Number) | `refund_amount` (numeric) | ➜ |
| `reason` (String) | `reason` (text) | ✓ |
| `saleReturnNo` (String) | `return_no` (text, unique) | ➜ renamed |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `items` (embedded Array) | **REMOVED** | Moved to `sale_return_items` table |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `refund_method` (text, required) ⊕ — cash/mpesa/card/bank/store_credit
- `refund_reference` (text) ⊕ — M-Pesa code, bank ref, etc.

---

## 10. `Purchase` → `purchases`

| MongoDB field | PG column | Notes |
|---|---|---|
| `totalAmount` (Number) | `total_amount` (numeric) | ➜ |
| `amountPaid` (Number) | `amount_paid` (numeric) | ➜ |
| `purchaseNo` (String) | `purchase_no` (text, unique) | ➜ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `supplierId` (ObjectId) | `supplier_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `attendant_id` (integer) | ➜ |
| `paymentType` (String) | `payment_type` (text) | ➜ |
| `outstandingBalance` (Number) | `outstanding_balance` (numeric) | ➜ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `items` (Array of ObjectIds) | **REMOVED** | Relationship via `purchase_items.purchase_id` FK |
| `payments` (embedded Array) | **REMOVED** | Moved to `purchase_payments` table |
| `sync` (Boolean) | **REMOVED** | |

---

## 11. `PurchaseItem` → `purchase_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `purchase` (ObjectId) | `purchase_id` (integer) | ➜ |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `unitPrice` (Number) | `unit_price` (numeric) | ➜ |
| `lineDiscount` (Number) | `line_discount` (numeric) | ➜ |
| `attendantId` (ObjectId) | **REMOVED** | Derivable via `purchase.attendant_id` |
| `shop` (ObjectId) | **REMOVED** | Derivable via `purchase.shop_id` |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `sync` (Boolean) | **REMOVED** | |

---

## 12. `PurchaseReturn` → `purchase_returns` + `purchase_return_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `purchaseId` (ObjectId) | `purchase_id` (integer) | ➜ |
| `paymentType` (String) | `payment_type` (text) | ➜ |
| `supplierId` (ObjectId) | `supplier_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `processed_by_id` (integer) | ➜ renamed |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `refundAmount` (Number) | `refund_amount` (numeric) | ➜ |
| `reason` (String) | `reason` (text) | ✓ |
| `purchaseReturnNo` (String, unique) | `return_no` (text, unique) | ➜ renamed |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `items` (embedded Array) | **REMOVED** | Moved to `purchase_return_items` table |
| `sync` (Boolean) | **REMOVED** | |

---

## 13. `Customer` → `customers`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `phonenumber` (String) | `phone` (text) | ➜ renamed (not `phone_number`) |
| `email` (String) | `email` (text) | ✓ |
| `address` (String) | `address` (text) | ✓ |
| `password` (String) | `password` (text) | ✓ |
| `otp` (Number) | `otp` (text) | type changed |
| `otp_expiry` (Number) | `otp_expiry` (bigint) | type changed |
| `type` (String) | `type` (text) | ✓ |
| `creditLimit` (Number) | `credit_limit` (numeric) | ➜ |
| `wallet` (Number) | `wallet` (numeric) | ✓ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `created_by_id` (integer) | ➜ renamed |
| `customerNo` (Number) | `customer_no` (integer) | ➜ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `outstanding_balance` (numeric) ⊕ — cached sum of all credit sales outstanding

**New PG tables decomposed from old `UserPayment` model:**
- `customer_wallet_transactions` ⊕ — full audit log of every wallet change

---

## 14. `Supplier` → `suppliers`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `phoneNumber` (String) | `phone` (text) | ➜ renamed (not `phone_number`) |
| `email` (String) | `email` (text) | ✓ |
| `address` (String) | `address` (text) | ✓ |
| `wallet` (Number) | `wallet` (numeric) | ✓ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `outstanding_balance` (numeric) ⊕ — cached sum of unpaid purchase balances

**New PG tables decomposed from old `UserPayment` model:**
- `supplier_wallet_transactions` ⊕ — full audit log of every supplier payment

---

## 15. `Expenses` → `expenses`

| MongoDB field | PG column | Notes |
|---|---|---|
| `description` (String) | `description` (text) | ✓ |
| `amount` (Number) | `amount` (numeric) | ✓ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `attendant` (ObjectId) | `recorded_by_id` (integer) | ➜ renamed |
| `category` (ObjectId) | `category_id` (integer) | ➜ |
| `autoSave` (Boolean) | `is_recurring` (boolean) | ➜ renamed |
| `frequency` (String) | `frequency` (text) | ✓ |
| `nextOccurrence` (Date) | `next_occurrence_at` (timestamp) | ➜ renamed (note `_at` suffix) |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `lastRunDate` (Date) | **REMOVED** | |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `expense_no` (text, unique) ⊕ — auto-generated reference e.g. EXP12345

---

## 16. `ExpenseCategory` → `expense_categories`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

---

## 17. `Cashflow` → `cashflows`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `description` (text) | ➜ **renamed** field (was `name`, now `description`) |
| `amount` (Number) | `amount` (numeric) | ✓ |
| `category` (ObjectId) | `category_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `recorded_by_id` (integer) | ➜ renamed |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `bank` (ObjectId) | `bank_id` (integer) | ➜ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `cashflow_no` (text, unique) ⊕ — auto-generated reference e.g. CF12345

---

## 18. `CashFlowCategory` → `cashflow_categories`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `type` (String: cashin/cashout) | `type` (text: cashin/cashout) | ✓ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

---

## 19. `Bank` → `banks`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `amount` (Number) | `balance` (numeric) | ➜ **renamed** (was `amount`, now `balance`) |
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

---

## 20. `Adjustment` → `adjustments`

| MongoDB field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `type` (String: add/remove) | `type` (text: add/remove) | ✓ |
| `before` (Number) | `quantity_before` (numeric) | ➜ renamed |
| `after` (Number) | `quantity_after` (numeric) | ➜ renamed |
| `adjusted` (Number) | `quantity_adjusted` (numeric) | ➜ renamed |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `adjusted_by_id` (integer) ⊕ — who performed the adjustment
- `reason` (text) ⊕

---

## 21. `BadStock` → `bad_stocks`

| MongoDB field | PG column | Notes |
|---|---|---|
| `productId` (ObjectId) | `product_id` (integer) | ➜ |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `attendantId` (ObjectId) | `written_off_by_id` (integer) | ➜ renamed |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `unitPrice` (Number) | `unit_price` (numeric) | ➜ |
| `reason` (String) | `reason` (text) | ✓ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `sync` (Boolean) | **REMOVED** | |

---

## 22. `ProductTransfer` → `product_transfers` + `transfer_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `attendantId` (ObjectId) | `initiated_by_id` (integer) | ➜ renamed |
| `fromShopId` (ObjectId) | `from_shop_id` (integer) | ➜ |
| `toShopId` (ObjectId) | `to_shop_id` (integer) | ➜ |
| `productId` (Array of {product, quantity}) | **REMOVED** | Moved to `transfer_items` table |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `sync` (Boolean) | **REMOVED** | |

**New `transfer_items` table replaces the embedded `productId` array:**
- `transfer_id`, `product_id`, `quantity`, `unit_price` (price snapshot)

**New PG columns with no MongoDB equivalent:**
- `transfer_no` (text, unique) ⊕ — auto-generated reference e.g. TRF12345
- `transfer_note` (text) ⊕
- `purchase_id` (integer) ⊕ — links to purchase created at receiving shop when source is a warehouse

> **`transferhistory.js`** — the old model file was empty. No equivalent MongoDB schema existed. The new `transfer_items` table serves this purpose.

---

## 23. `StockCount` → `stock_counts` + `stock_count_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `attendantId` (ObjectId) | `conducted_by_id` (integer) | ➜ renamed |
| `shopId` (ObjectId) | `shop_id` (integer) | ➜ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `products` (embedded Array) | **REMOVED** | Moved to `stock_count_items` table |
| `sync` (Boolean) | **REMOVED** | |

**Embedded `products` array → `stock_count_items` table:**

| MongoDB sub-field | PG column | Notes |
|---|---|---|
| `productId` | `product_id` (integer) | ➜ |
| `physicalCount` | `physical_count` (numeric) | ➜ |
| `initialCount` | `system_count` (numeric) | ➜ **renamed** |
| `variance` | `variance` (numeric) | ✓ |
| `createdAt` | `created_at` (timestamp) | ➜ |

---

## 24. `stockrequest` → `stock_requests` + `stock_request_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `attendant` (ObjectId) | `requested_by_id` (integer) | ➜ renamed |
| `acceptedBy` (ObjectId) | `accepted_by_id` (integer) | ➜ |
| `approvedBy` (ObjectId) | `approved_by_id` (integer) | ➜ |
| `status` (String: 5 states) | `status` (text: same 5 states) | ✓ |
| `fromShop` (ObjectId) | `from_shop_id` (integer) | ➜ |
| `warehouse` (ObjectId) | `warehouse_id` (integer) | ➜ |
| `total` (Number) | `total` (numeric) | ✓ |
| `acceptedDate` (Date) | `accepted_at` (timestamp) | ➜ renamed |
| `dispatchedDate` (Date) | `dispatched_at` (timestamp) | ➜ renamed |
| `invoiceNumber` (String) | `invoice_number` (text) | ➜ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `requestData` (embedded Array) | **REMOVED** | Moved to `stock_request_items` table |
| `sync` (Boolean) | **REMOVED** | |

**Embedded `requestData` → `stock_request_items` table:**

| MongoDB sub-field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `inventory` (ObjectId) | **REMOVED** | Not needed — looked up via `product + shop` |
| `quantity` | `quantity` (numeric) | ✓ |
| `received` | `quantity_received` (numeric) | ➜ renamed |

---

## 25. `Order` → `orders` + `order_items`

| MongoDB field | PG column | Notes |
|---|---|---|
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `customer` (ObjectId) | `customer_id` (integer) | ➜ |
| `receiptNo` (String) | `receipt_no` (text) | ➜ |
| `status` (String: pending/completed/cancelled) | `status` (text) | ✓ |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `items` (Array of ObjectIds) | **REMOVED** | Relationship via `order_items.order_id` FK |
| `sync` (Boolean) | **REMOVED** | |

**`OrderItem` → `order_items`:**

| MongoDB field | PG column | Notes |
|---|---|---|
| `product` (ObjectId) | `product_id` (integer) | ➜ |
| `quantity` (Number) | `quantity` (numeric) | ✓ |
| `sellingPrice` (Number) | `unit_price` (numeric) | ➜ renamed |

**New PG columns with no MongoDB equivalent:**
- `attendant_id` (integer) ⊕ — on orders

---

## 26. `Subscription` → `subscriptions` + `subscription_shops`

| MongoDB field | PG column | Notes |
|---|---|---|
| `userId` (ObjectId → Admin) | `admin_id` (integer) | ➜ renamed |
| `packageId` (ObjectId) | `package_id` (integer) | ➜ |
| `mpesaCode` (String) | `payment_reference` (text) | ➜ renamed |
| `amount` (Number) | `amount` (numeric) | ✓ |
| `invoiceNo` (String) | `invoice_no` (text, unique) | ➜ |
| `status` (Boolean: active?) | `is_active` (boolean) | ➜ renamed |
| `paid` (Boolean) | `is_paid` (boolean) | ➜ renamed |
| `currency` (String) | `currency` (text) | ✓ |
| `startDate` (Date) | `start_date` (timestamp) | ➜ |
| `endDate` (Date) | `end_date` (timestamp) | ➜ |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `shop` (ObjectId — single shop) | **REMOVED** | Replaced by `subscription_shops` junction table |
| `shops` (Array of ObjectIds) | **REMOVED** | Replaced by `subscription_shops` junction table |
| `type` (String) | **REMOVED** | |
| `commission` (Number) | **REMOVED** | Commission handled in `awards` / affiliate system |
| `sync` (Boolean) | **REMOVED** | |

**New `subscription_shops` junction table** replaces `shop` + `shops`:
- `subscription_id`, `shop_id`

---

## 27. `Package` → `packages` + `package_features`

| MongoDB field | PG column | Notes |
|---|---|---|
| `title` (String) | `title` (text) | ✓ |
| `description` (String) | `description` (text) | ✓ |
| `durationValue` (Number) | `duration_value` (integer) | ➜ |
| `durationUnit` (String) | `duration_unit` (text) | ➜ |
| `amount` (Number) | `amount` (numeric) | ✓ |
| `amountusd` (Number) | `amount_usd` (numeric) | ➜ renamed |
| `discount` (Number) | `discount` (numeric) | ✓ |
| `status` (Boolean) | `is_active` (boolean) | ➜ renamed |
| `order` (Number) | `sort_order` (integer) | ➜ renamed |
| `type` (String: trial/production) | `type` (text) | ✓ |
| `maxShops` (Number) | `max_shops` (integer) | ➜ |
| `features` (String[]) | **REMOVED** | Moved to `package_features` table |
| `sync` (Boolean) | **REMOVED** | |

**New `package_features` table:**
- `id`, `package_id`, `feature` (text), `sort_order` (integer)

---

## 28. `Affliate` → `affiliates`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `phonenumber` (String) | `phone` (text) | ➜ renamed (not `phone_number`) |
| `email` (String) | `email` (text, unique) | ✓ |
| `address` (String) | `address` (text) | ✓ |
| `country` (String) | `country` (text) | ✓ |
| `password` (String) | `password` (text) | ✓ |
| `commission` (Number) | `commission` (numeric) | ✓ |
| `wallet` (Number) | `wallet` (numeric) | ✓ |
| `blocked` (Boolean) | `is_blocked` (boolean) | ➜ renamed |
| `active` (Boolean) | `is_active` (boolean) | ➜ renamed |
| `code` (String) | `code` (text, unique) | ✓ |
| `otp` (Number) | `otp` (text) | type changed |
| `otp_expiry` (Number) | `otp_expiry` (bigint) | type changed |
| `createAt` (Date) | `created_at` (timestamp) | ➜ typo fixed |
| `sync` (Boolean) | **REMOVED** | |

**New PG tables:**
- `affiliate_transactions` ⊕ — explicit wallet ledger (type: withdraw/subscription, `is_completed`)

---

## 29. `Awards` → `awards`

| MongoDB field | PG column | Notes |
|---|---|---|
| `totalAmount` (Number) | `amount` (numeric) | ➜ renamed |
| `balance` (Number) | **REMOVED** | Not tracked on award rows |
| `mpesaCode` (String) | `payment_reference` (text) | ➜ renamed |
| `paymentNo` (String, unique) | `payment_no` (text, unique) | ➜ |
| `currency` (String) | `currency` (text) | ✓ |
| `type` (String: earnings/usage) | `type` (text) | ✓ |
| `awardType` (String: open_shop/subscription) | `award_type` (text) | ➜ |
| `user` (ObjectId → Affliate) | `affiliate_id` (integer) | ➜ consolidated |
| `affliate` (ObjectId → Affliate) | — | merged into `affiliate_id` |
| `fromUser` (ObjectId → Admin) | `from_admin_id` (integer) | ➜ renamed |
| `shop` (ObjectId) | `shop_id` (integer) | ➜ |
| `shops` (Array of ObjectIds) | **REMOVED** | |
| `createdAt` (Date) | `created_at` (timestamp) | ✓ |
| `sync` (Boolean) | **REMOVED** | |

**New PG columns with no MongoDB equivalent:**
- `subscription_id` (integer) ⊕ — hard link to the subscription payment that triggered this award
- `commission_amount` (numeric) ⊕ — the affiliate's cut (commission% × amount)

---

## 30. `UserPayment` → (split into 3 tables)

The old single `UserPayment` model handled payments for customers, suppliers, and standalone deposits/withdrawals. The new schema splits it:

| Old context (by `type`) | New table |
|---|---|
| Customer deposit/withdraw/payment/refund | `customer_wallet_transactions` |
| Supplier payment/deposit/withdraw/refund | `supplier_wallet_transactions` |
| Sale instalment payment | `sale_payments` |
| Purchase instalment payment | `purchase_payments` |

---

## 31. `Measure` → **REMOVED**

The old `Measure` collection was a lookup table of measurement units (kg, litres, pcs, etc.) referenced as a FK on products (`measureUnit` field). In the new schema:
- `products.measure_unit` is a **plain text field** — no FK, no separate table.
- The old free-text `measure` field on products is merged into `measure_unit`.
- The Flutter `measures/` endpoint and `Measure` model in the app are **removed**.

---

## 32. `Setting` → `settings`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text, unique) | ✓ |
| `setting` (free-form Object) | `setting` (jsonb) | type changed: BSON object → JSONB |
| Mongoose `timestamps` | `created_at` + `updated_at` (timestamp) | `updated_at` NOT auto-managed — API must set it explicitly |
| `sync` (Boolean) | **REMOVED** | |

---

## 33. `Communication` → (not directly mapped)

| MongoDB field | Notes |
|---|---|
| `message` (String) | ➜ maps to `email_messages.body` for campaigns |
| `status` (sent/failed) | ➜ tracked in `emails_sent` |
| `user` (ObjectId → Admin) | ➜ `email_messages.admin_id` |
| `type` (email/sms) | ➜ `email_messages.type` |
| `contact` (String) | ➜ `email_messages.audience_emails` |
| `failedreason` (String) | **REMOVED** — not in new schema |

The old `communication` model was a simple send-audit log. The new schema replaces it with a structured campaign model (`email_messages`) and a dispatch log (`emails_sent`). There is **no direct equivalent** of the old per-message audit log with `failed` status tracking.

---

## 34. `ShopCategory` → `shop_categories` (in `system.ts`)

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `active` (Boolean) | `is_active` (boolean) | ➜ renamed |
| `sync` (Boolean) | **REMOVED** | |

---

## 35. `ProductCategory` → `product_categories`

| MongoDB field | PG column | Notes |
|---|---|---|
| `name` (String) | `name` (text) | ✓ |
| `admin` (ObjectId) | `admin_id` (integer) | ➜ |
| `sync` (Boolean) | **REMOVED** | |

---

## New Tables with No MongoDB Equivalent

| New PG table | Purpose |
|---|---|
| `permissions` | Master catalogue of permission groups and sub-keys |
| `product_serials` | Per-unit serial number tracking for serialised products |
| `bundle_items` | Explicit join table for bundle product components |
| `sale_item_batches` | Records which batch(es) each sale item was pulled from |
| `sale_payments` | Normalized payment instalments for sales |
| `purchase_payments` | Normalized payment instalments for purchases |
| `sale_return_items` | Line items for a sale return |
| `purchase_return_items` | Line items for a purchase return |
| `transfer_items` | Line items for a product transfer |
| `stock_count_items` | Line items for a stock count session |
| `stock_request_items` | Line items for a warehouse stock request |
| `subscription_shops` | Junction table: which shops are covered by a subscription |
| `package_features` | Individual feature strings belonging to a package |
| `customer_wallet_transactions` | Audit log for customer wallet changes |
| `supplier_wallet_transactions` | Audit log for supplier wallet/payment changes |
| `affiliate_transactions` | Wallet ledger for affiliates (earnings + withdrawals) |

---

## Removed MongoDB Collections with No PG Equivalent

| MongoDB model | Reason removed |
|---|---|
| `Measure` | Replaced by plain text `measure_unit` on products |
| `Staff` | Internal staff model — no role in new PG schema |
| `Language` | Localisation handled client-side |
| `Attribute` | Product attributes not modelled in new schema |
| `emailsSent` (emails_sent) | Kept but as structured `emails_sent` + `email_messages` |
| `messagesEmail` / `emailsSent` | Consolidated into `email_messages` + `emails_sent` |

---

## Cross-Cutting Changes

| Pattern | MongoDB | PostgreSQL |
|---|---|---|
| Primary keys | ObjectId strings (24-char hex) | Integer serials |
| `sync` flag | Present on every model | Removed entirely |
| Embedded sub-arrays | Denormalized inside document | Normalized to separate tables |
| Typos in field names | `createAt`, `referalCredit`, `affliate` | Fixed: `created_at`, `referral_credit`, `affiliate` |
| Boolean flags | Varied naming (`active`, `allowed*`, `is*`) | Consistent `is_*` prefix |
| `admin` field (on many models) | Often duplicated beside `attendantId` | Removed — derivable via attendant → admin |
| GeoJSON `location` field | 2dsphere Point object | Two `real` columns: `location_lat`, `location_lng` |
| All `phone` fields | `phonenumber` / `phoneNumber` | Uniformly `phone` |
