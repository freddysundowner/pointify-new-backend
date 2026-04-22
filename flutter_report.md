# Flutter App → New API Migration Report

Full analysis of all 297 Dart files across models, services, and controllers.

---

## 1. `end_points.dart` — Complete URL Rewrite

Every route changed. The new API is shop-scoped (`/api/shops/:shopId/...`).

### Auth

| Old | Method | New |
|---|---|---|
| `auth/register` | POST | `api/auth/admin/register` |
| `auth/login` | POST | `api/auth/admin/login` |
| `auth/admin/request/password` | POST | `api/auth/admin/forgot-password` |
| `auth/admin/reset/password` | POST | `api/auth/admin/reset-password` |
| `admin/:id` | GET | `api/auth/me` |
| `admin/:id` | PUT | `api/auth/me` |
| `admin/:id` | DELETE | `api/admins/:id` |
| `attendants/login` | POST | `api/auth/attendant/login` |
| `analysis/update/user/lastseen` | PUT | *(removed — updated on login automatically)* |
| `admin/sendverificationemail` | POST | `api/auth/admin/send-verification-email` |

### Shop & Warehouse

| Old | Method | New |
|---|---|---|
| `shop/` | POST | `api/shops` |
| `shop/admin/:adminId` | GET | `api/shops?adminId=:id` |
| `shop/:id` | GET/PUT | `api/shops/:id` |
| `shop/data/:id` | DELETE | `api/shops/:id` |
| `shop/category/` | GET | `api/shop-types` |
| `shop/redeem/usage` | PUT | `api/shops/:id/redeem-usage` |
| `shop/backup/interval` | PUT | `api/shops/:id/backup-interval` |
| `warehouse/` | POST | `api/shops` (with `warehouse: true`) |
| `warehouse/` | GET | `api/shops?type=warehouse` |
| `warehouse/request` | GET | `api/shops/:shopId/warehouse-requests` |
| `warehouse/request/approve` | PUT | `api/shops/:shopId/warehouse-requests/:id/approve` |
| `warehouse/delete/item` | DELETE | `api/shops/:shopId/warehouse-requests/:id/items/:itemId` |

### Attendants & Users

| Old | Method | New |
|---|---|---|
| `attendants/` | POST | `api/shops/:shopId/attendants` |
| `attendants/shop/filter?adminId=` | GET | `api/shops/:shopId/attendants` |
| `attendants/:id` | GET | `api/shops/:shopId/attendants/:id` |
| `attendants/:id` | PUT | `api/shops/:shopId/attendants/:id` |
| `attendants/:id` | DELETE | `api/shops/:shopId/attendants/:id` |
| `settings?type=` | GET | `api/settings?type=` |
| `themes` | GET | `api/themes` |

### Products

| Old | Method | New |
|---|---|---|
| `product/` | POST | `api/shops/:shopId/products` |
| `product/` | GET | `api/shops/:shopId/products` |
| `product/:id` | PUT/DELETE | `api/shops/:shopId/products/:id` |
| `product/category` | GET | `api/shops/:shopId/product-categories` |
| `product/category` | POST | `api/shops/:shopId/product-categories` |
| `product/images/:id` | PUT | `api/shops/:shopId/products/:id/images` |
| `product/import/products` | POST | `api/shops/:shopId/products/import` |
| `product/transfer/products` | POST | `api/transfers/import` |
| `product/stats/summary?shopid=` | GET | `api/shops/:shopId/reports/stock-stats` |
| `product/stockreport/:shopId` | GET | `api/shops/:shopId/reports/stock` |
| `counts` | POST | `api/shops/:shopId/stock-counts` |
| `counts/shop/:shopId` | GET | `api/shops/:shopId/stock-counts` |
| `counts/product/:id?shop=` | GET | `api/shops/:shopId/stock-counts/product/:productId` |
| `badstock` | POST/GET | `api/shops/:shopId/bad-stocks` |
| `badstock/summary` | GET | `api/shops/:shopId/bad-stocks/summary` |
| `badstock/product/filter` | GET | `api/shops/:shopId/bad-stocks?productId=` |
| `measures/` | GET | *(removed — unit is a free-text field on products)* |
| `transfer/shop/transfer` | POST | `api/transfers` |
| `transfer/filter` | GET | `api/transfers?shopId=` |
| `transfer/product` | GET | `api/transfers?productId=` |

### Sales

| Old | Method | New |
|---|---|---|
| `sales/` | POST | `api/shops/:shopId/sales` |
| `sales/:id` | PUT | `api/shops/:shopId/sales/:id` |
| `sales/filter` | GET | `api/shops/:shopId/sales` |
| `sales/single/receipt/:id` | GET | `api/shops/:shopId/sales/:id` |
| `sales/void/sale/:id` | PUT | `api/shops/:shopId/sales/:id/void` |
| `salereturns/` | POST | `api/shops/:shopId/sale-returns` |
| `salereturns/:id` | DELETE | `api/shops/:shopId/sale-returns/:id` |
| `salereturns/filter` | GET | `api/shops/:shopId/sale-returns` |
| `sales/orders/sale/online` | GET | `api/shops/:shopId/orders` |
| `sales/orders/sale/online/:id` | DELETE | `api/shops/:shopId/orders/:id` |
| `sales/product/filter` | GET | `api/shops/:shopId/reports/product-sales` |
| `sales/products/reports` | GET | `api/shops/:shopId/reports/product-sales` |
| `sales/discount/reports` | GET | `api/shops/:shopId/reports/discount-sales` |
| `sales/duesbydate/reports` | GET | `api/shops/:shopId/reports/dues-by-date` |
| `sales/product/month/analysis/` | GET | `api/shops/:shopId/reports/product-monthly-sales` |
| `sales/summary/month/analysis/product/` | GET | `api/shops/:shopId/reports/product-summary` |
| `sales/send/report/email` | GET | `api/shops/:shopId/reports/sales/email` |

