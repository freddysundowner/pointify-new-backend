import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, AlertTriangle, DollarSign, BarChart3, ArrowLeft, Download } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
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

  const totalProducts = Number(stockData?.totalProducts) || 0;
  const lowstock = Number(stockData?.lowstock) || 0;
  const outofstock = Number(stockData?.outofstock) || 0;
  const healthyStock = totalProducts - lowstock - outofstock;
  const totalStockValue = parseFloat(String(stockData?.totalStockValue ?? 0));
  const profitEstimate = parseFloat(String(stockData?.profitEstimate ?? 0));
  const totalQty = parseFloat(String(stockData?.totalstock ?? 0));
  const profitMargin = totalStockValue > 0 ? ((profitEstimate / totalStockValue) * 100).toFixed(1) : "0.0";
  const avgValue = totalQty > 0 ? Math.round(totalStockValue / totalQty) : 0;

  return (
    <DashboardLayout>
      <div className="p-4 space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="hidden lg:flex h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Stock Summary</h1>
            <p className="hidden sm:block text-xs text-gray-500">Inventory status & value</p>
          </div>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Stock Value</span>
                <DollarSign className="h-3 w-3 text-green-600" />
              </div>
              <div className="text-base font-bold text-green-600 truncate">{formatCurrency(totalStockValue)}</div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Est. Profit</span>
                <TrendingUp className="h-3 w-3 text-blue-600" />
              </div>
              <div className="text-base font-bold text-blue-600 truncate">{formatCurrency(profitEstimate)}</div>
              <div className="text-xs text-gray-400">margin {profitMargin}%</div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Products</span>
                <Package className="h-3 w-3 text-gray-500" />
              </div>
              <div className="text-base font-bold">{totalProducts}</div>
              <div className="text-xs text-gray-400">{healthyStock} healthy</div>
            </CardContent>
          </Card>

          <Card
            className="col-span-1 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigateToProducts('lowstock')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Low Stock</span>
                <AlertTriangle className="h-3 w-3 text-orange-500" />
              </div>
              <div className="text-base font-bold text-orange-600">{lowstock}</div>
              <div className="text-xs text-gray-400">tap to view</div>
            </CardContent>
          </Card>

          <Card
            className="col-span-1 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigateToProducts('outofstock')}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  Out of Stock
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); downloadStockData('outofstock'); }}
                    className="h-4 w-4 p-0 ml-1 text-red-500 hover:text-red-700"
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </span>
                <AlertTriangle className="h-3 w-3 text-red-500" />
              </div>
              <div className="text-base font-bold text-red-600">{outofstock}</div>
              <div className="text-xs text-gray-400">tap to view</div>
            </CardContent>
          </Card>
        </div>

        {/* Health + Financials combined */}
        {stockData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="px-4 pt-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Stock Health
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {[
                  { label: "Healthy", value: healthyStock, color: "text-green-600 border-green-300" },
                  { label: "Low Stock", value: lowstock, color: "text-orange-600 border-orange-300" },
                  { label: "Out of Stock", value: outofstock, color: "text-red-600 border-red-300" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{label}</span>
                    <Badge variant="outline" className={`text-xs py-0 ${color}`}>{value} products</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 pt-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Financials
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {[
                  { label: "Total Investment", value: formatCurrency(totalStockValue), color: "" },
                  { label: "Expected Profit", value: formatCurrency(profitEstimate), color: "text-green-600" },
                  { label: "Profit Margin", value: `${profitMargin}%`, color: "text-blue-600" },
                  { label: "Avg Value / Product", value: formatCurrency(avgValue), color: "" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className={`text-xs font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}