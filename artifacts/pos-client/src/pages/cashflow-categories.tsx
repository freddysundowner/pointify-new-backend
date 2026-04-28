import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, ArrowLeft, TrendingUp, TrendingDown, Settings, DollarSign } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useGoBack } from "@/hooks/useGoBack";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { apiRequest } from '@/lib/queryClient';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useAuth } from '@/features/auth/useAuth';
import { extractId } from '@/lib/utils';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

interface CashflowCategory {
  _id: string;
  name: string;
  type: "cashin" | "cashout";
  amount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function CashflowCategories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CashflowCategory | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'cashin' as 'cashin' | 'cashout' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/cashflow");
  
  // Get effective shop ID - use attendant's shop if attendant, otherwise admin's selected shop
  const effectiveShopId = attendant
    ? String(extractId(attendant.shopId) ?? '')
    : selectedShopId || localStorage.getItem('selectedShopId');

  // Helper function to extract clean error messages
  const getCleanErrorMessage = (error: any, fallbackMessage: string): string => {
    if (!error.message) return fallbackMessage;
    
    // Check if the error message contains JSON
    if (error.message.includes('{"error":')) {
      try {
        // Extract the JSON part and parse it
        const jsonStart = error.message.indexOf('{"error":');
        const jsonPart = error.message.substring(jsonStart);
        const parsed = JSON.parse(jsonPart);
        return parsed.error || fallbackMessage;
      } catch (parseError) {
        // If we can't parse, just use the original message
        return error.message;
      }
    } else {
      return error.message;
    }
  };

  // Get shop currency
  const shopId = effectiveShopId || extractId(admin?.primaryShop);
  const shop = admin?.shops?.find((s: any) => s._id === shopId || s.id === shopId);
  const currency = shop?.currency || 'KES';

  // Fetch cashflow categories for management
  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.cashflow.categories}?shopId=${effectiveShopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    enabled: !!effectiveShopId,
    staleTime: 1 * 60 * 1000, // 1 minute - shorter stale time for more frequent updates
    gcTime: 5 * 60 * 1000, // 5 minutes - cache cleanup time
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: "always", // Always refetch on component mount for fresh data
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; shopId: string; type: 'cashin' | 'cashout' }) => {
      return await apiRequest('POST', ENDPOINTS.cashflow.createCategory, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      setNewCategory({ name: '', type: 'cashin' });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getCleanErrorMessage(error, "Failed to create category"),
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; type: 'cashin' | 'cashout' }) => {
      return await apiRequest('PUT', ENDPOINTS.cashflow.updateCategory(data.id), { name: data.name, type: data.type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: getCleanErrorMessage(error, "Failed to update category"),
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', ENDPOINTS.cashflow.deleteCategory(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  // Group categories by type
  const cashinCategories = categories.filter((cat: CashflowCategory) => cat.type === 'cashin');
  const cashoutCategories = categories.filter((cat: CashflowCategory) => cat.type === 'cashout');

  const handleCreateCategory = () => {
    if (!newCategory.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }
    
    createCategoryMutation.mutate({
      name: newCategory.name,
      shopId: effectiveShopId,
      type: newCategory.type
    });
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }
    
    updateCategoryMutation.mutate({
      id: editingCategory._id,
      name: editingCategory.name,
      type: editingCategory.type
    });
  };

  const handleEdit = (category: CashflowCategory) => {
    setEditingCategory({ ...category });
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setNewCategory({ name: '', type: 'cashin' });
    setIsDialogOpen(true);
  };

  if (!effectiveShopId) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Shop Selected</h3>
            <p className="text-gray-500">Please select a shop to manage cashflow categories.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={goBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cashflow
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Cashflow Categories</h1>
              <p className="text-gray-600">Manage categories for cash inflows and outflows</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Cashflow Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Category Name *</Label>
                  <Input
                    id="name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Enter category name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Category Type *</Label>
                  <Select 
                    value={newCategory.type} 
                    onValueChange={(value: 'cashin' | 'cashout') => setNewCategory({...newCategory, type: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashin">Cash In</SelectItem>
                      <SelectItem value="cashout">Cash Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCategory}
                    disabled={createCategoryMutation.isPending}
                  >
                    {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash In Categories</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{cashinCategories.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Out Categories</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{cashoutCategories.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currency} {categories?.reduce((sum: number, cat: any) => sum + (cat.amount || 0), 0).toLocaleString() || '0'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading categories...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">Error loading categories</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No categories found. Create your first category to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category: CashflowCategory) => (
                    <TableRow key={category._id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={category.type === 'cashin' ? 'default' : 'destructive'}
                          className={category.type === 'cashin' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {category.type === 'cashin' ? (
                            <>
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Cash In
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-3 h-3 mr-1" />
                              Cash Out
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{currency} {category.amount?.toLocaleString() || '0'}</TableCell>
                      <TableCell>
                        {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(category)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{category.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCategoryMutation.mutate(category._id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Category Dialog */}
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Cashflow Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Category Name *</Label>
                <Input
                  id="edit-name"
                  value={editingCategory?.name || ''}
                  onChange={(e) => setEditingCategory(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Enter category name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Category Type *</Label>
                <Select 
                  value={editingCategory?.type || 'cashin'} 
                  onValueChange={(value: 'cashin' | 'cashout') => setEditingCategory(prev => prev ? {...prev, type: value} : null)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashin">Cash In</SelectItem>
                    <SelectItem value="cashout">Cash Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateCategory}
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending ? 'Updating...' : 'Update Category'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}