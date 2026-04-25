import { useAttendantAuth } from "@/contexts/AttendantAuthContext";

// Route mapping for admin vs attendant paths
export const ROUTE_MAPPINGS = {
  // Products/Inventory routes
  products: {
    admin: "/stock/products",
    attendant: "/attendant/products"
  },
  addProduct: {
    admin: "/stock/add-product", 
    attendant: "/attendant/stock/add-product"
  },
  editProduct: {
    admin: "/stock/edit-product",
    attendant: "/attendant/stock/edit-product"
  },
  productHistory: {
    admin: "/product",
    attendant: "/attendant/product"
  },
  stockSummary: {
    admin: "/stock/summary",
    attendant: "/attendant/stock/summary"
  },
  stockCount: {
    admin: "/stock/count",
    attendant: "/attendant/stock/count"
  },
  stockTransfer: {
    admin: "/stock/transfer", 
    attendant: "/attendant/stock/transfer"
  },
  badStock: {
    admin: "/stock/bad-stock",
    attendant: "/attendant/stock/bad-stock"
  },
  
  // Sales routes
  sales: {
    admin: "/sales",
    attendant: "/attendant/sales"
  },
  pos: {
    admin: "/pos",
    attendant: "/attendant/pos"
  },
  
  // Customer routes
  customers: {
    admin: "/customers",
    attendant: "/attendant/customers"
  },
  customerOverview: {
    admin: "/customer-overview",
    attendant: "/attendant/customer-overview"
  },
  
  // Purchase routes
  purchases: {
    admin: "/purchases",
    attendant: "/attendant/purchases"
  },
  purchaseReturns: {
    admin: "/purchase-returns",
    attendant: "/attendant/purchases/returns"
  },
  addPurchase: {
    admin: "/purchases/create",
    attendant: "/attendant/purchases/create"
  },
  
  // Supplier routes
  suppliers: {
    admin: "/suppliers",
    attendant: "/attendant/suppliers"
  },
  
  // Dashboard routes
  dashboard: {
    admin: "/dashboard",
    attendant: "/attendant/dashboard"
  },
  
  // Other routes
  expenses: {
    admin: "/expenses",
    attendant: "/attendant/expenses"
  },
  cashflow: {
    admin: "/cashflow",
    attendant: "/attendant/cashflow"
  },
  reports: {
    admin: "/reports", 
    attendant: "/attendant/reports"
  },
  profitAnalysis: {
    admin: "/profit-analysis",
    attendant: "/attendant/profit-analysis"
  }
};

// Hook to get the correct route based on user type
export const useNavigationRoute = (routeKey: keyof typeof ROUTE_MAPPINGS) => {
  const { attendant } = useAttendantAuth();
  
  const userType = attendant ? "attendant" : "admin";
  return ROUTE_MAPPINGS[routeKey][userType];
};

// Utility function to get route without using hooks (for use in components that can't use hooks)
export const getNavigationRoute = (routeKey: keyof typeof ROUTE_MAPPINGS, isAttendant: boolean) => {
  const userType = isAttendant ? "attendant" : "admin";
  return ROUTE_MAPPINGS[routeKey][userType];
};

// Function to determine if current path is an attendant route
export const isAttendantRoute = (path: string) => {
  return path.startsWith('/attendant/');
};

// Function to convert admin route to attendant route
export const toAttendantRoute = (adminRoute: string) => {
  // Find the corresponding attendant route
  for (const [key, routes] of Object.entries(ROUTE_MAPPINGS)) {
    if (routes.admin === adminRoute) {
      return routes.attendant;
    }
  }
  
  // If no mapping found, prepend /attendant
  if (adminRoute.startsWith('/stock/')) {
    return adminRoute.replace('/stock/', '/attendant/stock/');
  }
  if (adminRoute.startsWith('/')) {
    return `/attendant${adminRoute}`;
  }
  
  return adminRoute;
};

// Function to convert attendant route to admin route  
export const toAdminRoute = (attendantRoute: string) => {
  // Find the corresponding admin route
  for (const [key, routes] of Object.entries(ROUTE_MAPPINGS)) {
    if (routes.attendant === attendantRoute) {
      return routes.admin;
    }
  }
  
  // If no mapping found, remove /attendant prefix
  if (attendantRoute.startsWith('/attendant/stock/')) {
    return attendantRoute.replace('/attendant/stock/', '/stock/');
  }
  if (attendantRoute.startsWith('/attendant/')) {
    return attendantRoute.replace('/attendant', '');
  }
  
  return attendantRoute;
};