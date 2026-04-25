import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'inventory' | 'financial' | 'reports' | 'management' | 'system';
  level: 'basic' | 'advanced' | 'admin';
}

interface PermissionsState {
  allPermissions: Permission[];
  userPermissions: string[];
  isLoading: boolean;
}

// Comprehensive permission definitions
const defaultPermissions: Permission[] = [
  // Sales Permissions
  { id: 'sales_create', name: 'Create Sales', description: 'Process new sales transactions', category: 'sales', level: 'basic' },
  { id: 'sales_view', name: 'View Sales', description: 'Access sales records and history', category: 'sales', level: 'basic' },
  { id: 'sales_edit', name: 'Edit Sales', description: 'Modify existing sales transactions', category: 'sales', level: 'advanced' },
  { id: 'sales_price_edit', name: 'Edit Prices', description: 'Change product prices during sales', category: 'sales', level: 'advanced' },
  { id: 'sales_datetime_edit', name: 'Edit Sale Date/Time', description: 'Manually set transaction date and time', category: 'sales', level: 'admin' },
  { id: 'sales_delete', name: 'Delete Sales', description: 'Remove sales transactions', category: 'sales', level: 'admin' },
  { id: 'sales_refund', name: 'Process Refunds', description: 'Handle returns and refunds', category: 'sales', level: 'advanced' },
  
  // Inventory Permissions
  { id: 'inventory_view', name: 'View Inventory', description: 'Access product and stock information', category: 'inventory', level: 'basic' },
  { id: 'inventory_add', name: 'Add Products', description: 'Create new product entries', category: 'inventory', level: 'advanced' },
  { id: 'inventory_edit', name: 'Edit Products', description: 'Modify product information', category: 'inventory', level: 'advanced' },
  { id: 'inventory_delete', name: 'Delete Products', description: 'Remove products from inventory', category: 'inventory', level: 'admin' },
  { id: 'stock_adjust', name: 'Stock Adjustments', description: 'Modify stock levels manually', category: 'inventory', level: 'advanced' },
  
  // Financial Permissions
  { id: 'financial_view', name: 'View Financial Data', description: 'Access revenue and profit reports', category: 'financial', level: 'basic' },
  { id: 'expenses_create', name: 'Create Expenses', description: 'Record business expenses', category: 'financial', level: 'basic' },
  { id: 'expenses_edit', name: 'Edit Expenses', description: 'Modify expense records', category: 'financial', level: 'advanced' },
  { id: 'cashflow_manage', name: 'Manage Cash Flow', description: 'Handle cash flow operations', category: 'financial', level: 'advanced' },
  { id: 'financial_export', name: 'Export Financial Data', description: 'Download financial reports', category: 'financial', level: 'admin' },
  
  // Reports Permissions
  { id: 'reports_view', name: 'View Reports', description: 'Access standard business reports', category: 'reports', level: 'basic' },
  { id: 'reports_advanced', name: 'Advanced Reports', description: 'Access detailed analytics and insights', category: 'reports', level: 'advanced' },
  { id: 'reports_export', name: 'Export Reports', description: 'Download reports in various formats', category: 'reports', level: 'advanced' },
  { id: 'reports_custom', name: 'Custom Reports', description: 'Create and modify custom reports', category: 'reports', level: 'admin' },
  
  // Management Permissions
  { id: 'customers_manage', name: 'Manage Customers', description: 'Create, edit, and view customer information', category: 'management', level: 'basic' },
  { id: 'suppliers_manage', name: 'Manage Suppliers', description: 'Handle supplier relationships', category: 'management', level: 'advanced' },
  { id: 'staff_view', name: 'View Staff', description: 'Access staff member information', category: 'management', level: 'basic' },
  { id: 'staff_manage', name: 'Manage Staff', description: 'Add, edit, and remove staff members', category: 'management', level: 'admin' },
  { id: 'purchases_manage', name: 'Manage Purchases', description: 'Handle purchase orders and procurement', category: 'management', level: 'advanced' },
  
  // System Permissions
  { id: 'system_settings', name: 'System Settings', description: 'Access system configuration', category: 'system', level: 'admin' },
  { id: 'user_permissions', name: 'User Permissions', description: 'Manage user roles and permissions', category: 'system', level: 'admin' },
  { id: 'data_backup', name: 'Data Backup', description: 'Perform system backups', category: 'system', level: 'admin' },
  { id: 'audit_logs', name: 'Audit Logs', description: 'View system activity logs', category: 'system', level: 'admin' },
];

const initialState: PermissionsState = {
  allPermissions: defaultPermissions,
  userPermissions: [],
  isLoading: false,
};

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    setUserPermissions: (state, action: PayloadAction<string[]>) => {
      state.userPermissions = action.payload;
    },
    addPermission: (state, action: PayloadAction<string>) => {
      if (!state.userPermissions.includes(action.payload)) {
        state.userPermissions.push(action.payload);
      }
    },
    removePermission: (state, action: PayloadAction<string>) => {
      state.userPermissions = state.userPermissions.filter(id => id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearPermissions: (state) => {
      state.userPermissions = [];
    },
  },
});

export const { 
  setUserPermissions, 
  addPermission, 
  removePermission, 
  setLoading, 
  clearPermissions 
} = permissionsSlice.actions;

export default permissionsSlice.reducer;