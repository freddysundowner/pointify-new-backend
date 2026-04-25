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
    attendantVerify:      "/api/auth/attendant/verify",

    me:                   "/api/auth/me",

    getAdmin:             (id: string) => `/api/auth/admin/${id}`,
    updateAdmin:          (id: string) => `/api/admin/${id}`,
    adminProfile:         "/api/admin/profile",
    adminPermissions:     "/api/admin/permissions",
  },

  // ─── Shop ─────────────────────────────────────────────────────────────────

  shop: {
    getAll:               "/api/shops",
    getById:              (id: string) => `/api/shops/${id}`,
    getData:              (id: string) => `/api/shops/${id}`,
    getByAdmin:           (adminId: string) => `/api/shop/admin/${adminId}`,
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
    adjust:               (id: string) => `/api/inventory/adjustments`,
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
    updateBalance:        (id: string) => `/api/customers/${id}/balance`,
    getDebtors:           "/api/customers/debtors",
    getPayments:          "/api/customers/payments",
    getOverdue:           (shopId: string) => `/api/customers/overdue/${shopId}`,
    getAnalysis:          (shopId: string) => `/api/customers/analysis/${shopId}`,
  },

  // ─── Sales ────────────────────────────────────────────────────────────────

  sales: {
    create:               "/api/sales",
    getAll:               "/api/sales/filter",
    getReceipt:           (id: string) => `/api/sales/single/receipt/${id}`,
    update:               (id: string) => `/api/sales/${id}`,
    complete:             (id: string) => `/api/sales/${id}`,
    delete:               (id: string) => `/api/sales/${id}`,
    void:                 (id: string) => `/api/sales/void/sale/${id}`,
    getOnlineOrders:      (shopId: string) => `/api/sales/shop/onlineorders/${shopId}`,

    // Online / orders
    onlineOrderCreate:    "/api/sales/orders/sale/online",
    onlineOrderGetAll:    "/api/sales/orders/sale/online",
    onlineOrderDelete:    (id: string) => `/api/sales/orders/sale/online/${id}`,

    // Reports & analytics
    getByFilter:          "/api/sales/product/filter",
    getProductReports:    "/api/sales/products/reports",
    getMostSelling:       "/api/sales/summary/month/analysis/product",
    getSummaryByDates:    "/api/sales/summary/bydates",
    getShopSales:         "/api/sales/shops/sales",
    getMonthlyAnalysis:   "/api/sales/product/month/analysis",
    getDiscountReports:   "/api/sales/discount/reports",
    getStatements:        "/api/sales/reports/statements",
    sendReportEmail:      "/api/sales/send/report/email",
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
    addPayment:           (id: string) => `/api/purchases/${id}/payment`,
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
  },

  // ─── Attendants ───────────────────────────────────────────────────────────

  attendants: {
    getAll:               (adminId: string) => `/api/attendants/all/${adminId}`,
    getByShop:            "/api/attendants/shop/filter",
    create:               "/api/attendants",
    update:               (id: string) => `/api/attendants/${id}`,
    delete:               (id: string) => `/api/attendants/${id}`,
  },

  // ─── Cashflow ─────────────────────────────────────────────────────────────

  cashflow: {
    getAll:               "/api/cashflow",
    create:               "/api/cashflow",
    categories:           "/api/cashflow-categories",
    createCategory:       "/api/cashflow-categories",
    updateCategory:       (id: string) => `/api/cashflow-categories/${id}`,
    deleteCategory:       (id: string) => `/api/cashflow-categories/${id}`,
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
    confirm:              "/api/payment/confirm",
    resend:               "/api/payment/resend",
  },

  // ─── SMS ──────────────────────────────────────────────────────────────────

  sms: {
    getLogs:              (adminId: string) => `/api/sms/sms-logs?adminId=${adminId}`,
    topup:                "/api/sms/topup",
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
    summaryAnalysis:      "/api/badstock/summary/analysis",
  },

  // ─── Stock Counts ─────────────────────────────────────────────────────────

  stockCounts: {
    create:               "/api/inventory/stock-counts",
    getAll:               "/api/inventory/stock-counts",
    getById:              (id: string) => `/api/inventory/stock-counts/${id}`,
    getByShop:            (shopId: string) => `/api/counts/shop/${shopId}`,
    countAnalysis:        "/api/reports/stock-count-analysis",
  },

  // ─── Expenses ─────────────────────────────────────────────────────────────

  expenses: {
    getAll:               "/api/expenses",
    create:               "/api/expenses",
    delete:               (id: string) => `/api/expenses/${id}`,
    summaryAnalysis:      "/api/expenses/stats/summary/analysis",
  },

  // ─── Expense Categories ───────────────────────────────────────────────────

  expenseCategories: {
    getAll:               "/api/expense-categories",
    create:               "/api/expense-categories",
    update:               (id: string) => `/api/expense-categories/${id}`,
    delete:               (id: string) => `/api/expense-categories/${id}`,
  },

  // ─── Stock Transfers ──────────────────────────────────────────────────────

  transfers: {
    shopTransfer:         "/api/transfer/shop/transfer",
    filter:               "/api/transfer/filter",
  },

};
