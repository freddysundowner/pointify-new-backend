import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { normalizeId } from '@/lib/utils';
import { Plus, Search, Edit, Trash2, Phone, Mail, User, Clock, DollarSign, Shield, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/dashboard-layout';

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
}

interface Attendant {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  shift: 'morning' | 'afternoon' | 'evening' | 'night';
  hourlyRate: number;
  status: 'active' | 'inactive' | 'on_leave';
  hireDate: string;
  lastActive?: string;
  permissions: string[];
  customRole?: boolean;
}

// Comprehensive permission definitions
const allPermissions: Permission[] = [
  // Sales Permissions
  { id: 'sales_create', name: 'Create Sales', description: 'Process new sales transactions', category: 'sales', level: 'basic' },
  { id: 'sales_view', name: 'View Sales', description: 'View sales history and details', category: 'sales', level: 'basic' },
  { id: 'sales_edit', name: 'Edit Sales', description: 'Modify existing sales', category: 'sales', level: 'advanced' },
  { id: 'sales_delete', name: 'Delete Sales', description: 'Remove sales transactions', category: 'sales', level: 'admin' },
  { id: 'sales_return', name: 'Process Returns', description: 'Handle returns and refunds', category: 'sales', level: 'basic' },
  { id: 'sales_discount', name: 'Apply Discounts', description: 'Apply discounts to sales', category: 'sales', level: 'basic' },
  { id: 'sales_void', name: 'Void Transactions', description: 'Void completed transactions', category: 'sales', level: 'advanced' },

  // Inventory Permissions
  { id: 'inventory_view', name: 'View Inventory', description: 'View product stock levels', category: 'inventory', level: 'basic' },
  { id: 'inventory_add', name: 'Add Products', description: 'Add new products to inventory', category: 'inventory', level: 'basic' },
  { id: 'inventory_edit', name: 'Edit Products', description: 'Modify product information', category: 'inventory', level: 'basic' },
  { id: 'inventory_delete', name: 'Delete Products', description: 'Remove products from inventory', category: 'inventory', level: 'advanced' },
  { id: 'inventory_transfer', name: 'Stock Transfer', description: 'Transfer stock between locations', category: 'inventory', level: 'basic' },
  { id: 'inventory_count', name: 'Stock Count', description: 'Perform stock counting', category: 'inventory', level: 'basic' },
  { id: 'inventory_purchase', name: 'Manage Purchases', description: 'Create and manage purchase orders', category: 'inventory', level: 'advanced' },

  // Financial Permissions
  { id: 'financial_view', name: 'View Financial Data', description: 'Access financial information', category: 'financial', level: 'basic' },
  { id: 'financial_expenses', name: 'Manage Expenses', description: 'Add and manage expenses', category: 'financial', level: 'basic' },
  { id: 'financial_cashflow', name: 'View Cash Flow', description: 'Access cash flow reports', category: 'financial', level: 'advanced' },
  { id: 'financial_payroll', name: 'Manage Payroll', description: 'Handle staff payroll', category: 'financial', level: 'admin' },

  // Reports Permissions
  { id: 'reports_sales', name: 'Sales Reports', description: 'View sales reports', category: 'reports', level: 'basic' },
  { id: 'reports_inventory', name: 'Inventory Reports', description: 'View inventory reports', category: 'reports', level: 'basic' },
  { id: 'reports_financial', name: 'Financial Reports', description: 'View financial reports', category: 'reports', level: 'advanced' },
  { id: 'reports_custom', name: 'Custom Reports', description: 'Create custom reports', category: 'reports', level: 'advanced' },

  // Management Permissions
  { id: 'management_customers', name: 'Manage Customers', description: 'Manage customer accounts', category: 'management', level: 'basic' },
  { id: 'management_suppliers', name: 'Manage Suppliers', description: 'Manage supplier accounts', category: 'management', level: 'basic' },
  { id: 'management_staff', name: 'Manage Staff', description: 'Manage staff members', category: 'management', level: 'admin' },
  { id: 'management_roles', name: 'Manage Roles', description: 'Create and edit roles', category: 'management', level: 'admin' },

  // System Permissions
  { id: 'system_settings', name: 'System Settings', description: 'Access system settings', category: 'system', level: 'admin' },
  { id: 'system_backup', name: 'Data Backup', description: 'Manage data backups', category: 'system', level: 'admin' },
  { id: 'system_audit', name: 'Audit Logs', description: 'View audit logs', category: 'system', level: 'admin' },
];

