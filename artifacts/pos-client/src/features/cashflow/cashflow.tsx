import { useState, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { normalizeIds, extractId } from '@/lib/utils';
import { Search, Plus, TrendingUp, TrendingDown, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, Filter, ChevronRight, ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useNavigationRoute } from '@/lib/navigation-utils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useAuth } from '@/features/auth/useAuth';
import { useAttendantAuth } from '@/contexts/AttendantAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface CashFlowEntry {
  _id: string;
  name: string;
  amount: number;
  category: any; // Category object or string
  createAt: string;
  attendantId?: any;
  shopId?: any;
  // Legacy mock data fields for compatibility
  date?: string;
  type?: 'inflow' | 'outflow';
  description?: string;
  source?: string;
  paymentMethod?: string;
  reference?: string;
}

const mockCashFlow: CashFlowEntry[] = [
  // June 2025 data
  {
    _id: '1',
    date: '2025-06-19',
    type: 'inflow',
    category: 'Sales',
    description: 'Daily sales',
    amount: 530.00,
    source: 'POS System',
    paymentMethod: 'Mixed',
    reference: 'SALE-001'
  },
  {
    _id: '2',
    date: '2025-06-19',
    type: 'inflow',
    category: 'Collected Debt',
    description: 'Customer payment',
    amount: 0,
    source: 'Customer',
    paymentMethod: 'Cash',
    reference: 'DEBT-001'
  },
  {
    _id: '3',
    date: '2025-06-19',
    type: 'outflow',
    category: 'Purchases',
    description: 'Inventory purchase',
    amount: 2020.00,
    source: 'Supplier',
    paymentMethod: 'Bank Transfer',
    reference: 'PUR-001'
  },
  {
    _id: '4',
    date: '2025-06-19',
    type: 'outflow',
    category: 'Payouts',
    description: 'Staff payment',
    amount: 0,
    source: 'HR',
    paymentMethod: 'Cash',
    reference: 'PAY-001'
  },
  // C Forward for June comes from May (dated at beginning of June)
  {
    _id: '5',
    date: '2025-06-01',
    type: 'inflow',
    category: 'C Forward',
    description: 'Balance carried forward from May',
    amount: 0,
    source: 'System',
    paymentMethod: 'System',
    reference: 'CF-JUN-2025'
  },
  
  // May 2025 data
  {
    _id: '6',
    date: '2025-05-20',
    type: 'inflow',
    category: 'Sales',
    description: 'Weekly sales total',
    amount: 1250.00,
    source: 'POS System',
    paymentMethod: 'Mixed',
    reference: 'SALE-MAY-001'
  },
  {
    _id: '7',
    date: '2025-05-15',
    type: 'outflow',
    category: 'Rent',
    description: 'Monthly office rent',
    amount: 800.00,
    source: 'Landlord',
    paymentMethod: 'Bank Transfer',
    reference: 'RENT-MAY-2025'
  },
  {
    _id: '8',
    date: '2025-05-10',
    type: 'inflow',
    category: 'Sales',
    description: 'Product sales',
    amount: 750.00,
    source: 'POS System',
    paymentMethod: 'Card',
    reference: 'SALE-MAY-002'
  },
  // C Forward for May comes from April (dated at beginning of May)
  {
    _id: '9',
    date: '2025-05-01',
    type: 'inflow',
    category: 'C Forward',
    description: 'Balance carried forward from April',
    amount: 0,
    source: 'System',
    paymentMethod: 'System',
    reference: 'CF-MAY-2025'
  },
  
  // April 2025 data
  {
    _id: '10',
    date: '2025-04-25',
    type: 'inflow',
    category: 'Sales',
    description: 'Monthly sales total',
    amount: 3200.00,
    source: 'POS System',
    paymentMethod: 'Mixed',
    reference: 'SALE-APR-001'
  },
  {
    _id: '11',
    date: '2025-04-20',
    type: 'outflow',
    category: 'Purchases',
    description: 'Stock replenishment',
    amount: 1500.00,
    source: 'Supplier',
    paymentMethod: 'Bank Transfer',
    reference: 'PUR-APR-001'
  },
  {
    _id: '12',
    date: '2025-04-15',
    type: 'inflow',
    category: 'Collected Debt',
    description: 'Customer payment',
    amount: 500.00,
    source: 'Customer',
    paymentMethod: 'Cash',
    reference: 'DEBT-APR-001'
  },
  // C Forward for April comes from March (dated at beginning of April)
  {
    _id: '13',
    date: '2025-04-01',
    type: 'inflow',
    category: 'C Forward',
    description: 'Balance carried forward from March',
    amount: 0,
    source: 'System',
    paymentMethod: 'System',
    reference: 'CF-APR-2025'
  }
];

