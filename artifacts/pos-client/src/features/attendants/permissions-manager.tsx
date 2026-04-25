import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Shield, Users, Settings, Plus, Edit, Trash2, Save } from "lucide-react";

// Permission definitions
interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'inventory' | 'financial' | 'reports' | 'management' | 'system';
  level: 'basic' | 'advanced' | 'admin';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isDefault: boolean;
  createdAt: string;
}

const allPermissions: Permission[] = [
  // Sales Permissions
  { id: 'sales_create', name: 'Create Sales', description: 'Create new sales transactions', category: 'sales', level: 'basic' },
  { id: 'sales_view', name: 'View Sales', description: 'View sales history and details', category: 'sales', level: 'basic' },
  { id: 'sales_edit', name: 'Edit Sales', description: 'Modify existing sales transactions', category: 'sales', level: 'advanced' },
  { id: 'sales_delete', name: 'Delete Sales', description: 'Delete sales transactions', category: 'sales', level: 'admin' },
  { id: 'sales_return', name: 'Process Returns', description: 'Handle product returns and refunds', category: 'sales', level: 'basic' },
  { id: 'sales_discount', name: 'Apply Discounts', description: 'Apply discounts to sales', category: 'sales', level: 'basic' },
  { id: 'sales_void', name: 'Void Transactions', description: 'Void completed transactions', category: 'sales', level: 'advanced' },

  // Inventory Permissions
  { id: 'inventory_view', name: 'View Inventory', description: 'View product inventory levels', category: 'inventory', level: 'basic' },
  { id: 'inventory_add', name: 'Add Products', description: 'Add new products to inventory', category: 'inventory', level: 'basic' },
  { id: 'inventory_edit', name: 'Edit Products', description: 'Modify product information', category: 'inventory', level: 'basic' },
  { id: 'inventory_delete', name: 'Delete Products', description: 'Remove products from inventory', category: 'inventory', level: 'advanced' },
  { id: 'inventory_transfer', name: 'Stock Transfer', description: 'Transfer stock between locations', category: 'inventory', level: 'basic' },
  { id: 'inventory_count', name: 'Stock Count', description: 'Perform stock counting and adjustments', category: 'inventory', level: 'basic' },
  { id: 'inventory_purchase', name: 'Manage Purchases', description: 'Create and manage purchase orders', category: 'inventory', level: 'advanced' },

  // Financial Permissions
  { id: 'financial_view', name: 'View Financial Data', description: 'Access financial information', category: 'financial', level: 'basic' },
  { id: 'financial_expenses', name: 'Manage Expenses', description: 'Add and manage business expenses', category: 'financial', level: 'basic' },
  { id: 'financial_cashflow', name: 'View Cash Flow', description: 'Access cash flow reports', category: 'financial', level: 'advanced' },
  { id: 'financial_payroll', name: 'Manage Payroll', description: 'Handle staff payroll', category: 'financial', level: 'admin' },

  // Reports Permissions
  { id: 'reports_sales', name: 'Sales Reports', description: 'View sales reports and analytics', category: 'reports', level: 'basic' },
  { id: 'reports_inventory', name: 'Inventory Reports', description: 'View inventory reports', category: 'reports', level: 'basic' },
  { id: 'reports_financial', name: 'Financial Reports', description: 'View financial reports', category: 'reports', level: 'advanced' },
  { id: 'reports_custom', name: 'Custom Reports', description: 'Create and export custom reports', category: 'reports', level: 'advanced' },
  { id: 'reports_analytics', name: 'Advanced Analytics', description: 'Access business analytics and insights', category: 'reports', level: 'admin' },

  // Management Permissions
  { id: 'management_customers', name: 'Manage Customers', description: 'Add, edit, and manage customer accounts', category: 'management', level: 'basic' },
  { id: 'management_suppliers', name: 'Manage Suppliers', description: 'Add, edit, and manage supplier accounts', category: 'management', level: 'basic' },
  { id: 'management_staff', name: 'Manage Staff', description: 'Add, edit, and manage staff members', category: 'management', level: 'admin' },
  { id: 'management_roles', name: 'Manage Roles', description: 'Create and edit user roles and permissions', category: 'management', level: 'admin' },

  // System Permissions
  { id: 'system_settings', name: 'System Settings', description: 'Access and modify system settings', category: 'system', level: 'admin' },
  { id: 'system_backup', name: 'Data Backup', description: 'Create and manage data backups', category: 'system', level: 'admin' },
  { id: 'system_audit', name: 'Audit Logs', description: 'View system audit logs', category: 'system', level: 'admin' },
];

