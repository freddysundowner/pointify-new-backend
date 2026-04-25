import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { CalendarDays, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, AlertTriangle, Calculator, ArrowLeft } from "lucide-react";
import { RootState } from "@/store";
import { Badge } from "@/components/ui/badge";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

interface ProfitLossData {
  creditTotals: number;
  debtPaid: number;
  totalProfitAndSalesValue: {
    totalProfit: number;
    totalCashSales: number;
    totalSales: number;
    totalPurchases: number;
    totalTaxes: number;
  };
  badStockValue: {
    badStockValue: number;
  };
  totalExpenses: {
    totalExpenses: number;
  };
  totalTaxes: number;
  gross: number;
  net: number;
}

interface Attendant {
  _id: string;
  username: string;
  uniqueDigits: number;
}

export default function ProfitLossPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { user } = useSelector((state: RootState) => state.auth);
  const { attendant } = useAttendantAuth();
  const { primaryShop } = usePrimaryShop();
  const [, setLocation] = useLocation();
  
  // Get effective shop ID and admin ID for both admin and attendant contexts
  const effectiveShopId = selectedShopId || (attendant ? (typeof attendant.shopId === 'string' ? attendant.shopId : attendant.shopId._id) : primaryShop?._id);
  const effectiveAdminId = user?.id || attendant?.adminId;
  
  // Handle back navigation based on user type
  const handleBack = () => {
    if (attendant) {
      // Navigate to attendant dashboard
      setLocation('/attendant/dashboard');
    } else {
      // Navigate to admin dashboard
      setLocation('/dashboard');
    }
  };
  
  // Date range state - default to current month
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [selectedAttendant, setSelectedAttendant] = useState<string>("all");

  // Fetch attendants for the shop (only for admin users)
  const { data: attendants = [] } = useQuery<Attendant[]>({
    queryKey: [ENDPOINTS.attendants.getByShop, effectiveShopId, effectiveAdminId],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: effectiveShopId || "",
        adminId: effectiveAdminId || "",
      });
      const response = await apiRequest('GET', `${ENDPOINTS.attendants.getByShop}?${params}`);
      return response.json();
    },
    enabled: !!effectiveShopId && !!effectiveAdminId && !!user, // Only enable for admin users
  });

  // Build the query URL with parameters
  const buildQueryUrl = () => {
    const params = new URLSearchParams({
      shopId: effectiveShopId || "",
      fromDate,
      toDate,
    });
    
    if (selectedAttendant && selectedAttendant !== "all") {
      params.append("attendant", selectedAttendant);
    }

    return `${ENDPOINTS.analytics.netProfit}?${params}`;
  };

  // Fetch profit/loss data
  const { data: profitLossData, isLoading, error, refetch } = useQuery<ProfitLossData>({
    queryKey: [buildQueryUrl(), effectiveShopId, fromDate, toDate, selectedAttendant],
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleApplyFilters = () => {
    refetch();
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return "KES 0";
    }
    return `KES ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading || !profitLossData) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Report</h1>
              <p className="text-gray-600 mt-1">Comprehensive financial analysis and performance metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Financial Report
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <CalendarDays className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className={`grid gap-4 ${user ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              <div className="space-y-2">
                <Label htmlFor="fromDate">From Date</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To Date</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              {user && (
                <div className="space-y-2">
                  <Label htmlFor="attendant">Attendant (Optional)</Label>
                  <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                    <SelectTrigger>
                      <SelectValue placeholder="All attendants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All attendants</SelectItem>
                      {attendants.map((attendant) => (
                        <SelectItem key={attendant._id} value={attendant._id}>
                          {attendant.username} ({attendant.uniqueDigits})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button 
                  onClick={handleApplyFilters}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>Report Period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
              {selectedAttendant && selectedAttendant !== "all" && (
                <p>Filtered by: {attendants.find(a => a._id === selectedAttendant)?.username || "Selected attendant"}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading profit & loss data...</span>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600">Failed to load profit & loss data. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {profitLossData && (
          <>
            {/* Key Metrics Summary */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Gross Profit</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(profitLossData.gross)}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Net Profit</p>
                      <p className={`text-2xl font-bold ${profitLossData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(profitLossData.net)}
                      </p>
                    </div>
                    <div className={`h-12 w-12 ${profitLossData.net >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
                      {profitLossData.net >= 0 ? 
                        <TrendingUp className="h-6 w-6 text-green-600" /> : 
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Sales</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(profitLossData.totalProfitAndSalesValue.totalSales)}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(profitLossData.totalExpenses.totalExpenses)}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue Breakdown */}
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <DollarSign className="h-5 w-5" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Sales</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.totalProfitAndSalesValue.totalSales)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Cash Sales</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.totalProfitAndSalesValue.totalCashSales)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Credit Sales</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.creditTotals)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Debt Collected</span>
                    <span className="font-semibold text-green-600">{formatCurrency(profitLossData.debtPaid)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-green-50 px-3 rounded-lg">
                    <span className="font-semibold text-green-800">Total Revenue</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(profitLossData.totalProfitAndSalesValue.totalSales + profitLossData.debtPaid)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown */}
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <Receipt className="h-5 w-5" />
                    Cost Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Purchases</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.totalProfitAndSalesValue.totalPurchases)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Operating Expenses</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.totalExpenses.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Bad Stock Losses</span>
                    <span className="font-semibold text-red-600">{formatCurrency(profitLossData.badStockValue.badStockValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Taxes</span>
                    <span className="font-semibold">{formatCurrency(profitLossData.totalTaxes)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-orange-50 px-3 rounded-lg">
                    <span className="font-semibold text-orange-800">Total Costs</span>
                    <span className="font-bold text-orange-600">
                      {formatCurrency(
                        profitLossData.totalProfitAndSalesValue.totalPurchases + 
                        profitLossData.totalExpenses.totalExpenses + 
                        profitLossData.badStockValue.badStockValue + 
                        profitLossData.totalTaxes
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profit Analysis */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b">
                <CardTitle className="flex items-center gap-2 text-purple-800">
                  <Calculator className="h-5 w-5" />
                  Profit Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-3">Sales Performance</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-600">Gross Profit</span>
                        <span className="font-semibold text-blue-800">{formatCurrency(profitLossData.totalProfitAndSalesValue.totalProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-600">Profit Margin</span>
                        <span className="font-semibold text-blue-800">
                          {profitLossData.totalProfitAndSalesValue.totalSales > 0 
                            ? `${((profitLossData.totalProfitAndSalesValue.totalProfit / profitLossData.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-3">Final Profit</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-green-600">Net Profit</span>
                        <span className={`font-semibold ${profitLossData.net >= 0 ? 'text-green-800' : 'text-red-600'}`}>
                          {formatCurrency(profitLossData.net)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-600">Net Margin</span>
                        <span className={`font-semibold ${profitLossData.net >= 0 ? 'text-green-800' : 'text-red-600'}`}>
                          {profitLossData.totalProfitAndSalesValue.totalSales > 0 
                            ? `${((profitLossData.net / profitLossData.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                    <h3 className="font-semibold text-purple-800 mb-3">Tax Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-purple-600">Total Taxes</span>
                        <span className="font-semibold text-purple-800">{formatCurrency(profitLossData.totalTaxes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-purple-600">Tax Rate</span>
                        <span className="font-semibold text-purple-800">
                          {profitLossData.totalProfitAndSalesValue.totalSales > 0 
                            ? `${((profitLossData.totalTaxes / profitLossData.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}