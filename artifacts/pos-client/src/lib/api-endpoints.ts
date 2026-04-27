/**
 * Central API Endpoints Registry
 *
 * All API paths used across the application are defined here.
 * This is the single source of truth for every endpoint call.
 */

export const ENDPOINTS = {

  // ─── Auth ────────────────────────────────────────────────────────────────

  auth: {
    adminLogin:           "/api/auth/admin/login",
    adminRegister:        "/api/auth/admin/register",
    adminLogout:          "/api/auth/admin/logout",
    adminForgotPassword:  "/api/auth/admin/forgot-password",
    adminResetPassword:   "/api/auth/admin/reset-password",
    adminVerifyEmail:     "/api/auth/admin/verify-email",
    adminResendOtp:       "/api/auth/admin/resend-otp",

    attendantLogin:       "/api/auth/attendant/login",
    attendantLogout:      "/api/auth/attendant/logout",
    attendantVerify:      "/api/auth/me",

    me:                   "/api/auth/me",

    adminProfile:         "/api/admin/profile",
    adminPermissions:     "/api/attendants/permissions",
  },

  // ─── Shop ─────────────────────────────────────────────────────────────────

  shop: {
    getAll:               "/api/shops",
    getById:              (id: string) => `/api/shops/${id}`,
    getData:              (id: string) => `/api/shops/${id}`,
    getCategories:        "/api/shop-categories",
    create:               "/api/shops",
  },

  // ─── Products ─────────────────────────────────────────────────────────────

  products: {
    getAll:               "/api/products",
    getById:              (id: string | number) => `/api/products/${id}`,
    create:               "/api/products",
    update:               (id: string) => `/api/products/${id}`,
    delete:               (id: string) => `/api/products/${id}`,
    search:               "/api/products/search",
    getCategories:        "/api/product-categories",
    createCategory:       "/api/product-categories",
    getByShop:            (shopId: string) => `/api/products?shopId=${shopId}`,
    adjust:               (_id: string) => `/api/inventory/adjustments`,
    adjustHistory:        (id: string) => `/api/products/${id}/history`,
    summary:              (id: string) => `/api/products/${id}/summary`,
    salesHistory:         (id: string) => `/api/products/${id}/sales-history`,
    purchasesHistory:     (id: string) => `/api/products/${id}/purchases-history`,
    stockHistory:         (id: string) => `/api/products/${id}/stock-history`,
    badStockMovements:    "/api/inventory/bad-stocks",
  },

  // ─── Customers ────────────────────────────────────────────────────────────

  customers: {
    getAll:               "/api/customers",
    getById:              (id: string) => `/api/customers/${id}`,
    create:               "/api/customers",
    update:               (id: string) => `/api/customers/${id}`,
    delete:               (id: string) => `/api/customers/${id}`,
    updateBalance:        (id: string) => `/api/customers/${id}/wallet`,
    walletPayment:        (id: string) => `/api/customers/${id}/wallet/payment`,
    getDebtors:           "/api/reports/dues",
    getPayments:          (id: string) => `/api/customers/${id}/wallet-transactions`,
    getOverdue:           "/api/reports/dues/overdue",
    getAnalysis:          "/api/customers/analysis",
  },

  // ─── Sales ────────────────────────────────────────────────────────────────

  sales: {
    create:               "/api/sales",
    getAll:               "/api/sales",
    stats:                "/api/sales/stats",
    getById:              (id: string) => `/api/sales/${id}`,
    getReceipt:           (id: string) => `/api/sales/${id}`,
    update:               (id: string) => `/api/sales/${id}`,
    complete:             (id: string) => `/api/sales/${id}/checkout`,
    delete:               (id: string) => `/api/sales/${id}`,
    void:                 (id: string) => `/api/sales/${id}/void`,
    getOnlineOrders:      (shopId: string) => `/api/orders?shopId=${shopId}`,

    // Online / orders
    onlineOrderCreate:    "/api/orders",
    onlineOrderGetAll:    "/api/orders",
    onlineOrderDelete:    (id: string) => `/api/orders/${id}`,

    // Reports & analytics (via /api/reports)
    getByFilter:          "/api/reports/sales/by-product/detail",
    getProductReports:    "/api/reports/sales/by-product",
    getMostSelling:       "/api/reports/sales/by-product",
    getSummaryByDates:    "/api/reports/sales/daily",
    getShopSales:         "/api/reports/cross-shop",
    getMonthlyAnalysis:   "/api/reports/monthly-product-sales",
    getDiscountReports:   "/api/reports/discounted-sales",
    getStatements:        "/api/reports/dues/detail",
    emailReceipt:         "/api/sales/email-receipt",
    reportFilter:         "/api/reports/sales",
  },

  // ─── Sale Returns ─────────────────────────────────────────────────────────

  saleReturns: {
    getAll:               "/api/sale-returns",
    getFiltered:          "/api/sale-returns",
    create:               "/api/sale-returns",
    delete:               (id: string) => `/api/sale-returns/${id}`,
  },

  // ─── Transactions ─────────────────────────────────────────────────────────

  transactions: {
    create:               "/api/transactions",
    getAll:               "/api/transactions",
    getById:              (id: string) => `/api/transactions/${id}`,
    getByDate:            "/api/transactions/summary/bydates",
  },

  // ─── Purchases ────────────────────────────────────────────────────────────

  purchases: {
    getAll:               "/api/purchases",
    getById:              (id: string) => `/api/purchases/${id}`,
    create:               "/api/purchases",
    update:               (id: string) => `/api/purchases/${id}`,
    delete:               (id: string) => `/api/purchases/${id}`,
    addPayment:           (id: string) => `/api/purchases/${id}/payments`,
    reportFilter:         "/api/reports/purchases",
  },

  // ─── Purchase Returns ─────────────────────────────────────────────────────

  purchaseReturns: {
    getAll:               "/api/purchase-returns",
    create:               "/api/purchase-returns",
    getFiltered:          "/api/purchase-returns",
  },

  // ─── Suppliers ────────────────────────────────────────────────────────────

  suppliers: {
    getAll:               "/api/suppliers",
    create:               "/api/suppliers",
    update:               (id: string) => `/api/suppliers/${id}`,
    delete:               (id: string) => `/api/suppliers/${id}`,
    walletPayment:        (id: string) => `/api/suppliers/${id}/wallet/payment`,
  },

  // ─── Attendants ───────────────────────────────────────────────────────────

  attendants: {
    getAll:               "/api/attendants",
    getByShop:            "/api/attendants",
    getPermissions:       "/api/attendants/permissions",
    create:               "/api/attendants",
    update:               (id: string) => `/api/attendants/${id}`,
    delete:               (id: string) => `/api/attendants/${id}`,
  },

  // ─── Cashflow ─────────────────────────────────────────────────────────────

  cashflow: {
    getAll:               "/api/finance/cashflows",
    create:               "/api/finance/cashflows",
    categories:           "/api/finance/cashflow-categories",
    createCategory:       "/api/finance/cashflow-categories",
    updateCategory:       (id: string) => `/api/finance/cashflow-categories/${id}`,
    deleteCategory:       (id: string) => `/api/finance/cashflow-categories/${id}`,
  },

  // ─── Reports & Analytics ──────────────────────────────────────────────────

  analytics: {
    stockValue:           "/api/reports/stock-value",
    stockAnalysis:        "/api/reports/inventory",
    netProfit:            "/api/reports/profit-loss",
    profitLoss:           "/api/reports/profit-loss",
    profitLossDetail:     "/api/reports/profit-loss/detail",
    profitYearly:         (year: number) => `/api/reports/profit/yearly/${year}`,
    salesReport:          "/api/reports/sales",
    salesByProduct:       "/api/reports/sales/by-product",
    salesByCustomer:      "/api/reports/sales/by-customer",
    salesByPaymentMethod: "/api/reports/sales/by-payment-method",
    salesByAttendant:     "/api/reports/sales/by-attendant",
    salesDaily:           "/api/reports/sales/daily",
    salesMonthly:         "/api/reports/sales/monthly",
    purchasesReport:      "/api/reports/purchases",
    purchasesUnpaid:      "/api/reports/purchases/unpaid",
    purchasesBySupplier:  "/api/reports/purchases/by-supplier",
    purchasesDetail:      "/api/reports/purchases/detail",
    expensesReport:       "/api/reports/expenses",
    expensesByCategory:   "/api/reports/expenses/by-category",
    inventoryReport:      "/api/reports/inventory",
    stockCountAnalysis:   "/api/reports/stock-count-analysis",
    creditReport:         "/api/reports/credit",
    duesReport:           "/api/reports/dues",
    duesOverdue:          "/api/reports/dues/overdue",
    duesDetail:           "/api/reports/dues/detail",
    income:               "/api/reports/income",
    accounts:             "/api/reports/accounts",
    businessSummary:      "/api/reports/business-summary",
    crossShop:            "/api/reports/cross-shop",
    outOfStockExport:     "/api/reports/out-of-stock/export",
    backup:               "/api/reports/backup",
    stockPdfDownload:     "/api/reports/stock-value",
    stockPdfFile:         "/api/reports/stock-value",
  },

  // ─── Subscriptions & Packages ─────────────────────────────────────────────

  packages: {
    getAll:               "/api/packages",
  },

  subscriptions: {
    getById:              (id: string) => `/api/subscriptions/${id}`,
    getAll:               "/api/subscriptions",
    create:               "/api/subscriptions",
  },

  // ─── Payments ─────────────────────────────────────────────────────────────

  payments: {
    confirm:              "/api/payments/confirm",
    resend:               "/api/payments/resend",
    mpesaCallback:        "/api/payments/mpesa/callback",
    paystackWebhook:      "/api/payments/paystack/webhook",
    stripeWebhook:        "/api/payments/stripe/webhook",
  },

  // ─── Printer ──────────────────────────────────────────────────────────────

  printer: {
    saleReceipt:          "/api/print/sale-receipt",
  },

  // ─── SMS ──────────────────────────────────────────────────────────────────

  sms: {
    getLogs:              "/api/sms/transactions",
    topup:                "/api/sms/top-up",
    balance:              "/api/sms/balance",
    transactions:         "/api/sms/transactions",
  },

  // ─── Inventory ────────────────────────────────────────────────────────────

  inventory: {
    getAll:               "/api/inventory",
    getItem:              (id: string) => `/api/inventory/item/${id}`,
    movements:            "/api/inventory/movements",
    batches:              "/api/inventory/batches",
    adjustments:          "/api/inventory/adjustments",
    deleteAdjustment:     (id: string) => `/api/inventory/adjustments/${id}`,
    badStocks:            "/api/inventory/bad-stocks",
    deleteBadStock:       (id: string) => `/api/inventory/bad-stocks/${id}`,
    stockCounts:          "/api/inventory/stock-counts",
    stockCountById:       (id: string) => `/api/inventory/stock-counts/${id}`,
    stockCountItems:      (id: string) => `/api/inventory/stock-counts/${id}/items`,
    applyStockCount:      (id: string) => `/api/inventory/stock-counts/${id}/apply`,
  },

  // ─── Bad Stock ────────────────────────────────────────────────────────────

  badStock: {
    getAll:               "/api/inventory/bad-stocks",
    create:               "/api/inventory/bad-stocks",
    delete:               (id: string) => `/api/inventory/bad-stocks/${id}`,
    summaryAnalysis:      "/api/reports/stock-value",
  },

  // ─── Stock Counts ─────────────────────────────────────────────────────────

  stockCounts: {
    create:               "/api/inventory/stock-counts",
    getAll:               "/api/inventory/stock-counts",
    getById:              (id: string) => `/api/inventory/stock-counts/${id}`,
    countAnalysis:        "/api/reports/stock-count-analysis",
  },

  // ─── Expenses ─────────────────────────────────────────────────────────────

  expenses: {
    getAll:               "/api/finance/expenses",
    create:               "/api/finance/expenses",
    delete:               (id: string) => `/api/finance/expenses/${id}`,
    summaryAnalysis:      "/api/reports/expenses",
  },

  // ─── Expense Categories ───────────────────────────────────────────────────

  expenseCategories: {
    getAll:               "/api/finance/expense-categories",
    create:               "/api/finance/expense-categories",
    update:               (id: string) => `/api/finance/expense-categories/${id}`,
    delete:               (id: string) => `/api/finance/expense-categories/${id}`,
  },

  // ─── Stock Transfers ──────────────────────────────────────────────────────

  transfers: {
    shopTransfer:         "/api/transfers",
    filter:               "/api/transfers",
  },

};
