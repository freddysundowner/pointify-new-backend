// API Configuration - All requests go through server proxy
export const API_ENDPOINTS = {
  // Product endpoints - all go through /api/ proxy
  products: {
    getAll: "/api/product",
    getById: (id: number) => `/api/product/${id}`,
    search: "/api/product",
    getByCategory: "/api/product",
    categories: "/api/product/category",
  },
  
  // Customer endpoints - all go through /api/ proxy
  customers: {
    getAll: "/api/customers",
    getById: (id: number) => `/api/customers/${id}`,
    create: "/api/customers",
    updateBalance: (id: number) => `/api/customers/${id}/balance`,
  },
  
  // Sales endpoints - all go through /api/ proxy
  sales: {
    create: "/api/sales",
    getAll: "/api/sales/filter",
    getById: (id: string) => `/api/sales/single/receipt/${id}`,
    update: (id: string) => `/api/sales/${id}`,
    void: (id: string) => `/api/sales/void/sale/${id}`,
    
    // Product-related sales
    getProductSales: "/api/sales/product/filter",
    getProductReports: "/api/sales/products/reports",
    getMostSellingProducts: "/api/sales/summary/month/analysis/product",
    
    // Summary and analytics
    getSummaryByDates: "/api/sales/summary/bydates",
    getShopSales: "/api/sales/shops/sales",
    getMonthlyAnalysis: "/api/sales/product/month/analysis",
    
    // Reports
    getDiscountReports: "/api/sales/discount/reports",
    getStatements: "/api/sales/reports/statements",
    sendReportEmail: "/api/sales/send/report/email",
    
    // Online sales/orders
    onlineSales: {
      create: "/api/sales/orders/sale/online",
      getAll: "/api/sales/orders/sale/online",
      delete: (id: string) => `/api/sales/orders/sale/online/${id}`,
    },
    
    // Development/maintenance
    updateSandbox: (id: string) => `/api/sales/sandbox/updating/sales/${id}`,
  },
  
  // Transaction endpoints - all go through /api/ proxy
  transactions: {
    create: "/api/transactions",
    getAll: "/api/transactions",
    getById: (id: string) => `/api/transactions/${id}`,
    getByDate: "/api/transactions/summary/bydates",
  },
  
  // Shop endpoints - all go through /api/ proxy
  shop: {
    getShopData: "/api/shop",
    getShopById: (shopId: string) => `/api/shop/${shopId}`,
  },
  
  // Auth endpoints - all go through /api/ proxy
  auth: {
    register: "/api/business/register",
    login: "/api/business/login",
    logout: "/api/business/logout",
    getAdmin: (id: string) => `/api/auth/admin/${id}`,
    resetPassword: "/api/admin/reset/password",
    requestPasswordReset: "/api/admin/request/password",
  },

  // Analytics endpoints - all go through /api/ proxy
  analytics: {
    stockAnalysis: "/api/analysis/stockanalysis",
    salesAnalysis: "/api/analysis/sales",
    customerAnalysis: "/api/analysis/customers",
    profitAnalysis: "/api/analysis/profit",
  },
};

// Helper function to build URL with query params
export const buildApiUrl = (endpoint: string, params?: URLSearchParams) => {
  return params ? `${endpoint}?${params.toString()}` : endpoint;
};

// API request wrapper - uses server proxy with auth token forwarding
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  
  const url = buildApiUrl(endpoint, );
  
  // Get auth token from localStorage - check both admin and attendant tokens
  const adminToken = localStorage.getItem('authToken');
  const attendantToken = localStorage.getItem('attendantToken');
  const token = adminToken || attendantToken;
  
  console.log('API Call:', endpoint, 'with token:', !!token, 'admin:', !!adminToken, 'attendant:', !!attendantToken);
  
  const defaultHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    ...(token && { "Authorization": `Bearer ${token}` }),
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout after 20 seconds');
    }, 20000); // 20 second timeout
     
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
      credentials: "include", // Include cookies for session management
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try to get the error message from the response body
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // If we can't parse the response, use the default error message
        console.warn("Could not parse error response:", parseError);
      }
      
      if (response.status === 401) {
        // Try to get error data to check for logout request
        let errorData;
        try {
          errorData = await response.json();
          if (errorData.logout) {
            console.log("🚪 Server requesting logout due to 401 error");
            // Clear all auth data and redirect to login
            localStorage.removeItem('authToken');
            localStorage.removeItem('adminData');
            localStorage.removeItem('attendantToken');
            localStorage.removeItem('attendantData');
            window.location.href = '/business-login';
            throw new Error(errorData.message || 'Authentication expired. Please log in again.');
          }
        } catch (parseError) {
          // If we can't parse the response, continue with normal 401 handling
        }
        
        // For login endpoints, don't auto-redirect on 401, just throw the error
        if (endpoint === '/api/business/login') {
          throw new Error(errorData?.message || errorMessage);
        }
        
        // Check if attendant is logged in - if so, don't redirect to business-login
        const attendantData = localStorage.getItem('attendantData');
        if (attendantData) {
          // Attendant is logged in, just throw error without redirect
          throw new Error(errorData?.message || errorMessage);
        }
        
        // For admin users, clear auth data and redirect to business login
        localStorage.removeItem('authToken');
        localStorage.removeItem('adminData');
        window.location.href = '/business-login';
        throw new Error(`Authentication failed. Please login again.`);
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        // Don't throw immediately - server fallback logic should handle this
        console.warn(`External API error ${response.status}, server should fallback to local API`);
        // Only throw if we get HTML response (indicating server error page)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error(`Service temporarily unavailable. The external API is experiencing issues. Please try again in a few moments.`);
        }
        // Otherwise, let the server handle the fallback
      }
      
      throw new Error(errorMessage);
    }
    
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout. The server is not responding.`);
      }
      if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Unable to connect to server. Please verify the server is running.`);
      }
    }
    throw error;
  }
};