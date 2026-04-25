import { useState } from 'react';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Eye, EyeOff, UserPlus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/features/auth/useAuth';

interface Permission {
  key: string;
  value: string[];
}

interface Attendant {
  _id: string;
  username: string;
  uniqueDigits: number;
  password?: string;
  shopId: string | { _id: string; name: string };
  adminId: string;
  permissions: Permission[];
  createdAt?: string;
  last_seen?: string;
  status?: 'active' | 'inactive' | 'on_leave';
}

export default function Attendants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [selectedAttendant, setSelectedAttendant] = useState<Attendant | null>(null);
  const [generatedPin, setGeneratedPin] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>([]);

  const { admin } = useAuth(); // Use AuthProvider context instead of Redux
  const { selectedShopId, availableShops } = useSelector((state: RootState) => state.shop);
  
  // Force use of admin's primary shop if no shop is selected
  const shopId = selectedShopId || admin?.primaryShop?.id || admin?.primaryShop?._id || admin?.primaryShop;
  
  // Get admin's primary shop ID
  const primaryShopId = typeof admin?.primaryShop === 'string' ? admin.primaryShop : admin?.primaryShop?._id;
  const currentShopId = selectedShopId || primaryShopId;

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    shopId: currentShopId || (availableShops.length > 0 ? availableShops[0].id : ''),
    permissions: [] as Permission[]
  });

  // Get shops data - availableShops uses 'id' field, not '_id'
  const shops = availableShops.map(shop => ({
    id: shop.id,
    name: shop?.name,
    location: shop.location || 'No address'
  }));
  
  console.log('Shops mapped:', shops);
  console.log('Available shops raw:', availableShops);
  console.log('Form shop ID:', formData.shopId);

  // Get admin from localStorage as fallback
  const localAdmin = JSON.parse(localStorage.getItem('adminData') || '{}');
  const effectiveAdmin = admin || localAdmin;

  // Fetch admin permissions when editing permissions
  const { data: adminPermissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['/api/admin/permissions'],
    queryFn: () => {
      const token = localStorage.getItem('authToken');
      return fetch(`/api/admin/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(res => {
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log('Admin permissions response:', data);
          return Array.isArray(data) ? data : data.permissions || [];
        });
    },
    enabled: isPermissionsDialogOpen,
  });

  // Permission editing functions
  const initializeEditingPermissions = (attendant: Attendant) => {
    setEditingPermissions(attendant.permissions || []);
  };

  const toggleEditingPermission = (groupKey: string, action: string, checked: boolean) => {
    setEditingPermissions(prev => {
      const permissions = [...prev];
      const existingIndex = permissions.findIndex(p => p.key === groupKey);
      
      if (existingIndex >= 0) {
        if (checked) {
          // Add action if not already present
          if (!permissions[existingIndex].value.includes(action)) {
            permissions[existingIndex].value.push(action);
          }
        } else {
          // Remove action
          permissions[existingIndex].value = permissions[existingIndex].value.filter(a => a !== action);
          if (permissions[existingIndex].value.length === 0) {
            // Remove permission group if no actions left
            permissions.splice(existingIndex, 1);
          }
        }
      } else if (checked) {
        // Create new permission group
        permissions.push({
          key: groupKey,
          value: [action]
        });
      }
      
      return permissions;
    });
  };

  const hasEditingPermission = (groupKey: string, action: string) => {
    const permission = editingPermissions.find(p => p.key === groupKey);
    return permission?.value?.includes(action) || false;
  };
  
  // Debug logging
  console.log('Auth admin:', admin);
  console.log('LocalStorage admin:', localAdmin);
  console.log('Debug attendants query:', {
    currentShopId,
    adminId: effectiveAdmin?._id || effectiveAdmin?.id,
    primaryShopId,
    enabled: !!currentShopId && !!(effectiveAdmin?._id || effectiveAdmin?.id),
    selectedShopId,
    availableShopsCount: availableShops.length
  });

  const { data: attendants = [], isLoading, error } = useQuery({
    queryKey: ['/api/attendants/all', effectiveAdmin?._id || effectiveAdmin?.id],
    queryFn: () => {
      const adminId = effectiveAdmin?._id || effectiveAdmin?.id;
      console.log('Fetching all attendants for adminId:', adminId);
      const token = localStorage.getItem('authToken');
      return fetch(`/api/attendants/all/${adminId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(res => {
          console.log('Attendants API response status:', res.status);
          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('Attendants API response data:', data);
          return Array.isArray(data) ? data : data.data || [];
        });
    },
    enabled: !!(effectiveAdmin?._id || effectiveAdmin?.id),
    onError: (error: Error) => {
      console.error('Error fetching attendants:', error);
      toast({
        title: "Error",
        description: "Failed to load attendants",
        variant: "destructive",
      });
    }
  });

  // Create attendant mutation
  const createAttendantMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/attendants', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendants/all'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Attendant created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create attendant",
        variant: "destructive",
      });
    }
  });

  // Update attendant mutation
  const updateAttendantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/attendants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendants/all'] });
      setIsDialogOpen(false);
      setIsPermissionsDialogOpen(false);
      setIsEditingPermissions(false);
      resetForm();
      toast({
        title: "Success",
        description: "Attendant updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update attendant",
        variant: "destructive",
      });
    }
  });

  // Delete attendant mutation
  const deleteAttendantMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/attendants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendants/all'] });
      setIsDeleteDialogOpen(false);
      setSelectedAttendant(null);
      toast({
        title: "Success",
        description: "Attendant deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete attendant",
        variant: "destructive",
      });
    }
  });

  const generateRandomPin = () => {
    // Generate a unique 5-digit PIN
    let pin;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop
    
    do {
      pin = Math.floor(10000 + Math.random() * 90000);
      attempts++;
    } while (
      attempts < maxAttempts && 
      attendants.some((attendant: Attendant) => attendant.uniqueDigits === pin)
    );
    
    return pin;
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      shopId: currentShopId || '',
      permissions: []
    });
    setSelectedAttendant(null);
    setGeneratedPin(0);
    setShowPassword(false);
  };

  const handleCreate = () => {
    const pin = generateRandomPin();
    setGeneratedPin(pin);
    
    const defaultShopId = currentShopId || (availableShops.length > 0 ? availableShops[0].id : '');
    console.log('Creating attendant with shop:', defaultShopId);
    console.log('Available shops:', availableShops);
    console.log('Current shop ID:', currentShopId);
    
    // Set form data with proper shop selection
    setFormData({
      username: '',
      password: '',
      shopId: defaultShopId,
      permissions: []
    });
    
    setSelectedAttendant(null);
    setShowPassword(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (attendant: Attendant) => {
    setSelectedAttendant(attendant);
    setFormData({
      username: attendant.username,
      password: '',
      shopId: typeof attendant.shopId === 'string' ? attendant.shopId : attendant.shopId._id,
      permissions: attendant.permissions || []
    });
    setIsDialogOpen(true);
  };

  const handleEditPermissions = (attendant: Attendant) => {
    setSelectedAttendant(attendant);
    initializeEditingPermissions(attendant);
    setIsPermissionsDialogOpen(true);
  };

  const handleDelete = (attendant: Attendant) => {
    setSelectedAttendant(attendant);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    console.log('Form data before validation:', formData);
    console.log('Current shop ID:', currentShopId);
    console.log('Available shops:', availableShops);
    
    if (!formData.username || (!selectedAttendant && !formData.password) || !formData.shopId) {
      console.log('Validation failed:', {
        username: formData.username,
        password: formData.password,
        shopId: formData.shopId,
        selectedAttendant: selectedAttendant
      });
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      username: formData.username,
      uniqueDigits: selectedAttendant ? selectedAttendant.uniqueDigits : generatedPin,
      shopId: formData.shopId,
      adminId: admin?._id,
      permissions: formData.permissions,
      ...(formData.password && { password: formData.password })
    };

    if (selectedAttendant) {
      updateAttendantMutation.mutate({ id: selectedAttendant._id, data: submitData });
    } else {
      createAttendantMutation.mutate(submitData);
    }
  };

  // Filter attendants based on search query
  const filteredAttendants = attendants.filter((attendant: Attendant) =>
    attendant.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attendant.uniqueDigits?.toString().includes(searchQuery)
  );

  const activeAttendants = attendants.filter((a: Attendant) => a.status === 'active' || !a.status).length;

  // Dynamic permission groups based on actual API data
  const getAvailablePermissionKeys = () => {
    const allKeys = new Set<string>();
    attendants.forEach((attendant: Attendant) => {
      attendant.permissions?.forEach(p => allKeys.add(p.key));
    });
    return Array.from(allKeys);
  };

  const getAvailableActionsForKey = (key: string) => {
    const allActions = new Set<string>();
    attendants.forEach((attendant: Attendant) => {
      const permission = attendant.permissions?.find(p => p.key === key);
      if (permission) {
        permission.value.forEach(action => allActions.add(action));
      }
    });
    return Array.from(allActions);
  };

  // Dynamic permission groups based on real API data
  const permissionGroups = React.useMemo(() => {
    const groups: Record<string, { name: string; actions: string[] }> = {};
    const availableKeys = getAvailablePermissionKeys();
    
    availableKeys.forEach(key => {
      groups[key] = {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        actions: getAvailableActionsForKey(key)
      };
    });

    // Add fallback groups for common permission keys if not found in API data
    const fallbackGroups = {
      products: {
        name: 'Products',
        actions: ['edit', 'view_adjustment_history', 'adjust_stock']
      },
      stocks: {
        name: 'Stocks',
        actions: ['view_products', 'add_purchases', 'view_purchases', 'add_products', 'view_buying_price', 'stock_summary']
      },
      warehouse: {
        name: 'Warehouse',
        actions: ['view_orders', 'accept_warehouse_orders']
      },
      sales: {
        name: 'Sales',
        actions: ['create_sales', 'view_sales', 'edit_sales', 'delete_sales', 'process_payments']
      },
      customers: {
        name: 'Customers',
        actions: ['add_customers', 'view_customers', 'edit_customers', 'view_debt', 'manage_payments']
      },
      reports: {
        name: 'Reports & Analytics',
        actions: ['view_sales_reports', 'view_inventory_reports', 'view_financial_reports', 'export_data']
      }
    };

    // Merge API data with fallbacks
    Object.keys(fallbackGroups).forEach(key => {
      if (!groups[key]) {
        groups[key] = fallbackGroups[key];
      }
    });

    return groups;
  }, [attendants]);

  // Permission helper functions
  const hasPermission = (groupKey: string, action: string) => {
    const permission = formData.permissions.find(p => p.key === groupKey);
    return permission?.value.includes(action) || false;
  };

  const handlePermissionChange = (groupKey: string, action: string, checked: boolean) => {
    setFormData(prev => {
      const permissions = [...prev.permissions];
      const existingIndex = permissions.findIndex(p => p.key === groupKey);
      
      if (existingIndex >= 0) {
        if (checked) {
          if (!permissions[existingIndex].value.includes(action)) {
            permissions[existingIndex].value.push(action);
          }
        } else {
          permissions[existingIndex].value = permissions[existingIndex].value.filter(v => v !== action);
          if (permissions[existingIndex].value.length === 0) {
            permissions.splice(existingIndex, 1);
          }
        }
      } else if (checked) {
        permissions.push({ key: groupKey, value: [action] });
      }
      
      return { ...prev, permissions };
    });
  };

  const savePermissions = () => {
    if (!selectedAttendant) return;
    
    const submitData = {
      username: selectedAttendant.username,
      uniqueDigits: selectedAttendant.uniqueDigits,
      shopId: typeof selectedAttendant.shopId === 'string' ? selectedAttendant.shopId : selectedAttendant.shopId._id,
      adminId: admin?._id,
      permissions: formData.permissions
    };

    updateAttendantMutation.mutate({ id: selectedAttendant._id, data: submitData });
  };

  // Get shop name for display
  const getShopName = (shopId: string | { _id: string; name: string }) => {
    if (typeof shopId === 'object') return shopId?.name;
    const shop = shops.find((s) => s.id === shopId);
    return shop?.name || 'Unknown Shop';
  };

  const selectedShop = shops.find((shop) => shop.id === currentShopId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600">
              Manage attendants for {selectedShop?.name || 'your shops'}
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Attendant
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{filteredAttendants.length}</div>
              <div className="text-sm text-gray-600">Total Staff</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{activeAttendants}</div>
              <div className="text-sm text-gray-600">Active Staff</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {attendants.filter((a: Attendant) => a.status === 'on_leave').length}
              </div>
              <div className="text-sm text-gray-600">On Leave</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {attendants.filter((a: Attendant) => a.status === 'inactive').length}
              </div>
              <div className="text-sm text-gray-600">Inactive</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
            <CardDescription>Manage your store attendants and their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or PIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading attendants...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">Error loading attendants</div>
            ) : filteredAttendants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No attendants found matching your search' : 'No attendants found for this shop'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PIN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAttendants.map((attendant: Attendant) => (
                      <tr key={attendant._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{attendant.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-500">{attendant.uniqueDigits}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{getShopName(attendant.shopId)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {attendant.last_seen ? new Date(attendant.last_seen).toLocaleString() : 'Never'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant={
                              attendant.status === 'active' || !attendant.status ? 'default' :
                              attendant.status === 'on_leave' ? 'secondary' : 'destructive'
                            }
                          >
                            {attendant.status || 'active'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPermissions(attendant)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(attendant)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(attendant)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Attendant Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedAttendant ? 'Edit Attendant' : 'Create New Attendant'}
              </DialogTitle>
              <DialogDescription>
                {selectedAttendant ? 'Update attendant information' : 'Add a new attendant to your team'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  value={selectedAttendant ? selectedAttendant.uniqueDigits : generatedPin}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  {selectedAttendant 
                    ? "Existing PIN cannot be changed" 
                    : "Auto-generated 5-digit PIN for this attendant"
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {selectedAttendant && "(Leave blank to keep current)"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopId">Shop</Label>
                <Select
                  value={formData.shopId || ''}
                  onValueChange={(value) => {
                    console.log('Shop selected:', value);
                    setFormData(prev => ({ ...prev, shopId: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        {shop?.name} - {shop.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAttendantMutation.isPending || updateAttendantMutation.isPending}
              >
                {selectedAttendant ? 'Update' : 'Create'} Attendant
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Attendant</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedAttendant?.username}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedAttendant && deleteAttendantMutation.mutate(selectedAttendant._id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permissions Dialog */}
        <Dialog open={isPermissionsDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsPermissionsDialogOpen(false);
            setIsEditingPermissions(false);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {isEditingPermissions ? 'Edit Permissions' : 'View Permissions'}
              </DialogTitle>
              <DialogDescription>
                {isEditingPermissions ? 'Assign permissions for' : 'Current permissions for'} {selectedAttendant?.username}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {isLoadingPermissions ? (
                <div className="text-center py-8">Loading permissions...</div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-medium">Available Permissions for {selectedAttendant?.username}:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminPermissions.map((permission: Permission) => (
                      <div key={permission.key} className="border rounded-lg p-3">
                        <h5 className="font-medium text-sm mb-3 text-blue-700 capitalize">{permission.key}</h5>
                        <div className="space-y-2">
                          {permission.value.map((action: string) => {
                            // Check if attendant has this permission in editing state
                            const isChecked = hasEditingPermission(permission.key, action);
                            
                            return (
                              <div key={action} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${permission.key}-${action}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    console.log(`Toggling ${permission.key}-${action}: ${checked}`);
                                    toggleEditingPermission(permission.key, action, checked as boolean);
                                  }}
                                />
                                <Label htmlFor={`${permission.key}-${action}`} className="text-xs font-normal cursor-pointer leading-tight">
                                  {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPermissionsDialogOpen(false);
                  setEditingPermissions([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedAttendant) return;
                  
                  const submitData = {
                    username: selectedAttendant.username,
                    uniqueDigits: selectedAttendant.uniqueDigits,
                    shopId: typeof selectedAttendant.shopId === 'string' ? selectedAttendant.shopId : selectedAttendant.shopId._id,
                    adminId: effectiveAdmin?._id || effectiveAdmin?.id,
                    permissions: editingPermissions
                  };

                  console.log('Saving permissions:', submitData);
                  updateAttendantMutation.mutate({ 
                    id: selectedAttendant._id, 
                    data: submitData 
                  }, {
                    onSuccess: () => {
                      setIsPermissionsDialogOpen(false);
                      setEditingPermissions([]);
                      toast({
                        title: "Success",
                        description: "Permissions updated successfully",
                      });
                    }
                  });
                }}
                disabled={updateAttendantMutation.isPending}
              >
                {updateAttendantMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}