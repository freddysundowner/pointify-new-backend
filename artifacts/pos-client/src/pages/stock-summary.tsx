import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, AlertTriangle, DollarSign, BarChart3, ArrowLeft, Download, MousePointer } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { usePermissions } from "@/hooks/usePermissions";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";

interface StockAnalysisData {
  totalStockValue: number;
  profitEstimate: number;
  outofstock: number;
  lowstock: number;
  totalstock: number;
}

export default function StockSummary() {
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { shopId, shopData } = usePrimaryShop();
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/dashboard");

  // Fetch stock analysis data
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.analytics.stockAnalysis, shopId],
    queryFn: async () => {
      // Get the appropriate token for admin or attendant
      const adminToken = localStorage.getItem("authToken");
      const attendantToken = localStorage.getItem("attendantToken");
      const token = attendantToken || adminToken;
      
      const response = await fetch(`${ENDPOINTS.analytics.stockAnalysis}?shopId=${shopId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      return (json.data ?? json) as StockAnalysisData;
    },
    enabled: !!shopId,
  });

  // Check if user has permission to view stock summary
  // Admins have access by default, attendants need specific permission
  const isAdmin = !!localStorage.getItem("authToken") || !!localStorage.getItem("adminData");
  const canViewStockSummary = isAdmin || hasPermission('inventory_view') || hasAttendantPermission('stocks', 'stock_summary');
  if (!canViewStockSummary) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to view stock summary. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2" />
              <p>Loading stock summary...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
              <p className="text-gray-600">
                Failed to load stock summary. Please try again later.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const formatCurrency = (amount: number | string | undefined | null) => {
    const currency = shopData?.currency || "KES";
    const num = parseFloat(String(amount ?? 0)) || 0;
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Navigation functions
  const navigateToProducts = (filter: string) => {
    // Navigate to stock products page with appropriate filter
    const attendantData = localStorage.getItem('attendantData');
    const basePath = attendantData ? '/attendant' : '';
    setLocation(`${basePath}/stock/products?filter=${filter}`);
  };

  // Download functions
  const downloadStockData = async (type: 'lowstock' | 'outofstock') => {
    try {
      const adminToken = localStorage.getItem("authToken");
      const attendantToken = localStorage.getItem("attendantToken");
      const token = attendantToken || adminToken;
      
      // Call the API that returns Excel file directly
      const downloadUrl = `${ENDPOINTS.analytics.stockPdfDownload}?shopid=${shopId}`;
      
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.status} ${response.statusText}`);
      }

      // Get the Excel file blob
      const blob = await response.blob();

      if (blob.size === 0) {
        alert('No data available for download.');
        return;
      }

      // Download the Excel file
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const filename = type === 'lowstock' 
        ? `low_stock_report_${new Date().toISOString().split('T')[0]}.xlsx`
        : `out_of_stock_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Stock Summary</h1>
            <p className="text-gray-600">Overview of your inventory status and value</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {/* Total Stock Value */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stockData?.totalStockValue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Current inventory value
              </p>
            </CardContent>
          </Card>

          {/* Profit Estimate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Estimate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(stockData?.profitEstimate || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated profit margin
              </p>
            </CardContent>
          </Card>

          {/* Total Products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Number(stockData?.totalProducts) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Products in inventory
              </p>
            </CardContent>
          </Card>

          {/* Low Stock */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigateToProducts('lowstock')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Low Stock 
                <MousePointer className="h-3 w-3 text-orange-600" />
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stockData?.lowstock || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Products running low · Click to view
              </p>
            </CardContent>
          </Card>

          {/* Out of Stock */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigateToProducts('outofstock')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Out of Stock 
                <MousePointer className="h-3 w-3 text-red-600" />
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadStockData('outofstock');
                  }}
                  className="h-7 px-2 text-xs hover:bg-red-50 border-red-200 text-red-600"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stockData?.outofstock || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Products out of stock · Click to view
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Insights */}
        {stockData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stock Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Stock Health Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Healthy Stock</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {Number(stockData.totalProducts) - Number(stockData.lowstock) - Number(stockData.outofstock)} products
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Low Stock Alert</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {stockData.lowstock} products
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Critical (Out of Stock)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      {stockData.outofstock} products
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Investment</span>
                  <span className="font-semibold">
                    {formatCurrency(stockData.totalStockValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Expected Profit</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(stockData.profitEstimate)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Profit Margin</span>
                  <span className="font-semibold text-blue-600">
                    {parseFloat(String(stockData.totalStockValue ?? 0)) > 0
                      ? `${((parseFloat(String(stockData.profitEstimate ?? 0)) / parseFloat(String(stockData.totalStockValue ?? 1))) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Average Value per Product</span>
                  <span className="font-semibold">
                    {parseFloat(String(stockData.totalstock ?? 0)) > 0
                      ? formatCurrency(Math.round(parseFloat(String(stockData.totalStockValue ?? 0)) / parseFloat(String(stockData.totalstock ?? 1))))
                      : formatCurrency(0)
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}