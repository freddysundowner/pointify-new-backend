import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENDPOINTS } from "@/lib/api-endpoints";
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
  Download
} from "lucide-react";
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
import autoTable from 'jspdf-autotable';
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
  const currency = useCurrency();
  const [, setLocation] = useLocation();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const { toast } = useToast();
  const purchasesRoute = useNavigationRoute("purchases");
  const addPurchasesRoute = useNavigationRoute("addPurchase");

  // Get shop and admin data - use Redux state for shop ID
  const primaryShop =
    typeof admin?.primaryShop === "object" ? admin.primaryShop : null;
  const shopId = selectedShopId || (primaryShop as any)?._id;

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

    // Date filtering - use wider range if no dates set to catch recent purchases
    if (startDate) {
      params.append("start", startDate);
    }
    if (endDate) {
      params.append("end", endDate);
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
      const response = await apiRequest('DELETE', ENDPOINTS.purchases.delete(purchaseId));
      return response.json();
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
      items: (purchase.items || []).map((item: any) => ({
        productName: item.product?.name || "Unknown Product",
        quantity: item.quantity || 0,
        unitCost: item.unitPrice || 0,
        totalCost: (item.quantity || 0) * (item.unitPrice || 0),
        received: item.received || item.quantity || 0,
      })),
      totalAmount: purchase.totalAmount || 0,
      orderDate: purchase.createdAt || new Date().toISOString(),
      expectedDate: purchase.expectedDate,
      receivedDate: purchase.receivedDate,
      status:
        purchase.amountPaid >= purchase.totalAmount && purchase.totalAmount > 0
          ? "paid"
          : "unpaid",
      invoiceNumber: purchase.purchaseNo || purchase._id,
      currency: purchase.shopId?.currency || "KES",
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
      (p: any) => p._id === purchase.id,
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
    if (
      window.confirm(
        `Are you sure you want to delete purchase ${purchase.invoiceNumber}? This action cannot be undone.`,
      )
    ) {
      deletePurchaseMutation.mutate(purchase.id);
    }
  };

  const handleCreatePurchase = () => {
    setLocation('/purchases/order');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString();
    
    // Header styling
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE REPORT', 105, 25, { align: 'center' });
    
    // Company info section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${currentDate}`, 20, 45);
    doc.text(`Shop: ${selectedShopId ? 'Shop One' : 'All Shops'}`, 20, 55);
    doc.text(`Report Period: ${startDate} to ${endDate}`, 20, 65);
    
    // Summary section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', 20, 85);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Purchases: ${filteredOrdersCount}`, 20, 95);
    doc.text(`Total Amount: ${filteredPurchases[0]?.currency || 'KES'} ${filteredTotalAmount.toLocaleString()}`, 20, 105);
    doc.text(`Paid Amount: ${filteredPurchases[0]?.currency || 'KES'} ${filteredSpent.toLocaleString()}`, 20, 115);
    doc.text(`Unpaid Count: ${filteredUnpaidCount}`, 20, 125);
    doc.text(`Unique Suppliers: ${filteredSuppliers}`, 20, 135);
    
    // Prepare table data
    const tableData = filteredPurchases.map((purchase: any) => [
      purchase.invoiceNumber || 'N/A',
      purchase.supplierName || 'N/A',
      new Date(purchase.orderDate).toLocaleDateString(),
      `${purchase.currency} ${purchase.totalAmount.toLocaleString()}`,
      purchase.status.toUpperCase(),
      purchase.items.length.toString()
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 150,
      head: [['PO Number', 'Supplier', 'Date', 'Amount', 'Status', 'Items']],
      body: tableData,
      styles: { 
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: { 
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 20, right: 20 }
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
      <DashboardLayout title="Purchase Reports">
        <div className="p-4 w-full">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackClick}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Purchase Reports
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Shop One
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <h3 className="text-lg font-semibold mb-2">
                Service Temporarily Unavailable
              </h3>
              <p className="text-gray-600 mb-4">
                The external API is experiencing issues. Please try again in a
                few moments.
              </p>
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
    <DashboardLayout title="Purchase Reports">
      <div className="p-4 w-full">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackClick}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Purchase Reports
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Shop One
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={exportToPDF}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
              {(isAdmin || hasAttendantPermission("stocks", "add_purchases")) && (
                <Link href={addPurchasesRoute}>
                  <Button onClick={handleCreatePurchase}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Purchase Order
                </Button></Link>
              )}
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-3"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            </div>

            <div className="space-y-4">
              {/* Search Bar - Full Width */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Search</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by purchase number..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearchChange("")}
                      className="h-9 px-3"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Found {filteredPurchases.length} results for "{searchQuery}"
                  </p>
                )}
              </div>

              {/* Filter Row - Horizontal Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Status
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={handleStatusFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Supplier Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Supplier
                  </Label>
                  <Select
                    value={supplierFilter}
                    onValueChange={handleSupplierFilter}
                  >
                    <SelectTrigger className="h-9">
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

                {/* Attendant Filter - Only show for admins */}
                {isAdmin && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Attendant
                    </Label>
                    <Select
                      value={attendantFilter}
                      onValueChange={handleAttendantFilter}
                    >
                      <SelectTrigger className="h-9">
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
              </div>

              {/* Date Range Section */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Date Range
                </Label>
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="flex-1">
                      <Label
                        htmlFor="start-date"
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Start Date
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="flex-1">
                      <Label
                        htmlFor="end-date"
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        End Date
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {(startDate || endDate) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {filteredPurchases.length} results from{" "}
                    {startDate || "beginning"} to {endDate || "now"}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card className="mb-4">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading purchases data...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="mb-4">
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

        {/* Summary Stats */}
        {!isLoading && !error && analyticsData && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Purchases
                  </p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {currency} {parseFloat(String(analyticsData?.totalAmount || 0)).toFixed(2)}
                  </p>
                </div>
                <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Cash Purchases
                  </p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {currency} {parseFloat(String(analyticsData?.totalPaid || 0)).toFixed(2)}
                  </p>
                </div>
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Unpaid Purchases
                  </p>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {currency} {parseFloat(String(analyticsData?.totalOutstanding || 0)).toFixed(2)}
                  </p>
                </div>
                <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Amount Paid
                  </p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {currency} {parseFloat(String(analyticsData?.totalPaid || 0)).toFixed(2)}
                  </p>
                </div>
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Returns
                  </p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {currency} {parseFloat(String(analyticsData?.totalOutstanding || 0)).toFixed(2)}
                  </p>
                </div>
                <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </Card>


          </div>
        )}

        {/* Purchases Table */}
        {!isLoading && !error && (
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <CardTitle className="text-lg">
                  Purchase Orders
                  {statusFilter !== "all" && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      -{" "}
                      {statusFilter.charAt(0).toUpperCase() +
                        statusFilter.slice(1)}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="items-per-page" className="whitespace-nowrap">
                    Show:
                  </Label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={handleItemsPerPageChange}
                  >
                    <SelectTrigger className="w-16 h-8">
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
              <div className="overflow-x-auto">
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
                            {purchase.invoiceNumber}
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
                                      {purchase.invoiceNumber || "Pending"}
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
      </div>
    </DashboardLayout>
  );
}
