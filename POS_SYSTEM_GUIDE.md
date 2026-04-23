# Point of Sale (POS) System — Complete Operational Guide

A structured, end-to-end walkthrough of how a modern POS system works, from business setup through daily operations to reporting and growth.

---

## Part 1 — Business Setup

Before any sale can happen, the business must be configured.

### 1.1 Owner / Admin Account
- The business owner registers a super-admin account (name, email, password).
- Email is verified via OTP before access is granted.
- The owner can later add additional admin accounts for managers.

### 1.2 Business Profile (Shop)
- Create one or more **shops** (a single business can run multiple branches).
- Each shop has: name, address, contact number, currency, tax settings.
- Shop-level toggles: online selling enabled/disabled, loyalty programme enabled/disabled, stock visibility on public catalog, price visibility on public catalog.

### 1.3 Receipt Customisation
- Upload a logo that prints on receipts.
- Set a custom footer message ("Thank you for shopping with us!").
- Choose whether to show tax line and discount line on printed/email receipts.
- Set the backup email address where nightly backups are sent.

### 1.4 Staff Accounts

**Attendants (cashiers/sales staff)**
- Owner adds attendants: name, username, PIN/password.
- Each attendant is assigned to one or more shops.
- Attendants only see their own sales; they cannot access admin reports.

**Affiliate accounts** (optional)
- Affiliates can refer customers and earn commission.

### 1.5 Packages & Subscriptions
- The platform offers feature packages (Basic, Standard, Premium etc.).
- Each shop is enrolled on a package which controls feature limits.

---

## Part 2 — Product Catalogue

### 2.1 Product Categories
- Create categories to group products (Beverages, Snacks, Electronics, etc.).
- Categories are shop-wide and used for filtering and reporting.

### 2.2 Products
Every product record holds:
| Field | Purpose |
|---|---|
| Name | Display name |
| Category | Grouping |
| Buying price | Cost of goods (used in profit calculations) |
| Selling price | Default retail price |
| Wholesale price | Alternate price tier |
| Min selling price | Floor — attendant cannot sell below this |
| Max discount | Maximum discount % allowed |
| Barcode | Scan-to-add at POS |
| Product type | `product` (physical), `service`, `virtual` |
| Images | Product photos for online catalog |
| Tax flag | Whether VAT/tax applies |

### 2.3 Product Types and Inventory
- **Physical products** — inventory is tracked; stock decreases with every sale.
- **Service products** — no inventory (e.g. installation fee, consultation).
- **Virtual products** — digital goods; no inventory deduction.

### 2.4 Attributes and Variants
- Products can have attributes (Size: S/M/L, Colour: Red/Blue).
- Each attribute combination is a **variant** with its own price and stock.

### 2.5 Units of Measure
- Define measures (kg, litres, pieces, boxes) and assign to products.
- Affects how quantities are entered and displayed.

### 2.6 Bundle Products
- A bundle is a product composed of other products (e.g. a gift hamper).
- When a bundle is sold, each component's inventory is deducted individually.

---

## Part 3 — Suppliers & Purchasing

### 3.1 Supplier Directory
- Add suppliers: name, phone, email, address, payment terms.
- Every purchase is linked to a supplier for debt tracking.

### 3.2 Purchase Order Flow

```
Create Purchase → Add Line Items → Confirm Receipt → Update Inventory → Record Payment
```

1. **Create purchase** — select supplier, add products with quantities and unit prices.
2. **Receive stock** — confirm goods received; inventory quantities are increased.
3. **Payment** — record full payment or partial payment.
   - If partial: an outstanding balance is tracked (accounts payable).
4. **Purchase return** — if goods are defective, create a return which reverses inventory.

### 3.3 Supplier Debt Tracking
- Each supplier has a running total of what is owed.
- Reports show all unpaid purchases, grouped by supplier.

---

## Part 4 — Inventory Management

### 4.1 Stock Levels
Every product-shop combination has:
- **Quantity on hand** — current stock
- **Reorder level** — threshold that triggers a low-stock alert
- **Status** — `active` (healthy), `low` (below reorder level), `out_of_stock`

### 4.2 Stock Count (Physical Count)
1. Initiate a stock count for a shop.
2. Attendant physically counts each item and enters the actual quantity.
3. System calculates **variance** (system qty vs counted qty).
4. Count is approved/rejected by admin.
5. Approved counts update inventory to the counted quantity.

### 4.3 Inventory Adjustments
- Add or remove stock with a reason (damaged goods, found stock, theft, donation).
- Every adjustment is logged with user, date, and reason.

### 4.4 Bad Stock
- Record damaged or expired items that cannot be sold.
- Reduces inventory and is reported separately.

### 4.5 Stock Transfers
- Move stock between shops (branch to branch).
- Sending shop's inventory decreases; receiving shop's inventory increases.

