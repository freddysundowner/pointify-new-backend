import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeIds, extractId } from '@/lib/utils';
import { Plus, Edit2, Trash2, Filter, Download, Calendar, Clock, RefreshCw, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const effectiveShopId = selectedShopId || extractId(admin?.primaryShop) || extractId(attendant?.shopId);
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
      return normalizeIds(Array.isArray(data) ? data : data?.expenses || data?.data || []);
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
      return normalizeIds(Array.isArray(data) ? data : data?.categories || data?.data || []);
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

  // On-the-fly category combobox state
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', ENDPOINTS.expenseCategories.create, { name, shopId: effectiveShopId });
      const data = await res.json();
      return data?.data ?? data;
    },
    onSuccess: (newCat: any) => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      const id = newCat?._id ?? newCat?.id;
      if (id) setFormData(fd => ({ ...fd, category: String(id) }));
      setCatSearch('');
      setCatOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to create category', variant: 'destructive' });
    },
  });

  const getCategoryName = (categoryId: string | number) => {
    const id = String(categoryId);
    const category = categories.find((cat: ExpenseCategory) => String(cat._id) === id || String((cat as any).id) === id);
    return category?.name || '—';
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

  const totalAmount = sortedExpenses.reduce((sum, expense) => sum + parseFloat(String(expense.amount ?? 0)), 0);

  return (
    <DashboardLayout title="Expenses">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {attendant && (
            <Link href={dashboardRoute}>
              <Button variant="ghost" size="sm" className="gap-1 px-2 h-8">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
          )}
          <h2 className="text-lg font-bold text-gray-900 flex-1">Expenses</h2>
          <Link href={window.location.pathname.includes('/attendant/') ? '/attendant/expense-categories' : '/expense-categories'}>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Settings className="h-3.5 w-3.5" /> Categories
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setCatOpen(false); setCatSearch(''); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleAddNew}>
                <Plus className="h-3.5 w-3.5" /> Add Expense
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
                    <Label>Category</Label>
                    <div className="flex gap-1.5">
                      <Select
                        value={String(formData.category || '')}
                        onValueChange={(val) => setFormData(fd => ({ ...fd, category: val }))}
                      >
                        <SelectTrigger className="h-9 text-sm flex-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c: ExpenseCategory) => (
                            <SelectItem key={c._id} value={String(c._id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                          {categories.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500">No categories yet — use + to create one</div>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-2.5"
                        title="Create new category"
                        onClick={() => { setCatOpen(o => !o); setCatSearch(''); }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {catOpen && (
                      <div className="flex gap-1.5 mt-1.5">
                        <Input
                          value={catSearch}
                          onChange={e => setCatSearch(e.target.value)}
                          placeholder="New category name..."
                          className="h-8 text-sm"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (catSearch.trim()) createCategoryMutation.mutate(catSearch.trim());
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          disabled={!catSearch.trim() || createCategoryMutation.isPending}
                          onClick={() => { if (catSearch.trim()) createCategoryMutation.mutate(catSearch.trim()); }}
                        >
                          Add
                        </Button>
                      </div>
                    )}
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

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-500 font-medium">Total Spent</p>
              <p className="text-xl font-bold text-red-700 leading-tight">
                {currency} {parseFloat(expenseStats?.data?.totalAmount || '0').toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-400 font-medium">Expenses</p>
              <p className="text-xl font-bold text-gray-700 leading-tight">{expenseStats?.data?.totalExpenses ?? sortedExpenses.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-500 font-medium">Categories</p>
              <p className="text-xl font-bold text-blue-700 leading-tight">{expenseStats?.byCategory?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-orange-50">
            <CardContent className="p-3">
              <p className="text-xs text-orange-500 font-medium">Top Category</p>
              <p className="text-sm font-bold text-orange-700 leading-tight truncate">{expenseStats?.byCategory?.[0]?.category || '—'}</p>
              <p className="text-xs text-orange-400">{currency} {(expenseStats?.byCategory?.[0]?.totalAmount || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Category chips */}
        {expenseStats?.byCategory && expenseStats.byCategory.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {expenseStats.byCategory.map((cat: any, i: number) => (
              <button
                key={i}
                onClick={() => {
                  const match = categories.find((c: ExpenseCategory) => c.name === cat.category);
                  if (match) setSelectedCategory(match._id);
                }}
                className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-2.5 py-1 transition-colors"
              >
                <span className="font-medium text-gray-700">{cat.category}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{currency} {cat.totalAmount.toLocaleString()}</span>
                {expenseStats.summary.totalAmount > 0 && (
                  <span className="text-gray-400 text-[10px]">
                    {Math.round((cat.totalAmount / expenseStats.summary.totalAmount) * 100)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Compact filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="h-8 text-sm border border-gray-200 rounded-md px-2 w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="h-8 text-sm border border-gray-200 rounded-md px-2 w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-sm w-40">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Array.isArray(categories) && categories.map((category: ExpenseCategory) => (
                <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(customStartDate || customEndDate || selectedCategory !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-gray-400 hover:text-gray-600"
              onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setSelectedCategory('all'); }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Compact table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-1 p-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : paginatedExpenses.data.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">No expenses found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedExpenses.data.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50/70">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-gray-800">{expense.description}</span>
                        {expense.frequency && (
                          <span className="ml-1.5 text-xs text-blue-500 capitalize">{expense.frequency}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        {expense.category && typeof expense.category === 'object'
                          ? expense.category?.name || '—'
                          : expense.category
                            ? getCategoryName(expense.category as any)
                            : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {(expense.createdAt || expense.createAt)
                          ? format(new Date((expense.createdAt || expense.createAt) as string), 'MMM d, yyyy')
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-red-600 whitespace-nowrap">
                        {currency} {parseFloat(String(expense.amount ?? 0)).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(expense)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
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
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-xs text-gray-400">
                      {sortedExpenses.length} expense{sortedExpenses.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-gray-800">
                      {currency} {totalAmount.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Compact pagination */}
        {paginatedExpenses.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {currentPage} of {paginatedExpenses.totalPages} · {paginatedExpenses.totalItems} items
            </p>
            <div className="flex gap-1">
              <Button
                size="sm" variant="outline" className="h-7 px-2 text-xs"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                ← Prev
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 px-2 text-xs"
                disabled={currentPage === paginatedExpenses.totalPages}
                onClick={() => setCurrentPage(Math.min(paginatedExpenses.totalPages, currentPage + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}