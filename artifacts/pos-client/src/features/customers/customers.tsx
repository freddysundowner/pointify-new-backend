import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      return data;
    },
    enabled: !!shopId && !!currentAdminId && 
             (userType === "admin" ? !!admin && !!token : userType === "attendant" ? !!attendant && isAttendantAuth : false),
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  const customers = Array.isArray(customersResponse) 
    ? customersResponse 
    : customersResponse?.customers || customersResponse?.data || [];

  console.log('=== CUSTOMERS DEBUG ===');
  console.log('Raw customersResponse:', customersResponse);
  console.log('Processed customers array:', customers);
  console.log('Array length:', customers.length);
  if (customers.length > 0) {
    console.log('First customer:', customers[0]);
  }

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
      console.log('Customer Analysis Data:', data);
      return data;
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

      const customerData = {
        name: data.name.trim(),
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        shopId: shopId,
      };

      console.log('Customer Creation Debug:', {
        userType,
        shopId,
        currentAdminId,
        primaryShopId,
        adminId: adminId,
        selectedShopId,
        attendantExists: !!attendant,
        adminExists: !!admin
      });
      console.log('Frontend: Sending customer data:', customerData);
      
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
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Link href={dashboardRoute}>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customer Management</h1>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
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
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Customers</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                    {analysisData?.totalCustomers || customers.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Wallet Balance</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 break-words">
                    {currency} {(analysisData?.totalWalletBalance || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Outstanding</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-red-600 break-words">
                    {currency} {(analysisData?.totalOutstanding || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Debtors Section */}
        {analysisData?.topDebtors && analysisData.topDebtors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-orange-600">Top Debtors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisData.topDebtors.map((debtor: any, index: number) => (
                  <div key={debtor.customerId} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold text-xs md:text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{debtor.name}</p>
                        {debtor.phonenumber && (
                          <p className="text-xs md:text-sm text-gray-500 truncate">{debtor.phonenumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold text-orange-600 text-sm md:text-base">
                          {currency} {debtor.totalOutstanding.toLocaleString()}
                        </p>
                        {debtor.totalSpent > 0 && (
                          <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
                            Total Spent: {currency} {debtor.totalSpent.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Link href={getCustomerOverviewUrl(debtor.customerId || debtor._id)}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 h-8 w-8 p-0"
                          onClick={() => {
                            // Find the complete customer data from the customers array
                            const fullCustomerData = customers.find(c => c._id === (debtor.customerId || debtor._id));
                            if (fullCustomerData) {
                              // Pass complete customer data to customer overview
                              (window as any).__customerData = fullCustomerData;
                            } else {
                              // Fallback to debtor data if customer not found in array
                              (window as any).__customerData = {
                                _id: debtor.customerId || debtor._id,
                                name: debtor.name,
                                phonenumber: debtor.phonenumber,
                                wallet: debtor.totalOutstanding * -1 // Convert outstanding to negative wallet balance
                              };
                            }
                          }}
                        >
                          <Eye className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
                {(!analysisData?.topDebtors || analysisData.topDebtors.length === 0) && (
                  <div className="text-center py-6 text-gray-500">
                    <p>No customers with outstanding balances</p>
                  </div>
                )}
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
              <div className="block md:hidden">
                {filteredCustomers.map((customer: Customer) => {
                  const outstandingBalance = Math.abs(customer.wallet || 0);
                  const walletBalance = customer.wallet || 0;
                  
                  return (
                    <div key={customer._id} className="border-b border-gray-200 last:border-b-0 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{customer.name}</h3>
                          <p className="text-sm text-gray-500">
                            {customer.customerType?.charAt(0)?.toUpperCase() + customer.customerType?.slice(1) || 'Regular'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <Link href={getCustomerOverviewUrl(customer._id)}>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-blue-600 hover:text-blue-700 h-8 w-8 p-0"
                              onClick={() => {
                                // Pass customer data to customer overview
                                (window as any).__customerData = {
                                  _id: customer._id,
                                  name: customer.name,
                                  email: customer.email,
                                  phonenumber: customer.phonenumber || customer.phone,
                                  address: customer.address,
                                  wallet: customer.wallet,
                                  customerType: customer.customerType
                                };
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(customer)} className="h-8 w-8 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteCustomer(customer._id)}
                            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {(customer.phonenumber || customer.phone) && (
                          <div className="flex items-center text-sm">
                            <Phone className="h-3 w-3 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customer.phonenumber || customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                          <div>
                            <p className="text-xs text-gray-500">Wallet Balance</p>
                            <p className={`font-medium text-sm ${walletBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {currency} {walletBalance.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Outstanding</p>
                            {walletBalance < 0 ? (
                              <p className="font-medium text-sm text-red-600">
                                {currency} {outstandingBalance.toLocaleString()}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500">-</p>
                            )}
                          </div>
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
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Wallet Balance</TableHead>
                      <TableHead>Total Outstanding</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer: Customer) => {
                    const outstandingBalance = Math.abs(customer.wallet || 0);
                    const walletBalance = customer.wallet || 0;
                    
                    return (
                      <TableRow key={customer._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-gray-500">
                              {customer.customerType?.charAt(0)?.toUpperCase() + customer.customerType?.slice(1) || 'Regular'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(customer.phonenumber || customer.phone) && (
                              <div className="flex items-center text-sm">
                                <Phone className="h-3 w-3 mr-1 text-gray-400" />
                                {customer.phonenumber || customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center text-sm">
                                <Mail className="h-3 w-3 mr-1 text-gray-400" />
                                {customer.email}
                              </div>
                            )}
                            {customer.address && (
                              <div className="flex items-center text-sm">
                                <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                                {customer.address}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${walletBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {currency} {walletBalance.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {walletBalance < 0 ? (
                            <span className="font-medium text-red-600">
                              {currency} {outstandingBalance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Link href={getCustomerOverviewUrl(customer._id)}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => {
                                    // Pass customer data to customer overview
                                    (window as any).__customerData = {
                                      _id: customer._id,
                                      name: customer.name,
                                      email: customer.email,
                                      phonenumber: customer.phonenumber || customer.phone,
                                      address: customer.address,
                                      wallet: customer.wallet,
                                      customerType: customer.customerType
                                    };
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(customer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteCustomer(customer._id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
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