### 4.6 Stock Requests
- A branch can raise a request to receive stock from another branch or central warehouse.
- Request is approved or rejected by the sending branch.

### 4.7 Inventory Movement Categories
The system classifies products into:
- **Out of stock** — zero qty
- **Low stock** — below reorder level
- **Fast moving** — high sales volume in period
- **Slow moving** — low sales volume
- **Dormant** — no sales in period

---

## Part 5 — The Point of Sale (Selling)

This is the core daily flow.

### 5.1 Opening the Till
- Attendant logs in with their PIN.
- Optionally records the opening cash float (cash in drawer at start of shift).

### 5.2 Creating a Sale

```
Select Products → Apply Discounts → Choose Payment → Complete Sale → Print/Send Receipt
```

**Step 1 — Add products**
- Scan barcode, or search by name, or browse categories.
- Quantity is entered; system checks stock.
- Each line item shows: product name, qty, unit price, line total.

**Step 2 — Customer (optional)**
- Attach a customer record to the sale for loyalty tracking and credit sales.
- New customers can be created on the spot.

**Step 3 — Discounts**
- Apply a percentage or fixed amount discount to the whole sale.
- Attendants are capped by `maxDiscount`; admins can override.

**Step 4 — Payment**
The sale can be paid by one or more methods:
| Method | Detail |
|---|---|
| Cash | Change calculated automatically |
| M-Pesa | Mobile money reference recorded |
| Card | Card terminal reference |
| Bank transfer | Bank and reference noted |
| Split payment | Any combination of the above |

**Credit sales**
- Customer pays partially or nothing now.
- Outstanding balance is tracked against the customer.
- A due date is set for collection.

**Step 5 — Complete sale**
- Inventory is deducted (physical products only).
- Loyalty points are earned (if programme is enabled).
- Sale is recorded with receipt number.

**Step 6 — Receipt**
- Print receipt at the till.
- Or email/SMS the receipt to the customer.

### 5.3 Sale Types
- **Regular sale** — standard retail transaction.
- **Wholesale sale** — uses wholesale price tier.
- **Credit sale** — payment deferred.
- **Layaway / held sale** — saved for later, stock reserved.

### 5.4 Voiding and Refunds
- **Void** — cancel a sale before it is finalised (same session).
- **Refund / return** — return goods after the sale is complete; inventory is restocked; payment is reversed.

---

## Part 6 — Credit & Debt Collection

### 6.1 Customer Credit Ledger
- Each customer has a running outstanding balance.
- Every credit sale increases the balance; every payment reduces it.

### 6.2 Recording Payments on Credit
- Attendant or admin records a payment against an existing credit sale.
- Multiple partial payments are supported.

### 6.3 Overdue Tracking
- Sales with a `dueDate` in the past and still unpaid are flagged overdue.
- AR aging report buckets debts: current / 1–30 / 31–60 / 61–90 / 90+ days.

---

## Part 7 — Customer Management

### 7.1 Customer Records
- Name, phone, email, address.
- Full purchase history.
- Current outstanding balance.
- Loyalty points balance.

### 7.2 Loyalty Programme
- Set **points earned per currency unit** (e.g. 1 point per KES 10 spent).
- Set **point redemption value** (e.g. 10 points = KES 1 discount).
- On every completed sale, points are added automatically.
- Customer can redeem points at checkout as a discount.
- Every earn and redeem event is logged in a loyalty ledger.

### 7.3 Customer-Facing Online Ordering
Customers can browse and order without visiting the shop:
1. Customer registers/logs in with their phone or email.
2. Browses the shop's product catalog (filtered by availability).
3. Adds items to cart and places an order.
4. Order appears in the admin panel with status: `pending`.
5. Admin or attendant reviews and **confirms** the order.
6. Confirmed order is **fulfilled** — it converts to a full sale and deducts inventory.
7. Customer can track their order status and history via the app.

---

## Part 8 — Finance & Cash Management

### 8.1 Cash Flow Register
- Record money coming into the business not from sales (cash in).
- Record money leaving the business not as a purchase (cash out).
- Optionally link to a bank account.

### 8.2 Bank Accounts
- Register the business's bank accounts.
- Cashflow entries that go to/from a bank update its running balance.

### 8.3 Expenses
- Record business expenses: rent, utilities, salaries, fuel, etc.
- Each expense is tagged with a category.
- Expenses reduce profit in P&L calculations.

### 8.4 Payment Methods
- Configure accepted payment methods (Cash, M-Pesa, Stripe, Paystack, bank, card).
- Payment gateway integrations handle online/card payments.

---

## Part 9 — Reports & Analytics

Reports are the lens through which the owner sees the business.