### Payments

| Old | Method | New |
|---|---|---|
| `payments/recordSalePayment` | POST | `api/shops/:shopId/payments/sale` |
| `payments/recordPurchasePayment` | POST | `api/shops/:shopId/payments/purchase` |
| `payments` | GET | `api/shops/:shopId/payments` |
| `payment-methods` | GET | `api/shops/:shopId/payment-methods` |
| `customers/payments/delete` | DELETE | `api/shops/:shopId/payments/:id` |
| `payments/awards/` | GET | `api/shops/:shopId/awards` |
| `payments/checkpaymentstatus` | GET | `api/shops/:shopId/payments/:id/status` |

### Customers

| Old | Method | New |
|---|---|---|
| `customers/` | POST | `api/shops/:shopId/customers` |
| `customers/?type=&shopId=` | GET | `api/shops/:shopId/customers` |
| `customers/:id` | GET/PUT/DELETE | `api/shops/:shopId/customers/:id` |
| `customers/verify/:id` | PUT | `api/shops/:shopId/customers/:id/verify` |
| `customers/payments` | GET | `api/shops/:shopId/payments?customerId=` |
| `customers/import/customers` | POST | `api/shops/:shopId/customers/import` |

### Purchases

| Old | Method | New |
|---|---|---|
| `purchases/` | POST | `api/shops/:shopId/purchases` |
| `purchases/?start=&end=...` | GET | `api/shops/:shopId/purchases` |
| `purchasereturns/` | POST | `api/shops/:shopId/purchase-returns` |
| `purchasereturns/?supplierId=` | GET | `api/shops/:shopId/purchase-returns` |
| `purchases/product/filter` | GET | `api/shops/:shopId/reports/product-purchases` |
| `purchases/product/month/analysis` | GET | `api/shops/:shopId/reports/product-purchase-monthly` |
| `purchases/send/report/email` | GET | `api/shops/:shopId/reports/purchases/email` |

### Suppliers

| Old | Method | New |
|---|---|---|
| `suppliers/` | POST | `api/shops/:shopId/suppliers` |
| `suppliers/` | GET | `api/shops/:shopId/suppliers` |
| `suppliers/:id` | PUT/DELETE | `api/shops/:shopId/suppliers/:id` |

### Expenses

| Old | Method | New |
|---|---|---|
| `expenses/` | POST | `api/shops/:shopId/expenses` |
| `expenses/filter` | GET | `api/shops/:shopId/expenses` |
| `expenses/:id` | PUT/DELETE | `api/shops/:shopId/expenses/:id` |
| `expensescategory` | GET/POST | `api/shops/:shopId/expense-categories` |
| `expenses/total/category` | GET | `api/shops/:shopId/reports/expenses-by-category` |
| `expenses/transactions` | GET | `api/shops/:shopId/expenses` (with `categoryId` filter) |

### Cashflows & Banks

| Old | Method | New |
|---|---|---|
| `cashflowcategory/` | POST | `api/shops/:shopId/cashflow-categories` |
| `cashflowcategory/shop/:shopId` | GET | `api/shops/:shopId/cashflow-categories` |
| `cashflowcategory/:id` | PUT/DELETE | `api/shops/:shopId/cashflow-categories/:id` |
| `cashflow/` | POST | `api/shops/:shopId/cashflows` |
| `cashflow/:id` | PUT | `api/shops/:shopId/cashflows/:id` |
| `cashflow/transactions/:shopId` | GET | `api/shops/:shopId/cashflows` |
| `cashflow/transactions/category/:id` | GET | `api/shops/:shopId/cashflows?categoryId=` |
| `cashflow/shop/cashflow` | GET | `api/shops/:shopId/cashflows/summary` |
| `cashflow/total/category` | GET | `api/shops/:shopId/cashflow-categories/totals` |
| `cashflow/bank/` | POST | `api/shops/:shopId/banks` |
| `bank/list` | GET | `api/shops/:shopId/banks` |
| `bank/:id` | PUT/DELETE | `api/shops/:shopId/banks/:id` |
| `bank/transactions/:id` | GET | `api/shops/:shopId/banks/:id/transactions` |

### Analysis & Reports

| Old | Method | New |
|---|---|---|
| `analysis/stockanalysis/` | GET | `api/shops/:shopId/reports/stock-analysis` |
| `analysis/netprofit/` | GET | `api/shops/:shopId/reports/net-profit` |
| `analysis/sales/report` | GET | `api/shops/:shopId/reports/sales` |
| `analysis/profits/summary` | GET | `api/shops/:shopId/reports/gross-profit` |
| `analysis/report/purchases` | GET | `api/shops/:shopId/reports/purchases` |
| `customers/customers/debtors` | GET | `api/shops/:shopId/reports/debtors` |
| `customers/customers/debtors/excel` | GET | *(removed — no Excel export in new API)* |
| `analysis/backup/download` | GET | *(removed)* |

