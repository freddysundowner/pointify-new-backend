import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Filter, Download, Calendar, Clock, RefreshCw, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { format } from "date-fns";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { ArrowLeft } from "lucide-react";
import { useCurrency } from '@/utils';

interface Expense {
  _id: string;
  description: string;
  amount: number;
  category: string;
  attendantId: string;
  shopId: string;
  frequency?: string;
  autoSave: boolean;
  createAt?: string;
  updatedAt?: string;
  vendor?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  notes?: string;
  isRecurring?: boolean;
  recurringPeriod?: string;
}

interface ExpenseCategory {
  _id: string;
  name: string;
  shopId: string;
}



export default function Expenses() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const currency  = useCurrency();
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: '',
    vendor: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'bank_transfer' | 'check',
    receiptNumber: '',
    notes: '',
    isRecurring: false,
    recurringPeriod: '' as 'daily' | 'friday' | 'saturday' | 'start_of_month' | 'end_of_month' | ''
  });
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const dashboardRoute = useNavigationRoute('dashboard');

  // Get effective shop ID and attendant ID (support both admin and attendant contexts)
  const effectiveShopId = selectedShopId || 
    (typeof admin?.primaryShop === 'string' ? admin.primaryShop : admin?.primaryShop?._id) ||
    (typeof attendant?.shopId === 'string' ? attendant.shopId : attendant?.shopId?._id);
  const attendantId = admin?.attendantId?._id || admin?._id || attendant?._id;

  // Fetch expenses with filters
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', effectiveShopId, selectedCategory, customStartDate, customEndDate],
    queryFn: async () => {
      if (!effectiveShopId) return [];
      
      const params = new URLSearchParams({
        shop: effectiveShopId
      });
      
      // Add filter parameters
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      
      if (customStartDate) {
        params.append('startDate', customStartDate);
      }
      
      if (customEndDate) {
        params.append('endDate', customEndDate);
      }
      
      console.log('Fetching expenses with filters:', params.toString());
      
      const response = await apiRequest('GET', `${ENDPOINTS.expenses.getAll}?${params.toString()}`);
      const data = await response.json();
      return Array.isArray(data) ? data : data?.expenses || data?.data || [];
    },
    enabled: !!effectiveShopId,
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0
  });

  // Fetch expense categories
  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories', effectiveShopId],
    queryFn: async () => {
      if (!effectiveShopId) return [];
      
      const params = new URLSearchParams({
        shop: effectiveShopId
      });
      
      const response = await apiRequest('GET', `${ENDPOINTS.expenseCategories.getAll}?${params.toString()}`);
      const data = await response.json();
      return Array.isArray(data) ? data : data?.categories || data?.data || [];
    },
    enabled: !!effectiveShopId
  });

  // Fetch expense analytics
  const { data: expenseStats } = useQuery({
    queryKey: ['expense-stats', effectiveShopId, selectedCategory, customStartDate, customEndDate],
    queryFn: async () => {
      if (!effectiveShopId) return null;
      
      const params = new URLSearchParams({
        shop: effectiveShopId,
        page: '1',
        limit: '20'
      });
      
      // Add filter parameters
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      
      if (customStartDate) {
        params.append('startDate', customStartDate);
      }
      
      if (customEndDate) {
        params.append('endDate', customEndDate);
      }
      
      const response = await apiRequest('GET', `${ENDPOINTS.expenses.summaryAnalysis}?${params.toString()}`);
      const data = await response.json();
      return data;
    },
    enabled: !!effectiveShopId,
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const expenseData = {
        description: data.description.trim(),
        amount: parseFloat(data.amount),
        categoryId: data.category,
        shopId: effectiveShopId,
        frequency: data.frequency || null,
        autoSave: data.autoSave,
      };
      
      const response = await apiRequest('POST', ENDPOINTS.expenses.create, expenseData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both expenses list and statistics cache
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      
      setIsDialogOpen(false);
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        vendor: '',
        paymentMethod: 'cash',
        receiptNumber: '',
        notes: '',
        isRecurring: false,
        recurringPeriod: ''
      });
      toast({
        title: "Success",
        description: "Expense created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const response = await apiRequest('DELETE', ENDPOINTS.expenses.delete(expenseId));
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both expenses list and statistics cache
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((cat: ExpenseCategory) => cat._id === categoryId);
    return category?.name || categoryId;
  };

  // Since API now handles filtering, we just use the returned data directly
  const sortedExpenses = useMemo(() => {
    return expenses.sort((a, b) => {
      const dateA = new Date(a.createAt || 0);
      const dateB = new Date(b.createAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [expenses]);

  // Pagination
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      data: sortedExpenses.slice(startIndex, endIndex),
      totalItems: sortedExpenses.length,
      totalPages: Math.ceil(sortedExpenses.length / itemsPerPage)
    };
  }, [sortedExpenses, currentPage, itemsPerPage]);

  const handleEdit = (expense: Expense) => {
    console.log('Editing expense:', expense);
    setSelectedExpense(expense);
    
    // Format date properly from API response
    let formattedDate = '';
    if (expense.createAt) {
      try {
        formattedDate = new Date(expense.createAt).toISOString().split('T')[0];
      } catch (error) {
        console.warn('Date parsing error:', error);
        formattedDate = new Date().toISOString().split('T')[0];
      }
    } else {
      formattedDate = new Date().toISOString().split('T')[0];
    }
    
    setFormData({
      description: expense.description || '',
      amount: expense.amount?.toString() || '',
      category: expense.category?._id || expense.category || '',
      date: formattedDate,
      vendor: '',
      paymentMethod: expense.paymentMethod || 'cash',
      receiptNumber: expense.receiptNumber || '',
      notes: expense.notes || '',
      isRecurring: expense.isRecurring || false,
      recurringPeriod: expense.recurringPeriod || ''
    });
    
    console.log('Form data set:', {
      category: expense.category?._id || expense.category,
      categoryObject: expense.category,
      date: formattedDate,
      description: expense.description
    });
    
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedExpense(null);
    setFormData({
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      paymentMethod: 'cash',
      receiptNumber: '',
      notes: '',
      isRecurring: false,
      recurringPeriod: ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Description is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Valid amount is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      });
      return;
    }
    
    const expenseData = {
      description: formData.description,
      amount: formData.amount,
      category: formData.category,
      frequency: formData.recurringPeriod || null,
      autoSave: formData.isRecurring
    };
    
    createExpenseMutation.mutate(expenseData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRecurringPeriodText = (period?: string) => {
    switch (period) {
      case 'daily': return 'Daily';
      case 'friday': return 'Every Friday';
      case 'saturday': return 'Every Saturday';
      case 'start_of_month': return 'Start of Month';
      case 'end_of_month': return 'End of Month';
      default: return '';
    }
  };

  const totalAmount = sortedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <DashboardLayout title="Expenses">
      <div className="space-y-6">
        {/* Header with Add Button */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {attendant && (
              <Link href={dashboardRoute}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            )}
            <div>
              <h2 className="text-2xl font-bold">Expenses</h2>
              <p className="text-gray-600">Manage and track your business expenses</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={window.location.pathname.includes('/attendant/') ? '/attendant/expense-categories' : '/expense-categories'}>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Manage Categories
              </Button>
            </Link>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category: ExpenseCategory) => (
                          <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={formData.paymentMethod} onValueChange={(value: any) => setFormData({...formData, paymentMethod: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="receiptNumber">Receipt Number</Label>
                    <Input
                      id="receiptNumber"
                      value={formData.receiptNumber}
                      onChange={(e) => setFormData({...formData, receiptNumber: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecurring"
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) => setFormData({...formData, isRecurring: checked as boolean})}
                  />
                  <Label htmlFor="isRecurring">Recurring Expense</Label>
                </div>
                
                {formData.isRecurring && (
                  <div>
                    <Label htmlFor="recurringPeriod">Recurring Period</Label>
                    <Select value={formData.recurringPeriod} onValueChange={(value: any) => setFormData({...formData, recurringPeriod: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="friday">Every Friday</SelectItem>
                        <SelectItem value="saturday">Every Saturday</SelectItem>
                        <SelectItem value="start_of_month">Start of Month</SelectItem>
                        <SelectItem value="end_of_month">End of Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedExpense ? 'Update' : 'Add'} Expense
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Expenses</div>
              <div className="text-2xl font-bold">{expenseStats?.summary?.totalCount || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Recorded expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Amount</div>
              <div className="text-2xl font-bold">{currency} {(expenseStats?.summary?.totalAmount || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">Total spent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Active Categories</div>
              <div className="text-2xl font-bold">{expenseStats?.byCategory?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Categories with expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Top Category</div>
              <div className="text-lg font-bold">{expenseStats?.byCategory?.[0]?.category || 'None'}</div>
              <div className="text-sm text-gray-500">{currency} {(expenseStats?.byCategory?.[0]?.totalAmount || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown - Collapsible */}
        {expenseStats?.byCategory && expenseStats.byCategory.length > 0 && (
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setShowCategoryBreakdown(!showCategoryBreakdown)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Expense by Category</CardTitle>
                <Button variant="ghost" size="sm" className="p-1">
                  {showCategoryBreakdown ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            {showCategoryBreakdown && (
              <CardContent>
                <div className="space-y-3">
                  {expenseStats.byCategory.map((categoryData: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <div>
                          <div className="font-medium">{categoryData.category}</div>
                          <div className="text-sm text-gray-500">{categoryData.count} expense{categoryData.count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{currency} {categoryData.totalAmount.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">
                          {expenseStats.summary.totalAmount > 0 
                            ? Math.round((categoryData.totalAmount / expenseStats.summary.totalAmount) * 100)
                            : 0}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Array.isArray(categories) && categories.map((category: ExpenseCategory) => (
                    <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {(customStartDate || customEndDate || selectedCategory !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSelectedCategory('all');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          {(customStartDate || customEndDate || selectedCategory !== 'all') && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {customStartDate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  From: {new Date(customStartDate).toLocaleDateString()}
                </span>
              )}
              {customEndDate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  To: {new Date(customEndDate).toLocaleDateString()}
                </span>
              )}
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Category: {categories.find((cat: ExpenseCategory) => cat._id === selectedCategory)?.name || selectedCategory}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expenses Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExpenses.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No expenses found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedExpenses.data.map((expense) => (
                    <TableRow key={expense._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{expense.description}</div>
                          {expense.receiptNumber && (
                            <div className="text-sm text-gray-500">#{expense.receiptNumber}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          {typeof expense.category === 'string' ? getCategoryName(expense.category) : expense.category?.name || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {expense.createAt 
                          ? format(new Date(expense.createAt), 'MMM dd, yyyy HH:mm')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {expense.frequency ? (
                          <div className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            <span className="text-sm capitalize">{expense.frequency}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">One-time</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-red-600">
                          {currency} {expense.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(expense)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this expense? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteExpenseMutation.mutate(expense._id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {paginatedExpenses.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">per page</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {paginatedExpenses.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(paginatedExpenses.totalPages, currentPage + 1))}
                disabled={currentPage === paginatedExpenses.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}