// Predefined roles
const defaultRoles: Role[] = [
  {
    id: 'cashier',
    name: 'Cashier',
    description: 'Basic sales operations',
    permissions: ['sales_create', 'sales_view', 'sales_return', 'sales_discount', 'inventory_view', 'management_customers', 'reports_sales'],
    isDefault: true,
  },
  {
    id: 'stock_clerk',
    name: 'Stock Clerk',
    description: 'Inventory management',
    permissions: ['inventory_view', 'inventory_add', 'inventory_edit', 'inventory_transfer', 'inventory_count', 'reports_inventory'],
    isDefault: true,
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Supervisory access with advanced permissions',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_return', 'sales_discount', 'sales_void',
      'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_transfer', 'inventory_count',
      'financial_view', 'financial_expenses', 'reports_sales', 'reports_inventory', 'reports_financial',
      'management_customers', 'management_suppliers'
    ],
    isDefault: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Full management access',
    permissions: [
      'sales_create', 'sales_view', 'sales_edit', 'sales_delete', 'sales_return', 'sales_discount', 'sales_void',
      'inventory_view', 'inventory_add', 'inventory_edit', 'inventory_delete', 'inventory_transfer', 'inventory_count', 'inventory_purchase',
      'financial_view', 'financial_expenses', 'financial_cashflow', 'financial_payroll',
      'reports_sales', 'reports_inventory', 'reports_financial', 'reports_custom',
      'management_customers', 'management_suppliers', 'management_staff', 'management_roles',
      'system_settings', 'system_backup', 'system_audit'
    ],
    isDefault: true,
  },
];

// Mock staff data
const mockAttendants: Attendant[] = [
  {
    _id: '1',
    name: 'Alice Johnson',
    email: 'alice.j@company.com',
    phone: '+1-555-0123',
    role: 'manager',
    shift: 'morning',
    hourlyRate: 25.00,
    status: 'active',
    hireDate: '2023-06-15',
    lastActive: '2024-01-15 14:30',
    permissions: defaultRoles.find(r => r.id === 'manager')?.permissions || [],
    customRole: false
  },
  {
    _id: '2',
    name: 'Bob Smith',
    email: 'bob.smith@company.com',
    phone: '+1-555-0456',
    role: 'cashier',
    shift: 'afternoon',
    hourlyRate: 15.00,
    status: 'active',
    hireDate: '2023-08-20',
    lastActive: '2024-01-15 16:45',
    permissions: defaultRoles.find(r => r.id === 'cashier')?.permissions || [],
    customRole: false
  },
  {
    _id: '3',
    name: 'Carol Davis',
    email: 'carol.davis@company.com',
    phone: '+1-555-0789',
    role: 'supervisor',
    shift: 'evening',
    hourlyRate: 20.00,
    status: 'active',
    hireDate: '2023-07-10',
    lastActive: '2024-01-14 22:15',
    permissions: defaultRoles.find(r => r.id === 'supervisor')?.permissions || [],
    customRole: false
  },
  {
    _id: '4',
    name: 'David Wilson',
    email: 'david.w@company.com',
    phone: '+1-555-0321',
    role: 'stock_clerk',
    shift: 'morning',
    hourlyRate: 14.00,
    status: 'on_leave',
    hireDate: '2023-09-05',
    lastActive: '2024-01-10 09:30',
    permissions: defaultRoles.find(r => r.id === 'stock_clerk')?.permissions || [],
    customRole: false
  }
];