### Subscriptions & Packages

| Old | Method | New |
|---|---|---|
| `packages/` | GET | `api/packages` |
| `subscriptions` | GET | `api/subscriptions/me` |
| `subscriptions/inapp/ios` | POST | `api/subscriptions/inapp` |
| `subscriptions/stripe/updateAfterStripeSuccessPayment` | PUT | `api/subscriptions/stripe/confirm` |
| `payment/subscribe/` | POST | `api/subscriptions/subscribe` |
| `payment/subscribe/confirm` | POST | `api/subscriptions/confirm` |
| `/stripe/createIntent/` | POST | `api/stripe/create-intent` |

---

## 2. ID Field — All 31 Model Files

Every `fromJson` reads `json['_id']` (MongoDB ObjectId string). The new API returns integer `id`. The safest approach is to keep model fields as `String?` and call `.toString()` on the integer value.

**One model already correct:** `warehouse.dart` already reads `json['id']` — no change needed.

| Model file | Old read | Model field |
|---|---|---|
| `usermodel.dart` | `json['_id']` | `id` (String?) |
| `shop.dart` | `json['_id']` | `id` (String?) |
| `product.dart` | `json['_id']` | `sId` (String?) |
| `customer.dart` | `json['_id']` | `sId` (String?) |
| `supplier.dart` | `json['_id']` | `id` (String?) |
| `invoice.dart` | `json['_id']` | `sId` (String?) |
| `InvoiceItem` (inside invoice.dart) | `json['_id']` | `sId` (String?) |
| `salemodel.dart` | `json['_id']` | `sId` (String?) |
| `saleitem.dart` | `json['_id']` | `id` (String?) |
| `salereturn.dart` | `json['_id']` | `sId` (String?) |
| `Items` (inside salereturn.dart) | `json['_id']` | `sId` (String?) |
| `payment.dart` | `json['_id']` | `sId` (String?) |
| `expense.dart` | `json['_id']` | `id` (String?) |
| `expensecategory.dart` | `json['_id']` | `id` (String?) |
| `cashflow.dart` | `json['_id']` | `sId` (String?) |
| `cashflowcategory.dart` | `json['_id']` | `id` (String?) |
| `expensestransaction.dart` | `json["_id"]` | `sId` (String?) |
| `bank.dart` | `json['_id']` | `id` (String?) |
| `adjustment.dart` | `json['_id']` | `id` (String?) |
| `badstock.dart` | `json['productId']['_id']`, `json['shopId']['_id']`, `json['attendantId']['_id']` | `sId` (String?) |
| `awards.dart` | `json['_id']` | `sId` (String?) |
| `subscription.dart` | `json['_id']` | `sId` (String?) |
| `package.dart` | `json['_id']` | `id` (String?) |
| `inventory.dart` | `json['_id']` | `id` (String?) |
| `shoptype.dart` | `json['_id']` | `id` (String?) |
| `transferhistory.dart` | `json['_id']`, `json['attendantId']['_id']`, `json['fromShopId']['_id']`, `json['toShopId']['_id']` | `sId` (String?) |
| `transferitems.dart` | `json['_id']` | `sId` (String?) |
| `counthistory.dart` | `json['_id']` | `sId` (String?) |
| `ProductCount` (inside counthistory.dart) | `json['_id']` | `sId` (String?) |
| `debtor.dart` | `json['_id']` | `id` (String — **non-nullable**, will crash if null) |
| `warehouseitem.dart` | `json['_id']` | `id` (String?) |
| `wahoureinvoice.dart` | `json['_id']` | `id` (String?) |
| `order.dart` | `json['_id']` | `sId` (String?) |
| `Attendant` (inside product.dart) | `json['_id']` | `sId` (String?) |

---

## 3. Request Body Changes

### Attendant login — breaking change

```dart
// OLD
body: {"uid": uid, "password": password}

// NEW
body: {"pin": pin, "password": password, "shopId": shopId}
```

`uid` was the MongoDB ObjectId string. `pin` is the numeric PIN assigned at creation. `shopId` is now required. The attendant login screen (`attendant_login.dart`) uses `attendantUidController` — this must become a PIN field and a shop selector must be added.

### Password reset — field rename

```dart
// OLD
body: {"email": email, "newpassword": password, "otp": otp}

// NEW
body: {"email": email, "password": password, "otp": otp}
```

### Admin login — no change

```dart
body: {"email": email, "password": password}  // unchanged
```

### Create attendant — field renames

```dart
// OLD (usercontroller.dart createAttendant)
{
  "password": pw, "username": name, "uniqueDigits": pin,
  "shopId": id, "adminId": adminId, "permissions": all
}

// NEW
{
  "password": pw, "username": name, "pin": pin, "shopId": id
  // adminId derived from JWT; permissions sent in a separate PUT
}
```

`uniqueDigits` → `pin`. `adminId` is no longer sent in the body.

### Create shop — field renames in body

```dart
// OLD (shopcontroller.dart createShop)
{
  "allowOnlineSelling": bool, "backupInterval": string,
  "shopCategoryId": id, "useWarehouse": bool, ...
}

// NEW
{
  "online_selling": bool, "backup_interval": string,
  "shop_category_id": id, "use_warehouse": bool, ...
}
```

