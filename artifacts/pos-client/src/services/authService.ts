import { store } from '@/store';
import { setUser, clearUser } from '@/store/slices/authSlice';
import { setUserPermissions } from '@/store/slices/permissionsSlice';

interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin?: boolean;
}

export class AuthService {
  static initializeUser(userData: LoginUser) {
    const user = {
      ...userData,
      isAdmin: userData.role === 'admin' || userData.isAdmin || false,
      permissions: [],
    };

    // Get role permissions from store
    const state = store.getState();
    const userRole = state.roles.roles.find(role => role.id === user.role);
    const rolePermissions = userRole?.permissions || [];

    // Set user in auth state
    store.dispatch(setUser(user));
    
    // Set permissions in permissions state
    store.dispatch(setUserPermissions(rolePermissions));

    return user;
  }

  static logout() {
    store.dispatch(clearUser());
    store.dispatch(setUserPermissions([]));
  }

  static getCurrentUser() {
    return store.getState().auth.user;
  }

  static hasPermission(permission: string): boolean {
    const state = store.getState();
    const user = state.auth.user;
    
    if (user?.isAdmin) return true;
    
    const userPermissions = state.permissions.userPermissions;
    const userRole = state.roles.roles.find(role => role.id === user?.role);
    const rolePermissions = userRole?.permissions || [];
    
    const allPermissions = [...rolePermissions, ...userPermissions];
    return allPermissions.includes(permission);
  }

  static simulateLogin(role: string = 'manager') {
    // Role-based permissions mapping
    const rolePermissions = {
      admin: [
        'sales_create', 'sales_view', 'sales_edit', 'sales_price_edit', 'sales_datetime_edit', 'sales_delete', 'sales_refund',
        'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_delete', 'stock_adjust',
        'financial_view', 'expenses_create', 'expenses_edit', 'cashflow_manage', 'financial_export',
        'reports_view', 'reports_advanced', 'reports_export', 'reports_custom',
        'customers_manage', 'suppliers_manage', 'staff_view', 'staff_edit', 'staff_permissions',
        'user_permissions', 'system_settings'
      ],
      manager: [
        'sales_create', 'sales_view', 'sales_edit', 'sales_price_edit', 'sales_datetime_edit', 'sales_refund',
        'inventory_view', 'inventory_add', 'inventory_edit', 'stock_adjust',
        'financial_view', 'expenses_create', 'expenses_edit', 'cashflow_manage',
        'reports_view', 'reports_advanced', 'reports_export',
        'customers_manage', 'suppliers_manage', 'staff_view'
      ],
      supervisor: [
        'sales_create', 'sales_view', 'sales_edit', 'sales_price_edit', 'sales_refund',
        'inventory_view', 'inventory_add', 'stock_adjust',
        'financial_view', 'expenses_create',
        'reports_view', 'reports_advanced',
        'customers_manage', 'staff_view'
      ],
      cashier: [
        'sales_create', 'sales_view',
        'inventory_view',
        'customers_manage'
      ],
      stock_clerk: [
        'inventory_view', 'inventory_add', 'inventory_edit', 'stock_adjust',
        'reports_view'
      ]
    };

    const mockUsers = {
      admin: {
        id: '1',
        email: 'admin@pointify.com',
        name: 'System Administrator',
        role: 'admin',
      },
      manager: {
        id: '2',
        email: 'manager@pointify.com', 
        name: 'Store Manager',
        role: 'manager',
      },
      supervisor: {
        id: '3',
        email: 'supervisor@pointify.com',
        name: 'Floor Supervisor', 
        role: 'supervisor',
      },
      cashier: {
        id: '4',
        email: 'cashier@pointify.com',
        name: 'Sales Cashier',
        role: 'cashier',
      },
      stock_clerk: {
        id: '5',
        email: 'stock@pointify.com',
        name: 'Stock Clerk',
        role: 'stock_clerk',
      },
    };

    const userData = mockUsers[role as keyof typeof mockUsers] || mockUsers.manager;
    const permissions = rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.manager;
    
    // Set permissions directly for this user
    store.dispatch(setUserPermissions(permissions));
    
    return this.initializeUser(userData);
  }
}