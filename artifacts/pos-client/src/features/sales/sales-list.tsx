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
  Mail,
  Send,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { ENDPOINTS } from "@/lib/api-endpoints";
import type { Sale } from "@shared/schema";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useShop } from "@/features/shop/useShop";
import { useProducts } from "@/contexts/ProductsContext";

function SalesList() {
  const { hasPermission, user, hasAttendantPermission } = usePermissions();
  const { admin } = useAuth();
  const { refreshProducts } = useProducts();
  const queryClient = useQueryClient();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const [location, setLocation] = useLocation();
  const salesRoute = useNavigationRoute("sales");

  // Add attendant authentication hooks
  const { attendant, isAuthenticated: isAttendantAuth } = useAttendantAuth();
  const { userType, adminId } = usePrimaryShop();
  const { shop: currentShop, currency: shopCurrency } = useShop();

  // Check if user is admin (has all permissions)
  const isAdmin = userType === "admin" || user?.role === "admin";

  // Back button handler
  const handleBackClick = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (userType === "attendant") {
      setLocation("/attendant/dashboard");
    } else {
      setLocation("/dashboard");
    }
  };
  // Initialize dates from URL parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const [statusFilter, setStatusFilter] = useState<string>(
    urlParams.get("status") || "all",
  );
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
  const [showCustomDates, setShowCustomDates] = useState<boolean>(
    !!(urlParams.get("startDate") || urlParams.get("endDate")),
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quotationDialogSale, setQuotationDialogSale] = useState<any>(null);
  const [quotationMode, setQuotationMode] = useState<"options" | "email">("options");
  const [quotationEmail, setQuotationEmail] = useState<string>("");
  const [quotationEmailSending, setQuotationEmailSending] = useState(false);
  const [invoiceDialogSale, setInvoiceDialogSale] = useState<any>(null);
  const [invoiceMode, setInvoiceMode] = useState<"options" | "email">("options");
  const [invoiceEmail, setInvoiceEmail] = useState<string>("");
  const [invoiceEmailSending, setInvoiceEmailSending] = useState(false);

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
  const shopDetails = useShopDetails(shopId);

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
        params.append("status", "credit");
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
    if (searchQuery.trim()) params.append("search", searchQuery.trim());
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
    // Mirror the same payment-type filter sent to the list so all stat cards are consistent
    if (statusFilter !== "all") {
      if (statusFilter === "cash") {
        params.append("status", "cashed");
        params.append("paymentTag", "cash");
      } else if (statusFilter === "mpesa") {
        params.append("status", "cashed");
        params.append("paymentTag", "mpesa");
      } else if (statusFilter === "credit") {
        params.append("status", "credit");
      } else if (statusFilter === "wallet") {
        params.append("status", "cashed");
        params.append("paymentTag", "wallet");
      } else if (statusFilter === "bank") {
        params.append("status", "cashed");
        params.append("paymentTag", "bank");
      } else if (statusFilter === "held") {
        params.append("status", "held");
      } else if (statusFilter === "returned") {
        params.append("status", "returned");
      }
    }
    return params.toString();
  }, [shopId, userType, attendant?._id, attendantFilter, startDate, endDate, statusFilter]);

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
    setShowCustomDates(false);
  };

  const setDateRange = (days: number) => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days);

    setStartDate(startDate.toISOString().split("T")[0]);
    setEndDate(today.toISOString().split("T")[0]);
    setShowCustomDates(false);
    setCurrentPage(1);
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
    setLocation(`${salesRoute}/return/${sale.id}`);
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
        // Refresh sales data, stats, and product quantities
        refetch();
        refetchReport();
        refreshProducts();
        // Invalidate customer statement queries so the ledger reflects the deletion
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = String(query.queryKey[0] ?? "");
            return key.includes("/api/customers/") && key.includes("/wallet-transactions");
          },
        });
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
        refetchReport();
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

  // Builds the quotation jsPDF document and returns it
  const buildQuotationDoc = (sale: any): jsPDF => {
    const originalSale = salesData.find((s: any) => (s.id ?? s._id) === sale.id);
    // Unwrap API envelope if the cached value is still { success, data: {...} }
    const rawShop: any = currentShop || {};
    const shop: any = rawShop?.data ?? rawShop;
    const currency = shopCurrency || primaryShopCurrency;
    const items: any[] = originalSale?.saleItems || sale.items || [];

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
    if ((shop as any).receiptEmail || (shop as any).email) {
      doc.text(`Email: ${(shop as any).receiptEmail || (shop as any).email}`, 20, y);
      y += 6;
    }
    if ((shop as any).paybillAccount || (shop as any).paybill_account) {
      const acct = (shop as any).paybillAccount || (shop as any).paybill_account;
      const till = shop.paybillTill || shop.paybill_till;
      doc.text(`Paybill: ${acct}${till ? ` / Acc: ${till}` : ""}`, 20, y);
      y += 6;
    } else if (shop.paybillTill || shop.paybill_till) {
      doc.text(`Buy Goods Till: ${shop.paybillTill || shop.paybill_till}`, 20, y);
      y += 6;
    }

    y += 4;
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, 20, y);
    doc.text(`No: ${sale.receiptNo}`, 190, y, { align: "right" });
    y += 8;

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
    y += 10;
    doc.line(20, y - 4, 190, y - 4);
    doc.setFont("helvetica", "normal");

    items.forEach((item: any) => {
      const name = item.productName || item.product?.name || item.name || "Item";
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

    y += 6;
    doc.line(20, y, 190, y);
    y += 10;

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

    return doc;
  };

  // Download the quotation as a PDF file
  const downloadQuotationPDF = (sale: any) => {
    try {
      const doc = buildQuotationDoc(sale);
      doc.save(`quotation-${sale.receiptNo}.pdf`);
      toast({ title: "Quotation Downloaded", description: `Quotation #${sale.receiptNo} saved.` });
      setQuotationDialogSale(null);
    } catch (err) {
      console.error("Quotation PDF error:", err);
      toast({ title: "PDF Error", description: "Failed to generate quotation.", variant: "destructive" });
    }
  };

  // Email the quotation as a PDF attachment
  const emailQuotationPDF = async (sale: any, email: string) => {
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setQuotationEmailSending(true);
    try {
      const doc = buildQuotationDoc(sale);
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const shopName = (currentShop as any)?.name || "";
      const response = await apiRequest("POST", "/api/sales/email-receipt", {
        toEmail: email,
        receiptHtml: `<p>Please find your quotation <strong>#${sale.receiptNo}</strong> attached.</p>`,
        receiptNo: sale.receiptNo,
        shopName,
        customerName: sale.customerName !== "Walk-in" ? sale.customerName : undefined,
        pdfBase64,
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Quotation Sent", description: `Quotation #${sale.receiptNo} emailed to ${email}.` });
        setQuotationDialogSale(null);
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (err: any) {
      console.error("Email quotation error:", err);
      toast({ title: "Email Failed", description: err.message || "Could not send the quotation email.", variant: "destructive" });
    } finally {
      setQuotationEmailSending(false);
    }
  };

  // Builds the invoice jsPDF document and returns it
  const buildInvoiceDoc = (sale: any): jsPDF => {
    const originalSale = salesData.find((s: any) => (s.id ?? s._id) === sale.id);
    // Unwrap API envelope if the cached value is still { success, data: {...} }
    const rawShop: any = currentShop || {};
    const shop: any = rawShop?.data ?? rawShop;
    const currency = shopCurrency || primaryShopCurrency;
    const items: any[] = originalSale?.saleItems || sale.items || [];

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
    if ((shop as any).receiptEmail || (shop as any).email) {
      doc.text(`Email: ${(shop as any).receiptEmail || (shop as any).email}`, 20, y);
      y += 6;
    }
    if ((shop as any).paybillAccount || (shop as any).paybill_account) {
      const acct = (shop as any).paybillAccount || (shop as any).paybill_account;
      const till = shop.paybillTill || shop.paybill_till;
      doc.text(`Paybill: ${acct}${till ? ` / Acc: ${till}` : ""}`, 20, y);
      y += 6;
    } else if (shop.paybillTill || shop.paybill_till) {
      doc.text(`Buy Goods Till: ${shop.paybillTill || shop.paybill_till}`, 20, y);
      y += 6;
    }

    y += 4;
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, 20, y);
    doc.text(`No: ${sale.receiptNo}`, 190, y, { align: "right" });
    y += 6;
    doc.text("Status: PENDING PAYMENT", 20, y);
    y += 8;

    if (sale.customerName && sale.customerName !== "Walk-in") {
      doc.text(`Bill To: ${sale.customerName}`, 20, y);
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
    y += 10;
    doc.line(20, y - 4, 190, y - 4);
    doc.setFont("helvetica", "normal");

    items.forEach((item: any) => {
      const name = item.productName || item.product?.name || item.name || "Item";
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

    y += 6;
    doc.line(20, y, 190, y);
    y += 10;

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
    doc.text("AMOUNT DUE:", 145, y, { align: "right" });
    doc.text(`${currency} ${Number(grandTotal).toFixed(2)}`, 188, y, { align: "right" });

    y += 12;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Please make payment at your earliest convenience. Thank you!", 105, y, { align: "center" });

    return doc;
  };

  const downloadInvoicePDF = (sale: any) => {
    try {
      const doc = buildInvoiceDoc(sale);
      doc.save(`invoice-${sale.receiptNo}.pdf`);
      toast({ title: "Invoice Downloaded", description: `Invoice #${sale.receiptNo} saved.` });
      setInvoiceDialogSale(null);
    } catch (err) {
      console.error("Invoice PDF error:", err);
      toast({ title: "PDF Error", description: "Failed to generate invoice.", variant: "destructive" });
    }
  };

  const emailInvoicePDF = async (sale: any, email: string) => {
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setInvoiceEmailSending(true);
    try {
      const doc = buildInvoiceDoc(sale);
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const shopName = (currentShop as any)?.name || "";
      const response = await apiRequest("POST", "/api/sales/email-receipt", {
        toEmail: email,
        receiptHtml: `<p>Please find your invoice <strong>#${sale.receiptNo}</strong> attached. Payment is due at your earliest convenience.</p>`,
        receiptNo: sale.receiptNo,
        shopName,
        customerName: sale.customerName !== "Walk-in" ? sale.customerName : undefined,
        pdfBase64,
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Invoice Sent", description: `Invoice #${sale.receiptNo} emailed to ${email}.` });
        setInvoiceDialogSale(null);
      } else {
        throw new Error(data.error || "Failed to send");
      }
    } catch (err: any) {
      console.error("Email invoice error:", err);
      toast({ title: "Email Failed", description: err.message || "Could not send the invoice email.", variant: "destructive" });
    } finally {
      setInvoiceEmailSending(false);
    }
  };

  // PDF Export function
  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.width;
      const reportData = (salesReportData as any) || {};
      const statsD = reportData?.data || reportData;

      const dateRange =
        !startDate && !endDate
          ? new Date().toLocaleDateString()
          : startDate === endDate
            ? new Date(startDate).toLocaleDateString()
            : `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`;

      const headerEndY = drawShopHeader(doc, shopDetails, "Sales Report", `${dateRange}   Generated: ${new Date().toLocaleDateString()}`);

      // ── Summary boxes ──
      const totalSalesAmt = Number(statsD?.totalSales ?? 0);
      const totalTxns = totalCount;
      const totalReturns = Number(statsD?.returns ?? 0);
      const totalCredit = Number(statsD?.credit ?? 0);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const col1 = 14, col2 = pw / 4 + 5, col3 = pw / 2 + 5, col4 = (pw * 3) / 4 + 5;
      const sy = headerEndY;
      doc.text("Total Revenue", col1, sy);
      doc.text("Transactions", col2, sy);
      doc.text("Returns", col3, sy);
      doc.text("Credit Sales", col4, sy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`${primaryShopCurrency} ${totalSalesAmt.toFixed(2)}`, col1, sy + 6);
      doc.text(String(totalTxns), col2, sy + 6);
      doc.text(`${primaryShopCurrency} ${totalReturns.toFixed(2)}`, col3, sy + 6);
      doc.text(`${primaryShopCurrency} ${totalCredit.toFixed(2)}`, col4, sy + 6);

      // ── Table ──
      const rows = transformedSales.map((sale: any, idx: number) => [
        idx + 1,
        sale.receiptNo || "N/A",
        sale.customerName || "Walk-in",
        new Date(sale.saleDate).toLocaleDateString(),
        (sale.paymentMethod || sale.status || "N/A").toUpperCase(),
        sale.status || "N/A",
        `${getSaleCurrency(sale)} ${Number(sale.totalAmount).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: sy + 12,
        head: [["#", "Receipt No.", "Customer", "Date", "Payment", "Status", "Amount"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          3: { cellWidth: 28 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22 },
          6: { halign: "right", cellWidth: 32 },
        },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.text(
            `${shopDetails.name || "Shop"} — Sales Report  |  Page ${data.pageNumber} of ${pageCount}`,
            pw / 2,
            doc.internal.pageSize.height - 5,
            { align: "center" }
          );
        },
      });

      const fileName = `sales-report-${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: `Sales report with ${transformedSales.length} transactions saved.`,
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

  // Derive stats Total that respects the payment method / status filter
  const statsD = (salesReportData as any)?.data;
  const filteredStatsTotal = (() => {
    if (!statsD) return 0;
    switch (statusFilter) {
      case "cash":     return Number(statsD.cashtransactions ?? 0);
      case "mpesa":    return Number(statsD.mpesa ?? 0);
      case "credit":   return Number(statsD.credit ?? 0);
      case "wallet":   return Number(statsD.wallet ?? 0);
      case "bank":     return Number(statsD.bank ?? 0);
      case "held":     return Number(statsD.hold ?? 0);
      case "returned": return Number(statsD.returns ?? 0);
      default:         return Number(statsD.totalSales ?? 0);
    }
  })();

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
      case "held":
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
      <div className="w-full">
          <div className="mb-3 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackClick}
                className="hidden sm:flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Sales
              </h1>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <PermissionGuard permission="create_sales">
                <Button
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={() => setLocation("/pos")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Sale</span>
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="sales_reports">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={exportToPDF}
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Export PDF</span>
                </Button>
              </PermissionGuard>
            </div>
          </div>

          {/* ── Mobile: search bar + filter button ── */}
          <div className="sm:hidden flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Receipt no. or customer..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-7 h-9 text-xs"
              />
            </div>
            <button
              onClick={() => setFilterSheetOpen(true)}
              className="relative flex-shrink-0 h-9 px-3 rounded-lg border border-gray-200 bg-white flex items-center gap-1.5 text-xs text-gray-600"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {(statusFilter !== "all" || attendantFilter !== "all" || startDate || endDate) && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                  {[statusFilter !== "all", attendantFilter !== "all", !!(startDate || endDate)].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* ── Mobile: filter bottom sheet ── */}
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-4 max-h-[85vh] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-sm font-semibold text-left">Filters</SheetTitle>
              </SheetHeader>

              {/* Payment type */}
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Payment type</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  { value: "all", label: "All" },
                  { value: "cash", label: "Cash" },
                  { value: "mpesa", label: "M-Pesa" },
                  { value: "credit", label: "Credit" },
                  { value: "held", label: "Hold" },
                  { value: "wallet", label: "Wallet" },
                  { value: "bank", label: "Bank" },
                  { value: "returned", label: "Returns" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusFilter(value)}
                    className={`h-8 px-3 text-xs rounded-full font-medium transition-colors ${
                      statusFilter === value
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Attendant (admin only) */}
              {userType === "admin" && (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Attendant</p>
                  <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                    <SelectTrigger className="h-9 text-xs w-full mb-4">
                      <SelectValue placeholder="All attendants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendants</SelectItem>
                      {uniqueAttendants.map((att: any) => (
                        <SelectItem key={att._id} value={att._id}>
                          {att.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Date range */}
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Date range</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { label: "Today", days: 0 },
                  { label: "7 Days", days: 7 },
                  { label: "30 Days", days: 30 },
                  { label: "90 Days", days: 90 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setDateRange(days)}
                    className="h-8 px-3 text-xs rounded-full border border-gray-200 bg-white text-gray-600"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowCustomDates((v) => !v);
                    if (showCustomDates) { setStartDate(""); setEndDate(""); setCurrentPage(1); }
                  }}
                  className={`h-8 px-3 text-xs rounded-full border transition-colors ${
                    showCustomDates
                      ? "bg-primary text-white border-primary"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  Custom
                </button>
              </div>
              {showCustomDates && (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                    className="h-9 text-xs flex-1"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                    className="h-9 text-xs flex-1"
                  />
                </div>
              )}
              {(startDate || endDate) && !showCustomDates && (
                <p className="text-xs text-muted-foreground mb-4">
                  {startDate} – {endDate}
                  <button onClick={clearDateFilters} className="ml-2 text-red-500">✕ clear</button>
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setAttendantFilter("all");
                    setStartDate("");
                    setEndDate("");
                    setDateFilter("all");
                    setShowCustomDates(false);
                    setCurrentPage(1);
                  }}
                >
                  Clear all
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => setFilterSheetOpen(false)}
                >
                  Show results
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* ── Desktop: full filter card (hidden on mobile) ── */}
          <Card className="hidden sm:block mb-2">
            <CardContent className="p-2.5 space-y-1.5">
              {/* Row 1 — search + filters */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Receipt no. or customer..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="held">Hold</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="returned">Returns</SelectItem>
                  </SelectContent>
                </Select>
                {userType === "admin" && (
                  <Select value={attendantFilter} onValueChange={handleAttendantFilter}>
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue placeholder="All attendants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attendants</SelectItem>
                      {uniqueAttendants.map((att: any) => (
                        <SelectItem key={att._id} value={att._id}>
                          {att.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost"
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
                  className="h-8 text-xs px-2 text-muted-foreground"
                >
                  Clear
                </Button>
              </div>

              {/* Quick date chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { label: "Today", days: 0 },
                  { label: "7 Days", days: 7 },
                  { label: "30 Days", days: 30 },
                  { label: "90 Days", days: 90 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setDateRange(days)}
                    className="flex-shrink-0 h-7 px-3 text-xs rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowCustomDates((v) => !v);
                    if (showCustomDates) { setStartDate(""); setEndDate(""); setCurrentPage(1); }
                  }}
                  className={`flex-shrink-0 h-7 px-3 text-xs rounded-full border transition-colors ${
                    showCustomDates
                      ? "bg-primary text-white border-primary"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-primary/10 hover:border-primary hover:text-primary"
                  }`}
                >
                  Custom
                </button>
                {(startDate || endDate) && !showCustomDates && (
                  <button onClick={clearDateFilters} className="flex-shrink-0 h-7 px-3 text-xs rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Custom date inputs */}
              {showCustomDates && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">From:</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                    className="h-8 text-xs w-[140px]"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                    className="h-8 text-xs w-[140px]"
                  />
                  {(startDate || endDate) && (
                    <button onClick={clearDateFilters} className="flex-shrink-0 h-7 px-2 text-xs rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                      ✕
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats — compact */}
          {(isAdmin || hasAttendantPermission("sales", "view_summary")) && (
            <div className="mb-2">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[
                  { label: "Total", value: filteredStatsTotal.toFixed(2), currency: true },
                  { label: "Count", value: String(filteredSalesCount), currency: false },
                  { label: "Cash", value: Number(salesReportData?.data?.cashtransactions ?? 0).toFixed(2), currency: true },
                  { label: "M-Pesa", value: Number(salesReportData?.data?.mpesa ?? 0).toFixed(2), currency: true },
                  { label: "Credit", value: Number(salesReportData?.data?.credit ?? 0).toFixed(2), currency: true },
                  { label: "Wallet", value: Number(salesReportData?.data?.wallet ?? 0).toFixed(2), currency: true },
                  { label: "Hold", value: Number(salesReportData?.data?.hold ?? 0).toFixed(2), currency: true },
                  { label: "Bank", value: Number(salesReportData?.data?.bank ?? 0).toFixed(2), currency: true },
                ].map((stat) => (
                  <Card key={stat.label} className="p-1.5">
                    <p className="text-[9px] text-muted-foreground leading-tight">{stat.label}</p>
                    <p className="text-[11px] font-bold mt-0.5 truncate">
                      {stat.currency ? `${primaryShopCurrency} ` : ""}{stat.value}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Sales History Table */}
          <Card className="flex-1">
            <CardHeader className="py-2 px-3">
              <div className="flex flex-row justify-between items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  Sales History
                  {statusFilter !== "all" && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      · {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs">
                  <Label htmlFor="items-per-page" className="whitespace-nowrap text-xs text-muted-foreground">
                    Show:
                  </Label>
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
            <CardContent className="p-0 pt-0">
              {/* Mobile Card List */}
              <div className="sm:hidden space-y-1.5 px-2 pb-2">
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-gray-500">Loading sales data...</div>
                ) : paginatedData.length === 0 ? (
                  <div className="py-6 text-center text-gray-500 text-sm">No sales found for the selected filters</div>
                ) : (
                  paginatedData.map((sale: any) => (
                    <div key={sale.id} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
                        <button
                          onClick={() => handleViewSale(sale)}
                          className="text-xs font-mono font-semibold text-primary hover:underline"
                        >
                          #{sale.receiptNo}
                        </button>
                        <span className="text-xs font-bold text-gray-900">
                          {getSaleCurrency(sale)} {Number(sale.totalAmount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 pb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-gray-500 truncate">
                            {sale.customerName} · {new Date(sale.saleDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] capitalize text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{sale.paymentTag}</span>
                          <Badge variant={getStatusBadgeVariant(sale.status)} className="text-[10px] px-1.5 py-0">
                            {sale.status}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewSale(sale)}>
                                <Eye className="mr-2 h-4 w-4" />View Receipt
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setQuotationDialogSale(sale);
                                setQuotationMode("options");
                                setQuotationEmail("");
                              }}>
                                <FileText className="mr-2 h-4 w-4" />Print Quotation
                              </DropdownMenuItem>
                              {sale.status === "held" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleCompleteSale(sale)} className="text-green-600 focus:text-green-600">
                                    <CheckCircle className="mr-2 h-4 w-4" />Complete Sale
                                  </DropdownMenuItem>
                                </>
                              )}
                              {sale.status !== "held" && (userType === 'admin' || hasAttendantPermission('sales', 'return')) && (
                                <DropdownMenuItem onClick={() => handleReturnSale(sale)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />Return Sale
                                </DropdownMenuItem>
                              )}
                              {(userType === 'admin' || hasAttendantPermission('sales', 'delete')) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteSale(sale)} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />Delete Sale
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
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
                                  onClick={() => {
                                    setQuotationDialogSale(sale);
                                    setQuotationMode("options");
                                    setQuotationEmail("");
                                  }}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Print Quotation
                                </DropdownMenuItem>

                                {/* Invoice + Complete Sale - only for held status */}
                                {sale.status === "held" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setInvoiceDialogSale(sale);
                                        setInvoiceMode("options");
                                        setInvoiceEmail("");
                                      }}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      Invoice
                                    </DropdownMenuItem>
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
                                {sale.status !== "held" && (userType === 'admin' || hasAttendantPermission('sales', 'return')) && (
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
      {/* Quotation Dialog */}
      <Dialog
        open={!!quotationDialogSale}
        onOpenChange={(open) => { if (!open) setQuotationDialogSale(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quotation #{quotationDialogSale?.receiptNo}
            </DialogTitle>
            <DialogDescription>
              Choose how you'd like to deliver this quotation.
            </DialogDescription>
          </DialogHeader>

          {quotationMode === "options" && (
            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="w-full justify-start gap-2"
                onClick={() => downloadQuotationPDF(quotationDialogSale)}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setQuotationMode("email")}
              >
                <Mail className="h-4 w-4" />
                Email Quotation
              </Button>
            </div>
          )}

          {quotationMode === "email" && (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quotation-email">Recipient email address</Label>
                <Input
                  id="quotation-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={quotationEmail}
                  onChange={(e) => setQuotationEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") emailQuotationPDF(quotationDialogSale, quotationEmail);
                  }}
                  autoFocus
                />
              </div>
              <DialogFooter className="flex-row gap-2 sm:justify-start">
                <Button
                  variant="outline"
                  onClick={() => setQuotationMode("options")}
                  disabled={quotationEmailSending}
                >
                  Back
                </Button>
                <Button
                  onClick={() => emailQuotationPDF(quotationDialogSale, quotationEmail)}
                  disabled={quotationEmailSending || !quotationEmail}
                  className="gap-2"
                >
                  {quotationEmailSending ? (
                    <>Sending…</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog
        open={!!invoiceDialogSale}
        onOpenChange={(open) => { if (!open) setInvoiceDialogSale(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice #{invoiceDialogSale?.receiptNo}
            </DialogTitle>
            <DialogDescription>
              Choose how you'd like to deliver this invoice.
            </DialogDescription>
          </DialogHeader>

          {invoiceMode === "options" && (
            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="w-full justify-start gap-2"
                onClick={() => downloadInvoicePDF(invoiceDialogSale)}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setInvoiceMode("email")}
              >
                <Mail className="h-4 w-4" />
                Email Invoice
              </Button>
            </div>
          )}

          {invoiceMode === "email" && (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-email">Recipient email address</Label>
                <Input
                  id="invoice-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") emailInvoicePDF(invoiceDialogSale, invoiceEmail);
                  }}
                  autoFocus
                />
              </div>
              <DialogFooter className="flex-row gap-2 sm:justify-start">
                <Button
                  variant="outline"
                  onClick={() => setInvoiceMode("options")}
                  disabled={invoiceEmailSending}
                >
                  Back
                </Button>
                <Button
                  onClick={() => emailInvoicePDF(invoiceDialogSale, invoiceEmail)}
                  disabled={invoiceEmailSending || !invoiceEmail}
                  className="gap-2"
                >
                  {invoiceEmailSending ? (
                    <>Sending…</>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