---

## 4. Response Shape Changes

### Login response — major change

Old API returned the **bare user object**, parsed directly as `UserModel.fromJson(response)`.  
New API returns a wrapper:

```json
{ "token": "jwt...", "admin": { "id": 1, "email": "...", ... } }
```

`authcontroller.dart` currently does:

```dart
UserModel.fromJson(response)
```

Must change to:

```dart
await prefs.saveString('user_token', response['token']);
UserModel.fromJson(response['admin'])
```

### Attendant login response

Old: bare attendant object with `usertype: "attendant"` merged in.  
New: `{ "token": "...", "attendant": { ... } }` — same wrapper pattern.

### Paginated list responses

Old API returned bare arrays for lists. New API wraps all paginated results:

```json
{ "data": [...], "pagination": { "page": 1, "limit": 50, "total": 200, "totalPages": 4 } }
```

Every controller that iterates a list response needs updating:

```dart
// OLD
List sales = response;

// NEW
List sales = response["data"];
```

---

## 5. Field Name Changes — Every `fromJson`

### `shop.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['_id']` | `json['id'].toString()` |
| `json['trackbatches']` | `json['track_batches']` |
| `json['allownegativeselling']` | `json['negative_selling']` |
| `json['allowOnlineSelling']` | `json['online_selling']` |
| `json['allowBackup']` | `json['allow_backup']` |
| `json['receiptemail']` | `json['receipt_email']` |
| `json['backupInterval']` | `json['backup_interval']` |
| `json['backupemail']` | `json['backup_email']` |
| `json['warehouseemail']` | **REMOVED** — no equivalent field in new schema |
| `json['useWarehouse']` | **REMOVED** — derived from `json['warehouse']` flag |
| `json['shopCategoryId']` | `json['shop_category_id']` |
| `json['adminId']` (owner expand) | `json['admin_id']` |

### `product.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['_id']` | `json['id'].toString()` |
| `json['productType']` | `json['type']` |
| `json['measure']` | `json['measure_unit']` |
| `json['wholesalePrice']` | `json['wholesale_price']` |
| `json['dealerPrice']` | `json['dealer_price']` |
| `json['minSellingPrice']` | `json['min_selling_price']` |
| `json['maxDiscount']` | `json['max_discount']` |
| `json['reorderLevel']` | `json['reorder_level']` |
| `json['buyingPrice']` | `json['buying_price']` |
| `json['sellingPrice']` | `json['selling_price']` |
| `json['inventoryId']` | `json['inventory_id']` |
| `json['manageByPrice']` | `json['manage_by_price']` |
| `json['totalSoldQty']` | `json['total_sold_qty']` |
| `json['salesCount']` | `json['sales_count']` |
| `json['bundleItems']` | `json['bundle_items']` |
| `json['productCategoryId']` | `json['product_category_id']` |
| `json['supplierId']` | `json['supplier_id']` |
| `json['shopId']` | `json['shop_id']` |
| `json['attendantId']` | `json['attendant_id']` |
| `json['uploadImage']` | `json['thumbnail_url']` |
| `json['lastcoundate']` | `json['last_count_date']` |

