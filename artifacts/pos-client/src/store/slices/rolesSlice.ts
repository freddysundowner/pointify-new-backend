import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isDefault: boolean;
  isSystem: boolean;
}

interface RolesState {
  roles: Role[];
  isLoading: boolean;
}

// Default system roles
const defaultRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_delete', 'sales_refund',
      'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_delete', 'stock_adjust',
      'financial_view', 'expenses_create', 'expenses_edit', 'cashflow_manage', 'financial_export',
      'reports_view', 'reports_advanced', 'reports_export', 'reports_custom',
      'customers_manage', 'suppliers_manage', 'staff_view', 'staff_manage', 'purchases_manage',
      'system_settings', 'user_permissions', 'data_backup', 'audit_logs'
    ],
    isDefault: true,
    isSystem: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Management level access with advanced permissions',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_refund',
      'inventory_view', 'inventory_add', 'inventory_edit', 'stock_adjust',
      'financial_view', 'expenses_create', 'expenses_edit', 'cashflow_manage',
      'reports_view', 'reports_advanced', 'reports_export',
      'customers_manage', 'suppliers_manage', 'staff_view', 'purchases_manage'
    ],
    isDefault: true,
    isSystem: true,
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Supervisory access with moderate permissions',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_refund',
      'inventory_view', 'inventory_add', 'inventory_edit',
      'financial_view', 'expenses_create',
      'reports_view', 'reports_advanced',
      'customers_manage', 'staff_view'
    ],
    isDefault: true,
    isSystem: true,
  },
  {
    id: 'cashier',
    name: 'Cashier',
    description: 'Basic sales and customer service permissions',
    permissions: [
      'sales_create', 'sales_view',
      'inventory_view',
      'customers_manage',
      'reports_view'
    ],
    isDefault: true,
    isSystem: true,
  },
  {
    id: 'stock_clerk',
    name: 'Stock Clerk',
    description: 'Inventory management focused permissions',
    permissions: [
      'inventory_view', 'inventory_add', 'inventory_edit', 'stock_adjust',
      'reports_view'
    ],
    isDefault: true,
    isSystem: true,
  },
];

const initialState: RolesState = {
  roles: defaultRoles,
  isLoading: false,
};

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    setRoles: (state, action: PayloadAction<Role[]>) => {
      state.roles = action.payload;
    },
    addRole: (state, action: PayloadAction<Role>) => {
      state.roles.push(action.payload);
    },
    updateRole: (state, action: PayloadAction<Role>) => {
      const index = state.roles.findIndex(role => role.id === action.payload.id);
      if (index !== -1) {
        state.roles[index] = action.payload;
      }
    },
    deleteRole: (state, action: PayloadAction<string>) => {
      state.roles = state.roles.filter(role => role.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setRoles, addRole, updateRole, deleteRole, setLoading } = rolesSlice.actions;
export default rolesSlice.reducer;