import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { API_ENDPOINTS, apiCall } from "@/lib/api-config";
import { store } from "@/store";
import { clearUser } from "@/store/slices/authSlice";
import { clearAttendant } from "@/store/slices/attendantSlice";
import { clearShopData } from "@/store/shopSlice";
import { clearPermissions } from "@/store/slices/permissionsSlice";
import { queryClient } from "@/lib/queryClient";
import { useAppDispatch } from "@/store/hooks";
import { setCurrency } from "@/store/slices/defaultCurrencySlicce";

interface Admin {
  _id: string;
  id: string;
  username: string;
  email: string;
  phone?: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  emailVerified: number;
  phoneVerified: number;
  primaryShop?: string | { _id: string; id?: string } | null;
  createdAt: string;
  updatedAt: string;
  attendantId: string;
}

interface AuthContextType {
  admin: Admin | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  serverError: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateAdmin: (updatedAdmin: Admin) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = (): AuthContextType => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState<Error | null>(null);
  const [, setLocation] = useLocation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    initializeAuth();
  }, [isLoading]);

  const fetchAdminData = async (adminId: string, authToken: string) => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      };

      const response = await apiCall(API_ENDPOINTS.auth.getAdmin(adminId), {
        headers,
      });
      
      const adminData = await response.json();

      dispatch(setCurrency(adminData?.primaryShop?.currency || 'KES'));
      await checkAndTriggerAutoSync();
      console.log("Fetched admin data:", adminData);
      if (!adminData?._id) {
        dispatch(setCurrency(adminData?.primaryShop?.currency || 'KES'));
        
        let localdata = await localStorage.getItem('adminData');
        if(localdata){
          localdata = JSON.parse(localdata);
          setAdmin(localdata );
          return localdata;
        }
        logout();
      } else {
        if (adminData?._id) {
          setAdmin(adminData);
          localStorage.setItem("adminData", JSON.stringify(adminData));
          return adminData;
        }
      }
    } catch (error) {
      logout();
      console.warn("Failed to fetch admin data:", error);
      // Don't set server error - let app continue loading normally
      throw error;
    }
  };

  const initializeAuth = async () => {
    try {
      const storedToken = localStorage.getItem("authToken");
      if (storedToken) {
        setToken(storedToken);
        
        // Extract admin data from JWT token
        try {
          const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
          console.log("Token payload:", tokenPayload);
          const adminId = tokenPayload.id || tokenPayload._id;
          console.log("Admin ID from token:", adminId);
          
          if (adminId) {
            try {
              await fetchAdminData(adminId, storedToken);
            } catch (fetchError) {
              console.warn("Failed to fetch fresh admin data, using session data:", fetchError);
              if (fetchError instanceof Error && (fetchError.message.includes('502') || fetchError.message.includes('unavailable') || fetchError.message.includes('401'))) {
                setServerError(fetchError);
                // Keep using session data when server is unavailable or unauthorized
              } else {
                setServerError(null);
                // Don't logout on token refresh failures, keep the session
                console.warn("Keeping session despite fetch error");
              }
            }
          }
        } catch (e) {
          console.error("Could not decode JWT token:", e);
          console.log("Stored token:", storedToken);
          logout();
          return;
        }
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      if (error instanceof Error && (error.message.includes('502') || error.message.includes('unavailable'))) {
        setServerError(error);
      } else {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log("Login attempt:", { email, password: password.length + " chars" });
      
      // Clear React Query cache before login to ensure fresh data
      queryClient.clear();
      
      // Clear Redux store for fresh state
      store.dispatch(clearShopData());
      
      const response = await apiCall(API_ENDPOINTS.auth.login, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      console.log("Login response:", data);

      if (data && data.token && data.userdata) {
        setToken(data.token);
        localStorage.setItem("authToken", data.token);
        
        // Fetch fresh admin data to get current primaryShop status
        const adminId = data.userdata._id;
        if (adminId) {
          try {
            await fetchAdminData(adminId, data.token);
          } catch (fetchError) {
            // Fallback to login response data if fetch fails
            setAdmin(data.userdata);
            localStorage.setItem("adminData", JSON.stringify(data.userdata));
          }
        } else {
          // Fallback to login response data
          setAdmin(data.userdata);
          localStorage.setItem("adminData", JSON.stringify(data.userdata));
        }
        
        // Force invalidation of shop-related queries after login
        queryClient.invalidateQueries({ queryKey: ["shops"] });
        queryClient.invalidateQueries({ queryKey: ["admin"] });
        
        // Check if automatic sync is needed after login
        // await checkAndTriggerAutoSync();
        
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('502') || error.message.includes('unavailable'))) {
        setServerError(error);
      }
      // Don't logout on login failure - just throw error to stay on login page
      throw error;
    }
  };

  const checkAndTriggerAutoSync = async () => {
    try {
        
        // Get current admin data
        const currentAdmin = admin || JSON.parse(localStorage.getItem("adminData") || '{}');
        const adminId = currentAdmin?._id || currentAdmin?.id;
        const primaryShopId = currentAdmin?.primaryShop;
        
        if (adminId) {
          try {
            // Trigger automatic sync in background
            const syncResponse = await apiCall(`/api/sync/${currentAdmin._id}`, {
              method: 'GET',
              body: JSON.stringify({ 
                adminId, 
                shopId: primaryShopId 
              })
            });
            
            const syncResult = await syncResponse.json();
            console.log('Automatic sync completed:', syncResult);
            
            // Invalidate all queries to refresh with synced data
            queryClient.invalidateQueries();
          } catch (syncError) {
            console.warn('Automatic sync failed, user can manually sync later:', syncError);
            // Don't block login if sync fails
          }
        }
    } catch (error) {
      console.warn('Could not check sync status:', error);
      // Don't block login if sync check fails
    }
  };

  const logout = () => {
    // Clear local state
    setAdmin(null);
    setToken(null);
    
    // Clear localStorage
    localStorage.removeItem("authToken");
    localStorage.removeItem("adminData");
    localStorage.removeItem("attendantData");
    localStorage.removeItem("attendantToken");
    localStorage.removeItem("selectedShopId");
    
    // Clear Redux store
    store.dispatch(clearUser());
    store.dispatch(clearAttendant());
    store.dispatch(clearShopData());
    store.dispatch(clearPermissions());
    
    // Clear React Query cache to ensure fresh data for new user
    queryClient.clear();
    
    // Redirect to home page
    setLocation('/');
  };

  const refreshAuth = async () => {
    try {
      if (!admin || !token) return;
      
      const adminId = admin._id || admin.id;
      if (!adminId) return;

      await fetchAdminData(adminId, token);
    } catch (error) {
      console.error("Failed to refresh auth:", error);
      logout();
    }
  };

  const updateAdmin = (updatedAdmin: Admin) => {
    setAdmin(updatedAdmin);
    localStorage.setItem("adminData", JSON.stringify(updatedAdmin));
  };

  return {
    admin,
    token,
    isLoading,
    isAuthenticated: !!admin && !!token,
    serverError,
    login,
    logout,
    refreshAuth,
    updateAdmin,
  };
};

export { AuthContext };