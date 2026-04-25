import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  TrendingUp,
  Edit,
  Eye,
  MoreVertical,
  History,
  Trash2,
  X,
  ArrowLeft,
  FileText,
  Download,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { Link, useLocation } from "wouter";
import { useShop } from "@/features/shop/useShop";
import { useAuth } from "@/features/auth/useAuth";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useProducts } from "@/contexts/ProductsContext";

interface Product {
  _id: string;
  name: string;
  price?: number;
  sellingPrice: number;
  stock: number;
  quantity: number;
  category: string;
  sku?: string;
  lowStockThreshold: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  virtual?: boolean; // Services are virtual products
}

export default function StockProducts() {
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY CONDITIONAL RETURNS
  const queryClient = useQueryClient();
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { toast } = useToast();
  const { refreshProducts } = useProducts();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [productType, setProductType] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [stockFilter, setStockFilter] = useState<
    "all" | "outofstock" | "lowstock"
  >("all");
  const { currency, shop } = useShop();
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const [location, setLocation] = useLocation();
  const addProductRoute = useNavigationRoute("addProduct");
  const editProductRoute = useNavigationRoute("editProduct");
  const productHistoryRoute = useNavigationRoute("productHistory");

  // Adjust Stock Dialog State
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("increase");

  const [isAdjusting, setIsAdjusting] = useState(false);

  // Note: Adjustment history now uses standalone page instead of dialog

  // Check if user is an attendant
  const isAttendant = location.startsWith("/attendant/");

  // Handle URL parameters for filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam === 'lowstock' || filterParam === 'outofstock') {
      setStockFilter(filterParam);
    }
  }, [location]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, productType, sortBy, stockFilter]);

  // Get effective shop ID from Redux state or fallback to admin/attendant data
  const getShopId = () => {
    if (selectedShopId) return selectedShopId;

    if (isAttendant) {
      // For attendants, get shop ID from attendant data
      const attendantData = localStorage.getItem("attendantData");
      if (attendantData) {
        try {
          const parsed = JSON.parse(attendantData);
          return typeof parsed.shopId === "string"
            ? parsed.shopId
            : parsed.shopId?._id;
        } catch {
          return null;
        }
      }
      return null;
    }

    // For admins, use admin data
    return typeof admin?.primaryShop === "string"
      ? admin.primaryShop
      : (admin?.primaryShop as any)?._id || (admin?.primaryShop as any)?.id;
  };

  const effectiveShopId = getShopId();

  // Fetch products
  const {
    data: productsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      ENDPOINTS.products.getAll,
      effectiveShopId,
      page,
      itemsPerPage,
      searchQuery,
      selectedCategory,
      productType,
      sortBy,
      stockFilter,
    ],
    queryFn: async ({ queryKey }) => {
      // Determine type parameter based on stock filter
      let typeParam = selectedCategory === "all" ? "" : selectedCategory;
      if (stockFilter === "outofstock") {
        typeParam = "outofstock";
      } else if (stockFilter === "lowstock") {
        typeParam = "runninglow";
      }

      const params = new URLSearchParams({
        page: page.toString(),
        reason: "",
        date: "",
        limit: itemsPerPage.toString(),
        name: searchQuery,
        shopid: effectiveShopId || "",
        type: typeParam,
        sort: sortBy,
        productid: "",
        barcodeid: "",
        productType: productType === "all" ? "" : productType,
        useWarehouse: "true",
        warehouse: shop?.warehouse?.toString() || "false",
        // Only include adminid for admin users, not attendants
        ...(isAttendant ? {} : { adminid: admin?._id || "" }),
      });

      const url = `${ENDPOINTS.products.getAll}?${params.toString()}`;
      console.log("Making API call to:", url);

      const response = await apiCall(url, {
        method: "GET",
      });

      const data = await response.json();
      console.log("Raw API response:", data);
      
      // Debug: Check reorder levels
      console.log("=== REORDER LEVEL ANALYSIS ===");
      const productsWithReorder = data.data.filter(p => p.reorderLevel && p.reorderLevel > 0);
      console.log("Products with reorder level > 0:", productsWithReorder.length);
      productsWithReorder.forEach(p => {
        console.log(`${p.name}: quantity=${p.quantity || 0}, reorderLevel=${p.reorderLevel}, virtual=${p.virtual}`);
      });
      console.log("===============================");
      
      return data;
    },
    staleTime: 0,
    enabled:
      (isAttendant ? !!localStorage.getItem("attendantData") : !!admin?._id) &&
      !!effectiveShopId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch stock analysis data
  const { data: stockAnalysis, error: stockAnalysisError } = useQuery({
    queryKey: [ENDPOINTS.analytics.stockAnalysis, effectiveShopId, true],
    queryFn: async ({ queryKey }) => {
      const warehouse = true;
      const url = `${ENDPOINTS.analytics.stockAnalysis}/?shopid=${effectiveShopId}&warehouse=${warehouse}&totalstock=true`;
      
      console.log("=== STOCK ANALYSIS QUERY TRIGGERED ===");
      console.log("Query URL:", url);
      console.log("Effective Shop ID:", effectiveShopId);
      console.log("=====================================");

      // Get auth token from localStorage
      const token = localStorage.getItem("authToken");

      const response = await fetch(url, {
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

      const stockData = await response.json();
      console.log("=== STOCK ANALYSIS API DATA ===");
      console.log("Stock Analysis Response:", stockData);
      console.log("Low Stock Count:", stockData?.lowstock);
      console.log("Out of Stock Count:", stockData?.outofstock);
      console.log("================================");
      
      return stockData;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled:
      (isAttendant ? !!localStorage.getItem("attendantData") : !!admin?._id) &&
      !!effectiveShopId,
  });

  // Check if user has permission to view products (stocks permission)
  const canViewProducts =
    hasPermission("inventory_view") ||
    hasAttendantPermission("stocks", "view_products");
  if (!canViewProducts) {
    return (
      <DashboardLayout title="Inventory">
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to view products. Contact your
                administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Extract products from the API response structure
  const products = Array.isArray(productsData?.data)
    ? productsData.data
    : Array.isArray(productsData?.products)
      ? productsData.products
      : Array.isArray(productsData)
        ? productsData
        : [];

  // Products are already filtered by the API based on stock status
  const filteredProducts = products;

  console.log("Product processing:", {
    productsData,
    extractedProducts: products,
    count: products.length,
    isLoading,
    error: error?.message,
    enabled: !!admin?._id && !!effectiveShopId,
    adminId: admin?._id,
    effectiveShopId,
  });

  // Use authentic API pagination data
  const totalProducts = productsData?.count || 0;
  const totalPages = productsData?.totalPages || 1;
  const currentPage = productsData?.currentPage || 1;
  // Use API data for accurate stats instead of filtered page data
  const lowQuantityProducts = stockAnalysis?.lowstock || 0;
  const outOfStockProducts = stockAnalysis?.outofstock || 0;
  const totalStockValue = stockAnalysis?.totalStockValue || 0;
  const profitEstimate = stockAnalysis?.profitEstimate || 0;
  const totalStockCount = stockAnalysis?.totalstock || 0;

  // Download stock data function
  const downloadStockData = async (type: 'outofstock' | 'lowstock') => {
    try {
      const token = localStorage.getItem("authToken");
      const url = `${ENDPOINTS.analytics.stockPdfFile}?shopid=${effectiveShopId}`;
      
      console.log("Downloading stock data for:", type);
      console.log("Download URL:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      
      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `stock-${type}-report.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Success",
        description: `Stock ${type === 'outofstock' ? 'out of stock' : 'low stock'} report downloaded successfully`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download stock report",
        variant: "destructive",
      });
    }
  };

  const getQuantityStatus = (product: any) => {
    // Services (virtual products) don't have stock status
    if (product.virtual) {
      return { label: "Service", variant: "outline" as const };
    }

    const qty = product.quantity || 0;
    const threshold = product.reorderLevel || product.lowStockThreshold || 0;
    if (qty <= 0)
      return { label: "Out of Stock", variant: "destructive" as const };
    if (qty <= threshold)
      return { label: "Low Quantity", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  // Function to open adjust stock dialog
  const openAdjustDialog = (product: any) => {
    setSelectedProduct(product);
    setAdjustQuantity("");
    setAdjustType("increase");
    setAdjustDialogOpen(true);
  };

  // Function to handle stock adjustment
  const handleAdjustStock = async () => {
    if (!selectedProduct || !adjustQuantity) {
      toast({
        title: "Error",
        description: "Please enter a quantity",
        variant: "destructive",
      });
      return;
    }

    setIsAdjusting(true);
    try {
      let attendantId;
      if (isAttendant) {
        const attendantData = localStorage.getItem('attendantData');
        if (attendantData) {
          try {
            const parsed = JSON.parse(attendantData);
            attendantId = parsed._id;
          } catch {
            attendantId = null;
          }
        }
      } else {
        // For admin users, get their attendant ID
        attendantId = (admin as any)?._id || (admin as any)?.id;
      }

      const qtyBefore = selectedProduct.quantity || 0;
      const delta = Number(adjustQuantity);
      const qtyAfter = adjustType === 'increase' ? qtyBefore + delta : Math.max(0, qtyBefore - delta);

      const payload = {
        shopId: getShopId(),
        productId: selectedProduct._id,
        type: adjustType === 'increase' ? 'add' : 'remove',
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
      };

      const response = await apiCall(ENDPOINTS.products.adjust(selectedProduct._id), {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to adjust stock');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: `Stock ${adjustType === 'increase' ? 'increased' : 'decreased'} by ${adjustQuantity}`,
      });

      // Close dialog and reset form
      setAdjustDialogOpen(false);
      setSelectedProduct(null);
      setAdjustQuantity("");
      
      // Invalidate and refetch all product-related queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/product') || 
                 key.includes('/api/analysis/stockanalysis') ||
                 key.includes('products') ||
                 key.includes('stock');
        }
      });
      
      // Force immediate refetch for current products data
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/product') || 
                 key.includes('/api/analysis/stockanalysis');
        }
      });
      
      // Also refresh products context for components that depend on it
      refreshProducts();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust stock",
        variant: "destructive",
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Adjustment history is now handled in standalone page

  // Function to navigate to adjustment history page
  const openHistoryDialog = (product: any) => {
    const route = isAttendant ? `/attendant/product/adjustment-history/${product._id}` : `/product/adjustment-history/${product._id}`;
    setLocation(route);
  };

  return (
    <DashboardLayout title="Stock Products">
      <div className="space-y-6">
        {/* Back button */}
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Check if we came from stock summary by looking at URL parameters
              const urlParams = new URLSearchParams(window.location.search);
              const hasFilter = urlParams.has('filter');
              
              if (hasFilter) {
                // If we came from stock summary with a filter, go back there
                const backRoute = isAttendant ? '/attendant/stock/summary' : '/stock/summary';
                setLocation(backRoute);
              } else {
                // Otherwise go to dashboard
                const backRoute = isAttendant ? '/attendant/dashboard' : '/dashboard';
                setLocation(backRoute);
              }
            }}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
        {/* Stats Cards - Show for admins always, attendants only if they have stock_summary permission */}
        {(hasPermission('inventory_view') || hasAttendantPermission("stocks", "stock_summary")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Low Quantity
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        {lowQuantityProducts}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setStockFilter(
                        stockFilter === "lowstock" ? "all" : "lowstock",
                      )
                    }
                    className={`text-xs ${stockFilter === "lowstock" ? "bg-orange-100 text-orange-700" : "text-gray-500 hover:text-orange-600"}`}
                  >
                    {stockFilter === "lowstock" ? "Show All" : "View"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Out of Stock
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {outOfStockProducts}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setStockFilter(
                        stockFilter === "outofstock" ? "all" : "outofstock",
                      )
                    }
                    className={`text-xs ${stockFilter === "outofstock" ? "bg-red-100 text-red-700" : "text-gray-500 hover:text-red-600"}`}
                  >
                    {stockFilter === "outofstock" ? "Show All" : "View"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Stock Value
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {currency} {totalStockValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Profit Estimate
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {currency} {profitEstimate.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Stock
                    </p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {totalStockCount}
                    </p>
                    <p className="text-xs text-gray-500">warehouse included</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Product Inventory</CardTitle>
            <CardDescription>
              Manage your product stock levels and information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products by name, serial number or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Stock Status Filter */}
              <Select value={stockFilter} onValueChange={(value: "all" | "outofstock" | "lowstock") => setStockFilter(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="outofstock">Out of Stock</SelectItem>
                  <SelectItem value="lowstock">Running Low</SelectItem>
                </SelectContent>
              </Select>
              
              {(hasPermission("inventory_add") ||
                hasAttendantPermission("stocks", "add_products") ||
                hasAttendantPermission("products", "add")) && (
                <Link href={addProductRoute}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </Link>
              )}
            </div>

            {/* Products Table */}
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Product</th>
                      <th className="text-left p-4 font-medium">SKU</th>
                      <th className="text-left p-4 font-medium">Selling Price</th>
                      {(hasPermission("inventory_view") ||
                        hasAttendantPermission(
                          "stocks",
                          "view_buying_price",
                        )) && <th className="text-left p-4 font-medium">Buying Price</th>}
                      <th className="text-left p-4 font-medium">Quantity</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center p-8 text-gray-500"
                        >
                          Loading products...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center p-8 text-gray-500"
                        >
                          No products found
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product: Product) => {
                        const stockStatus = getQuantityStatus(product);
                        const quantity = (product as any).quantity || 0;
                        const reorderLevel = (product as any).reorderLevel || 0;
                        const isVirtual = (product as any).virtual;
                        const isLowStock =
                          !isVirtual &&
                          quantity > 0 &&
                          reorderLevel > 0 &&
                          quantity <= reorderLevel;
                        const isOutOfStock = !isVirtual && quantity === 0;

                        // No background styling for services (virtual products)
                        let rowBgClass = "";
                        if (!isVirtual) {
                          if (isOutOfStock) {
                            rowBgClass = "bg-red-50 hover:bg-red-100";
                          } else if (isLowStock) {
                            rowBgClass = "bg-amber-50 hover:bg-amber-100";
                          }
                        }

                        return (
                          <tr
                            key={product._id}
                            className={`border-b hover:bg-gray-50 ${rowBgClass}`}
                          >
                            <td className="p-4">
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-500">
                                  {(product as any).productCategoryId?.name ||
                                    product.category ||
                                    "No Category"}
                                </p>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {(product as any).barcode || "-"}
                            </td>
                            <td className="p-4 font-medium">
                              {currency}{" "}
                              {(
                                (product as any).sellingPrice ||
                                product.price ||
                                0
                              ).toLocaleString()}
                            </td>
                            {(hasPermission("inventory_view") ||
                              hasAttendantPermission(
                                "stocks",
                                "view_buying_price",
                              )) && (
                              <td className="p-4 font-medium">
                                {currency}{" "}
                                {(
                                  (product as any).buyingPrice ||
                                  0
                                ).toLocaleString()}
                              </td>
                            )}
                            <td className="p-4">
                              {isVirtual ? (
                                <span className="text-gray-500 font-medium">
                                  N/A
                                </span>
                              ) : (
                                <span
                                  className={`font-medium ${
                                    quantity === 0
                                      ? "text-red-600"
                                      : isLowStock
                                        ? "text-amber-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {quantity}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge variant={stockStatus.variant}>
                                {stockStatus.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48"
                                >
                                  {(hasPermission("inventory_history") ||
                                    hasAttendantPermission(
                                      "products",
                                      "view_history",
                                    )) && (
                                    <DropdownMenuItem
                                      className="flex items-center space-x-2"
                                      onClick={() =>
                                        setLocation(
                                          `${productHistoryRoute}/${product._id}/history`,
                                        )
                                      }
                                    >
                                      <History className="h-4 w-4" />
                                      <span>Product History</span>
                                    </DropdownMenuItem>
                                  )}
                                  {(hasPermission("inventory_edit") ||
                                    hasAttendantPermission(
                                      "products",
                                      "edit",
                                    )) && (
                                    <DropdownMenuItem
                                      className="flex items-center space-x-2"
                                      onClick={() => {
                                        const bundleItems =
                                          (product as any).bundleItems ||
                                          (product as any).items ||
                                          [];

                                        // Pass data through navigation state instead of sessionStorage
                                        console.log(
                                          "Passing product data to edit form:",
                                          product,
                                        );
                                        (window as any).productEditData = {
                                          bundleItems: bundleItems,
                                          productData: product,
                                          passedBundleItems: true,
                                        };

                                        // Use client-side navigation without page reload
                                        setLocation(
                                          `${editProductRoute}/${product._id}`,
                                        );
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                  )}

                                  {/* Hide stock adjustment options for services (virtual products) */}
                                  {!(product as any).virtual && (hasPermission("inventory_adjust") ||
                                    hasAttendantPermission(
                                      "products",
                                      "adjust_stock",
                                    )) && (
                                    <DropdownMenuItem 
                                      className="flex items-center space-x-2"
                                      onClick={() => openAdjustDialog(product)}
                                    >
                                      <TrendingUp className="h-4 w-4" />
                                      <span>Adjust Stock</span>
                                    </DropdownMenuItem>
                                  )}

                                  {/* Hide adjustment history for services (virtual products) */}
                                  {!(product as any).virtual && (hasPermission("inventory_history") ||
                                    hasAttendantPermission(
                                      "products",
                                      "view_adjustment_history",
                                    )) && (
                                    <DropdownMenuItem 
                                      className="flex items-center space-x-2"
                                      onClick={() => openHistoryDialog(product)}
                                    >
                                      <FileText className="h-4 w-4" />
                                      <span>Adjustment History</span>
                                    </DropdownMenuItem>
                                  )}

                                  {(hasPermission("inventory_delete") ||
                                    hasAttendantPermission(
                                      "products",
                                      "delete",
                                    )) && (
                                    <DropdownMenuItem className="flex items-center space-x-2 text-red-600 focus:text-red-600">
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(1); // Reset to first page when changing items per page
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, totalProducts)} of{" "}
                  {totalProducts} products
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {(() => {
                    const pages = [];

                    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={currentPage === i ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(i)}
                          className="w-8 h-8 p-0"
                        >
                          {i}
                        </Button>,
                      );
                    }

                    return pages;
                  })()}
                </div>

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
          </CardContent>
        </Card>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Adjust the stock quantity for {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="adjustType" className="text-right">
                Type
              </Label>
              <Select value={adjustType} onValueChange={(value: "increase" | "decrease") => setAdjustType(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase Stock</SelectItem>
                  <SelectItem value="decrease">Decrease Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                className="col-span-3"
                placeholder="Enter quantity"
                min="1"
              />
            </div>

          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAdjustDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdjustStock}
              disabled={isAdjusting || !adjustQuantity}
            >
              {isAdjusting ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </DashboardLayout>
  );
}
