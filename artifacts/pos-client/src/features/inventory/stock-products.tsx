import { useState, useMemo, useEffect } from "react";
import { extractId } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Package, AlertTriangle, TrendingUp, Edit, MoreVertical, History, Trash2, ArrowLeft, FileText, Download, Mail, ChevronDown, Loader2 } from "lucide-react";
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [productType, setProductType] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [stockFilter, setStockFilter] = useState<
    "all" | "outofstock" | "lowstock" | "highstock" | "expiring"
  >("all");
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
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

  // Delete product state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Debounce search — wait 400ms after last keystroke before querying API
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, productType, sortBy, stockFilter]);

  // Get effective shop ID from Redux state or fallback to admin/attendant data
  const getShopId = () => {
    if (selectedShopId) return selectedShopId;

    if (isAttendant) {
      // For attendants, get shop ID from attendant data
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

    // For admins, use admin data
    return String(extractId(admin?.primaryShop) ?? '');
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
      debouncedSearch,
      selectedCategory,
      productType,
      sortBy,
      stockFilter,
    ],
    queryFn: async ({ queryKey }) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        search: debouncedSearch,
        shopId: effectiveShopId || "",
        ...(stockFilter === "outofstock" ? { stockStatus: "outofstock" } : {}),
        ...(stockFilter === "lowstock" ? { stockStatus: "lowstock" } : {}),
        ...(stockFilter === "expiring" ? { stockStatus: "expiring", sort: "expiring" } : {}),
        ...(stockFilter === "highstock" ? { sort: "qty_desc" } : {}),
        ...(selectedCategory !== "all" ? { categoryId: selectedCategory } : {}),
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
      (isAttendant ? !!localStorage.getItem("attendantData") : !!(admin?.id ?? (admin as any)?._id)) &&
      !!effectiveShopId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch product categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: [ENDPOINTS.products.getCategories, effectiveShopId],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.products.getCategories, { method: "GET" });
      return response.json();
    },
    enabled: !!effectiveShopId,
    staleTime: 60_000,
  });
  const categories: any[] = categoriesData?.data ?? categoriesData ?? [];

  // Fetch stock analysis data
  const { data: stockAnalysis, error: stockAnalysisError } = useQuery({
    queryKey: [ENDPOINTS.analytics.stockAnalysis, effectiveShopId],
    queryFn: async () => {
      const url = `${ENDPOINTS.analytics.stockAnalysis}?shopId=${effectiveShopId}`;
      const token = localStorage.getItem("authToken");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const json = await response.json();
      return json.data ?? json;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled:
      (isAttendant ? !!localStorage.getItem("attendantData") : !!(admin?.id ?? (admin as any)?._id)) &&
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
  const totalProducts = productsData?.meta?.total || 0;
  const totalPages = productsData?.meta?.totalPages || 1;
  const currentPage = productsData?.meta?.page || 1;
  const stockSummary = stockAnalysis ?? {};
  const lowQuantityProducts = Number(stockSummary?.lowstock ?? 0);
  const outOfStockProducts = Number(stockSummary?.outofstock ?? 0);
  const totalStockValue = Number(stockSummary?.totalStockValue ?? stockSummary?.totalValue ?? 0);
  const profitEstimate = Number(stockSummary?.profitEstimate ?? 0);
  const totalStockCount = Number(stockSummary?.totalstock ?? stockSummary?.totalQuantity ?? 0);

  // Download stock data function
  const downloadStockData = async (type: 'outofstock' | 'lowstock') => {
    try {
      const token = localStorage.getItem("authToken");
      const url = `${ENDPOINTS.analytics.stockPdfFile}?shopId=${effectiveShopId}`;
      
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

  // Build export URL params (same filters, no pagination)
  const buildExportParams = (action: "download" | "email", toEmail?: string) => {
    const p = new URLSearchParams({
      action,
      shopId: effectiveShopId || "",
      search: debouncedSearch,
      filterKey: stockFilter,
      ...(stockFilter === "outofstock" ? { stockStatus: "outofstock" } : {}),
      ...(stockFilter === "lowstock" ? { stockStatus: "lowstock" } : {}),
      ...(stockFilter === "expiring" ? { stockStatus: "expiring", sort: "expiring" } : {}),
      ...(stockFilter === "highstock" ? { sort: "qty_desc" } : {}),
      ...(selectedCategory !== "all" ? { categoryId: selectedCategory } : {}),
      ...(toEmail ? { to: toEmail } : {}),
    });
    return p.toString();
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("authToken");
      const url = `${ENDPOINTS.products.export}?${buildExportParams("download")}`;
      const response = await fetch(url, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const cd = response.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      link.download = match ? match[1] : `stock-report-${stockFilter}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Downloaded", description: "Stock report saved as CSV." });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) return;
    setIsEmailing(true);
    try {
      const token = localStorage.getItem("authToken");
      const url = `${ENDPOINTS.products.export}?${buildExportParams("email")}&to=${encodeURIComponent(emailAddress.trim())}`;
      const response = await fetch(url, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? `${response.status}`);
      if (data?.sent === false) throw new Error(data?.reason ?? "Email not sent");
      toast({ title: "Email sent", description: `Stock report sent to ${emailAddress.trim()}.` });
      setEmailDialogOpen(false);
    } catch (err) {
      toast({ title: "Email failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setIsEmailing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("authToken");
      const id = productToDelete._id ?? productToDelete.id;
      const response = await apiCall(ENDPOINTS.products.delete(String(id)), {
        method: "DELETE",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? `Error ${response.status}`);
      }
      toast({ title: "Deleted", description: `"${productToDelete.name}" has been removed.` });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
      refreshProducts();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Could not delete product.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getQuantityStatus = (product: any) => {
    // Services and virtual products don't have stock status
    if (product.type === "virtual" || product.type === "service") {
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

      const productId = selectedProduct.id ?? selectedProduct._id;
      const payload = {
        shopId: getShopId(),
        productId,
        type: adjustType === 'increase' ? 'add' : 'remove',
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
      };

      const response = await apiCall(ENDPOINTS.products.adjust(productId), {
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
      
      // Invalidate product list and stock analysis summary
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/products') || 
                 key.includes('/api/reports/inventory');
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
    const pid = product.id ?? product._id;
    const route = isAttendant ? `/attendant/product/adjustment-history/${pid}` : `/product/adjustment-history/${pid}`;
    setLocation(route);
  };

  return (
    <DashboardLayout title="Stock Products">
      <div className="space-y-3">

        {/* Page header: back + title + add button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                  return;
                }
                const urlParams = new URLSearchParams(window.location.search);
                const hasFilter = urlParams.has('filter');
                if (hasFilter) {
                  setLocation(isAttendant ? '/attendant/stock/summary' : '/stock/summary');
                } else {
                  setLocation(isAttendant ? '/attendant/dashboard' : '/dashboard');
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-base font-semibold">Products</h1>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs px-3" disabled={isExporting || isEmailing}>
                  {isExporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  Export
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleDownload} disabled={isExporting}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setEmailAddress((shop as any)?.warehouseEmail || (shop as any)?.receiptEmail || "");
                  setEmailDialogOpen(true);
                }} disabled={isEmailing}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send by Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(hasPermission("inventory_add") ||
              hasAttendantPermission("stocks", "add_products") ||
              hasAttendantPermission("products", "add")) && (
              <Link href={addProductRoute}>
                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-xs px-3">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Product
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Email export dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Send Stock Report</DialogTitle>
              <DialogDescription>
                The current filtered stock list will be sent as a CSV attachment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="export-email" className="text-sm">Email address</Label>
              <Input
                id="export-email"
                type="email"
                placeholder="e.g. manager@shop.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(); }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSendEmail} disabled={isEmailing || !emailAddress.trim()}>
                {isEmailing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Sending…</> : <><Mail className="h-3.5 w-3.5 mr-1" />Send</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats strip */}
        {(hasPermission('inventory_view') || hasAttendantPermission("stocks", "stock_summary")) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <Card className="cursor-pointer" onClick={() => setStockFilter(stockFilter === "lowstock" ? "all" : "lowstock")}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">Low Qty</p>
                    <p className={`text-lg font-bold leading-tight ${stockFilter === "lowstock" ? "text-orange-600" : "text-orange-500"}`}>{lowQuantityProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer" onClick={() => setStockFilter(stockFilter === "outofstock" ? "all" : "outofstock")}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">Out of Stock</p>
                    <p className={`text-lg font-bold leading-tight ${stockFilter === "outofstock" ? "text-red-700" : "text-red-500"}`}>{outOfStockProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">Stock Value</p>
                    <p className="text-sm font-bold text-green-600 leading-tight truncate">{currency} {totalStockValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">Profit Est.</p>
                    <p className="text-sm font-bold text-purple-600 leading-tight truncate">{currency} {profitEstimate.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">Total Stock</p>
                    <p className="text-lg font-bold text-indigo-600 leading-tight">{totalStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter bar + table */}
        <Card>
          <CardContent className="p-3">
            {/* Single-row filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search by name, SKU or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-36">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id ?? cat._id} value={String(cat.id ?? cat._id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={(value: "all" | "outofstock" | "lowstock" | "highstock" | "expiring") => setStockFilter(value)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-36">
                  <SelectValue placeholder="All Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="outofstock">Out of Stock</SelectItem>
                  <SelectItem value="lowstock">Running Low</SelectItem>
                  <SelectItem value="highstock">Highest Stock</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Products — mobile cards */}
            {isLoading ? (
              <div className="sm:hidden text-center py-8 text-gray-500 text-sm">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="sm:hidden text-center py-8 text-gray-500 text-sm">No products found</div>
            ) : (
              <div className="sm:hidden divide-y rounded-md border">
                {filteredProducts.map((product: Product) => {
                  const stockStatus = getQuantityStatus(product);
                  const quantity = (product as any).quantity || 0;
                  const reorderLevel = (product as any).reorderLevel || 0;
                  const isVirtual = (product as any).type === "virtual" || (product as any).type === "service";
                  const isLowStock = !isVirtual && quantity > 0 && reorderLevel > 0 && quantity <= reorderLevel;
                  const isOutOfStock = !isVirtual && quantity === 0;
                  const cardBg = isOutOfStock ? "bg-red-50" : isLowStock ? "bg-amber-50" : "";
                  return (
                    <div key={(product as any).id ?? product._id} className={`flex items-center gap-2 px-3 py-2.5 ${cardBg}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs leading-tight truncate">{product.name}</p>
                        <p className="text-[11px] text-gray-500 leading-tight truncate">{(product as any).category?.name || "No Category"}</p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5">{currency} {((product as any).sellingPrice || product.price || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          {isVirtual ? (
                            <span className="text-xs text-gray-400">Service</span>
                          ) : (
                            <span className={`text-sm font-bold ${isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-green-600"}`}>
                              {quantity}
                            </span>
                          )}
                          <p className="text-[10px] text-gray-400 leading-none">units</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {(hasPermission("inventory_history") || hasAttendantPermission("products", "view_history")) && (
                              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => setLocation(`${productHistoryRoute}/${(product as any).id ?? product._id}/history`)}>
                                <History className="h-3.5 w-3.5" />
                                Product History
                              </DropdownMenuItem>
                            )}
                            {(hasPermission("inventory_edit") || hasAttendantPermission("products", "edit")) && (
                              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => {
                                const bundleItems = (product as any).bundleItems || (product as any).items || [];
                                (window as any).productEditData = { bundleItems, productData: product, passedBundleItems: true };
                                setLocation(`${editProductRoute}/${(product as any).id ?? product._id}`);
                              }}>
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {!(product as any).virtual && (hasPermission("inventory_adjust") || hasAttendantPermission("products", "adjust_stock")) && (
                              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => openAdjustDialog(product)}>
                                <TrendingUp className="h-3.5 w-3.5" />
                                Adjust Stock
                              </DropdownMenuItem>
                            )}
                            {!(product as any).virtual && (hasPermission("inventory_history") || hasAttendantPermission("products", "view_adjustment_history")) && (
                              <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => openHistoryDialog(product)}>
                                <FileText className="h-3.5 w-3.5" />
                                Adjustment History
                              </DropdownMenuItem>
                            )}
                            {(hasPermission("inventory_delete") || hasAttendantPermission("products", "delete")) && (
                              <DropdownMenuItem
                                className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600"
                                onClick={() => { setProductToDelete(product); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Products Table — sm and above */}
            <div className="hidden sm:block rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">SKU / Barcode</th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Sell Price</th>
                      {(hasPermission("inventory_view") || hasAttendantPermission("stocks", "view_buying_price")) && (
                        <th className="text-left px-3 py-2 font-medium text-xs text-gray-600 hidden md:table-cell">Buy Price</th>
                      )}
                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Status</th>
                      <th className="px-3 py-2 font-medium text-xs text-gray-600 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500 text-sm">Loading products...</td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500 text-sm">No products found</td>
                      </tr>
                    ) : (
                      filteredProducts.map((product: Product) => {
                        const stockStatus = getQuantityStatus(product);
                        const quantity = (product as any).quantity || 0;
                        const reorderLevel = (product as any).reorderLevel || 0;
                        const isVirtual = (product as any).type === "virtual" || (product as any).type === "service";
                        const isLowStock = !isVirtual && quantity > 0 && reorderLevel > 0 && quantity <= reorderLevel;
                        const isOutOfStock = !isVirtual && quantity === 0;

                        let rowBgClass = "";
                        if (!isVirtual) {
                          if (isOutOfStock) rowBgClass = "bg-red-50 hover:bg-red-100";
                          else if (isLowStock) rowBgClass = "bg-amber-50 hover:bg-amber-100";
                        }

                        return (
                          <tr key={(product as any).id ?? product._id} className={`border-b hover:bg-gray-50 ${rowBgClass}`}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-xs leading-tight">{product.name}</p>
                              <p className="text-xs text-gray-500 leading-tight">{(product as any).category?.name || "No Category"}</p>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {(product as any).barcode || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium">
                              {currency} {((product as any).sellingPrice || product.price || 0).toLocaleString()}
                            </td>
                            {(hasPermission("inventory_view") || hasAttendantPermission("stocks", "view_buying_price")) && (
                              <td className="px-3 py-2 text-xs font-medium hidden md:table-cell">
                                {currency} {((product as any).buyingPrice || 0).toLocaleString()}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              {isVirtual ? (
                                <span className="text-xs text-gray-400">N/A</span>
                              ) : (
                                <span className={`text-xs font-semibold ${quantity === 0 ? "text-red-600" : isLowStock ? "text-amber-600" : "text-green-600"}`}>
                                  {quantity}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={stockStatus.variant} className="text-xs px-1.5 py-0">
                                {stockStatus.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {(hasPermission("inventory_history") || hasAttendantPermission("products", "view_history")) && (
                                    <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => setLocation(`${productHistoryRoute}/${(product as any).id ?? product._id}/history`)}>
                                      <History className="h-3.5 w-3.5" />
                                      Product History
                                    </DropdownMenuItem>
                                  )}
                                  {(hasPermission("inventory_edit") || hasAttendantPermission("products", "edit")) && (
                                    <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => {
                                      const bundleItems = (product as any).bundleItems || (product as any).items || [];
                                      (window as any).productEditData = { bundleItems, productData: product, passedBundleItems: true };
                                      setLocation(`${editProductRoute}/${(product as any).id ?? product._id}`);
                                    }}>
                                      <Edit className="h-3.5 w-3.5" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {!(product as any).virtual && (hasPermission("inventory_adjust") || hasAttendantPermission("products", "adjust_stock")) && (
                                    <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => openAdjustDialog(product)}>
                                      <TrendingUp className="h-3.5 w-3.5" />
                                      Adjust Stock
                                    </DropdownMenuItem>
                                  )}
                                  {!(product as any).virtual && (hasPermission("inventory_history") || hasAttendantPermission("products", "view_adjustment_history")) && (
                                    <DropdownMenuItem className="flex items-center gap-2 text-xs" onClick={() => openHistoryDialog(product)}>
                                      <FileText className="h-3.5 w-3.5" />
                                      Adjustment History
                                    </DropdownMenuItem>
                                  )}
                                  {(hasPermission("inventory_delete") || hasAttendantPermission("products", "delete")) && (
                                    <DropdownMenuItem
                                      className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600"
                                      onClick={() => { setProductToDelete(product); setDeleteDialogOpen(true); }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
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

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 mt-1">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                  className="border rounded px-1.5 py-0.5 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="hidden sm:inline">
                  {totalProducts > 0 ? `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalProducts)} of ${totalProducts}` : "0 products"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                  Previous
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(i => (
                  <Button key={i} variant={currentPage === i ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setPage(i)}>
                    {i}
                  </Button>
                ))}
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
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


      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!isDeleting) { setDeleteDialogOpen(open); if (!open) setProductToDelete(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{productToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setProductToDelete(null); }} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