// Helper functions
const getMonthFromDate = (dateString: string) => {
  return dateString.slice(0, 7);
};

const getCurrentMonthDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // First day of current month
  const startDate = `${year}-${month}-01`;
  
  // Last day of current month
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  
  return { startDate, endDate };
};

const getPreviousMonthDisplay = (currentViewMonth: string) => {
  const currentDate = new Date(currentViewMonth + '-01');
  const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const monthNames = {
    0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr',
    4: 'May', 5: 'Jun', 6: 'Jul', 7: 'Aug',
    8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec'
  };
  const month = monthNames[previousMonth.getMonth() as keyof typeof monthNames];
  const year = previousMonth.getFullYear();
  return `${month}-${year}`;
};

export default function CashFlow() {
  // Get current month date range
  const currentMonthRange = getCurrentMonthDateRange();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedEntry, setSelectedEntry] = useState<CashFlowEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [formData, setFormData] = useState({
    type: 'inflow' as 'inflow' | 'outflow',
    category: '',
    name: '',
    amount: ''
  });
  const { toast } = useToast();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  
  // Fetch shop data to display current shop name
  const { data: shopsData } = useQuery({
    queryKey: ["shops", admin?._id],
    queryFn: async () => {
      const response = await apiRequest('GET', ENDPOINTS.shop.getAll);
      return response.json();
    },
    enabled: !!admin?._id
  });
  
  // Get current shop name from multiple sources
  const shopIdToUse = selectedShopId || admin?.primaryShop;
  const shopsArray = Array.isArray(shopsData) ? shopsData : [];
  const currentShop = shopsArray.find((shop: any) => 
    shop._id === shopIdToUse || shop.id === shopIdToUse
  );
  
  // If still no shop found, use the first shop or admin's primary shop
  const fallbackShop = shopsArray[0];
  const finalShop = currentShop || fallbackShop;
  const shopName = finalShop?.name || 'Shop';
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const salesRoute = useNavigationRoute('sales');

  // Get effective shop ID - use attendant's shop if attendant
  const effectiveShopId = attendant
    ? String(extractId(attendant.shopId) ?? '')
    : selectedShopId || localStorage.getItem('selectedShopId');

  // Fetch cashflow summary data with dynamic date filtering and attendant filtering
  const { data: cashflowSummary, isLoading: isLoadingTransactions } = useQuery({
    queryKey: [ENDPOINTS.cashflow.getAll, effectiveShopId, startDate, endDate, attendant?._id],
    queryFn: async () => {
      const params = new URLSearchParams({
        shop: effectiveShopId!,
        startDate: startDate,
        endDate: endDate
      });
      
      // Add attendant filtering if user is attendant
      if (attendant?._id) {
        params.append('attendantId', attendant._id);
      }
      
      const response = await apiRequest('GET', `${ENDPOINTS.cashflow.getAll}?${params.toString()}`);
      return response.json();
    },
    enabled: !!effectiveShopId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Create cashflow transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (payload: { name: string; amount: number; category: string; attendantId: string; shopId: string }) => {
      const response = await apiRequest('POST', ENDPOINTS.cashflow.create, payload);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both categories and transactions caches
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.getAll] });
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
      setFormData({ type: 'inflow', category: '', name: '', amount: '' });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction",
        variant: "destructive",
      });
    },
  });

  // Fetch cashflow categories for dropdowns
  const { data: cashflowCategories = [] } = useQuery({
    queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.cashflow.categories}?shop=${effectiveShopId}`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.data || data?.categories || [];
      return normalizeIds(list);
    },
    enabled: !!effectiveShopId,
    staleTime: 1 * 60 * 1000, // 1 minute - shorter stale time for more frequent updates
    gcTime: 5 * 60 * 1000, // 5 minutes - cache cleanup time
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  // Filter categories by type
  const cashinCategories = cashflowCategories.filter((cat: any) => cat.category === 'cashin' || cat.type === 'cashin');
  const cashoutCategories = cashflowCategories.filter((cat: any) => cat.category === 'cashout' || cat.type === 'cashout');

  // Use authentic API data
  const summaryData = cashflowSummary || {
    totalSales: 0,
    cashintotal: 0,
    cashoutotal: 0,
    purchasestotal: 0,
    cashathand: 0,
    walletTotals: 0,
    balForward: 0,
    totalExpenses: 0,
    salesDebtTotalPaid: 0,
    purchasesTotalPaid: 0
  };

  // Calculate net cashflow
  const netCashflow = summaryData.cashintotal - summaryData.cashoutotal;

  // Function to get month label from date filter
  const getCurrentMonthLabel = () => {
    const startMonth = new Date(startDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[startMonth.getMonth()]}-${startMonth.getFullYear()}`;
  };

  // Function to get previous month label for Bal Forward
  const getPreviousMonthLabel = () => {
    const startMonth = new Date(startDate);
    const prevMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() - 1, 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `<<<${monthNames[prevMonth.getMonth()]}-${prevMonth.getFullYear()}`;
  };

  const currentMonthLabel = getCurrentMonthLabel();
  const previousMonthLabel = getPreviousMonthLabel();

  // Function to handle clicking on previous month (Bal Forward)
  const handlePreviousMonthClick = () => {
    const startMonth = new Date(startDate);
    const prevMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() - 1, 1);
    const lastDayOfPrevMonth = new Date(startMonth.getFullYear(), startMonth.getMonth(), 0);
    
    const prevStartDate = prevMonth.toISOString().split('T')[0];
    const prevEndDate = lastDayOfPrevMonth.toISOString().split('T')[0];
    
    setStartDate(prevStartDate);
    setEndDate(prevEndDate);
  };

  // Function to handle going to next month (if not beyond current month)
  const handleNextMonthClick = () => {
    if (!canGoToNextMonth()) return;
    
    // Parse the current start date to extract year and month
    const currentDate = new Date(startDate + 'T00:00:00');
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-based month
    
    // Calculate next month dates
    const nextMonthFirstDay = new Date(currentYear, currentMonth + 1, 1);
    const nextMonthLastDay = new Date(currentYear, currentMonth + 2, 0);
    
    // Format dates as ISO strings
    const nextStartDate = nextMonthFirstDay.toISOString().split('T')[0];
    const nextEndDate = nextMonthLastDay.toISOString().split('T')[0];
    
    // Update state
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
  };

  // Check if we can go to next month (not beyond current month)
  const canGoToNextMonth = () => {
    const startMonth = new Date(startDate + 'T00:00:00');
    const nextMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);
    const currentDate = new Date();
    
    // Allow navigation if next month is not in the future
    return nextMonth.getFullYear() < currentDate.getFullYear() || 
           (nextMonth.getFullYear() === currentDate.getFullYear() && nextMonth.getMonth() <= currentDate.getMonth());
  };

  // Create comprehensive table data from all API fields
  const tableData = [
    {
      date: previousMonthLabel,
      name: 'Bal Forward',
      inAmount: summaryData.balForward,
      outAmount: null
    },
    {
      date: currentMonthLabel,
      name: 'Total Sales',
      inAmount: summaryData.totalSales,
      outAmount: null
    },
    {
      date: currentMonthLabel,
      name: 'Cash In Total',
      inAmount: summaryData.cashintotal,
      outAmount: null
    },
    {
      date: currentMonthLabel, 
      name: 'Sales Debt Total Paid',
      inAmount: summaryData.salesDebtTotalPaid,
      outAmount: null
    },
    {
      date: currentMonthLabel,
      name: 'Wallet Totals',
      inAmount: summaryData.walletTotals > 0 ? summaryData.walletTotals : null,
      outAmount: summaryData.walletTotals < 0 ? Math.abs(summaryData.walletTotals) : null
    },
    {
      date: currentMonthLabel,
      name: 'Cash Out Total',
      inAmount: null,
      outAmount: summaryData.cashoutotal
    },
    {
      date: currentMonthLabel,
      name: 'Purchases Total',
      inAmount: null,
      outAmount: summaryData.purchasestotal
    },
    {
      date: currentMonthLabel,
      name: 'Total Expenses',
      inAmount: null,
      outAmount: summaryData.totalExpenses
    },
    {
      date: currentMonthLabel,
      name: 'Purchases Total Paid',
      inAmount: null,
      outAmount: summaryData.purchasesTotalPaid
    }
  ];

  const handleEdit = (entry: CashFlowEntry) => {
    // Determine type from category for real API data
    const entryType = entry.type || 
      (typeof entry.category === 'object' && entry.category?.category === 'cashin' ? 'inflow' : 'outflow');
    
    // Get category ID
    const categoryId = typeof entry.category === 'object' ? entry.category?._id : entry.category;
    
    setSelectedEntry(entry);
    setFormData({
      type: entryType,
      category: categoryId || '',
      name: entry.name || entry.description || '',
      amount: entry.amount.toString()
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get attendant ID - use attendant ID if attendant is logged in, otherwise admin ID
      const attendantId = attendant ? attendant._id : (admin?.attendantId?._id || admin?._id);
      
      if (!attendantId) {
        toast({
          title: "Error",
          description: "Unable to find attendant information",
          variant: "destructive"
        });
        return;
      }

      // Get shopId - use attendant's shop if attendant is logged in, otherwise admin's selected shop
      const shopId = attendant
        ? String(extractId(attendant.shopId) ?? '')
        : (selectedShopId || extractId(admin?.primaryShop));
      
      if (!shopId) {
        toast({
          title: "Error",
          description: "Please select a shop first",
          variant: "destructive"
        });
        return;
      }

      const payload = {
        description: formData.name,
        amount: parseFloat(formData.amount),
        categoryId: formData.category,
        shopId: shopId,
      };

      console.log('Submitting cashflow transaction:', payload);

      const response = await apiRequest('POST', ENDPOINTS.cashflow.create, payload);
      const result = await response.json();
      console.log('Cashflow transaction created:', result);

      // Invalidate both categories and transactions caches to refresh data
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.categories, effectiveShopId] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.cashflow.getAll] });

      // Reset form
      setFormData({
        type: 'inflow',
        category: '',
        name: '',
        amount: ''
      });
      setIsDialogOpen(false);
      setSelectedEntry(null);
      
      toast({
        title: "Success",
        description: `Cash ${formData.type === 'inflow' ? 'In' : 'Out'} transaction created successfully`,
      });

    } catch (error: any) {
      console.error('Error creating cashflow transaction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create cashflow transaction",
        variant: "destructive"
      });
    }
  };

  // Navigation functions
  const navigateToMonth = (targetMonth: string) => {
    setCurrentMonth(targetMonth);
    setDateFilter(targetMonth);
  };

  const formatDateForDisplay = (dateString: string, currentViewMonth: string) => {
    const entryMonth = dateString.slice(0, 7);
    
    // If viewing June 2025
    if (currentViewMonth === '2025-06') {
      if (entryMonth === '2025-06') return 'Jun-2025';
      if (entryMonth === '2025-05') return '<<<May-2025';
    }
    // If viewing May 2025
    else if (currentViewMonth === '2025-05') {
      if (entryMonth === '2025-05') return 'May-2025';
      if (entryMonth === '2025-04') return '<<<Apr-2025';
    }
    // If viewing April 2025
    else if (currentViewMonth === '2025-04') {
      if (entryMonth === '2025-04') return 'Apr-2025';
      if (entryMonth === '2025-03') return '<<<Mar-2025';
    }
    
    // Default formatting
    const monthNames = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };
    const month = monthNames[entryMonth.slice(5, 7) as keyof typeof monthNames];
    const year = entryMonth.slice(0, 4);
    
    return `${month}-${year}`;
  };

  // Use summary data from API
  
  // Use data from API summary

  return (
    <DashboardLayout title="Cash Flow">
      <div className="space-y-6">
        {/* Header with Back Button for Attendants */}
        <div className="flex items-center justify-center relative">
          {attendant && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLocation('/attendant/dashboard')}
              className="absolute left-0 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
          <div className="text-center">
            <p className="text-gray-600">{shopName}</p>
          </div>
        </div>

        {/* Cash at Hand - moved to top */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-2">Cash at Hand</p>
          <h3 className={`text-4xl font-bold ${summaryData.cashathand >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summaryData.cashathand >= 0 ? '+' : ''}{summaryData.cashathand.toLocaleString()}
          </h3>
        </div>

        {/* Filter by Date Button with Navigation */}
        <div className="flex justify-center items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePreviousMonthClick}
            className="px-4"
          >
            ← Previous
          </Button>
          
          <Dialog open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="px-8">
                <Calendar className="w-4 h-4 mr-2" />
                <div className="flex flex-col items-start">
                  <span className="text-sm">Filter by date</span>
                  <span className="text-xs text-gray-500">
                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                  </span>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter by Date</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date" className="text-sm font-medium mb-2 block">
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-sm font-medium mb-2 block">
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Filters</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const weekAgo = new Date(today);
                        weekAgo.setDate(today.getDate() - 7);
                        setStartDate(weekAgo.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const monthAgo = new Date(today);
                        monthAgo.setDate(today.getDate() - 30);
                        setStartDate(monthAgo.toISOString().split('T')[0]);
                        setEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate('2025-06-01');
                        setEndDate('2025-06-30');
                      }}
                    >
                      June 2025
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate('2025-05-01');
                        setEndDate('2025-05-31');
                      }}
                    >
                      May 2025
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDateFilterOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setIsDateFilterOpen(false)}>
                    Apply Filter
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleNextMonthClick}
            disabled={!canGoToNextMonth()}
            className="px-4"
          >
            Next →
          </Button>
        </div>

        {/* Cash Flow Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cash In</p>
                  <h3 className="text-2xl font-bold text-green-600">
                    +{summaryData.cashintotal.toLocaleString()}
                  </h3>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cash Out</p>
                  <h3 className="text-2xl font-bold text-red-600">
                    -{summaryData.cashoutotal.toLocaleString()}
                  </h3>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Flow</p>
                  <h3 className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netCashflow >= 0 ? '+' : ''}{netCashflow.toLocaleString()}
                  </h3>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 hover:border-blue-300"
            onClick={(e) => {
              e.preventDefault();
              console.log('Total Sales card clicked', { startDate, endDate });
              // Navigate to sales page with date filters
              setLocation(`${salesRoute}?startDate=${startDate}&endDate=${endDate}`);
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <h3 className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                    {summaryData.totalSales.toLocaleString()}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Click to view details</p>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                  <ArrowUpRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Purchases</p>
                  <h3 className="text-2xl font-bold text-orange-600">
                    {summaryData.purchasestotal.toLocaleString()}
                  </h3>
                </div>
                <TrendingDown className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                  <h3 className="text-2xl font-bold text-purple-600">
                    {summaryData.totalExpenses.toLocaleString()}
                  </h3>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Dialog open={isDialogOpen && formData.type === 'inflow'} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (open) setFormData({...formData, type: 'inflow'});
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white px-6">
                Add Cash In
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Cash In</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="Enter amount"
                    className="w-full"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashinCategories.map((category: any) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter name"
                    className="w-full"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Cash In</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen && formData.type === 'outflow'} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (open) setFormData({...formData, type: 'outflow'});
          }}>
            <DialogTrigger asChild>
              <Button className="bg-red-500 hover:bg-red-600 text-white px-6">
                Add Cash Out
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Cash Out</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="Enter amount"
                    className="w-full"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashoutCategories.map((category: any) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter name"
                    className="w-full"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Cash Out</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Categories Section */}
        <div className="border-t pt-6">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => setLocation(attendant ? '/attendant/cashflow-categories' : '/cashflow-categories')}
          >
            <div>
              <h3 className="text-lg font-semibold">Categories</h3>
              <p className="text-sm text-gray-600">Manage Cashflow Categories</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>

          {/* Cashflow Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold text-center">In</TableHead>
                    <TableHead className="font-semibold text-center">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTransactions ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        Loading cashflow data...
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((row, index) => {
                      const isBalForward = row.name === 'Bal Forward';
                      return (
                        <TableRow 
                          key={index} 
                          className={`${isBalForward ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'}`}
                          onClick={isBalForward ? handlePreviousMonthClick : undefined}
                        >
                          <TableCell className="py-3">
                            <div className={`text-sm font-medium ${isBalForward ? 'text-blue-600 hover:text-blue-800' : ''}`}>
                              {row.date}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className={`font-medium ${isBalForward ? 'text-blue-600 hover:text-blue-800' : ''}`}>
                              {row.name}
                              {isBalForward && <span className="text-xs text-gray-500 ml-2">(Click to view)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {row.inAmount !== null && row.inAmount !== undefined && (
                              <span className="text-blue-600 font-semibold">
                                {(row.inAmount || 0).toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {row.outAmount !== null && row.outAmount !== undefined && (
                              <span className="text-black font-semibold">
                                {(row.outAmount || 0).toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}