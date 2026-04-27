import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  MoreHorizontal,
  RotateCcw,
  ArrowLeft,
  FileText,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { PermissionGuard } from "@/components/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/features/auth/useAuth";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { ENDPOINTS } from "@/lib/api-endpoints";
import type { Sale } from "@shared/schema";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";

function SalesList() {
  const { hasPermission, user, hasAttendantPermission } = usePermissions();
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const [location, setLocation] = useLocation();
  const salesRoute = useNavigationRoute("sales");

  // Add attendant authentication hooks
  const { attendant, isAuthenticated: isAttendantAuth } = useAttendantAuth();
  const { userType, adminId } = usePrimaryShop();

  // Check if user is admin (has all permissions)
  const isAdmin = userType === "admin" || user?.role === "admin";

  // Back button handler
  const handleBackClick = () => {
    if (userType === "attendant") {
      setLocation("/attendant/dashboard");
    } else {
      setLocation("/dashboard");
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Initialize dates from URL parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const [startDate, setStartDate] = useState<string>(
    urlParams.get("startDate") || "",
  );
  const [endDate, setEndDate] = useState<string>(
    urlParams.get("endDate") || "",
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Set dateFilter based on URL params or default to "all"
  const [dateFilter, setDateFilter] = useState<string>(
    urlParams.get("startDate") && urlParams.get("endDate") ? "custom" : "all",
  );
  const [attendantFilter, setAttendantFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Complete Sale (hold → cashed) state
  const [completeSaleOpen, setCompleteSaleOpen] = useState(false);
  const [saleToComplete, setSaleToComplete] = useState<any>(null);
  const [completePaymentMethod, setCompletePaymentMethod] = useState("cash");
  const [completeAmountPaid, setCompleteAmountPaid] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const { toast } = useToast();

  // Get shop and admin details using usePrimaryShop hook
  const { shopId: primaryShopId } = usePrimaryShop();
  const shopId = selectedShopId || primaryShopId;
  const primaryShop =
    typeof admin?.primaryShop === "object" ? admin.primaryShop : null;
  const primaryShopCurrency = (primaryShop as any)?.currency || "KES";

  // Function to get currency for a sale - extract from shopId object
  const getSaleCurrency = (sale: any) => {
    // Extract currency from shopId object if it exists
    if (
      sale.shopId &&
      typeof sale.shopId === "object" &&
      sale.shopId.currency
    ) {
      return sale.shopId.currency;
    }
    // Fallback to primary shop currency
    return primaryShopCurrency;
  };

  // Memoize query parameters to prevent unnecessary refetches
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (shopId) params.append("shopId", shopId);
    // For attendants, filter by their attendantId to show only their sales
    if (userType === "attendant" && attendant?._id) {
      params.append("attendantId", attendant._id);
    }
    // Only add status filter if not 'all' and map frontend values to API values
    if (statusFilter !== "all") {
      if (statusFilter === "cash") {
        // For cash filter, use both status and paymentTag
        params.append("status", "cashed");
        params.append("paymentTag", "cash");
      } else if (statusFilter === "mpesa") {
        params.append("status", "cashed");
        params.append("paymentTag", "mpesa");
      } else if (statusFilter === "credit") {
        params.append("status", "cashed");
        params.append("paymentTag", "credit");
      } else if (statusFilter === "wallet") {
        params.append("status", "cashed");
        params.append("paymentTag", "wallet");
      } else if (statusFilter === "bank") {
        params.append("status", "cashed");
        params.append("paymentTag", "bank");
      } else {
        let apiStatus = statusFilter;
        if (statusFilter === "completed") apiStatus = "cashed";
        params.append("status", apiStatus);
      }
    }
    // Only add date filters if they are set (show all sales by default)
    if (startDate) {
      params.append("start", startDate);
    }
    if (endDate) {
      params.append("end", endDate);
    }
    if (searchQuery.trim()) params.append("receiptNo", searchQuery.trim());
    if (attendantFilter !== "all")
      params.append("attendantId", attendantFilter);
    params.append("page", currentPage.toString());
    params.append("limit", itemsPerPage.toString());

    return params.toString();
  }, [
    shopId,
    userType,
    attendant?._id,
    statusFilter,
    startDate,
    endDate,
    searchQuery,
    attendantFilter,
    currentPage,
    itemsPerPage,
  ]);

  // Check if query should be enabled
  const queryEnabled = !!shopId && (userType === "admin" || (userType === "attendant" && !!attendant?._id));
  
 

  // Fetch sales data from API using default query function
  const {
    data: salesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [`${ENDPOINTS.sales.getAll}?${queryParams}`],
    enabled: queryEnabled,
  });

  // Build stats query params — mirrors the list filters (same shopId, dates, attendant)
  const statsParams = useMemo(() => {
    const params = new URLSearchParams();
    if (shopId) params.append("shopId", shopId);
    if (userType === "attendant" && attendant?._id) {
      params.append("attendantId", attendant._id);
    }
    if (userType === "admin" && attendantFilter !== "all") {
      params.append("attendantId", attendantFilter);
    }
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);
    return params.toString();
  }, [shopId, userType, attendant?._id, attendantFilter, startDate, endDate]);

  // Fetch sales stats from dedicated endpoint
  const { data: salesReportData, isLoading: isReportLoading, refetch: refetchReport } = useQuery({
    queryKey: [`${ENDPOINTS.sales.stats}?${statsParams}`],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: queryEnabled,
  });

  // Refresh both the sales list and summary stats whenever the user navigates to this page
  useEffect(() => {
    const isSalesPage = location === "/sales" || location === "/attendant/sales";
    if (isSalesPage) {
      refetch();
      refetchReport();
    }
  }, [location]);

  // Also refresh on window focus (e.g. switching browser tabs back)
  useEffect(() => {
    const handleFocus = () => {
      if (location === "/sales" || location === "/attendant/sales") {
        refetch();
        refetchReport();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [location, refetch, refetchReport]);

  const salesData = (salesResponse as any)?.data || [];
  const totalCount = (salesResponse as any)?.meta?.total ?? (salesResponse as any)?.count ?? 0;
  const apiTotalPages = (salesResponse as any)?.meta?.totalPages ?? (salesResponse as any)?.totalPages ?? 1;

  // Transform API data to match expected format
  const transformedSales = salesData.map((sale: any) => ({
    id: sale.id || sale._id,
    receiptNo: sale.receiptNo || String(sale.id || sale._id || ''),
    customerName: sale.customer?.name || sale.customerId?.name || sale.customerName || "Walk-in",
    totalAmount: sale.totalWithDiscount || sale.totalAmount || 0,
    saleDate: sale.createdAt || sale.saleDate,
    status: sale.status === "cashed" ? "completed" : sale.status,
    paymentTag: sale.paymentType || sale.paymentTag || "cash",
    saleType: sale.saleType || "Retail",
    items: sale.saleItems || sale.items || [],
    attendantName: sale.attendant?.username || sale.attendantId?.username || sale.attendantName || "Admin",
    attendantId: sale.attendant?.id || sale.attendantId?._id || sale.attendant?.id,
    shopId: sale.shop || sale.shopId,
  }));

  // Fetch attendants from API - only for admin users
  const { data: attendantsResponse } = useQuery({
    queryKey: [
      `${ENDPOINTS.attendants.getByShop}?shopId=${shopId}&adminId=${adminId}`,
    ],
    enabled: userType === "admin" && !!shopId && !!adminId,
  });

  const uniqueAttendants = Array.isArray(attendantsResponse)
    ? attendantsResponse
    : (attendantsResponse as any)?.data || [];

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const setDateRange = (days: number) => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    setStartDate(startDate.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Use API data directly (no client-side pagination since API handles it)
  const paginatedData = transformedSales;

  // Reset to first page when filters change and refresh API data
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleAttendantFilter = (attendantId: string) => {
    setAttendantFilter(attendantId);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Sales action handlers - Navigate to existing pages
  const handleViewSale = (sale: any) => {
    // Pass original sale data from API, not transformed
    const originalSale = salesData.find((s: any) => s._id === sale.id);
    const saleId = sale.id;
    
    // Use dynamic routing based on user type
    const receiptRoute = userType === "attendant" ? `/attendant/receipt/${saleId}` : `/receipt/${saleId}`;
    setLocation(receiptRoute, { state: { saleData: originalSale } });
  };


  const handleReturnSale = (sale: any) => {
    // Pass original sale data from API, not transformed
    const originalSale = salesData.find((s: any) => s._id === sale.id);
    const saleId = sale.id;
    setLocation(`${salesRoute}/return/${saleId}`, {
      state: { saleData: originalSale },
    });
  };

  const handleDeleteSale = (sale: any) => {
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;

    setIsDeleting(true);
    try {
      // Call delete sale API
      const response = await fetch(ENDPOINTS.sales.delete(saleToDelete.id), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        // Refresh sales data
        refetch();
        toast({
          title: "Sale Deleted",
          description: `Sale #${saleToDelete.receiptNo} has been successfully deleted.`,
        });
      } else {
        const error = await response.text();
        toast({
          title: "Delete Failed",
          description: `Failed to delete sale: ${error}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete sale. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    }
  };

  // Complete Sale handlers
  const handleCompleteSale = (sale: any) => {
    setSaleToComplete(sale);
    setCompleteAmountPaid(Number(sale.totalAmount).toFixed(2));
    setCompletePaymentMethod("cash");
    setCompleteSaleOpen(true);
  };

  const confirmCompleteSale = async () => {
    if (!saleToComplete) return;
    setIsCompleting(true);
    try {
      const response = await apiRequest("POST", ENDPOINTS.sales.complete(saleToComplete.id), {
        paymentMethod: completePaymentMethod,
        amountPaid: parseFloat(completeAmountPaid) || saleToComplete.totalAmount,
      });
      if (response.ok) {
        refetch();
        toast({
          title: "Sale Completed",
          description: `Sale #${saleToComplete.receiptNo} has been marked as completed.`,
        });
        setCompleteSaleOpen(false);
        setSaleToComplete(null);
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        toast({
          title: "Failed to Complete Sale",
          description: err.error || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Complete Sale",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // Quotation PDF generator
  const generateQuotationPDF = (sale: any) => {
    try {
      const originalSale = salesData.find((s: any) => s._id === sale.id);
      const shop = originalSale?.shopId || {};
      const currency = shop.currency || primaryShopCurrency;
      const items: any[] = originalSale?.items || sale.items || [];

      const doc = new jsPDF();
      let y = 20;

      // Shop header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text((shop.name || "Shop").toUpperCase(), 20, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (shop.location || shop.address) {
        doc.text(shop.location || shop.address, 20, y);
        y += 6;
      }
      if (shop.contact || shop.phone) {
        doc.text(`Tel: ${shop.contact || shop.phone}`, 20, y);
        y += 6;
      }
      if (shop.receiptemail || shop.email) {
        doc.text(`Email: ${shop.receiptemail || shop.email}`, 20, y);
        y += 6;
      }
      if (shop.paybillTill || shop.paybill_till) {
        doc.text(`PayBill/Till: ${shop.paybillTill || shop.paybill_till}`, 20, y);
        y += 6;
      }

      y += 4;
      // Title
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("QUOTATION", 105, y, { align: "center" });
      y += 10;

      // Date and number row
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, 20, y);
      doc.text(`No: ${sale.receiptNo}`, 190, y, { align: "right" });
      y += 8;

      // Customer
      if (sale.customerName && sale.customerName !== "Walk-in") {
        doc.text(`Customer: ${sale.customerName}`, 20, y);
        y += 7;
      }

      y += 4;

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y - 4, 170, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.text("Item", 22, y);
      doc.text("Qty", 110, y, { align: "right" });
      doc.text("Unit Price", 145, y, { align: "right" });
      doc.text("Total", 188, y, { align: "right" });
      y += 8;
      doc.line(20, y - 2, 190, y - 2);
      doc.setFont("helvetica", "normal");

      // Items
      items.forEach((item: any) => {
        const name = item.productName || item.name || "Item";
        const qty = item.quantity || 1;
        const unitPrice = item.unitPrice || item.sellingPrice || 0;
        const total = item.totalPrice || qty * unitPrice;

        const lines = doc.splitTextToSize(name, 82);
        doc.text(lines, 22, y);
        doc.text(String(qty), 110, y, { align: "right" });
        doc.text(`${currency} ${Number(unitPrice).toFixed(2)}`, 145, y, { align: "right" });
        doc.text(`${currency} ${Number(total).toFixed(2)}`, 188, y, { align: "right" });
        y += lines.length > 1 ? lines.length * 6 : 8;
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      });

      y += 2;
      doc.line(20, y, 190, y);
      y += 8;

      // Subtotal
      const subtotal = originalSale?.totalAmount || sale.totalAmount || 0;
      const tax = originalSale?.totaltax || 0;
      const discount = originalSale?.discount || 0;
      const grandTotal = originalSale?.totalWithDiscount || subtotal;

      doc.text("Subtotal:", 145, y, { align: "right" });
      doc.text(`${currency} ${Number(subtotal).toFixed(2)}`, 188, y, { align: "right" });
      y += 7;

      if (tax > 0) {
        doc.text("Tax:", 145, y, { align: "right" });
        doc.text(`${currency} ${Number(tax).toFixed(2)}`, 188, y, { align: "right" });
        y += 7;
      }
      if (discount > 0) {
        doc.text("Discount:", 145, y, { align: "right" });
        doc.text(`- ${currency} ${Number(discount).toFixed(2)}`, 188, y, { align: "right" });
        y += 7;
      }

      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", 145, y, { align: "right" });
      doc.text(`${currency} ${Number(grandTotal).toFixed(2)}`, 188, y, { align: "right" });

      y += 12;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("Thank you for your business!", 105, y, { align: "center" });

      doc.save(`quotation-${sale.receiptNo}.pdf`);
      toast({ title: "Quotation Generated", description: `Quotation #${sale.receiptNo} downloaded.` });
    } catch (err) {
      console.error("Quotation PDF error:", err);
      toast({ title: "PDF Error", description: "Failed to generate quotation.", variant: "destructive" });
    }
  };

  // PDF Export function
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(20);
      doc.text("Sales Report", 20, 20);

      // Add shop and date information
      doc.setFontSize(12);
      const shopName = (primaryShop as any)?.name || "Shop";
      doc.text(`Shop: ${shopName}`, 20, 35);

      const dateRange =
        !startDate && !endDate
          ? `Date: ${new Date().toLocaleDateString()}`
          : startDate === endDate
            ? `Date: ${new Date(startDate).toLocaleDateString()}`
            : `Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
      doc.text(dateRange, 20, 45);

      // Add summary statistics
      const reportData = salesReportData || {};
      doc.text(
        `Total Sales: ${primaryShopCurrency} ${Number((reportData as any).totalSales || 0).toFixed(2)}`,
        20,
        60,
      );
      doc.text(`Total Transactions: ${totalCount}`, 20, 70);

      // Add transaction details manually without autoTable
      doc.setFontSize(10);
      let currentY = 90;

      // Table headers
      doc.text("#", 20, currentY);
      doc.text("Receipt No.", 35, currentY);
      doc.text("Customer", 75, currentY);
      doc.text("Date", 120, currentY);
      doc.text("Status", 155, currentY);
      doc.text("Amount", 180, currentY);

      // Draw header line
      doc.line(20, currentY + 2, 200, currentY + 2);
      currentY += 10;

      // Add transaction rows
      transformedSales.slice(0, 30).forEach((sale: any, index: number) => {
        if (currentY > 270) return; // Stop if page is full

        doc.text(String(index + 1), 20, currentY);
        doc.text(sale.receiptNo || "N/A", 35, currentY);
        doc.text(
          (sale.customerName || "Walk-in").substring(0, 15),
          75,
          currentY,
        );
        doc.text(new Date(sale.saleDate).toLocaleDateString(), 120, currentY);
        doc.text(sale.status || "N/A", 155, currentY);
        doc.text(
          `${getSaleCurrency(sale)} ${Number(sale.totalAmount).toFixed(2)}`,
          180,
          currentY,
        );

        currentY += 8;
      });

      // Add footer
      if (transformedSales.length > 30) {
        doc.text(
          `... and ${transformedSales.length - 30} more transactions`,
          20,
          currentY + 10,
        );
      }

      // Save the PDF
      const fileName = `sales-report-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Generated",
        description: "Sales report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredSalesCount = totalCount;



  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "cash":
        return "default";
      case "credit":
        return "secondary";
      case "wallet":
        return "outline";
      case "hold":
        return "secondary";
      case "pending":
        return "outline";
      case "cancelled":
        return "destructive";
      case "returned":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout title="Sales Reports">
      <div className="p-4">
        <div className="w-full">
          <div className="mb-6 flex justify-between items-start">
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
                  Sales Reports
                </h1>
                <div className="text-gray-600 dark:text-gray-400 mt-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {!startDate && !endDate
                      ? "Showing all sales transactions"
                      : startDate === endDate
                        ? `Showing transactions for ${new Date(startDate).toLocaleDateString()}`
                        : `Showing transactions from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Permission Controlled */}
            <div className="flex gap-2">
              <PermissionGuard permission="create_sales">
                <Button
                  className="flex items-center gap-2"
                  onClick={() => setLocation("/pos")}
                >
                  <Plus className="h-4 w-4" />
                  New Sale
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="sales_reports">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={exportToPDF}
                >
                  <TrendingUp className="h-4 w-4" />
                  Export PDF
                </Button>
              </PermissionGuard>
            </div>
          </div>

          {/* Filters Section */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">Filters</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setAttendantFilter("all");
                    setStartDate("");
                    setEndDate("");
                    setDateFilter("all");
                    setCurrentPage(1);
                  }}
                  className="h-8 px-3 text-xs"
                >
                  Clear All
                </Button>
              </div>

              <div className="space-y-4">
                {/* Search */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Search by Receipt Number
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by receipt number..."
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
                      Found {transformedSales.length} results for "{searchQuery}
                      "
                    </p>
                  )}
                </div>

                {/* Attendant Filter - Only show for admin users */}
                {userType === "admin" && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Filter by Attendant
                    </Label>
                    <Select
                      value={attendantFilter}
                      onValueChange={handleAttendantFilter}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select attendant..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Attendants</SelectItem>
                        {uniqueAttendants.map((attendant: any) => (
                          <SelectItem key={attendant._id} value={attendant._id}>
                            {attendant.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {attendantFilter !== "all" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Filtering by:{" "}
                        {
                          uniqueAttendants.find(
                            (a: any) => a._id === attendantFilter,
                          )?.username
                        }
                      </p>
                    )}
                  </div>
                )}

                {/* Date Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Date Range
                  </Label>
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Date Inputs */}
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
                          placeholder="dd/mm/yyyy"
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
                          placeholder="dd/mm/yyyy"
                          className="h-9"
                        />
                      </div>
                    </div>

                    {/* Quick Date Buttons */}
                    <div className="flex flex-wrap gap-2 items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(7)}
                        className="h-9"
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(30)}
                        className="h-9"
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange(90)}
                        className="h-9"
                      >
                        Last 90 Days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearDateFilters}
                        disabled={!startDate && !endDate}
                        className="flex items-center gap-1 h-9"
                      >
                        <Calendar className="h-3 w-3" />
                        Clear Dates
                      </Button>
                    </div>
                  </div>

                  {(startDate || endDate) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {transformedSales.length} results from{" "}
                      {startDate || "beginning"} to {endDate || "now"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="space-y-4 mb-4">
            {/* Date Range Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Summary Stats</h2>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                  {!startDate && !endDate
                    ? "All Time"
                    : startDate === endDate
                      ? `${new Date(startDate).toLocaleDateString()}`
                      : `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`}
                </span>
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="hold">Hold</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Stats - Permission Controlled */}
            {(isAdmin || hasAttendantPermission("sales", "view_summary")) && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Main Metrics */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Sales
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.totalSales ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Sales Count
                      </p>
                      <p className="text-2xl font-bold">{salesReportData?.data?.totalCount ?? filteredSalesCount}</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>

                {/* Payment Method Cards */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Cash
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.cashtransactions ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        M-Pesa
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.mpesa ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Credit
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.credit ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Wallet
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.wallet ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Hold
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.hold ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Bank
                      </p>
                      <p className="text-2xl font-bold">
                        {primaryShopCurrency}{" "}
                        {Number(salesReportData?.data?.bank ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Sales History Table */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <CardTitle className="text-lg">
                  Sales History
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
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Receipt ID
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Customer
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Amount
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Date
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Payment
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Status
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-sm">
                        Attendant
                      </th>
                      {(hasPermission("sales_edit") ||
                        hasPermission("sales_delete") ||
                        hasPermission("sales_return")) && (
                        <th className="text-left py-2 px-3 font-medium text-sm">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center">
                          <div className="flex flex-col items-center space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="text-sm text-gray-500">
                              Loading sales data...
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-gray-500"
                        >
                          No sales found for the selected filters
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((sale: any) => (
                        <tr
                          key={sale.id}
                          className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="py-2 px-3 text-sm font-mono">
                            <button
                              onClick={() => handleViewSale(sale)}
                              className="hover:text-blue-600 hover:underline cursor-pointer"
                              title="View sale details"
                            >
                              #{sale.receiptNo}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {sale.customerName}
                          </td>
                          <td className="py-2 px-3 text-sm font-medium">
                            {getSaleCurrency(sale)}{" "}
                            {Number(sale.totalAmount).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {new Date(sale.saleDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-sm capitalize">
                            {sale.paymentTag}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={getStatusBadgeVariant(sale.status)}
                              className="text-xs"
                            >
                              {sale.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-sm">
                            {sale.attendantName}
                          </td>
                          <td className="py-2 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleViewSale(sale)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Receipt
                                </DropdownMenuItem>

                                {/* Print Quotation - available for all sales */}
                                <DropdownMenuItem
                                  onClick={() => generateQuotationPDF(sale)}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Print Quotation
                                </DropdownMenuItem>

                                {/* Complete Sale - only for hold status */}
                                {sale.status === "hold" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleCompleteSale(sale)}
                                      className="text-green-600 focus:text-green-600"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Complete Sale
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {/* Return Sale - Show for completed sales, for all admins or attendants with return permission */}
                                {sale.status !== "hold" && (userType === 'admin' || hasAttendantPermission('sales', 'return')) && (
                                  <DropdownMenuItem
                                    onClick={() => handleReturnSale(sale)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Return Sale
                                  </DropdownMenuItem>
                                )}
                                
                                {/* Delete Sale - Show for all admins or attendants with permission */}
                                {(userType === 'admin' || hasAttendantPermission('sales', 'delete')) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteSale(sale)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Sale
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalCount > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, totalCount)} of{" "}
                    {totalCount}
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
                        { length: Math.min(5, apiTotalPages) },
                        (_, i) => {
                          let pageNum;
                          if (apiTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= apiTotalPages - 2) {
                            pageNum = apiTotalPages - 4 + i;
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
                        setCurrentPage((prev) =>
                          Math.min(prev + 1, apiTotalPages),
                        )
                      }
                      disabled={currentPage === apiTotalPages}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Sale Dialog */}
      <Dialog open={completeSaleOpen} onOpenChange={setCompleteSaleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Complete Sale #{saleToComplete?.receiptNo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">Total Amount Due</span>
              <span className="text-xl font-bold text-green-700 dark:text-green-300">
                {primaryShopCurrency} {Number(saleToComplete?.totalAmount || 0).toFixed(2)}
              </span>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Payment Method</Label>
              <Select value={completePaymentMethod} onValueChange={setCompletePaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Amount Paid</Label>
              <Input
                type="number"
                value={completeAmountPaid}
                onChange={(e) => setCompleteAmountPaid(e.target.value)}
                placeholder="Enter amount paid"
                min={0}
                step="0.01"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCompleteSaleOpen(false)}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={confirmCompleteSale}
                disabled={isCompleting}
              >
                {isCompleting ? "Processing..." : "Complete Sale"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete sale #{saleToDelete?.receiptNo}?
              This action cannot be undone and will permanently remove this sale
              from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSale}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Sale"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default SalesList;