### `usermodel.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['_id']` | `json['id'].toString()` |
| `json['emailVerified']` | `json['email_verified']` |
| `json['phoneVerified']` | `json['phone_verified']` |
| `json['smscredit']` | `json['sms_credit']` — now on the admin object; shows remaining SMS balance |
| `json['saleSmsEnabled']` | `json['sale_sms_enabled']` — now a **shop-level** field, not admin-level; read from the shop object |
| `json['emailVerificationDate']` | `json['email_verification_date']` |
| `json['lastAppRatingDate']` | `json['last_app_rating_date']` |
| `json['referalCredit']` | `json['referral_credit']` |
| `json['primaryShop']` | `json['primary_shop_id']` |
| `json['usertype']` | `json['user_type']` |
| `json['uniqueDigits']` | `json['pin']` |
| `json['attendantId']` | `json['attendant_id']` |
| `json['shopId']` (attendant's shop) | `json['shop_id']` |

### `customer.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['creditLimit']` | `json['credit_limit']` |
| `json['phonenumber']` | `json['phone']` |
| `json['shopId']` | `json['shop_id']` |
| `json['attendantId']` | `json['created_by_id']` |
| `json['customerNo']` | `json['customer_no']` |
| `json['createAt']` | `json['created_at']` |
| `json['totalDebt']` | `json['outstanding_balance']` |

### `supplier.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['phoneNumber']` | `json['phone']` |
| `json['totalDebt']` | `json['outstanding_balance']` |
| `json['shopId']` | `json['shop_id']` |

### `invoice.dart` (purchase)

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['paymentType']` | `json['payment_type']` |
| `json['amountPaid']` | `json['amount_paid']` |
| `json['totalAmount']` | `json['total_amount']` |
| `json['outstandingBalance']` | `json['outstanding_balance']` |
| `json['purchaseNo']` | `json['purchase_no']` |
| `json['purchaseReturnNo']` | `json['return_no']` |
| `json['shopId']` | `json['shop_id']` |
| `json['supplierId']` | `json['supplier_id']` |
| `json['attendantId']` | `json['attendant_id']` |
| `json['refundAmount']` | `json['refund_amount']` |
| `InvoiceItem: json['unitPrice']` | `json['unit_price']` |
| `InvoiceItem: json['lineDiscount']` | `json['line_discount']` |
| `InvoiceItem: json['selligPrice']` | `json['selling_price']` |

### `salemodel.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['totalDiscount']` | `json['total_discount']` |
| `json['totaltax']` | `json['total_tax']` |
| `json['totalAmount']` | `json['total_amount']` |
| `json['totalWithDiscount']` | `json['total_with_discount']` |
| `json['receiptNo']` | `json['receipt_no']` |
| `json['shopId']` | `json['shop_id']` |
| `json['customerId']` | `json['customer_id']` |
| `json['attendantId']` | `json['attendant_id']` |
| `json['mpesaNewTotal']` | `json['mpesa_total']` |
| `json['amountPaid']` | `json['amount_paid']` |
| `json['bankTotal']` | `json['bank_total']` |
| `json['paymentType']` | `json['payment_type']` |
| `json['saleType']` | `json['sale_type']` |
| `json['paymentTag']` | **REMOVED** — no equivalent field in new schema |
| `json['salesnote']` | `json['sale_note']` |
| `json['outstandingBalance']` | `json['outstanding_balance']` |
| `json['duedate']` | `json['due_date']` |
| `json['orderId']` | `json['order_id']` |
| `json['order']` (String status) | `json['order_id']` (integer FK) — semantics changed |
| `json['mpesaTotal']` (old) + `json['mpesaNewTotal']` (new) | `json['mpesa_total']` — consolidated |

### `saleitem.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['unitPrice']` | `json['unit_price']` |
| `json['lineDiscount']` | `json['line_discount']` |
| `json['attendantId']` | `json['attendant_id']` |
| `json['totalLinePrice']` | `json['total_line_price']` |

### `salereturn.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['saleId']` | `json['sale_id']` |
| `json['customerId']` | `json['customer_id']` |
| `json['attendantId']` | `json['processed_by_id']` |
| `json['refundAmount']` | `json['refund_amount']` |
| `json['saleReturnNo']` | `json['return_no']` |

### `payment.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['totalAmount']` / `json['amount']` | `json['amount']` |
| `json['attendantId']` | `json['received_by_id']` or `json['handled_by_id']` |
| `json['customerId']` | `json['customer_id']` |
| `json['mpesaCode']` | `json['payment_reference']` |
| `json['paymentType']` | `json['payment_type']` |
| `json['paymentNo']` | `json['payment_no']` |
| `json['supplierId']` | `json['supplier_id']` |

### `expense.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['createAt']` | `json['created_at']` |
| `json['nextOccurrence']` | `json['next_occurrence_at']` |
| `json['autoSave']` | `json['is_recurring']` |
| `json['attendant']` (attendant id) | `json['recorded_by_id']` |

### `cashflow.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['name']` | `json['description']` |
| `json['attendantId']` | `json['recorded_by_id']` |
| `json['shopId']` | `json['shop_id']` |
| `json['bank']` | `json['bank_id']` |
| `json['createAt']` | `json['created_at']` |

### `cashflowcategory.dart` and `expensecategory.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['createAt']` | `json['created_at']` |
| `json['totalAmount']` | `json['total_amount']` |

### `expensestransaction.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['createAt']` | `json['created_at']` |
| `json['attendantId']` | `json['attendant_id']` |

### `awards.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['awardType']` | `json['award_type']` |
| `json['totalAmount']` | `json['amount']` |
| `json['paymentNo']` | `json['payment_no']` |

### `subscription.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['userId']` | `json['admin_id']` or `json['shop_id']` |
| `json['packageId']` | `json['package_id']` |
| `json['startDate']` | `json['start_date']` |
| `json['endDate']` | `json['end_date']` |

### `package.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['amountusd']` | `json['amount_usd']` |
| `json['displayprice']` | `json['display_price']` |
| `json['durationUnit']` | `json['duration_unit']` |
| `json['durationValue']` | `json['duration_value']` |
| `json['maxShops']` | `json['max_shops']` |

### `wahoureinvoice.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['requestData']` | `json['items']` |
| `json['fromShop']` | `json['from_shop_id']` |
| `json['invoiceNumber']` | `json['invoice_number']` |
| `json['acceptedBy']` | `json['accepted_by_id']` |
| `json['acceptedDate']` | `json['accepted_at']` |
| `json['dispatchedDate']` | `json['dispatched_at']` |

### `bank.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['amount']` | `json['balance']` |
| `json['shop']` | `json['shop_id']` |
| `json['createAt']` | `json['created_at']` |

### `adjustment.dart`

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['before']` | `json['quantity_before']` |
| `json['after']` | `json['quantity_after']` |
| `json['adjusted']` | `json['quantity_adjusted']` |
| `json['shop']` | `json['shop_id']` |
| `json['product']` | `json['product_id']` |

### `counthistory.dart` (StockCount + embedded ProductCount)

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['attendantId']` | `json['conducted_by_id']` |
| `json['shopId']` | `json['shop_id']` |
| ProductCount: `json['productId']` | `json['product_id']` |
| ProductCount: `json['physicalCount']` | `json['physical_count']` |
| ProductCount: `json['initialCount']` | `json['system_count']` |
| ProductCount: `json['variance']` | `json['variance']` |

### `communication.dart` — NEW MODEL (replace old SMS service pattern)

The old API used a flat `sendSms()` service call with no response model. The new API logs every send as a `Communications` record, and SMS credits are tracked per admin.

New Dart models to create:

**`Communication`** (maps to `communications` table)

| Field | Dart type | `json[key]` |
|---|---|---|
| `id` | `int` | `json['id']` |
| `adminId` | `int?` | `json['admin_id']` |
| `message` | `String` | `json['message']` |
| `status` | `String` | `json['status']` — `"sent"` \| `"failed"` |
| `type` | `String` | `json['type']` — `"sms"` \| `"email"` |
| `contact` | `String` | `json['contact']` |
| `failedReason` | `String?` | `json['failed_reason']` |
| `createdAt` | `DateTime` | `json['created_at']` |

**`SmsCreditTransaction`** (maps to `sms_credit_transactions` table)

| Field | Dart type | `json[key]` |
|---|---|---|
| `id` | `int` | `json['id']` |
| `adminId` | `int` | `json['admin_id']` |
| `type` | `String` | `json['type']` — `top_up` \| `deduction` \| `adjustment` \| `refund` |
| `amount` | `int` | `json['amount']` — positive or negative |
| `balanceAfter` | `int` | `json['balance_after']` |
| `description` | `String?` | `json['description']` |
| `communicationId` | `int?` | `json['communication_id']` |
| `createdAt` | `DateTime` | `json['created_at']` |

**`EmailTemplate`** (maps to `email_templates` table)

| Field | Dart type | `json[key]` |
|---|---|---|
| `id` | `int` | `json['id']` |
| `name` | `String` | `json['name']` |
| `slug` | `String` | `json['slug']` |
| `htmlContent` | `String` | `json['html_content']` |
| `category` | `String` | `json['category']` |
| `placeholders` | `List<String>` | `json['placeholders']` |

**`usermodel.dart`** — update `sms_credit` field:
- `json['smscredit']` → `json['sms_credit']` *(int, default 0)*
- Display this value in the admin settings screen as "SMS Credits Remaining"

**`shop.dart`** — add `sale_sms_enabled` field:
- `json['saleSmsEnabled']` was **removed from admin** and **moved to shop**
- Read it from the shop object: `json['sale_sms_enabled']` *(bool, default false)*
- When `sale_sms_enabled = true` and `admin.sms_credit > 0`, the app should show that an SMS receipt will be sent

**New endpoints to call:**

| Action | Endpoint |
|---|---|
| Check SMS balance | `GET /api/sms/balance` → `{ sms_credit: int }` |
| Top up credits | `POST /api/sms/top-up` → triggers M-Pesa STK push |
| View credit history | `GET /api/sms/transactions` |
| View send log | `GET /api/admin/communications` |
| Re-send failed | `POST /api/admin/communications/:id/resend` |
| Send one SMS/email | `POST /api/admin/communications/send` |
| Bulk SMS by segment | `POST /api/admin/communications/bulk-sms` |

### `awards.dart` — additional renames

| Old `json[key]` | New `json[key]` |
|---|---|
| `json['mpesaCode']` | `json['payment_reference']` |
| `json['user']` / `json['affliate']` | `json['affiliate_id']` |
| `json['fromUser']` | `json['from_admin_id']` |
| `json['shops']` (array) | **REMOVED** |

### `badstock.dart` — hardcoded nested path reads

This model directly drills into nested objects using `_id`. All three nested objects must change:

```dart
// OLD
product = Product(sId: json['productId']['_id'],   name: json['productId']['name'], ...)
shop     = Shop(id: json['shopId']['_id'],          name: json['shopId']['name'])
attendant= Attendant(sId: json['attendantId']['_id'], username: json['attendantId']['username'])

// NEW — key names change AND nested _id → id
product  = Product(sId: json['product_id']['id'].toString(), name: json['product_id']['name'], ...)
shop     = Shop(id: json['shop_id']['id'].toString(),         name: json['shop_id']['name'])
attendant= Attendant(sId: json['attendant_id']['id'].toString(), username: json['attendant_id']['username'])
```

### `transferhistory.dart` — same hardcoded nested pattern

```dart
// OLD
Attendant(sId: json['attendantId']['_id'], username: ...)
Shop(id: json['fromShopId']['_id'], name: ...)
Shop(id: json['toShopId']['_id'],   name: ...)
// TransferItem also reads json['product']['_id'] via Product.fromJson

// NEW
Attendant(sId: json['attendant_id']['id'].toString(), username: ...)
Shop(id: json['from_shop_id']['id'].toString(), name: ...)
Shop(id: json['to_shop_id']['id'].toString(),   name: ...)
```

---

## 6. Permissions Format — Deep Impact

Old format (stored on `UserModel.permisions`):

```json
[{"key": "pos", "value": "can_sell"}, {"key": "stocks", "value": "view_products"}]
```

New format (flat strings):

```json
["pos.can_sell", "stocks.view_products"]
```

**All files that need changing:**

| File | What to change |
|---|---|
| `usercontroller.dart` — `getRoles()` | Builds `{"key": e["key"], "value": e["value"]}` objects. Must split on `.` instead: `e.split('.')` → `{"key": parts[0], "value": parts[1]}` |
| `usercontroller.dart` — `createAttendant()` | Sends `"permissions": all` where `all` is a list of objects. Must send flat strings: `["pos.can_sell", ...]` |
| `usercontroller.dart` — `updateAttendant()` | Same permissions list — must use flat strings |
| All attendant permission UI screens | Any code reading `element["key"]` / `element["value"]` from `userController.roles` must be updated |
| Permission guard checks | Any code like `.any((e) => e["key"] == "pos" && e["value"] == "can_sell")` must change to `.contains("pos.can_sell")` |

---

## 7. Controller-Level Response Parsing Issues

Beyond model field names, these controllers parse the response wrapper incorrectly for the new API:

| Controller | Current code | What it should be |
|---|---|---|
| `salescontroller.getDailySalesGraph` | `response["sales"]` | `response["data"]` |
| `salescontroller.getGraphSales` | `response["data"]` | ✓ already correct |
| `salescontroller.getOrders` | `response["data"]` | ✓ already correct |
| `shopcontroller.getShops` | bare `response` (expects array) | `response["data"]` |
| `shopcontroller.createShop` | `Shop.fromJson(response)` | `Shop.fromJson(response["data"] ?? response)` |
| `usercontroller.getAttendants` | bare list cast from `User.getAttendants()` | `response["data"]` |
| `usercontroller.createAttendant` | calls `User.getAttendants()` directly | same issue propagates |
| `purchasecontroller` | reads response directly as list | `response["data"]` |
| `stockcontroller` | reads response directly as list | `response["data"]` |
| `reportscontroller` | reads report values directly | wrap access: `response["data"]` |

---

## 8. `toJson` Serialisation — Bodies Sent to the API

Every `toJson()` used in POST/PUT bodies also needs updating:

| Model | Old body keys | New body keys |
|---|---|---|
| `Customer.toJson()` | `_id`, `phonenumber`, `shopId`, `attendantId`, `customerNo`, `createAt` | `id`, `phone`, `shop_id`, `created_by_id`, `customer_no`, `created_at` |
| `Product.toJson()` | `measure`, `buyingPrice`, `sellingPrice`, `minSellingPrice`, `reorderLevel`, `maxDiscount`, `productCategoryId`, `supplierId`, `shopId`, `attendantId`, `uploadImage`, `lastcoundate` | all snake_case equivalents |
| `SaleModel.toJson()` | `shopId`, `customerId`, `attendantId`, `paymentType`, `outstandingBalance` | `shop_id`, `customer_id`, `attendant_id`, `payment_type`, `outstanding_balance` |
| `Supplier.toJson()` | `_id`, `shopId` | `id`, `shop_id` |
| `Shop.toJson()` | `_id`, `shopCategoryId`, `adminId` | `id`, `shop_category_id`, `admin_id` |
| `Invoice.toJson()` | `shopId`, `supplierId`, `attendantId`, `paymentType`, `outstandingBalance`, `purchaseNo` | snake_case equivalents |
| `SaleReturn.toJson()` | `saleId`, `customerId`, `attendantId`, `refundAmount`, `saleReturnNo` | snake_case equivalents |

---

## 9. `PreferenceManager` — Token Storage

The app stores the auth token under key `'user_token'`. The new API issues separate JWTs for admins and attendants. Recommended approach:

- Keep `'user_token'` as the key for the active session token regardless of user type
- Add `'user_type'` key storing `"admin"` or `"attendant"` for post-login role routing
- No changes needed to the `DbBase` HTTP client — it already reads `'user_token'` for every request

---

## 10. Features to Remove or Stub Out

These integrations no longer exist in the new backend:

| Feature | Files to remove / stub |
|---|---|
| Firebase Firestore (chat) | `controllers/chat_controller.dart`, `services/firestore_files_access_service.dart`, `models/chat.dart`, `models/chat_message_type.dart`, all chat screens |
| Firebase Dynamic Links | `services/dynamic_link_services.dart` |
| Stripe SDK (direct) | `controllers/shopcontroller.dart` — `openStripe()`, `checkStripeStatus()`, all `flutter_stripe` imports; `screens/usage/` Stripe screens |
| SMS top-up direct | `services/sms_service.dart` — old direct top-up flow replaced by new M-Pesa STK push via `POST /api/sms/top-up`; update to new endpoint and handle the new credit balance response |
| Backup download | `controllers/reports_controller.dart` — `backupnow` / `analysis/backup/download` |
| `measures/` endpoint | Any `getMeasures()` call in `productcontroller.dart` |
| Excel report download | `reports_controller.dart` — `debtorexcel` usage |
| Email report send | `services/sales_service.dart` — `sendReportEmail`, `services/purchase_service.dart` — `sendReportEmail` |
| `analysis/update/user/lastseen` | `services/user.dart` — `updateLastSeen()` method |

---

## 11. Summary Count

| Category | Count |
|---|---|
| Endpoint URLs to rewrite | ~90 |
| Model files with `_id` → `id` change | 31 |
| Model files with snake_case field renames | 21 |
| Models with hardcoded nested `_id` reads | 2 (`badstock.dart`, `transferhistory.dart`) |
| Controllers with response wrapper fix needed | 9 |
| Request bodies with field renames | 12 |
| Firebase / Stripe integrations to remove | 5 (SMS top-up is NOT removed — update to new endpoint) |
| Permission format fix touchpoints | 5+ |
| New Dart models to create | 3 (`Communication`, `SmsCreditTransaction`, `EmailTemplate`) |

---

## 12. New Required Fields — Flutter Must Send or Handle

These fields exist only in the new PG schema and were not in the old MongoDB API. They affect either what the Flutter app must **include in request bodies** or what it can now **read from responses**.

### Fields Flutter must now send in request bodies

| Endpoint | New required field | Notes |
|---|---|---|
| `POST /sale-returns` | `refund_method` (text) | cash / mpesa / card / bank / store_credit — was not required in old API |
| `POST /purchase-returns` | `refund_method` optional but supported | |
| `POST /sales` | `card_total` (number) | Include when payment includes card |
| `POST /expenses` | no new required fields | `is_recurring` replaces `autoSave` |
| `POST /cashflows` | `description` (required) | Was `name` in old API |

### New fields available in API responses (add to Flutter models)

| Model / table | New field | What it means |
|---|---|---|
| `customer` | `outstanding_balance` | Total unpaid credit across all sales — add to `customer.dart` |
| `supplier` | `outstanding_balance` | Total unpaid credit across all purchases — add to `supplier.dart` |
| `sale` | `card_total` | Portion paid by card — add to `salemodel.dart` |
| `sale_return` | `refund_method`, `refund_reference` | How refund was issued — add to `salereturn.dart` |
| `expense` | `expense_no` | Auto-generated reference code — add to `expense.dart` |
| `cashflow` | `cashflow_no` | Auto-generated reference code — add to `cashflow.dart` |
| `product_transfer` | `transfer_no`, `transfer_note`, `purchase_id` | Reference and warehouse purchase link — add to `transferhistory.dart` |
| `product` | `sku` | Stock-keeping unit code — optional addition to `product.dart` |
| `sale_item` | `cost_price` | Buying price at time of sale — add to `saleitem.dart` for margin tracking |
| `adjustment` | `adjusted_by_id`, `reason` | Who adjusted and why — add to `adjustment.dart` |
| `stock_count_items` | `system_count` | System stock at time of count — replaces old `initialCount` |
| `subscription` | `is_active` + `is_paid` | Replaces old boolean `status` and `paid` — update `subscription.dart` |
| `affiliate_transaction` | `is_completed`, `type` (withdraw/subscription) | New wallet ledger — new Dart model needed |

### Fields REMOVED from API responses — remove from Flutter models

| Model | Removed field | Why |
|---|---|---|
| `shop.dart` | `warehouseemail` | Not in new schema |
| `shop.dart` | `useWarehouse` | Derive from `warehouse` flag |
| `shop.dart` | `deletewarning` | Not in new schema |
| `salemodel.dart` | `paymentTag` | Replaced by `payment_type` |
| `salemodel.dart` | `mpesaNewTotal` | Merged into `mpesa_total` |
| `salemodel.dart` | `batchId` | Batch tracking is per sale item |
| `usermodel.dart` | `permissions` (on admin) | Admins no longer have their own permissions string |
| `usermodel.dart` | `status` (online/offline/hybrid) | Sync concept removed |
| `usermodel.dart` | `syncInterval` | Sync concept removed |
| `usermodel.dart` | `smscredit` | **Renamed to `sms_credit`** — field stays on admin object (credit balance) |
| `shop.dart` | `saleSmsEnabled` | **Moved + renamed to `sale_sms_enabled`** — now on the shop object, not the admin |
| `usermodel.dart` | `lastAppRatingDate` | Not in new schema |
| `product.dart` | `virtual` (boolean) | Encoded in `type = 'virtual'` |
| `product.dart` | `bundle` (boolean) | Encoded in `type = 'bundle'` |
| `product.dart` | `quantity`, `lastCount`, `reorderLevel` | Moved to inventory table/endpoint |
| `awards.dart` | `balance` | Not tracked on award rows |
| `awards.dart` | `shops` (array) | Not in new schema |
| `subscription.dart` | `commission` | Affiliate commission is in awards system |
| `subscription.dart` | `type` | Not in new schema |
| `payment.dart` | all fields | The `UserPayment` model is split across 4 tables — the Flutter `payment.dart` model needs refactoring for each context |

---

## 13. Recommended Migration Order

1. **`end_points.dart`** — new URL map (unblocks everything)
2. **`usermodel.dart`** — login works first
3. **Auth flow** (`authcontroller.dart`, `authentication.dart`) — login/register/reset request bodies + response unwrapping
4. **`shop.dart`** — required before products, sales, or any shop-scoped call
5. **`product.dart`** — most referenced model throughout
6. **`salemodel.dart` + `saleitem.dart`** — core POS flow
7. **`customer.dart`, `supplier.dart`, `invoice.dart`** — supporting models
8. **All remaining models** — cashflow, expenses, adjustments, bad stocks, transfers
9. **Permissions format** — `usercontroller.dart` + all permission guard checks
10. **Controller response wrappers** — swap bare `response` → `response["data"]`
11. **`toJson` bodies** — snake_case keys for all POST/PUT requests
12. **Remove Firebase/Stripe dependencies** — clean up imports and stub removed screens
