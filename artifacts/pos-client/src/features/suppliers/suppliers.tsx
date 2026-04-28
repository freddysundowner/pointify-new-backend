import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Building2, DollarSign, History, ArrowLeft, CreditCard } from 'lucide-react';
import { useGoBack } from "@/hooks/useGoBack";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import DashboardLayout from '@/components/layout/dashboard-layout';
import AlertModal from '@/components/ui/alert-modal';
import { useForm } from 'react-hook-form';
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";

interface Supplier {
  _id: string;
  name: string;
  contact: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  creditLimit?: number;
  wallet?: number;
  status?: 'active' | 'inactive';
}

interface SupplierFormData {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
}

export default function SuppliersPage() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const { toast } = useToast();

  // Authentication hooks
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  
  // Check if this is an attendant route
  const isAttendantRoute = window.location.pathname.startsWith('/attendant');
  
  // Handle back button navigation
  const handleBack = useGoBack("/dashboard");

  // Get shop ID based on user type
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const primaryShop = typeof admin?.primaryShop === 'object' ? admin.primaryShop : null;
  const attendantShopId = typeof attendant?.shopId === 'object' ? attendant.shopId._id : attendant?.shopId;
  const shopId = isAttendantRoute ? attendantShopId : (selectedShopId || (primaryShop as any)?._id);
  


  // Form hooks
  const createForm = useForm<SupplierFormData>({
    defaultValues: {
      name: '',
      phoneNumber: '',
      email: '',
      address: ''
    }
  });

  const editForm = useForm<SupplierFormData>({
    defaultValues: {
      name: '',
      phoneNumber: '',
      email: '',
      address: ''
    }
  });

  // Fetch suppliers
  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    enabled: !!shopId
  });



  // Create supplier mutation
  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const payload = {
        name: data.name,
        phone: data.phoneNumber || '',
        email: data.email || '',
        address: data.address || '',
        shopId,
      };
      const response = await apiRequest('POST', ENDPOINTS.suppliers.create, payload);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Supplier created successfully"
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create supplier",
        variant: "destructive"
      });
    }
  });

  // Update supplier mutation
  const updateMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (!selectedSupplier) throw new Error('No supplier selected');
      const payload = {
        name: data.name,
        phone: data.phoneNumber || '',
        email: data.email || '',
        address: data.address || '',
        shopId,
      };
      const response = await apiRequest('PUT', ENDPOINTS.suppliers.update(selectedSupplier._id ?? selectedSupplier.id), payload);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Supplier updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update supplier",
        variant: "destructive"
      });
    }
  });

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', ENDPOINTS.suppliers.delete(id));
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Supplier deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });
      setIsDeleteModalOpen(false);
      setSelectedSupplier(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete supplier",
        variant: "destructive"
      });
    }
  });

  // Pay supplier debt mutation
  const payDebtMutation = useMutation({
    mutationFn: async ({ supplierId, amount }: { supplierId: string; amount: number }) => {
      const response = await apiRequest('POST', ENDPOINTS.suppliers.walletPayment(supplierId), { amount });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: "Supplier debt payment has been recorded successfully"
      });
      // Refresh suppliers data
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });
      // Refresh analytics data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/analysis/report/purchases');
        }
      });
      setIsPaymentDialogOpen(false);
      setSelectedSupplier(null);
      setPaymentAmount(0);
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Filter suppliers based on search
  const filteredSuppliers = Array.isArray(suppliers) ? suppliers.filter((supplier: Supplier) =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    editForm.reset({
      name: supplier.name || '',
      phoneNumber: supplier.phoneNumber || '',
      email: supplier.email || '',
      address: supplier.address || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteModalOpen(true);
  };

  const handleViewHistory = (supplier: Supplier) => {
    const route = isAttendantRoute ? '/attendant/supplier-history' : '/supplier-history';
    navigate(`${route}?supplierId=${supplier._id ?? supplier.id}&supplierName=${encodeURIComponent(supplier.name)}`);
  };

  const handlePayDebt = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    // Convert negative wallet to positive payment amount
    setPaymentAmount(Math.abs(supplier.wallet || 0));
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = () => {
    if (!selectedSupplier || paymentAmount <= 0) return;
    payDebtMutation.mutate({
      supplierId: selectedSupplier._id ?? selectedSupplier.id,
      amount: paymentAmount
    });
  };

  const onCreateSubmit = (data: SupplierFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: SupplierFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Suppliers">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading suppliers...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Suppliers">
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load suppliers. Please try again.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Suppliers">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {isAttendantRoute && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">Suppliers</h1>
              <p className="text-muted-foreground">Manage your suppliers and vendor relationships</p>
            </div>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Supplier</DialogTitle>
              </DialogHeader>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    {...createForm.register('name', { required: true })}
                    placeholder="Enter supplier name"
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    {...createForm.register('phoneNumber', { required: true })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...createForm.register('email', { required: true })}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    {...createForm.register('address', { required: true })}
                    placeholder="Enter address"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Supplier'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Suppliers ({filteredSuppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No suppliers match your search' : 'No suppliers found'}
                </p>
                {!searchTerm && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Supplier
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier: Supplier) => (
                    <TableRow key={supplier._id ?? supplier.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          {supplier.address && (
                            <p className="text-sm text-muted-foreground">{supplier.address}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contact}</TableCell>
                      <TableCell>
                        {supplier.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.phoneNumber && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.phoneNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.creditLimit ? (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {supplier.creditLimit.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No limit</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.wallet !== undefined && supplier.wallet !== null ? (
                          <Badge variant={supplier.wallet > 0 ? "destructive" : "default"}>
                            {supplier.wallet.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0.00</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Pay Debt button - only show if supplier has debt */}
                          {supplier.wallet && supplier.wallet < 0 && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePayDebt(supplier)}
                              title={`Pay Debt: ${Math.abs(supplier.wallet).toFixed(2)}`}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CreditCard className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewHistory(supplier)}
                            title="View Purchase History"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                            title="Edit Supplier"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(supplier)}
                            title="Delete Supplier"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Supplier Name *</Label>
                <Input
                  id="edit-name"
                  {...editForm.register('name', { required: true })}
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <Label htmlFor="edit-phoneNumber">Phone Number *</Label>
                <Input
                  id="edit-phoneNumber"
                  {...editForm.register('phoneNumber', { required: true })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  {...editForm.register('email', { required: true })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address *</Label>
                <Textarea
                  id="edit-address"
                  {...editForm.register('address', { required: true })}
                  placeholder="Enter address"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Supplier'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>



        {/* Pay Debt Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pay Supplier Debt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Paying debt for: <span className="font-medium">{selectedSupplier?.name}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Current debt: <span className="font-medium text-red-600">
                    {Math.abs(selectedSupplier?.wallet || 0).toFixed(2)}
                  </span>
                </p>
              </div>
              <div>
                <Label htmlFor="paymentAmount">Payment Amount</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="Enter payment amount"
                  min="0"
                  max={Math.abs(selectedSupplier?.wallet || 0)}
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentSubmit}
                  disabled={payDebtMutation.isPending || paymentAmount <= 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {payDebtMutation.isPending ? 'Processing...' : 'Pay Debt'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => selectedSupplier && deleteMutation.mutate(selectedSupplier._id ?? selectedSupplier.id)}
          title="Delete Supplier"
          description={`Are you sure you want to delete ${selectedSupplier?.name}? This action cannot be undone.`}
          type="danger"
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </DashboardLayout>
  );
}