### 9.1 Sales Reports
| Report | What it answers |
|---|---|
| Sales summary | Total revenue, paid, outstanding, discount for a period |
| Sales by product | Which products sell most; quantity and revenue per SKU |
| Sales by product (with margins) | Revenue, cost, gross profit, margin % per product |
| Sales by customer | Which customers spend the most |
| Sales by attendant | Who sells the most |
| Sales by payment method | How customers pay (cash vs mobile vs card) |
| Daily sales chart | Revenue per day for the last N days |
| Monthly sales trend | 12-month revenue and profit bars |
| Discounted sales | Every sale where a discount was applied |
| Credit sales (dues) | All outstanding credit balances |
| Overdue credit sales | Credit past due date |

### 9.2 Purchase Reports
| Report | What it answers |
|---|---|
| Purchases summary | Total purchased, paid, outstanding by period |
| Purchases by supplier | Debt per supplier |
| Unpaid purchases | Every purchase with an outstanding balance |
| Top purchased products | What is being restocked most |

### 9.3 Inventory Reports
| Report | What it answers |
|---|---|
| Stock take | Current qty, cost value, sale value, margin for every SKU |
| Inventory valuation | Total stock value at cost and at selling price |
| Stock count analysis | Variance between counted and system quantities |
| Out-of-stock products | Products that need immediate restocking |
| Low-stock products | Products approaching reorder level |
| Stock movement categories | Fast/slow/dormant movers |

### 9.4 Financial Reports
| Report | What it answers |
|---|---|
| Income report | Revenue breakdown with daily time series |
| Expenses by category | Where money is going |
| Profit & Loss (P&L) | Revenue − COGS − Expenses = Net Profit, with margin |
| P&L by year/month | Monthly P&L breakdown for the year |
| Accounts summary | Cash position: receivables, payables, bank balances, net |
| Business summary dashboard | All key KPIs in one view |

### 9.5 Debt Aging Report
- Splits all outstanding customer debts into age buckets.
- Helps the owner prioritise collection efforts.

### 9.6 Cross-Shop Report
- For multi-branch businesses: revenue per branch side by side.

---

## Part 10 — Communications

### 10.1 SMS Notifications
- Sale receipt via SMS.
- Low stock alerts.
- Overdue debt reminders to customers.
- Daily sales summary to owner.

### 10.2 Email Notifications
- Sale receipt PDF.
- Password reset and OTP verification.
- Nightly backup snapshot delivered to owner's email.

### 10.3 Email Templates
- Admin can customise email templates (subject, HTML body, variables).

---

## Part 11 — System & Security

### 11.1 Role-Based Access Control
| Role | Access |
|---|---|
| Super admin | Everything across all shops |
| Admin | Own shops only |
| Attendant | Assigned shops; own sales only; no reports |
| Customer | Public catalog and own orders only |
| Affiliate | Own referral dashboard only |

### 11.2 Activity Log
- Every significant action (sale, purchase, stock adjustment, login) is recorded with user, timestamp, and details.
- Provides a full audit trail.

### 11.3 Data Backup
- On demand: admin downloads a full JSON snapshot of their data.
- Scheduled: every night the system generates a snapshot and emails it to the shop's backup email.

### 11.4 Sync Flag
- Every record has a `sync` flag to support offline/online sync for mobile POS clients.

---

## Part 12 — Closing the Till / End of Day

1. **Reconcile cash** — compare expected cash in drawer vs actual counted cash.
2. **Review daily sales summary** — total revenue, payment method breakdown, voids, refunds.
3. **Check low-stock alerts** — identify what needs restocking.
4. **Review pending orders** — ensure all online orders are fulfilled or actioned.
5. **Post expenses** — enter any cash expenses paid during the day.
6. **Close shift** — attendant logs out; system records shift totals.
7. **End-of-day report** — admin reviews P&L snapshot and outstanding credit.

---

## Summary Flow Diagram (Text)

```
SETUP
  └─ Create Admin → Create Shop → Add Staff → Add Products → Set Prices

STOCK IN
  └─ Add Supplier → Create Purchase → Receive Goods → Record Payment

SELLING
  └─ Attendant Login → Open Till → Scan Products → Apply Discount
       └─ Payment (Cash/Card/Mobile/Credit) → Complete → Receipt

ONLINE ORDERING
  └─ Customer Browses Catalog → Places Order → Admin Confirms
       └─ Fulfil Order → Converts to Sale → Inventory Deducted

CREDIT MANAGEMENT
  └─ Credit Sale → Balance Tracked → Customer Pays Later → Balance Cleared

STOCK MANAGEMENT
  └─ Inventory Updates → Low Stock Alerts → Stock Count → Adjustments → Transfers

FINANCE
  └─ Record Expenses → Cash Flow → Bank Balances → P&L Updated

END OF DAY
  └─ Reconcile → Review Reports → Low Stock Check → Close Shift → Backup
```

---

*This document describes the operational logic of a complete Point of Sale system. Individual features may be toggled on or off per shop and per subscription package.*
