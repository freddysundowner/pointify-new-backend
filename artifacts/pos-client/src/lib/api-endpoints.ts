/**
 * Central API Endpoints Registry
 *
 * All API paths used across the application are defined here.
 * This is the single source of truth for every endpoint call.
 *
 * NOTE: Some paths are still using old external-server paths (marked TODO).
 * These will be updated to match the local API server routes in the next cleanup step.
 */

export const ENDPOINTS = {

  // ─── Auth ────────────────────────────────────────────────────────────────

  auth: {
    // TODO: update to /api/auth/admin/login
    adminLogin:           "/api/business/login",
    // TODO: update to /api/auth/admin/register
    adminRegister:        "/api/business/register",
    // TODO: update to /api/auth/admin/logout
    adminLogout:          "/api/business/logout",
    // TODO: update to /api/auth/admin/forgot-password
    adminForgotPassword:  "/api/admin/request/password",
    // TODO: update to /api/auth/admin/reset-password
    adminResetPassword:   "/api/admin/reset/password",

    attendantLogin:       "/api/auth/attendant/login",
    attendantVerify:      "/api/auth/attendant/verify",

    getAdmin:             (id: string) => `/api/auth/admin/${id}`,
    updateAdmin:          (id: string) => `/api/admin/${id}`,
    adminPermissions:     "/api/admin/permissions",
  },

  // ─── Shop ─────────────────────────────────────────────────────────────────

  shop: {
    getAll:               "/api/shop",
    getById:              (id: string) => `/api/shop/${id}`,
    getData:              (id: string) => `/api/shop/data/${id}`,
    getByAdmin:           (adminId: string) => `/api/shop/admin/${adminId}`,
    getCategories:        "/api/shop/category",
    create:               "/api/shop",
  },

  // ─── Products ─────────────────────────────────────────────────────────────

  products: {
    // TODO: update to /api/products (plural)
    getAll:               "/api/product",
    // TODO: update to /api/products/:id
    getById:              (id: string | number) => `/api/product/${id}`,
    // TODO: update to /api/products
    create:               "/api/product",
    // TODO: update to /api/products/:id
    update:               (id: string) => `/api/product/${id}`,
    // TODO: update to /api/product-categories
    getCategories:        "/api/product/category",
    // TODO: update to /api/product-categories
    createCategory:       "/api/product/category",
    getByShop:            (shopId: string) => `/api/product/shop/${shopId}`,
    adjust:               (id: string) => `/api/product/adjust/${id}`,
    adjustHistory:        (id: string) => `/api/product/adjust/history/${id}`,
    summary:              "/api/product-summary",
    badStockMovements:    "/api/bad-stock-movements",
    salesHistory:         "/api/sales-history",
    purchasesHistory:     "/api/purchases-history",
  },

  // ─── Customers ────────────────────────────────────────────────────────────

  customers: {
    getAll:               "/api/customers",
    getById:              (id: string) => `/api/customers/${id}`,
    create:               "/api/customers",
    updateBalance:        (id: string) => `/api/customers/${id}/balance`,
    getDebtors:           "/api/customers/debtors",
    getPayments:          "/api/customers/payments",
    getOverdue:           (shopId: string) => `/api/customers/overdue/${shopId}`,
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
    // TODO: check if this path exists on local API
    getByFilter:          "/api/sales/product/filter",
    getProductReports:    "/api/sales/products/reports",
    getMostSelling:       "/api/sales/summary/month/analysis/product",
    getSummaryByDates:    "/api/sales/summary/bydates",
    getShopSales:         "/api/sales/shops/sales",
    getMonthlyAnalysis:   "/api/sales/product/month/analysis",
    getDiscountReports:   "/api/sales/discount/reports",
    getStatements:        "/api/sales/reports/statements",
    sendReportEmail:      "/api/sales/send/report/email",
    reportFilter:         "/api/analysis/report/sales",
  },

  // ─── Sale Returns ─────────────────────────────────────────────────────────

  saleReturns: {
    getAll:               "/api/salereturns",
    getFiltered:          "/api/salereturns/filter",
    delete:               (id: string) => `/api/salereturns/${id}`,
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
    addPayment:           (id: string) => `/api/purchases/${id}/payment`,
    reportFilter:         "/api/analysis/report/purchases",
  },

  // ─── Purchase Returns ─────────────────────────────────────────────────────

  purchaseReturns: {
    getAll:               "/api/purchasereturns",
    create:               "/api/purchasereturns",
    getFiltered:          "/api/purchasereturns",
  },

  // ─── Suppliers ────────────────────────────────────────────────────────────

  suppliers: {
    // TODO: normalize — some files use /api/supplier (singular), others use /api/suppliers
    getAll:               "/api/suppliers",
    create:               "/api/suppliers",
  },

  // ─── Attendants ───────────────────────────────────────────────────────────

  attendants: {
    getAll:               (adminId: string) => `/api/attendants/all/${adminId}`,
    getByShop:            "/api/attendants/shop/filter",
  },

  // ─── Cashflow ─────────────────────────────────────────────────────────────

  cashflow: {
    getAll:               "/api/cashflow",
    categories:           "/api/cashflow-categories",
  },

  // ─── Analytics ────────────────────────────────────────────────────────────

  analytics: {
    // TODO: check if /api/analysis/* paths exist on local API or need renaming
    stockAnalysis:        "/api/analysis/stockanalysis",
    netProfit:            "/api/analysis/netprofit",
    salesReport:          "/api/analysis/report/sales",
    purchasesReport:      "/api/analysis/report/purchases",
    stockPdfDownload:     "/api/analysis/pdf/download",
    stockPdfFile:         "/api/analysis/pdf/download/file",
    salesAnalysis:        "/api/analysis/sales",
    customerAnalysis:     "/api/analysis/customers",
    profitAnalysis:       "/api/analysis/profit",
  },

  // ─── Subscriptions & Packages ─────────────────────────────────────────────

  packages: {
    getAll:               "/api/packages",
  },

  subscriptions: {
    getById:              (id: string) => `/api/subscriptions/${id}`,
  },

  // ─── Payments ─────────────────────────────────────────────────────────────

  payments: {
    confirm:              "/api/payment/confirm",
    resend:               "/api/payment/resend",
  },

  // ─── SMS ──────────────────────────────────────────────────────────────────

  sms: {
    getLogs:              (adminId: string) => `/api/sms/sms-logs?adminId=${adminId}`,
  },

  // ─── Stock Transfers ──────────────────────────────────────────────────────

  transfers: {
    shopTransfer:         "/api/transfer/shop/transfer",
  },

  // ─── Printer (TODO: implement on local API or remove) ────────────────────

  printer: {
    // TODO: these came from the old bundled server — implement on local API or remove
    status:               "/api/printer/status",
    initialize:           "/api/printer/initialize",
    test:                 "/api/printer/test",
    list:                 "/api/printers",
    saleReceipt:          "/api/printer/salereceipt",
  },

  // ─── Network / Config (TODO: remove — old server only) ──────────────────

  network: {
    // TODO: remove — these were old-server-only endpoints
    check:                "/api/network/check",
    status:               "/api/network/status",
  },

  config: {
    // TODO: remove — old-server-only
    get:                  "/api/config",
  },

};
