import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Hash, Search, Save, RefreshCw, Plus, Minus, Calendar, ChevronLeft, ChevronRight, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useLocation } from "wouter";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";

interface Product {
  id: number;
  _id?: string;
  name: string;
  quantity: number;
  category?: string;
  sku?: string;
  virtual?: boolean;
  productType?: string;
  type?: string;
}

export default function StockCount() {
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const goBack = useGoBack("/dashboard");
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const [searchQuery, setSearchQuery] = useState("");
  const [countData, setCountData] = useState<Record<string, number>>({});
  
  // Preserve counted data across API calls and filter changes
  const [preservedCounts, setPreservedCounts] = useState<Record<string, number>>({});
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Determine back route: attendants go to dashboard, admins to inventory
  const backRoute = attendant ? '/attendant/dashboard' : '/stock';

  const { data: productsResponse, isLoading, error } = useQuery({
    queryKey: [ENDPOINTS.products.getAll, "stock-count", adminId, shopId, currentPage, itemsPerPage, searchQuery, selectedStatus, selectedDate],
    enabled: !!adminId && !!shopId && (selectedStatus !== 'counteddate' || (selectedStatus === 'counteddate' && selectedDate !== '')),
    queryFn: async () => {
      if (!adminId || !shopId) return { data: [], count: 0, totalPages: 0 };
      
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          reason: "",
          date: selectedDate || "",
          limit: itemsPerPage.toString(),
          name: searchQuery,
          shopid: shopId,
          type: "all",
          sort: "",
          productid: "",
          barcodeid: "",
          productType: "",
          useWarehouse: "true",
          warehouse: "false",
          adminid: adminId
        });

        // Use appropriate token based on user type
        const token = attendant 
          ? localStorage.getItem('attendantToken')
          : localStorage.getItem('authToken');

        const response = await fetch(`${ENDPOINTS.products.getAll}?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const products = Array.isArray(data) ? data : (data?.data || []);
        
        return {
          data: products,
          count: data?.total || products.length,
          totalPages: Math.ceil((data?.total || products.length) / itemsPerPage)
        };
      } catch (error) {
        console.error("Failed to fetch products:", error);
        return { data: [], count: 0, totalPages: 0 };
      }
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Extract products array and pagination info from API response
  const products: Product[] = (() => {
    if (Array.isArray(productsResponse)) return productsResponse;
    if (productsResponse?.data && Array.isArray(productsResponse.data)) return productsResponse.data;
    return [];
  })();

  // Extract pagination info from API response
  const totalProductsFromAPI = productsResponse?.count || products.length;
  const currentPageFromAPI = currentPage;
  const totalPagesFromAPI = productsResponse?.totalPages || Math.ceil(totalProductsFromAPI / itemsPerPage);

  // Products are filtered server-side based on status and search query
  const filteredProducts = products;

  // Calculate counts using preserved data to maintain accuracy across filter changes
  const totalProducts = totalProductsFromAPI; // Use API total, not displayed data length
  const countedProducts = Object.keys(preservedCounts).length;
  const pendingProducts = Math.max(0, totalProducts - countedProducts);

  // Stock count submission mutation
  const stockCountMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", ENDPOINTS.stockCounts.create, payload);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stock count submitted successfully",
      });
      setCountData({});
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
    },
    onError: (error) => {
      console.error('Stock count submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit stock count. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check if user has permission to perform stock count
  const canStockCount = hasPermission('inventory_view') || hasAttendantPermission('stocks', 'stock_count');
  if (!canStockCount) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Hash className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to perform stock counts. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleCountChange = (productId: string, count: number) => {
    if (count < 0) return;
    
    setCountData(prev => {
      const newData = { ...prev };
      newData[productId] = count;
      return newData;
    });
    
    // Also update preserved counts to maintain data across API calls
    setPreservedCounts(prev => {
      const newData = { ...prev };
      newData[productId] = count;
      return newData;
    });
  };

  const handleSaveCount = async () => {
    const productCounts = Object.entries(preservedCounts).filter(
      ([productId, count]) => productId !== "undefined" && !isNaN(Number(productId)) && count !== undefined
    );
    
    if (productCounts.length === 0) {
      toast({
        title: "No Counts",
        description: "Please enter counts for at least one product",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      shopId: shopId,
      items: productCounts.map(([productId, physicalCount]) => ({
        productId: Number(productId),
        physicalCount
      }))
    };

    stockCountMutation.mutate(payload);
  };

  const handleReset = () => {
    setCountData({});
    setPreservedCounts({});
    toast({
      title: "Reset Complete",
      description: "All count data has been cleared",
    });
  };

  const resetSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading products...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {attendant && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">Stock Count</h1>
              <p className="text-gray-600">Count and verify your inventory</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setLocation(attendant ? "/attendant/stock/count-history" : "/stock/count-history")}
              variant="outline"
            >
              <History className="h-4 w-4 mr-2" />
              Stock Count History
            </Button>
            <Button 
              onClick={handleReset} 
              variant="outline"
              disabled={Object.keys(preservedCounts).length === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={handleSaveCount}
              disabled={Object.entries(preservedCounts).filter(([_, count]) => count !== undefined).length === 0 || stockCountMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {stockCountMutation.isPending ? "Saving..." : "Save Count"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold">{totalProducts}</p>
                </div>
                <Hash className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Counted</p>
                  <p className="text-2xl font-bold text-green-600">{countedProducts}</p>
                </div>
                <Hash className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{pendingProducts}</p>
                </div>
                <Hash className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="counted">Counted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="counteddate">Counted Date</SelectItem>
                  </SelectContent>
                </Select>
                {selectedStatus === 'counteddate' && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-40"
                    />
                  </div>
                )}
                {searchQuery && (
                  <Button variant="outline" onClick={resetSearch}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Physical Count</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const pid = product._id ?? String(product.id);
                    const countValue = preservedCounts[pid] ?? countData[pid];
                    const currentStock = product.quantity || 0;
                    const physicalCount = countValue ?? 0;
                    const variance = countValue !== undefined ? physicalCount - currentStock : 0;
                    const isCounted = countValue !== undefined;

                    return (
                      <TableRow key={pid}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{currentStock}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCountChange(pid, Math.max(0, physicalCount - 1))}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={countValue !== undefined ? countValue.toString() : ""}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                                if (!isNaN(value)) {
                                  handleCountChange(pid, value);
                                }
                              }}
                              className="w-20 text-center"
                              min="0"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCountChange(pid, physicalCount + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCounted && (
                            <span className={variance === 0 ? "text-green-600" : variance > 0 ? "text-blue-600" : "text-red-600"}>
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCounted ? "default" : "secondary"}>
                            {isCounted ? "Counted" : "Pending"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
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
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPagesFromAPI) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPagesFromAPI}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}