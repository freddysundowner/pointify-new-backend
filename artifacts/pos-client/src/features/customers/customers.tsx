import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { normalizeIds } from '@/lib/utils';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, CreditCard, Eye, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/features/auth/useAuth';
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useShop } from "@/features/shop/useShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useNavigationRoute } from "@/lib/navigation-utils";

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  phonenumber?: string;
  address?: string;
  balance: number;
  totalPurchases: number;
  lastPurchase?: string;
  status: 'active' | 'inactive';
  customerType: 'regular' | 'vip' | 'wholesale';
  wallet?: number;
  outstandingBalance?: string | number;
  online?: boolean;
  dueDate?: string;
}

export default function Customers() {
  const { admin, token } = useAuth();
  const { attendant, isAuthenticated: isAttendantAuth } = useAttendantAuth();
  const { userType, shopId: primaryShopId, adminId } = usePrimaryShop();
  const { toast } = useToast();
  const dashboardRoute = useNavigationRoute('dashboard');
  const customerOverviewRoute = useNavigationRoute('customerOverview');
  const queryClient = useQueryClient();
  
  // Helper function to generate customer overview URL
  const getCustomerOverviewUrl = (customerId: string) => {
    return `${customerOverviewRoute}?id=${customerId}`;
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    wallet: 0
  });

  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { currency } = useShop();
  
  // Get the correct shop ID and admin ID based on user type
  const shopId = selectedShopId || primaryShopId;
  const currentAdminId = userType === "attendant" ? adminId : (admin?._id || admin?.id);

  // Fetch customers
  const { data: customersResponse, isLoading } = useQuery({
    queryKey: ['customers', shopId, userType],
    queryFn: async () => {
      if (!shopId || !currentAdminId) return [];
      
      const params = new URLSearchParams({
        shopId: shopId,
        adminid: currentAdminId
      });
      
      const response = await apiRequest('GET', `${ENDPOINTS.customers.getAll}?${params.toString()}`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.data || data?.customers || [];
      return normalizeIds(list);
    },
    enabled: !!shopId && !!currentAdminId && 
             (userType === "admin" ? !!admin && !!token : userType === "attendant" ? !!attendant && isAttendantAuth : false),
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  const customers = (customersResponse ?? []) as unknown as Customer[];


  // Fetch customer analysis data
  const { data: analysisData } = useQuery({
    queryKey: ['customer-analysis', shopId, userType],
    queryFn: async () => {
      if (!shopId || !currentAdminId) return null;
      
      const params = new URLSearchParams({
        adminid: currentAdminId
      });
      
      const response = await apiRequest('GET', `${ENDPOINTS.customers.getAnalysis}?shopId=${shopId}&${params.toString()}`);
      const data = await response.json();
      return data?.data ?? data;
    },
    enabled: !!shopId && !!currentAdminId && 
             (userType === "admin" ? !!admin && !!token : userType === "attendant" ? !!attendant && isAttendantAuth : false),
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });



  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      // Ensure name is not empty
      if (!data.name || data.name.trim() === '') {
        throw new Error('Customer name is required');
      }

      const customerData: any = {
        name: data.name.trim(),
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        shopId: shopId,
      };
      if (data.wallet && Number(data.wallet) > 0) {
        customerData.wallet = Number(data.wallet);
      }

      
      const response = await apiRequest('POST', ENDPOINTS.customers.create, customerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analysis'] });
      setIsCreateDialogOpen(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '', wallet: 0 });
      toast({
        title: "Success",
        description: "Customer created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const updatePayload = {
        name: data.name?.trim(),
        phone: data.phone || data.phonenumber || '',
        email: data.email || '',
        address: data.address || '',
        shopId: shopId,
      };
      const response = await apiRequest('PUT', ENDPOINTS.customers.update(data._id || data.id), updatePayload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analysis'] });
      setEditingCustomer(null);
      toast({
        title: "Success",
        description: "Customer updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest('DELETE', ENDPOINTS.customers.delete(customerId));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analysis'] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    customer.phonenumber?.includes(searchQuery)
  );

  const handleCreateCustomer = () => {
    // Validate required fields
    if (!newCustomer.name || newCustomer.name.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }
    
    createCustomerMutation.mutate(newCustomer);
  };

  const handleUpdateCustomer = () => {
    if (editingCustomer) {
      updateCustomerMutation.mutate(editingCustomer);
    }
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomerMutation.mutate(customerId);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
  };

  return (
    <DashboardLayout>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign(dashboardRoute)}>
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
            <h1 className="text-base font-bold text-gray-900">Customers</h1>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>
                <div>
                  <Label htmlFor="wallet">Initial Wallet Balance</Label>
                  <Input
                    id="wallet"
                    type="number"
                    value={newCustomer.wallet}
                    onChange={(e) => setNewCustomer({ ...newCustomer, wallet: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCustomer}
                    disabled={!newCustomer.name || createCustomerMutation.isPending}
                  >
                    {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-3 w-3" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Customers</p>
                  <p className="text-sm font-bold text-gray-900">{analysisData?.totalCustomers || customers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Wallet Total</p>
                  <p className="text-sm font-bold text-green-600 truncate">{currency} {(analysisData?.totalWalletBalance || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-3.5 w-3.5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Outstanding</p>
                  <p className="text-sm font-bold text-red-600 truncate">{currency} {(analysisData?.totalOutstanding || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Debtors Section */}
        {analysisData?.topDebtors && analysisData.topDebtors.length > 0 && (
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Top Debtors</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-orange-100">
                {analysisData.topDebtors.map((debtor: any, index: number) => (
                  <div key={debtor.customerId} className="flex items-center justify-between px-3 py-1.5 bg-orange-50">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold text-xs flex-shrink-0">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{debtor.name}</p>
                        {debtor.phonenumber && <p className="text-xs text-gray-400 truncate">{debtor.phonenumber}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-orange-600">{currency} {debtor.totalOutstanding.toLocaleString()}</span>
                      <Link href={getCustomerOverviewUrl(debtor.customerId || debtor._id)}>
                        <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                          onClick={() => {
                            const fullCustomerData = customers.find(c => c._id === (debtor.customerId || debtor._id));
                            (window as any).__customerData = fullCustomerData || { _id: debtor.customerId || debtor._id, name: debtor.name, phonenumber: debtor.phonenumber };
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}



        {/* Customers Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="h-3 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : filteredCustomers.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-gray-100">
                {filteredCustomers.map((customer: Customer) => {
                  const walletBalance = parseFloat(String(customer.wallet ?? 0));
                  const outstanding = parseFloat(String(customer.outstandingBalance ?? 0));
                  return (
                    <div key={customer._id} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{customer.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {(customer.phonenumber || customer.phone) && (
                              <span className="text-xs text-gray-400">{customer.phonenumber || customer.phone}</span>
                            )}
                            {outstanding > 0 && <span className="text-xs text-red-600 font-medium">{currency} {outstanding.toLocaleString()} owing</span>}
                            {walletBalance > 0 && <span className="text-xs text-green-600 font-medium">{currency} {walletBalance.toLocaleString()} wallet</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Link href={getCustomerOverviewUrl(customer._id)}>
                            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-blue-600"
                              onClick={() => { (window as any).__customerData = { _id: customer._id, name: customer.name, email: customer.email, phonenumber: customer.phonenumber || customer.phone, address: customer.address, wallet: customer.wallet, customerType: customer.customerType }; }}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => handleEdit(customer)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-red-600" onClick={() => handleDeleteCustomer(customer._id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="h-7">
                      <TableHead className="text-xs py-1 px-2">Customer</TableHead>
                      <TableHead className="text-xs py-1 px-2">Contact</TableHead>
                      <TableHead className="text-xs py-1 px-2">Wallet</TableHead>
                      <TableHead className="text-xs py-1 px-2">Outstanding</TableHead>
                      <TableHead className="text-xs py-1 px-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer: Customer) => {
                      const walletBalance = parseFloat(String(customer.wallet ?? 0));
                      const outstanding = parseFloat(String(customer.outstandingBalance ?? 0));
                      return (
                        <TableRow key={customer._id} className="h-7">
                          <TableCell className="py-1 px-2">
                            <p className="text-xs font-medium">{customer.name}</p>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <div className="space-y-0.5">
                              {(customer.phonenumber || customer.phone) && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <Phone className="h-3 w-3 mr-1 text-gray-400" />
                                  {customer.phonenumber || customer.phone}
                                </div>
                              )}
                              {customer.email && (
                                <div className="flex items-center text-xs text-gray-600">
                                  <Mail className="h-3 w-3 mr-1 text-gray-400" />
                                  {customer.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            <span className={`text-xs font-medium ${walletBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {currency} {walletBalance.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="py-1 px-2">
                            {outstanding > 0 ? (
                              <span className="text-xs font-medium text-red-600">{currency} {outstanding.toLocaleString()}</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={getCustomerOverviewUrl(customer._id)}>
                                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                                  onClick={() => { (window as any).__customerData = { _id: customer._id, name: customer.name, email: customer.email, phonenumber: customer.phonenumber || customer.phone, address: customer.address, wallet: customer.wallet, customerType: customer.customerType }; }}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </Link>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => handleEdit(customer)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-red-600 hover:text-red-700" onClick={() => handleDeleteCustomer(customer._id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'No customers match your search criteria.' : 'Get started by adding your first customer.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Customer Dialog */}
        <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            {editingCustomer && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Customer Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editingCustomer.phonenumber || editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phonenumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editingCustomer.address || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-wallet">Wallet Balance</Label>
                  <Input
                    id="edit-wallet"
                    type="number"
                    value={editingCustomer.wallet || 0}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, wallet: Number(e.target.value) })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setEditingCustomer(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateCustomer}
                    disabled={!editingCustomer.name || updateCustomerMutation.isPending}
                  >
                    {updateCustomerMutation.isPending ? 'Updating...' : 'Update Customer'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}