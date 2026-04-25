import { useAppSelector } from '@/store/hooks';
import { useState, useEffect } from 'react';
import { useSubscriptionStatus } from './useSubscriptionStatus';

export const usePermissions = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { userPermissions } = useAppSelector((state) => state.permissions);
  const { roles } = useAppSelector((state) => state.roles);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isExpired: isSubscriptionExpired } = useSubscriptionStatus();

  // Check if user is admin from localStorage
  useEffect(() => {
    const checkAdminStatus = () => {
      const token = localStorage.getItem("authToken");
      const adminData = localStorage.getItem("adminData");
      
      if (token || adminData) {
        // If we have any auth data, consider them admin for dashboard access
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
    
    // Listen for localStorage changes
    const handleStorageChange = () => {
      checkAdminStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Get user's role permissions
  const getUserRolePermissions = () => {
    if (!user?.role) return [];
    const userRole = roles.find(role => role.id === user.role);
    return userRole?.permissions || [];
  };

  // Combine role permissions with individual permissions
  const getAllUserPermissions = () => {
    const rolePermissions = getUserRolePermissions();
    const combined = rolePermissions.concat(userPermissions);
    return Array.from(new Set(combined));
  };

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    // If subscription is expired, deny all permissions
    if (isSubscriptionExpired) {
      return false;
    }
    
    // Admin users automatically have all permissions
    if (isAdmin) {
      return true;
    }
    
    const allPermissions = getAllUserPermissions();
    return allPermissions.includes(permission);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  // Check if user has all specified permissions
  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  // Get permissions by category
  const getPermissionsByCategory = (category: string) => {
    const allPermissions = getAllUserPermissions();
    return allPermissions.filter(permId => {
      // You could expand this to check actual permission definitions
      return permId.startsWith(category.toLowerCase());
    });
  };

  // Check if user can access specific routes
  const canAccessRoute = (route: string): boolean => {
    // If subscription is expired, deny all route access
    if (isSubscriptionExpired) {
      return false;
    }
    
    const routePermissions: Record<string, string[]> = {
      '/sales': ['sales_view', 'sales_create'],
      '/purchases': ['purchases_manage'],
      '/inventory': ['inventory_view'],
      '/stock': ['inventory_view', 'stock_adjust'],
      '/customers': [],
      '/suppliers': ['suppliers_manage'],
      '/expenses': ['expenses_create', 'financial_view'],
      '/cashflow': ['cashflow_manage', 'financial_view'],
      '/reports': ['reports_view'],
      '/attendants': ['staff_view'],
      '/staff-permissions': ['user_permissions', 'staff_manage'],
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) return true; // Allow access if no specific permissions required
    
    return hasAnyPermission(requiredPermissions);
  };

  // Check attendant permissions (key-value structure)
  const hasAttendantPermission = (key: string, action: string): boolean => {
    
    // Check if we're in attendant context
    const attendantData = localStorage.getItem('attendantData');
    if (!attendantData) {
      return false;
    }
    
    // Parse attendant data to get shop information
    let attendant;
    try {
      attendant = JSON.parse(attendantData);
    } catch {
      return false;
    }
    const checkShopSubscription = () => {
      try {
        // Check if we have shop data cached from when attendant logged in
        const shopData = localStorage.getItem('currentShopData');
        if (shopData) {
          const shop = JSON.parse(shopData);
          if (shop.subscription) {
            const now = new Date();
            const endDate = new Date(shop.subscription.endDate);
            const isExpired = now > endDate || !shop.subscription.status;
            return !isExpired;
          }
        }
        return true;
      } catch (error) {
        return true; // Default to allowing access if check fails
      }
    };
    
    if (!checkShopSubscription()) {
      return false;
    }
    
    // Continue with permission validation using the already parsed attendant data
    try {
      
      if (!attendant.permissions) {
        return false;
      }
      
      const permission = attendant.permissions.find((p: any) => p.key === key);
      
      const hasPermission = permission ? permission.value.includes(action) : false;
      
      return hasPermission;
    } catch (error) {
      return false;
    }
  };

  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    getPermissionsByCategory,
    getAllUserPermissions,
    hasAttendantPermission,
    isAdmin: isAdmin || user?.isAdmin || false,
    isSubscriptionExpired,
  };
};