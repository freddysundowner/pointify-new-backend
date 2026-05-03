import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from "@/components/ui/sheet";
import {
  Search, RefreshCw, ArrowLeft, Download, Eye,
  SlidersHorizontal, RotateCcw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useLocation } from "wouter";
import { useCurrency } from "@/utils";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";

interface PurchaseReturn {
  _id: string;
  purchaseId: string;
  reason: string;
  totalAmount?: number;
  refundAmount?: number;
  returnDate?: string;
  createdAt?: string;
  purchaseReturnNo?: string;
  attendantId: { _id: string; username: string };
  shopId: { _id: string; name: string; currency: string };
  items: Array<{
    product: { _id: string; name: string };
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
  }>;
  status?: string;
}

interface PurchaseReturnsResponse {
  returns: PurchaseReturn[];
  total: number;
}

export default function PurchaseReturns() {
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const { shopId } = usePrimaryShop();
  const shopDetails = useShopDetails(shopId);
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute("purchases");
  const currency = useCurrency();

  const backRoute = attendant ? "/attendant/dashboard" : purchasesRoute;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter sheet
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const activeFilterCount = [
    supplierFilter !== "all",
    startDate !== "",
    endDate !== "",
  ].filter(Boolean).length;

  // Fetch returns
  const { data: returnsData, isLoading, refetch } = useQuery<PurchaseReturnsResponse>({
    queryKey: [ENDPOINTS.purchaseReturns.getAll, shopId, searchTerm, supplierFilter, startDate, endDate, currentPage],
    queryFn: async (): Promise<PurchaseReturnsResponse> => {
      if (!shopId) return { returns: [], total: 0 };
      const params = new URLSearchParams({
        shopId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(supplierFilter !== "all" && { supplierId: supplierFilter }),
        ...(startDate && { fromDate: startDate }),
        ...(endDate && { toDate: endDate }),
        ...(attendant && { attendantId: attendant._id }),
      });
      const responseObj = await apiCall(`${ENDPOINTS.purchaseReturns.getAll}?${params}`);
      const response = await responseObj.json();
      if (response?.data && Array.isArray(response.data))
        return { returns: response.data, total: response.meta?.total || response.data.length };
      if (Array.isArray(response))
        return { returns: response, total: response.length };
      return (response as PurchaseReturnsResponse) || { returns: [], total: 0 };
    },
    enabled: !!shopId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch suppliers
  const { data: suppliersResponse } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const res = await fetch(`${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`, {
        headers: {
          Authorization: `Bearer ${admin ? localStorage.getItem("authToken") : localStorage.getItem("attendantToken")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      return res.json();
    },
    enabled: !!shopId,
  });
  const suppliers = Array.isArray(suppliersResponse) ? suppliersResponse : [];

  const returns = returnsData?.returns || [];
  const totalReturns = returnsData?.total || 0;
  const totalPages = Math.ceil(totalReturns / itemsPerPage);
  const totalReturnAmount = returns.reduce(
    (sum: number, r: PurchaseReturn) => sum + (r.refundAmount || r.totalAmount || 0), 0,
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSupplierFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const fmtCurrency = (n: number) => `${currency} ${(n || 0).toLocaleString()}`;

  const fmtDate = (d: string) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
  };

  const downloadReport = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let y = drawShopHeader(doc, shopDetails, "Purchase Returns Report", `Generated ${new Date().toLocaleDateString()}`);
      doc.setFontSize(10);
      doc.text(`Total Returns: ${returns.length}   Total Amount: ${fmtCurrency(totalReturnAmount)}`, 20, y);
      y += 12;
      const headers = ["Return #", "Amount", "Date", "Attendant", "Reason"];
      const colW = [40, 30, 30, 40, 50];
      let x = 20;
      headers.forEach((h, i) => { doc.text(h, x, y); x += colW[i]; });
      y += 10;
      returns.forEach((r: PurchaseReturn) => {
        if (y > 270) { doc.addPage(); y = 20; }
        x = 20;
        [
          r.purchaseReturnNo || r._id,
          fmtCurrency(r.refundAmount || r.totalAmount || 0),
          fmtDate(r.createdAt || r.returnDate || ""),
          r.attendantId?.username || "Unknown",
          (r.reason || "N/A").substring(0, 20),
        ].forEach((v, i) => { doc.text(String(v), x, y); x += colW[i]; });
        y += 8;
      });
      doc.save(`purchase-returns-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleView = (r: PurchaseReturn) => {
    (window as any).__returnData = r;
    const isAttendant = window.location.pathname.startsWith("/attendant/");
    setLocation(isAttendant ? `/attendant/purchase-return-details/${r._id}` : `/purchase-return-details/${r._id}`);
  };

  return (
    <DashboardLayout title="Purchase Returns">
      <div className="-mx-4 sm:mx-0 px-0 py-0">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setLocation(backRoute)}
                className={`${attendant ? "flex" : "hidden lg:flex"} items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0`}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">Purchase Returns</h1>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {/* Mobile filter button */}
              <Button
                variant="outline" size="sm"
                className="sm:hidden h-8 px-2 relative"
                onClick={() => setFilterSheetOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs px-2" onClick={downloadReport}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Mobile: inline search */}
          <div className="sm:hidden px-3 pb-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-8 text-sm w-full"
              />
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-3 space-y-3">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <Card>
              <CardContent className="px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total Returns</p>
                <p className="text-xl font-bold mt-0.5">{totalReturns}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-3 py-2.5">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Return Amount</p>
                <p className="text-xl font-bold mt-0.5">{fmtCurrency(totalReturnAmount)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop filters */}
          <Card className="hidden sm:block">
            <CardContent className="p-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search returns..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 px-2 shrink-0">
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 text-xs min-w-[130px]">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {(suppliers as any[]).map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs flex-1 min-w-[120px]" />
                <span className="self-center text-xs text-gray-400 shrink-0">–</span>
                <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs flex-1 min-w-[120px]" />
              </div>
            </CardContent>
          </Card>

          {/* Returns table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-gray-400 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : returns.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No purchase returns found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="py-2 px-3">Return #</TableHead>
                        <TableHead className="py-2 px-3">Amount</TableHead>
                        <TableHead className="py-2 px-3">Date</TableHead>
                        <TableHead className="py-2 px-3 hidden sm:table-cell">Attendant</TableHead>
                        <TableHead className="py-2 px-3 w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((r: PurchaseReturn) => (
                        <TableRow key={r._id} className="text-xs">
                          <TableCell className="py-2 px-3 font-medium">
                            {r.purchaseReturnNo || r._id.slice(-6).toUpperCase()}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            {fmtCurrency(r.refundAmount || r.totalAmount || 0)}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-gray-500">
                            {fmtDate(r.createdAt || r.returnDate || "")}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-gray-500 hidden sm:table-cell">
                            {r.attendantId?.username || "—"}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleView(r)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
              <span>
                {Math.min((currentPage - 1) * itemsPerPage + 1, totalReturns)}–
                {Math.min(currentPage * itemsPerPage, totalReturns)} of {totalReturns}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (pg > totalPages) return null;
                  return (
                    <Button
                      key={pg}
                      variant={currentPage === pg ? "default" : "outline"}
                      size="sm" className="h-7 w-7 p-0 text-xs"
                      onClick={() => setCurrentPage(pg)}
                    >
                      {pg}
                    </Button>
                  );
                })}
                <Button
                  variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile filter bottom sheet ── */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent side="bottom" className="sm:hidden rounded-t-2xl p-0 max-h-[80vh] overflow-y-auto">
            <SheetHeader className="px-4 pt-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base">Filters</SheetTitle>
                <Button
                  variant="ghost" size="sm"
                  className="h-8 text-xs text-purple-600 font-medium px-2"
                  onClick={clearFilters}
                >
                  Clear all
                </Button>
              </div>
            </SheetHeader>

            <div className="px-4 py-4 space-y-4">
              {/* Supplier */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</label>
                <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {(suppliers as any[]).map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Range</label>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="h-10 text-sm flex-1" />
                  <span className="text-xs text-gray-400 shrink-0">–</span>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="h-10 text-sm flex-1" />
                </div>
              </div>

              <SheetClose asChild>
                <Button className="w-full h-11 text-sm font-medium mt-2">
                  {activeFilterCount > 0 ? `Show results (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active)` : "Show results"}
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}
