import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { extractId } from "@/lib/utils";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Filter, RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { ENDPOINTS } from "@/lib/api-endpoints";

export default function AdjustmentHistoryPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  
  // Get product ID and name from URL params
  const pathParts = location.split('/');
  const productId = pathParts[pathParts.indexOf('adjustment-history') + 1];
  
  // State
  const [product, setProduct] = useState<any>(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  // Check if user is an attendant
  const isAttendant = location.startsWith("/attendant/");
  
  // Get effective shop ID
  const getShopId = () => {
    if (selectedShopId) return selectedShopId;

    if (isAttendant) {
      const attendantData = localStorage.getItem("attendantData");
      if (attendantData) {
        try {
          const parsed = JSON.parse(attendantData);
          return String(extractId(parsed.shopId) ?? '');
        } catch {
          return null;
        }
      }
      return null;
    }

    // For admin users, get from localStorage admin data
    const adminData = localStorage.getItem("adminData");
    if (adminData) {
      try {
        const parsed = JSON.parse(adminData);
        return parsed.primaryShop?._id || parsed.primaryShop;
      } catch {
        return null;
      }
    }
    return null;
  };

  // Fetch product details
  const fetchProduct = async () => {
    try {
      const response = await fetch(ENDPOINTS.products.getById(productId), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('attendantToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    }
  };

  // Fetch adjustment history
  const fetchAdjustmentHistory = async () => {
    setIsLoading(true);
    try {
      const shopId = getShopId();
      
      // Calculate date range - use provided dates or default to last 30 days
      let startDate, endDate;
      if (fromDate && toDate) {
        startDate = fromDate;
        endDate = toDate;
      } else {
        // Default to last 30 days if no dates provided
        endDate = new Date().toISOString().split('T')[0];
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      const queryParams = new URLSearchParams({
        shopId: shopId,
        fromDate: startDate,
        toDate: endDate,
        page: "1",
        limit: "100",
        ...(filterType !== "all" && { type: filterType })
      });
      
      const response = await fetch(`${ENDPOINTS.products.adjustHistory(productId)}?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('attendantToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch adjustment history');
      }
      
      const data = await response.json();
      console.log('Adjustment history data:', data);
      
      // Handle different response structures
      let historyData = data.data || data.adjustments || data || [];
      if (!Array.isArray(historyData)) {
        historyData = [];
      }
      
      // Data is filtered by API when type is specified, no need for client-side processing
      
      setAdjustmentHistory(historyData);
    } catch (error) {
      console.error('Error fetching adjustment history:', error);
      toast({
        title: "Error",
        description: "Failed to load adjustment history",
        variant: "destructive",
      });
      setAdjustmentHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = ['Date', 'Type', 'Before', 'After', 'Change'];
    const csvData = adjustmentHistory.map(adjustment => {
      const before = adjustment.before || adjustment.previousQuantity || 0;
      const after = adjustment.after || adjustment.newQuantity || adjustment.currentQuantity || 0;
      const change = after - before;
      const type = change > 0 ? 'Stock In' : 'Stock Out';
      const date = adjustment.date || adjustment.createdAt || adjustment.timestamp 
        ? new Date(adjustment.date || adjustment.createdAt || adjustment.timestamp).toLocaleString()
        : 'N/A';
      
      return [date, type, before, after, Math.abs(change)];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product?.name || 'product'}_adjustment_history_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Export Complete",
      description: "Adjustment history exported to CSV",
    });
  };

  // Navigate back
  const goBack = useGoBack("/stock/products");

  useEffect(() => {
    if (productId) {
      fetchProduct();
      fetchAdjustmentHistory();
    }
  }, [productId, filterType, fromDate, toDate]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Adjustment History</h1>
              <p className="text-gray-600">
                Stock adjustment history for {product?.name || 'Product'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={fetchAdjustmentHistory} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportToCsv} disabled={adjustmentHistory.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="add">Stock In (Add)</SelectItem>
                    <SelectItem value="remove">Stock Out (Remove)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Product Info */}
        {product && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Product Name</p>
                  <p className="font-semibold">{product.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Stock</p>
                  <p className="font-semibold">{product.quantity || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-semibold">{product.productCategoryId?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <Badge variant={product.virtual ? "secondary" : "default"}>
                    {product.virtual ? 'Service' : 'Physical'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Adjustment History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Adjustment Records</span>
              <Badge variant="outline">{adjustmentHistory.length} records</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-500 py-12">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>Loading adjustment history...</span>
                </div>
              </div>
            ) : adjustmentHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No adjustment history found</p>
                <p className="text-sm">Try adjusting the date range or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Date</th>
                      <th className="text-left p-3 font-medium text-gray-700">Type</th>
                      <th className="text-left p-3 font-medium text-gray-700">Before</th>
                      <th className="text-left p-3 font-medium text-gray-700">After</th>
                      <th className="text-left p-3 font-medium text-gray-700">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentHistory.map((adjustment: any, index: number) => {
                      const before = adjustment.before || adjustment.previousQuantity || 0;
                      const after = adjustment.after || adjustment.newQuantity || adjustment.currentQuantity || 0;
                      const change = after - before;
                      const type = change > 0 ? 'Stock In' : 'Stock Out';
                      const badgeVariant = change > 0 ? 'default' : 'destructive';
                      
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm">
                            {adjustment.date || adjustment.createdAt || adjustment.timestamp 
                              ? new Date(adjustment.date || adjustment.createdAt || adjustment.timestamp).toLocaleString()
                              : 'N/A'}
                          </td>
                          <td className="p-3 text-sm">
                            <Badge variant={badgeVariant}>
                              {type}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">
                            {before}
                          </td>
                          <td className="p-3 text-sm">
                            {after}
                          </td>
                          <td className="p-3 text-sm">
                            <span className={change > 0 ? 'text-green-600' : 'text-red-600'}>
                              {change > 0 ? '+' : ''}{change}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}