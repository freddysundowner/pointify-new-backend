import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useGoBack } from "@/hooks/useGoBack";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { extractId } from '@/lib/utils';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';

interface CashflowCategory {
  id: number;
  name: string;
  type: "cashin" | "cashout";
  createdAt?: string;
}

export default function CashflowCategories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CashflowCategory | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'cashin' as 'cashin' | 'cashout' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { attendant } = useAttendantAuth();
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

  // Fetch cashflow categories for management
  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ["cashflow-categories-page", effectiveShopId],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.cashflow.categories}?shopId=${effectiveShopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    select: (data: any) => Array.isArray(data) ? data : (data?.data ?? []),
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; shopId: string; type: 'cashin' | 'cashout' }) => {
      return await apiRequest('POST', ENDPOINTS.cashflow.createCategory, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflow-categories-page", effectiveShopId] });
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
      queryClient.invalidateQueries({ queryKey: ["cashflow-categories-page", effectiveShopId] });
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
      queryClient.invalidateQueries({ queryKey: ["cashflow-categories-page", effectiveShopId] });
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
      id: String(editingCategory.id),
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

  return (
    <DashboardLayout title="Cash Flow Categories">
      <div className="w-full space-y-3">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden lg:flex gap-1 px-2 h-8" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h2 className="text-lg font-bold text-gray-900 flex-1">Cash Flow Categories</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleAddNew}>
                <Plus className="h-3.5 w-3.5" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g. Sales Income, Bank Deposit…"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={newCategory.type}
                    onValueChange={(value: 'cashin' | 'cashout') => setNewCategory({ ...newCategory, type: value })}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashin">↑ Cash In</SelectItem>
                      <SelectItem value="cashout">↓ Cash Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1 h-8" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 h-8" onClick={handleCreateCategory} disabled={createCategoryMutation.isPending}>
                    {createCategoryMutation.isPending ? 'Saving…' : 'Add'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-1 p-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm font-medium text-gray-500">No categories yet</p>
                <p className="text-xs text-gray-400 mt-1">Add a Cash In or Cash Out category to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Created</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {categories.map((category: CashflowCategory) => (
                    <tr key={category.id} className="hover:bg-gray-50/70">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{category.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${
                          category.type === 'cashin' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {category.type === 'cashin' ? '↑ Cash In' : '↓ Cash Out'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                        {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={() => handleEdit(category)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "{category.name}"? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCategoryMutation.mutate(String(category.id))}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={editingCategory?.name || ''}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={editingCategory?.type || 'cashin'}
                  onValueChange={(value: 'cashin' | 'cashout') => setEditingCategory(prev => prev ? { ...prev, type: value } : null)}
                >
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashin">↑ Cash In</SelectItem>
                    <SelectItem value="cashout">↓ Cash Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-8" onClick={() => setEditingCategory(null)}>Cancel</Button>
                <Button size="sm" className="flex-1 h-8" onClick={handleUpdateCategory} disabled={updateCategoryMutation.isPending}>
                  {updateCategoryMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}