import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Package,
  Download,
  RefreshCw
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation,useParams } from "wouter";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { navigate } from "wouter/use-browser-location";
import { useAuth } from "@/features/auth/useAuth";
import { useCurrency } from "@/utils";

export default function ProductHistory() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const productId = id;
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("sales");
  const currency = useCurrency();
  
  // Pagination states for each tab
  const [salesPage, setSalesPage] = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [badStockPage, setBadStockPage] = useState(1);

  // Reset pagination when tab changes
  useEffect(() => {
    setSalesPage(1);
    setPurchasesPage(1);
    setBadStockPage(1);
  }, [activeTab]);

  // Compute month date range for API calls
  const fromDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const toDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

  // Fetch product details
  const { data: productResp, isLoading: productLoading } = useQuery({
    queryKey: [ENDPOINTS.products.getById(productId || ''), productId],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.products.getById(productId || ''));
      return await response.json();
    },
    enabled: !!productId,
  });
  const product = productResp?.data ?? productResp;

  // Fetch product summary (all-time)
  const { data: summaryResp, isLoading: summaryLoading } = useQuery({
    queryKey: [ENDPOINTS.products.summary(productId || ''), productId],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.products.summary(productId || ''));
      return await response.json();
    },
    enabled: !!productId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  const summaryData = summaryResp?.data ?? summaryResp;

  // Fetch sales history - only when Sales tab is active
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: [ENDPOINTS.products.salesHistory(productId || ''), productId, fromDate, toDate, salesPage],
    queryFn: async () => {
      const response = await apiCall(`${ENDPOINTS.products.salesHistory(productId || '')}?from=${fromDate}&to=${toDate}&page=${salesPage}`);
      return await response.json();
    },
    enabled: !!productId && activeTab === "sales",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Fetch purchases history - only when Stock In tab is active
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: [ENDPOINTS.products.purchasesHistory(productId || ''), productId, fromDate, toDate, purchasesPage],
    queryFn: async () => {
      const response = await apiCall(`${ENDPOINTS.products.purchasesHistory(productId || '')}?from=${fromDate}&to=${toDate}&page=${purchasesPage}`);
      return await response.json();
    },
    enabled: !!productId && activeTab === "stock-in",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Fetch bad stock movements - only when Bad Stock tab is active
  const { data: badStockData, isLoading: badStockLoading } = useQuery({
    queryKey: [ENDPOINTS.products.badStockMovements, productId, fromDate, toDate, badStockPage],
    queryFn: async () => {
      const response = await apiCall(`${ENDPOINTS.products.badStockMovements}?productId=${productId}&from=${fromDate}&to=${toDate}&page=${badStockPage}`);
      return await response.json();
    },
    enabled: !!productId && activeTab === "bad-stock",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Extract data arrays with proper fallbacks
  const sales = (salesData && salesData.data && Array.isArray(salesData.data)) ? salesData.data : [];
  const purchases = (purchasesData && purchasesData.data && Array.isArray(purchasesData.data)) ? purchasesData.data : [];
  const badStockMovements = (badStockData && badStockData.data && Array.isArray(badStockData.data)) ? badStockData.data : [];
  
  // Extract pagination info based on active tab
  const getPaginationInfo = () => {
    switch (activeTab) {
      case "sales":
        return {
          totalPages: salesData?.meta?.totalPages || salesData?.pagination?.totalPages || 1,
          currentPage: salesData?.meta?.page || salesData?.pagination?.page || 1,
          setPage: setSalesPage,
          page: salesPage
        };
      case "stock-in":
        return {
          totalPages: purchasesData?.meta?.totalPages || purchasesData?.pagination?.totalPages || 1,
          currentPage: purchasesData?.meta?.page || purchasesData?.pagination?.page || 1,
          setPage: setPurchasesPage,
          page: purchasesPage
        };
      case "bad-stock":
        return {
          totalPages: badStockData?.meta?.totalPages || badStockData?.pagination?.totalPages || 1,
          currentPage: badStockData?.meta?.page || badStockData?.pagination?.page || 1,
          setPage: setBadStockPage,
          page: badStockPage
        };
      default:
        return { totalPages: 1, currentPage: 1, setPage: () => {}, page: 1 };
    }
  };
  
  const { totalPages, currentPage, setPage } = getPaginationInfo();
    const { admin } = useAuth();
  
  const isAdmin = !!admin && !localStorage.getItem("attendantData");

  const handleGoBack = () => {
    if (isAdmin) {
      navigate("/products");
    } else {
      navigate("/attendant/products");
    }
    // setLocation("/attendant/stock-summary");
  };

  if (!productId) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-gray-500">Product not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleGoBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {productLoading ? "Loading..." : product?.name || "Product History"}
              </h1>
              <p className="text-gray-600">
                {selectedMonth}/{selectedYear} • Stock movements and transactions
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summaryData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">{currency} {parseFloat(summaryData?.sales?.totalSoldValue ?? "0").toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{summaryData?.sales?.saleCount ?? 0} transactions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Units Sold</p>
                  <p className="text-2xl font-bold">{parseFloat(summaryData?.sales?.totalSoldQty ?? "0")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Stock</p>
                  <p className="text-2xl font-bold text-green-600">{parseFloat(summaryData?.currentStock ?? "0")}</p>
                  <p className="text-xs text-gray-400">{currency} {parseFloat(summaryData?.stockValue ?? "0").toFixed(2)} value</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Stock Purchased</p>
                  <p className="text-2xl font-bold text-blue-600">{parseFloat(summaryData?.purchases?.totalPurchasedQty ?? "0")}</p>
                  <p className="text-xs text-gray-400">{summaryData?.purchases?.purchaseCount ?? 0} orders</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabbed History */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Product History</h2>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted">
                <TabsTrigger 
                  value="stock-in" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <TrendingUp className="h-4 w-4" />
                  Stock In
                </TabsTrigger>
                <TabsTrigger 
                  value="sales" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <TrendingDown className="h-4 w-4" />
                  Sales
                </TabsTrigger>
                <TabsTrigger 
                  value="bad-stock" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <Package className="h-4 w-4" />
                  Bad Stock
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stock-in" className="space-y-4">
                {purchasesLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading purchases history...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchases.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No purchases found for this period</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-4 font-medium">Receipt No</th>
                              <th className="text-left p-4 font-medium">Supplier</th>
                              <th className="text-left p-4 font-medium">Date</th>
                              <th className="text-left p-4 font-medium">Payment Type</th>
                              <th className="text-right p-4 font-medium">Units</th>
                              <th className="text-right p-4 font-medium">Unit Price</th>
                              <th className="text-right p-4 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases.map((purchase: any, index: number) => (
                              <tr key={purchase.id || index} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-mono text-sm">{purchase.purchaseNo || `#${purchase.purchaseId || purchase.id}`}</td>
                                <td className="p-4">{purchase.supplierId ? `Supplier #${purchase.supplierId}` : 'Direct'}</td>
                                <td className="p-4 text-sm">
                                  {new Date(purchase.purchaseDate || purchase.createdAt).toLocaleDateString()} {new Date(purchase.purchaseDate || purchase.createdAt).toLocaleTimeString()}
                                </td>
                                <td className="p-4 capitalize">{purchase.batchCode || '—'}</td>
                                <td className="p-4 text-right">{parseFloat(purchase.quantity ?? 1)}</td>
                                <td className="p-4 text-right">{currency} {parseFloat(purchase.unitPrice ?? 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-medium">{currency} {(parseFloat(purchase.quantity ?? 1) * parseFloat(purchase.unitPrice ?? 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Pagination for Stock In */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                            <p className="text-sm text-gray-600">
                              Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="space-y-4">
                {salesLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading sales data...</p>
                  </div>
                ) : (
                  <div className="space-y-4">

                    
                    {sales.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No sales found for this period</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-4 font-medium">Receipt No</th>
                              <th className="text-left p-4 font-medium">Customer</th>
                              <th className="text-left p-4 font-medium">Date</th>
                              <th className="text-left p-4 font-medium">Payment Type</th>
                              <th className="text-right p-4 font-medium">Units</th>
                              <th className="text-right p-4 font-medium">Unit Price</th>
                              <th className="text-right p-4 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sales.map((sale: any, index: number) => (
                              <tr key={sale.id || index} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-mono text-sm">{sale.receiptNo || `#${sale.saleId || sale.id}`}</td>
                                <td className="p-4">{sale.customerId ? `Customer #${sale.customerId}` : 'Walk-in'}</td>
                                <td className="p-4 text-sm">
                                  {new Date(sale.saleDate || sale.createdAt).toLocaleDateString()} {new Date(sale.saleDate || sale.createdAt).toLocaleTimeString()}
                                </td>
                                <td className="p-4 capitalize">{sale.saleType || '—'}</td>
                                <td className="p-4 text-right">{parseFloat(sale.quantity ?? 1)}</td>
                                <td className="p-4 text-right">{currency} {parseFloat(sale.unitPrice ?? 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-medium">{currency} {(parseFloat(sale.quantity ?? 1) * parseFloat(sale.unitPrice ?? 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between p-4 border-t">
                            <div className="text-sm text-gray-500">
                              Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage <= 1}
                                onClick={() => setSalesPage(Math.max(1, salesPage - 1))}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= totalPages}
                                onClick={() => setSalesPage(Math.min(totalPages, salesPage + 1))}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bad-stock" className="space-y-4">
                {badStockLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-8 h-8 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading bad stock movements...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {badStockMovements.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No bad stock movements found for this period</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-4 font-medium">Date</th>
                              <th className="text-left p-4 font-medium">Reason</th>
                              <th className="text-left p-4 font-medium">Performed By</th>
                              <th className="text-right p-4 font-medium">Quantity</th>
                              <th className="text-right p-4 font-medium">Unit Price</th>
                              <th className="text-right p-4 font-medium">Total Loss</th>
                            </tr>
                          </thead>
                          <tbody>
                            {badStockMovements.map((movement: any, index: number) => (
                              <tr key={movement._id || index} className="border-b hover:bg-gray-50">
                                <td className="p-4 text-sm">
                                  {new Date(movement.createdAt || movement.date).toLocaleDateString()} {new Date(movement.createdAt || movement.date).toLocaleTimeString()}
                                </td>
                                <td className="p-4 capitalize">{movement.reason || 'Bad Stock'}</td>
                                <td className="p-4">{movement.attendantId?.username || movement.performedBy || 'System'}</td>
                                <td className="p-4 text-right text-red-600 font-medium">-{movement.quantity || 1}</td>
                                <td className="p-4 text-right">{currency} {parseFloat(movement.unitPrice || 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-medium text-red-600">
                                {currency} {(parseFloat(movement.unitPrice || 0) * parseInt(movement.quantity || 1)).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Pagination for Bad Stock */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                            <p className="text-sm text-gray-600">
                              Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}