export default function StaffPermissions() {
  const [attendants] = useState<Attendant[]>(mockAttendants);
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttendant, setSelectedAttendant] = useState<Attendant | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'cashier',
    shift: 'morning' as 'morning' | 'afternoon' | 'evening' | 'night',
    hourlyRate: '',
    hireDate: '',
    permissions: [] as string[]
  });
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });
  const { toast } = useToast();

  const createStaffMutation = useMutation({
    mutationFn: async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Staff member added successfully' });
      resetStaffForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add staff member', variant: 'destructive' });
    }
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { id, data };
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Staff member updated successfully' });
      resetStaffForm();
    }
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Role created successfully' });
      resetRoleForm();
    }
  });

  const filteredAttendants = attendants.filter(attendant =>
    attendant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attendant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attendant.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAttendants = attendants.filter(a => a.status === 'active').length;
  const totalPayroll = attendants
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + (a.hourlyRate * 40), 0);

  const resetStaffForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'cashier',
      shift: 'morning',
      hourlyRate: '',
      hireDate: '',
      permissions: []
    });
    setSelectedAttendant(null);
    setIsStaffDialogOpen(false);
  };

  const resetRoleForm = () => {
    setRoleFormData({ name: '', description: '', permissions: [] });
    setSelectedRole(null);
    setIsRoleDialogOpen(false);
  };

  const handleStaffSubmit = () => {
    if (selectedAttendant) {
      updateStaffMutation.mutate({ id: selectedAttendant._id, data: formData });
    } else {
      createStaffMutation.mutate(formData);
    }
  };

  const handleRoleSubmit = () => {
    if (selectedRole) {
      // Update role logic
    } else {
      createRoleMutation.mutate({
        ...roleFormData,
        id: roleFormData.name.toLowerCase().replace(/\s+/g, '_'),
        isDefault: false
      });
    }
  };

  const handleStaffEdit = (attendant: Attendant) => {
    setSelectedAttendant(attendant);
    setFormData({
      name: attendant.name,
      email: attendant.email,
      phone: attendant.phone,
      role: attendant.role,
      shift: attendant.shift,
      hourlyRate: attendant.hourlyRate.toString(),
      hireDate: attendant.hireDate,
      permissions: attendant.permissions || []
    });
    setIsStaffDialogOpen(true);
  };

  const handleRoleEdit = (role: Role) => {
    setSelectedRole(role);
    setRoleFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setIsRoleDialogOpen(true);
  };

  const handlePermissionToggle = (permissionId: string, isRole = false) => {
    if (isRole) {
      setRoleFormData(prev => ({
        ...prev,
        permissions: prev.permissions.includes(permissionId)
          ? prev.permissions.filter(p => p !== permissionId)
          : [...prev.permissions, permissionId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.includes(permissionId)
          ? prev.permissions.filter(p => p !== permissionId)
          : [...prev.permissions, permissionId]
      }));
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-800';
      case 'supervisor': return 'bg-blue-100 text-blue-800';
      case 'cashier': return 'bg-green-100 text-green-800';
      case 'stock_clerk': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'on_leave': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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

  return (
    <DashboardLayout title="Staff & Permissions">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-purple-600" />
              Staff & Permissions
            </h1>
            <p className="hidden sm:block text-gray-600">Manage staff members, roles, and permissions</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Staff Members
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles & Permissions
            </TabsTrigger>
          </TabsList>

          {/* Staff Management Tab */}
          <TabsContent value="staff" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetStaffForm()} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Staff Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {selectedAttendant ? 'Edit Staff Member' : 'Add New Staff Member'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="role">Role *</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="shift">Shift</Label>
                        <Select value={formData.shift} onValueChange={(value: any) => setFormData({ ...formData, shift: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                        <Input
                          id="hourlyRate"
                          type="number"
                          step="0.01"
                          value={formData.hourlyRate}
                          onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                          placeholder="15.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hireDate">Hire Date</Label>
                        <Input
                          id="hireDate"
                          type="date"
                          value={formData.hireDate}
                          onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={resetStaffForm}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleStaffSubmit}
                        disabled={!formData.name || !formData.email || createStaffMutation.isPending || updateStaffMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {createStaffMutation.isPending || updateStaffMutation.isPending ? (
                          'Saving...'
                        ) : selectedAttendant ? (
                          'Update Staff Member'
                        ) : (
                          'Add Staff Member'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">{attendants.length}</div>
                  <div className="text-sm text-gray-600">Total Staff</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{activeAttendants}</div>
                  <div className="text-sm text-gray-600">Active</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {attendants.filter(a => a.status === 'on_leave').length}
                  </div>
                  <div className="text-sm text-gray-600">On Leave</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">${totalPayroll.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Weekly Payroll</div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search staff members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Staff Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAttendants.map((attendant) => (
                <Card key={normalizeId(attendant)._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{attendant.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getRoleColor(attendant.role)}>{attendant.role}</Badge>
                            <Badge className={getStatusColor(attendant.status)}>{attendant.status}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStaffEdit(attendant)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      {attendant.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      {attendant.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      {attendant.shift} shift
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2" />
                      ${attendant.hourlyRate}/hour
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Shield className="h-4 w-4 mr-2" />
                      {attendant.permissions.length} permissions
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Hired:</span>
                          <span className="font-medium">{attendant.hireDate}</span>
                        </div>
                        {attendant.lastActive && (
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-500">Last Active:</span>
                            <span className="font-medium">{attendant.lastActive}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Roles & Permissions Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetRoleForm()} className="bg-purple-600 hover:bg-purple-700">
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
                        <Label htmlFor="roleName">Role Name *</Label>
                        <Input
                          id="roleName"
                          value={roleFormData.name}
                          onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                          placeholder="e.g., Senior Cashier"
                        />
                      </div>
                      <div>
                        <Label htmlFor="roleDescription">Description</Label>
                        <Input
                          id="roleDescription"
                          value={roleFormData.description}
                          onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
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
                                    checked={roleFormData.permissions.includes(permission.id)}
                                    onCheckedChange={() => handlePermissionToggle(permission.id, true)}
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
                      <Button variant="outline" onClick={resetRoleForm}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleRoleSubmit}
                        disabled={!roleFormData.name || createRoleMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}