const defaultRoles: Role[] = [
  {
    id: 'cashier',
    name: 'Cashier',
    description: 'Basic sales operations and customer service',
    permissions: ['sales_create', 'sales_view', 'sales_return', 'sales_discount', 'inventory_view', 'management_customers', 'reports_sales'],
    isDefault: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'stock_clerk',
    name: 'Stock Clerk',
    description: 'Inventory management and stock operations',
    permissions: ['inventory_view', 'inventory_add', 'inventory_edit', 'inventory_transfer', 'inventory_count', 'reports_inventory', 'management_suppliers'],
    isDefault: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Supervisory access with advanced sales and inventory permissions',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_return', 'sales_discount', 'sales_void',
      'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_transfer', 'inventory_count',
      'financial_view', 'financial_expenses', 'reports_sales', 'reports_inventory', 'reports_financial',
      'management_customers', 'management_suppliers'
    ],
    isDefault: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Full management access with advanced reporting and staff management',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_delete', 'sales_return', 'sales_discount', 'sales_void',
      'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_delete', 'inventory_transfer', 'inventory_count', 'inventory_purchase',
      'financial_view', 'financial_expenses', 'financial_cashflow', 'financial_payroll',
      'reports_sales', 'reports_inventory', 'reports_financial', 'reports_custom', 'reports_analytics',
      'management_customers', 'management_suppliers', 'management_staff', 'management_roles',
      'system_settings', 'system_backup', 'system_audit'
    ],
    isDefault: true,
    createdAt: '2024-01-01',
  },
];

export default function PermissionsManager() {
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });
  const { toast } = useToast();

  const createRoleMutation = useMutation({
    mutationFn: async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Role created successfully' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create role', variant: 'destructive' });
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { id, data };
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Role updated successfully' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [] });
    setSelectedRole(null);
    setIsRoleDialogOpen(false);
  };

  const handleSubmit = () => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data: formData });
    } else {
      createRoleMutation.mutate({
        ...formData,
        id: formData.name.toLowerCase().replace(/\s+/g, '_'),
        isDefault: false,
        createdAt: new Date().toISOString().split('T')[0]
      });
    }
  };

  const handleRoleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
    setIsRoleDialogOpen(true);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const getPermissionsByCategory = (category: string) => {
    return allPermissions.filter(p => p.category === category);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return '💰';
      case 'inventory': return '📦';
      case 'financial': return '💳';
      case 'reports': return '📊';
      case 'management': return '👥';
      case 'system': return '⚙️';
      default: return '🔧';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'basic': return 'bg-green-100 text-green-800';
      case 'advanced': return 'bg-blue-100 text-blue-800';
      case 'admin': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-600" />
            Staff Permissions
          </h1>
          <p className="text-gray-600">Manage roles and permissions for your staff</p>
        </div>
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedRole ? 'Edit Role' : 'Create New Role'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Senior Cashier"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the role"
                  />
                </div>
              </div>

              {/* Permissions Selection */}
              <div>
                <Label className="text-base font-semibold">Permissions</Label>
                <p className="text-sm text-gray-600 mb-4">Select the permissions for this role</p>
                
                <div className="space-y-6">
                  {['sales', 'inventory', 'financial', 'reports', 'management', 'system'].map(category => (
                    <div key={category} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-700 mb-3 flex items-center gap-2">
                        <span>{getCategoryIcon(category)}</span>
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {getPermissionsByCategory(category).map(permission => (
                          <div key={permission.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={permission.id}
                              checked={formData.permissions.includes(permission.id)}
                              onCheckedChange={() => handlePermissionToggle(permission.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                                  {permission.name}
                                </Label>
                                <Badge variant="outline" className={`text-xs ${getLevelColor(permission.level)}`}>
                                  {permission.level}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!formData.name || createRoleMutation.isPending || updateRoleMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {selectedRole ? 'Update Role' : 'Create Role'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(role => (
          <Card key={role.id} className="relative">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                  {role.isDefault && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      Default Role
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRoleEdit(role)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!role.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Permissions: {role.permissions.length}
                </div>
                
                {/* Permission Categories */}
                <div className="space-y-2">
                  {['sales', 'inventory', 'financial', 'reports', 'management', 'system'].map(category => {
                    const categoryPermissions = role.permissions.filter(p => 
                      allPermissions.find(ap => ap.id === p)?.category === category
                    );
                    if (categoryPermissions.length === 0) return null;
                    
                    return (
                      <div key={category} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 capitalize flex items-center gap-1">
                          <span>{getCategoryIcon(category)}</span>
                          {category}
                        </span>
                        <Badge variant="secondary" className="h-5">
                          {categoryPermissions.length}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Permission Reference
          </CardTitle>
          <p className="text-sm text-gray-600">Complete list of available permissions</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {['sales', 'inventory', 'financial', 'reports', 'management', 'system'].map(category => (
              <div key={category} className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-700 mb-3 flex items-center gap-2">
                  <span>{getCategoryIcon(category)}</span>
                  {category} Permissions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getPermissionsByCategory(category).map(permission => (
                    <div key={permission.id} className="flex items-start space-x-3 p-2 rounded border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{permission.name}</span>
                          <Badge variant="outline" className={`text-xs ${getLevelColor(permission.level)}`}>
                            {permission.level}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}