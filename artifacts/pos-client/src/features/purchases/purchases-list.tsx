import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  TrendingDown,
  Package,
  Truck,
  Users,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  FileText,
  Eye,
  MoreHorizontal,
  Plus,
  DollarSign,
  RefreshCw,
  ArrowLeft,
  RotateCcw,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import React, { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useAuth } from "@/features/auth/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Purchase, PurchaseItem } from "@shared/schema";
import PurchaseOrderDialog from "./purchase-order-dialog";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { useCurrency } from "@/utils";

// Purchases data now comes from API

export default function PurchasesList() {
  const [, navigate] = useLocation();
  const { hasPermission } = usePermissions();
  const { hasAttendantPermission } = usePermissions();
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { attendant, refreshAttendantData, isRefreshing } = useAttendantAuth();

  // Determine if current user is admin (not attendant)
  const isAdmin = !!admin && !localStorage.getItem("attendantData");

  const handleBackClick = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (isAdmin) {
      navigate("/");
    } else {
      navigate("/attendant/dashboard");
    }
  };

  const shortPurchaseNo = (no: string | undefined) => {
    if (!no) return "—";
    const digits = no.replace(/\D/g, "");
    return digits.length >= 6 ? "PUR-" + digits.slice(-6) : no;
  };

  // Check if user has permission to view purchases - admins always have access, attendants need permission
  const canViewPurchases =
    isAdmin || hasAttendantPermission("stocks", "view_purchases");
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [attendantFilter, setAttendantFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<any>(null);
  const currency = useCurrency();

  const activeFilterCount = [
    searchQuery.trim() !== "",
    statusFilter !== "all",
    supplierFilter !== "all",
    attendantFilter !== "all",
    startDate !== "",
    endDate !== "",
  ].filter(Boolean).length;
  const [, setLocation] = useLocation();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const { toast } = useToast();
  const purchasesRoute = useNavigationRoute("purchases");
  const addPurchasesRoute = useNavigationRoute("addPurchase");

  // Get shop and admin data - use Redux state for shop ID
  const primaryShop =
    typeof admin?.primaryShop === "object" ? admin.primaryShop : null;
  const shopId = selectedShopId || (primaryShop as any)?._id;
  const shopDetails = useShopDetails(shopId);

  // Get attendant ID properly: for attendants use attendant._id, for admins use admin data
  const attendantId =
    attendant?._id ||
    (admin?.attendantId as any)?._id ||
    admin?.attendantId ||
    admin?._id;

  // Fetch suppliers data for filter dropdown
  const { data: suppliersData = [] } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    enabled: !!shopId,
  });

  // Fetch attendants data for filter dropdown (only for admins)
  const showAttendantFilter = true; // Show attendant filter for all users for now
  const { data: attendantsData = [] } = useQuery({
    queryKey: [ENDPOINTS.attendants.getByShop, shopId],
    queryFn: async () => {
      if (!shopId || !showAttendantFilter) return [];
      const response = await apiRequest('GET', `${ENDPOINTS.attendants.getByShop}?shopId=${shopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    enabled: !!shopId && showAttendantFilter,
  });

  // Build query parameters for purchases filter
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (shopId) params.append("shopId", shopId);

    // For attendant filter: attendants always see only their own purchases, admins can filter by attendant
    if (!isAdmin && attendantId) {
      // Attendants always filtered by their own ID
      params.append("attendantId", attendantId);
    } else if (isAdmin && attendantFilter !== "all") {
      // Admins can filter by specific attendant
      params.append("attendantId", attendantFilter);
    }

    // Date filtering
    if (startDate) {
      params.append("from", startDate);
    }
    if (endDate) {
      params.append("to", endDate);
    }

    // Add payment type filter if needed
    if (statusFilter !== "all") {
      // Map status to payment type: paid -> cash, unpaid -> credit
      const paymentType = statusFilter === "paid" ? "cash" : "credit";
      params.append("paymentType", paymentType);
    }

    // Add supplier filter if needed
    if (supplierFilter !== "all") {
      params.append("supplierId", supplierFilter);
    }

    // Add search query if provided (search by purchase number only)
    if (searchQuery.trim()) {
      params.append("purchaseNo", searchQuery.trim());
    }

    return params.toString();
  };

  // Fetch purchases data from API
  const {
    data: purchasesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      ENDPOINTS.purchases.getAll,
      shopId,
      attendantId,
      startDate,
      endDate,
      statusFilter,
      supplierFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      // Add timestamp to force cache busting
      const timestamp = Date.now();
      const response = await apiRequest('GET', `${ENDPOINTS.purchases.getAll}?${queryParams}&_t=${timestamp}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    // enabled: !!shopId && canViewPurchases,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const purchasesData = Array.isArray(purchasesResponse)
    ? purchasesResponse
    : [];

  // Get purchases analytics for summary cards
  const { data: analyticsData } = useQuery({
    queryKey: [
      ENDPOINTS.purchases.reportFilter,
      shopId,
      startDate,
      endDate,
      supplierFilter,
      attendantFilter,
      statusFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (shopId) params.append("shopId", shopId);
      if (startDate) params.append("fromDate", startDate);
      if (endDate) params.append("toDate", endDate);

      // Add supplier filter to analytics
      if (supplierFilter !== "all") {
        params.append("supplierId", supplierFilter);
      }

      // Add status filter to analytics (map to payment type)
      if (statusFilter !== "all") {
        const paymentType = statusFilter === "paid" ? "cash" : "credit";
        params.append("paymentType", paymentType);
      }

      // Only add attendant filter to analytics if no supplier filter (API doesn't support both)
      if (supplierFilter === "all") {
        if (attendantFilter !== "all" && isAdmin) {
          params.append("attendantId", attendantFilter);
        } else if (!isAdmin && attendantId) {
          params.append("attendantId", attendantId);
        }
      }

      // Add search query if provided (search by purchase number only)
      if (searchQuery.trim()) {
        params.append("purchaseNo", searchQuery.trim());
      }

      // Add timestamp to force cache busting
      const timestamp = Date.now();
      const response = await apiRequest('GET', `${ENDPOINTS.purchases.reportFilter}?${params}&_t=${timestamp}`);
      const json = await response.json();
      return json.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Delete purchase mutation
  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      await apiRequest('DELETE', ENDPOINTS.purchases.delete(purchaseId));
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Purchase deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.getAll] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete purchase",
        variant: "destructive",
      });
    },
  });

  // Create supplier lookup map for ID to name mapping
  const supplierMap = (Array.isArray(suppliersData) ? suppliersData : []).reduce((acc: any, supplier: any) => {
    acc[supplier._id || supplier.id] = supplier.name;
    return acc;
  }, {});

  // Transform API data to match expected format - API already handles filtering
  const filteredPurchases = purchasesData
    .map((purchase: any) => ({
      id: purchase._id || purchase.id,
      supplierName: purchase.supplier?.name || 
                   purchase.supplierId?.name || 
                   supplierMap[purchase.supplierId] || 
                   "Direct Purchase",
      items: (purchase.purchaseItems || purchase.items || []).map((item: any) => ({
        productName: item.product?.name || "Unknown Product",
        quantity: parseFloat(String(item.quantity || 0)),
        unitCost: parseFloat(String(item.unitPrice || 0)),
        totalCost: parseFloat(String(item.quantity || 0)) * parseFloat(String(item.unitPrice || 0)),
        received: parseFloat(String(item.received || item.quantity || 0)),
      })),
      totalAmount: parseFloat(String(purchase.totalAmount || 0)),
      orderDate: purchase.createdAt || new Date().toISOString(),
      expectedDate: purchase.expectedDate,
      receivedDate: purchase.receivedDate,
      status:
        parseFloat(String(purchase.amountPaid || 0)) >= parseFloat(String(purchase.totalAmount || 0)) && parseFloat(String(purchase.totalAmount || 0)) > 0
          ? "paid"
          : "unpaid",
      invoiceNumber: purchase.purchaseNo || purchase._id,
      currency: purchase.shopId?.currency || purchase.currency || "KES",
    }));



  // Pagination calculations
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPurchases.slice(startIndex, endIndex);
  }, [filteredPurchases, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSupplierFilter = (supplier: string) => {
    setSupplierFilter(supplier);
    setCurrentPage(1);
    // Force immediate refetch when supplier changes
    refetch();
  };

  const handleAttendantFilter = (attendant: string) => {
    setAttendantFilter(attendant);
    setCurrentPage(1);
    // Force immediate refetch when attendant changes
    refetch();
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Clear all filters function
  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setAttendantFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const toggleRowExpansion = (purchaseId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(purchaseId)) {
      newExpanded.delete(purchaseId);
    } else {
      newExpanded.add(purchaseId);
    }
    setExpandedRows(newExpanded);
  };

  // Action handlers
  const handleViewPurchase = (purchase: any) => {
    // Find the original purchase data from API to pass complete data
    const originalPurchase = purchasesData.find(
      (p: any) => p._id === purchase.id,
    );
    setLocation(`${purchasesRoute}/view/${purchase.id}`, {
      state: { purchase: originalPurchase || purchase },
    });
  };

  const handleEditPurchase = (purchase: any) => {
    const originalPurchase = purchasesData.find(
      (p: any) => (p._id || p.id) === purchase.id,
    );
    setLocation(`${purchasesRoute}/edit/${purchase.id}`, {
      state: { purchase: originalPurchase || purchase },
    });
  };

  const handlePayPurchase = (purchase: any) => {
    const originalPurchase = purchasesData.find(
      (p: any) => p._id === purchase.id,
    );
    setLocation(`${purchasesRoute}/pay/${purchase.id}`, {
      state: { purchase: originalPurchase || purchase },
    });
  };

  const handleReceiveItems = (purchase: Purchase) => {
    setLocation(`${purchasesRoute}/receive/${purchase.id}`);
  };

  const handleCancelPurchase = (purchase: Purchase) => {
    setLocation(`${purchasesRoute}/cancel/${purchase.id}`);
  };

  const handleReturnPurchase = (purchase: any) => {
    // Store purchase data in window object for immediate access (same pattern as sales)
    (window as any).__purchaseReturnData = purchase;
    setLocation(`${purchasesRoute}/return/${purchase.id}`);
  };

  const handleDeletePurchase = (purchase: any) => {
    setPurchaseToDelete(purchase);
  };

  const handleCreatePurchase = () => {
    setLocation('/purchases/order');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString();
    const periodLabel = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Until ${endDate}`
      : "All dates";
    let y = drawShopHeader(doc, shopDetails, "Purchase Report", `Period: ${periodLabel}   Generated: ${currentDate}`);
    
    const cur = currency || filteredPurchases[0]?.currency || 'KES';

    // Summary section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Purchases: ${filteredOrdersCount}`, 20, y); y += 5;
    doc.text(`Total Amount: ${cur} ${filteredTotalAmount.toFixed(2)}`, 20, y); y += 5;
    doc.text(`Paid Amount: ${cur} ${filteredSpent.toFixed(2)}`, 20, y); y += 5;
    doc.text(`Unpaid Count: ${filteredUnpaidCount}`, 20, y); y += 5;
    doc.text(`Unique Suppliers: ${filteredSuppliers}`, 20, y); y += 8;
    
    // Build flat table: one purchase header row + item rows beneath it
    type RowMeta = { type: 'purchase' | 'item-header' | 'item' };
    const tableBody: string[][] = [];
    const rowMeta: RowMeta[] = [];

    for (const purchase of filteredPurchases) {
      const shortNo = (() => {
        const s = purchase.invoiceNumber || '';
        const digits = s.replace(/\D/g, '');
        return digits.length >= 6 ? 'PUR-' + digits.slice(-6) : s || 'N/A';
      })();
      tableBody.push([
        shortNo,
        purchase.supplierName || 'Direct Purchase',
        new Date(purchase.orderDate).toLocaleDateString(),
        `${cur} ${parseFloat(String(purchase.totalAmount || 0)).toFixed(2)}`,
        purchase.status.toUpperCase(),
        `${purchase.items?.length ?? 0} item(s)`,
      ]);
      rowMeta.push({ type: 'purchase' });

      const items: any[] = purchase.items || [];
      if (items.length > 0) {
        tableBody.push(['  Product', 'Qty', 'Unit Price', 'Line Total', '', '']);
        rowMeta.push({ type: 'item-header' });
        for (const item of items) {
          tableBody.push([
            `  ${item.productName || 'Unknown'}`,
            String(item.quantity ?? ''),
            `${cur} ${parseFloat(String(item.unitCost || 0)).toFixed(2)}`,
            `${cur} ${parseFloat(String(item.totalCost || 0)).toFixed(2)}`,
            '', '',
          ]);
          rowMeta.push({ type: 'item' });
        }
      }
    }

    // Add table
    autoTable(doc, {
      startY: y,
      head: [['PO Number', 'Supplier', 'Date', 'Amount', 'Status', 'Items']],
      body: tableBody,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      margin: { left: 20, right: 20 },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const meta = rowMeta[data.row.index];
        if (!meta) return;
        if (meta.type === 'purchase') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [235, 242, 252];
        } else if (meta.type === 'item-header') {
          data.cell.styles.fontSize = 7;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 248, 248];
          data.cell.styles.textColor = [100, 100, 100];
        } else if (meta.type === 'item') {
          data.cell.styles.fontSize = 7.5;
          data.cell.styles.fillColor = [252, 252, 252];
          data.cell.styles.textColor = [60, 60, 60];
        }
      },
    });
    
    // Save the PDF
    const filename = `Purchase_Report_${startDate}_to_${endDate}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    toast({
      title: "Success",
      description: "Purchase report exported successfully",
    });
  };

  // Calculate filtered stats
  const filteredSpent = filteredPurchases
    .filter((purchase: any) => purchase.status === "paid")
    .reduce((sum: number, purchase: any) => sum + purchase.totalAmount, 0);

  const filteredTotalAmount = filteredPurchases.reduce(
    (sum: number, purchase: any) => sum + purchase.totalAmount,
    0,
  );
  const filteredOrdersCount = filteredPurchases.length;
  const filteredUnpaidCount = filteredPurchases.filter(
    (p: any) => p.status === "unpaid",
  ).length;
  const filteredSuppliers = new Set(
    filteredPurchases.map((purchase: any) => purchase.supplierName),
  ).size;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "unpaid":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Permission check is now handled above

  if (!canViewPurchases) {
    return (
      <DashboardLayout title="Purchases">
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to view purchases. Contact your
                administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Show error state if API is down
  if (error) {
    return (
      <DashboardLayout title="Purchases">
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <h3 className="text-lg font-semibold mb-2">Service Temporarily Unavailable</h3>
              <p className="text-gray-600 mb-4">The API is experiencing issues. Please try again.</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Purchases">
      <div className="-mx-4 sm:mx-0 px-0 sm:px-0 py-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleBackClick} className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {/* Mobile: Filter button */}
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden h-8 px-2.5 relative gap-1.5 text-xs"
                onClick={() => setFilterSheetOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button onClick={exportToPDF} variant="outline" size="sm" className="h-8 gap-1 text-xs px-2">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              {(isAdmin || hasAttendantPermission("stocks", "add_purchases")) && (
                <Link href={addPurchasesRoute}>
                  <Button size="sm" className="h-8 gap-1 text-xs px-2.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New Order</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-3 space-y-3">
          {/* Mobile: full-width search above stat cards */}
          <div className="sm:hidden relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by purchase number..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-9 text-sm w-full"
            />
          </div>

        {/* Compact Filters — desktop only */}
        <Card className="hidden sm:block">
          <CardContent className="p-3 space-y-2">
            {/* Row 1: search + clear */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by purchase number..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-8 px-2 shrink-0">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
            {/* Row 2: dropdowns */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="h-8 text-xs min-w-[110px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={handleSupplierFilter}>
                <SelectTrigger className="h-8 text-xs min-w-[120px]">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {(Array.isArray(suppliersData) ? suppliersData : []).map((supplier: any) => (
                    <SelectItem key={supplier._id || supplier.id} value={supplier._id || supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                  <SelectTrigger className="h-8 text-xs min-w-[120px]">
                    <SelectValue placeholder="All Attendants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attendants</SelectItem>
                    {(Array.isArray(attendantsData) ? attendantsData : []).map((attendant: any) => (
                      <SelectItem key={attendant._id || attendant.id} value={attendant._id || attendant.id}>
                        {attendant.username || attendant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Row 3: date range */}
            <div className="flex gap-2 items-center">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs flex-1" />
              <span className="text-xs text-gray-400 shrink-0">–</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </CardContent>
        </Card>

        {/* Mobile filter bottom sheet */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent side="bottom" className="sm:hidden rounded-t-2xl p-0 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="px-4 pt-4 pb-2 border-b">
              <SheetTitle className="text-base">Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 py-4 space-y-4">
              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by purchase number..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</label>
                <Select value={supplierFilter} onValueChange={handleSupplierFilter}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {(Array.isArray(suppliersData) ? suppliersData : []).map((supplier: any) => (
                      <SelectItem key={supplier._id || supplier.id} value={supplier._id || supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Attendant (admin only) */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attendant</label>
                  <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="All Attendants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendants</SelectItem>
                      {(Array.isArray(attendantsData) ? attendantsData : []).map((attendant: any) => (
                        <SelectItem key={attendant._id || attendant.id} value={attendant._id || attendant.id}>
                          {attendant.username || attendant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date range */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Range</label>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-sm flex-1" />
                  <span className="text-xs text-gray-400 shrink-0">–</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-sm flex-1" />
                </div>
              </div>

              {/* Apply button */}
              <SheetClose asChild>
                <Button className="w-full h-11 text-sm font-medium mt-2">
                  {activeFilterCount > 0 ? `Show results (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active)` : "Show results"}
                </Button>
              </SheetClose>
              <Button
                variant="ghost"
                className="w-full h-9 text-sm text-gray-500"
                onClick={clearAllFilters}
              >
                Clear all
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading purchases data...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-red-500 mb-4">
                Error loading purchases data
              </div>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats — compact horizontal scroll strip */}
        {!isLoading && !error && analyticsData && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 sm:mx-0 px-3 sm:px-0">
            {[
              { label: "Total",    value: analyticsData?.totalAmount,      color: "text-blue-600 dark:text-blue-400" },
              { label: "Paid",     value: analyticsData?.totalPaid,        color: "text-green-600 dark:text-green-400" },
              { label: "Unpaid",   value: analyticsData?.totalOutstanding, color: "text-orange-600 dark:text-orange-400" },
              { label: "Cash",     value: analyticsData?.totalPaid,        color: "text-purple-600 dark:text-purple-400" },
              { label: "Returns",  value: 0,                               color: "text-red-600 dark:text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="shrink-0 bg-white border rounded-lg px-3 py-2 min-w-[110px]">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-bold truncate ${color}`}>
                  {currency} {parseFloat(String(value || 0)).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Purchases Table */}
        {!isLoading && !error && (
          <Card className="flex-1">
            <CardHeader className="py-2 px-3 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">
                  Purchase Orders
                  {statusFilter !== "all" && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground capitalize">
                      — {statusFilter}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <span>Show</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={handleItemsPerPageChange}
                  >
                    <SelectTrigger className="w-14 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-2 py-2">
                {paginatedData.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No purchase orders found for the selected filters.</div>
                ) : paginatedData.map((purchase) => (
                  <div key={purchase.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                    <div className="px-3 py-2 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-gray-800">{shortPurchaseNo(purchase.invoiceNumber)}</span>
                          <Badge variant={getStatusBadgeVariant(purchase.status)} className="text-xs px-1.5 py-0">{purchase.status}</Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{purchase.supplierName}</p>
                        <p className="text-xs text-gray-400">{new Date(purchase.orderDate).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="text-sm font-bold text-gray-900">{purchase.currency} {parseFloat(String(purchase.totalAmount || 0)).toFixed(2)}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toggleRowExpansion(purchase.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              {expandedRows.has(purchase.id) ? "Hide Items" : "View Items"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewPurchase(purchase)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditPurchase(purchase)} disabled={purchase.status === "received" || purchase.status === "cancelled"}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Order
                            </DropdownMenuItem>
                            {parseFloat(String(purchase.outstandingBalance || 0)) > 0 && (
                              <DropdownMenuItem onClick={() => handlePayPurchase(purchase)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Make Payment
                              </DropdownMenuItem>
                            )}
                            {(purchase.status === "received" || purchase.status === "paid" || purchase.status === "completed") && (
                              <DropdownMenuItem onClick={() => handleReturnPurchase(purchase)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Return Items
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(isAdmin || hasAttendantPermission('stocks', 'delete_purchase_invoice')) && (
                              <DropdownMenuItem onClick={() => handleDeletePurchase(purchase)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Purchase
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {expandedRows.has(purchase.id) && (
                      <div className="border-t bg-blue-50 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">Order Items</p>
                        <div className="space-y-1">
                          {purchase.items.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-center text-xs bg-white rounded p-2 border border-gray-100">
                              <div>
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-gray-400">{purchase.currency} {parseFloat(String(item.unitCost || 0)).toFixed(2)} /unit</p>
                              </div>
                              <p className="font-medium">×{item.quantity}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-sm w-16">
                        Details
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        PO #
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Supplier
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Total
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Date
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Status
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((purchase) => (
                      <React.Fragment key={purchase.id}>
                        <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td
                            className="py-2 px-3 cursor-pointer"
                            onClick={() => toggleRowExpansion(purchase.id)}
                          >
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                              {expandedRows.has(purchase.id) ? "Hide" : "Show"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-sm font-mono">
                            {shortPurchaseNo(purchase.invoiceNumber)}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {purchase.supplierName}
                          </td>
                          <td className="py-2 px-3 text-sm font-medium">
                            {purchase.currency}{" "}
                            {parseFloat(String(purchase.totalAmount || 0)).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {new Date(purchase.orderDate).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={getStatusBadgeVariant(purchase.status)}
                              className="text-xs"
                            >
                              {purchase.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleViewPurchase(purchase)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEditPurchase(purchase)}
                                  disabled={
                                    purchase.status === "received" ||
                                    purchase.status === "cancelled"
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Order
                                </DropdownMenuItem>
                                {parseFloat(String(purchase.outstandingBalance || 0)) > 0 && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handlePayPurchase(purchase)
                                      }
                                    >
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Make Payment
                                    </DropdownMenuItem>
                                  )}
                                {(purchase.status === "received" || purchase.status === "paid" || purchase.status === "completed") && (
                                  <DropdownMenuItem
                                    onClick={() => handleReturnPurchase(purchase)}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Return Items
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {(isAdmin || hasAttendantPermission('stocks', 'delete_purchase_invoice')) && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeletePurchase(purchase)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Purchase
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {expandedRows.has(purchase.id) && (
                          <tr className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500">
                            <td colSpan={8} className="py-4 px-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Order Details
                                  </h4>
                                </div>
                                <div className="grid gap-2">
                                  {purchase.items.map((item, index) => (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center text-sm bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {item.productName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {purchase.currency}{" "}
                                          {parseFloat(String(item.unitCost || 0)).toFixed(2)} per unit
                                          {item.received !== undefined && (
                                            <span className="ml-2">
                                              • Received: {item.received}/
                                              {item.quantity}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">
                                          {purchase.currency}{" "}
                                          {parseFloat(String(item.totalCost || 0)).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          Qty: {item.quantity}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t-2 border-gray-200 dark:border-gray-700 text-sm">
                                  <div>
                                    <span className="font-medium">
                                      Expected:{" "}
                                    </span>
                                    <span>
                                      {purchase.expectedDate
                                        ? new Date(
                                            purchase.expectedDate,
                                          ).toLocaleDateString()
                                        : "TBD"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Invoice:{" "}
                                    </span>
                                    <span>
                                      {shortPurchaseNo(purchase.invoiceNumber) || "Pending"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    Order Total:
                                  </span>
                                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                                    {purchase.currency}{" "}
                                    {parseFloat(String(purchase.totalAmount || 0)).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {filteredPurchases.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No purchase orders found for the selected filters.
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {filteredPurchases.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredPurchases.length,
                    )}{" "}
                    of {filteredPurchases.length}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                currentPage === pageNum ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0 text-xs"
                            >
                              {pageNum}
                            </Button>
                          );
                        },
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Purchase Order Dialog */}
        <PurchaseOrderDialog
          isOpen={showPurchaseDialog}
          onClose={() => setShowPurchaseDialog(false)}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({
              queryKey: [ENDPOINTS.purchases.reportFilter],
            });
          }}
        />
        </div>{/* end space-y-3 inner */}
      </div>{/* end outer -mx-4 */}

      <AlertDialog open={!!purchaseToDelete} onOpenChange={(open) => { if (!open) setPurchaseToDelete(null); }}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Purchase</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete purchase <span className="font-medium text-gray-900">{purchaseToDelete?.invoiceNumber}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-9 text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 text-sm bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (purchaseToDelete) deletePurchaseMutation.mutate(purchaseToDelete.id);
                setPurchaseToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
