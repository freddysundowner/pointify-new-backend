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
  id: number;
  purchase: number;
  shop: number;
  refundAmount: string;
  reason: string;
  refundMethod: string;
  processedBy: number | null;
  returnNo: string;
  createdAt: string;
  purchaseReturnItems?: Array<{
    id: number;
    product: number;
    quantity: string;
    unitPrice: string;
  }>;
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
        ...(attendant && { attendantId: attendant.id }),
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
    (sum: number, r: PurchaseReturn) => sum + (parseFloat(r.refundAmount) || 0), 0,
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
      const PW = 210; // page width mm
      const ML = 14;  // margin left
      const MR = 196; // margin right

      const refundMethodLabel: Record<string, string> = {
        credit: "Supplier Credit", refund: "Cash Refund", cash: "Cash Refund", exchange: "Exchange Items",
      };

      // ── Helper fns ──────────────────────────────────────────────────────
      const hline = (yPos: number, r = 0, g = 0, b = 0, lw = 0.2) => {
        doc.setDrawColor(r, g, b); doc.setLineWidth(lw);
        doc.line(ML, yPos, MR, yPos);
      };
      const cell = (text: string, x: number, yPos: number, w: number, align: "left"|"right"|"center" = "left", fs = 9, bold = false) => {
        doc.setFontSize(fs);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        if (align === "right")        doc.text(text, x + w, yPos, { align: "right" });
        else if (align === "center")  doc.text(text, x + w / 2, yPos, { align: "center" });
        else                          doc.text(text, x, yPos);
      };
      const checkPage = (yPos: number, needed = 20) => {
        if (yPos + needed > 278) { doc.addPage(); return ML; }
        return yPos;
      };

      // ── Shop header ─────────────────────────────────────────────────────
      const shop = shopDetails as any;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text((shop?.name || "Shop").toUpperCase(), PW / 2, 18, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const addrParts = [shop?.address, shop?.city, shop?.country].filter(Boolean).join(", ");
      if (addrParts) { doc.text(addrParts, PW / 2, 24, { align: "center" }); }
      if (shop?.phone) { doc.text(`Tel: ${shop.phone}`, PW / 2, 29, { align: "center" }); }

      let y = addrParts ? (shop?.phone ? 34 : 30) : 26;
      hline(y, 0, 0, 0, 0.5); y += 7;

      // ── Report title ─────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text("PURCHASE RETURNS REPORT", PW / 2, y, { align: "center" }); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Generated: ${new Date().toLocaleString()}`, PW / 2, y, { align: "center" });
      if (startDate || endDate) {
        y += 5;
        doc.text(`Period: ${startDate || "—"}  to  ${endDate || "—"}`, PW / 2, y, { align: "center" });
      }
      doc.setTextColor(0); y += 8;
      hline(y, 180, 180, 180, 0.3); y += 7;

      // ── Summary box ──────────────────────────────────────────────────────
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(ML, y - 3, MR - ML, 14, 2, 2, "F");
      cell("Total Returns", ML + 4, y + 4, 60, "left", 9, false);
      cell(String(returns.length), ML + 4, y + 9, 60, "left", 11, true);
      cell("Total Refunded", PW / 2 - 10, y + 4, 60, "left", 9, false);
      cell(fmtCurrency(totalReturnAmount), PW / 2 - 10, y + 9, 60, "left", 11, true);
      y += 20;

      // ── Column header for returns table ──────────────────────────────────
      doc.setFillColor(30, 30, 30);
      doc.rect(ML, y - 4, MR - ML, 9, "F");
      doc.setTextColor(255);
      cell("Return #",     ML + 2,  y + 1, 35, "left",   8, true);
      cell("Date",         ML + 38, y + 1, 30, "left",   8, true);
      cell("Processed By", ML + 70, y + 1, 40, "left",   8, true);
      cell("Method",       ML + 112,y + 1, 40, "left",   8, true);
      cell("Total",        MR - 14, y + 1, 14, "right",  8, true);
      doc.setTextColor(0); y += 10;

      // ── Each return ───────────────────────────────────────────────────────
      returns.forEach((r: PurchaseReturn, idx: number) => {
        const rowAmount = parseFloat(r.refundAmount) || 0;
        const items = r.purchaseReturnItems ?? [];

        // Estimate space needed: header row + items + footer
        const needed = 10 + items.length * 6 + 10;
        y = checkPage(y, needed);

        // Alternating row background
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 252);
          doc.rect(ML, y - 4, MR - ML, 9, "F");
        }

        // Return summary row
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
        doc.text(r.returnNo || `#${r.id}`, ML + 2, y + 1);
        doc.setFont("helvetica", "normal");
        doc.text(fmtDate(r.createdAt),                               ML + 38, y + 1);
        doc.text(r.processedBy ? `Attendant #${r.processedBy}` : "Admin", ML + 70, y + 1);
        doc.text(refundMethodLabel[r.refundMethod] ?? r.refundMethod ?? "—", ML + 112, y + 1);
        doc.setFont("helvetica", "bold");
        doc.text(fmtCurrency(rowAmount), MR, y + 1, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 8;

        // Reason (if any)
        if (r.reason) {
          doc.setFontSize(7.5); doc.setTextColor(100);
          doc.text(`Reason: ${r.reason.substring(0, 80)}`, ML + 4, y);
          doc.setTextColor(0); y += 5;
        }

        // Items sub-table
        if (items.length > 0) {
          // Items header
          doc.setFontSize(7.5); doc.setTextColor(100);
          doc.text("Product",    ML + 6,   y);
          doc.text("Qty",        ML + 115, y, { align: "right" });
          doc.text("Unit Price", ML + 140, y, { align: "right" });
          doc.text("Line Total", MR,       y, { align: "right" });
          doc.setTextColor(0);
          hline(y + 1.5, 210, 210, 210, 0.2); y += 5;

          items.forEach((item: any) => {
            y = checkPage(y, 7);
            const name = (item.productName || `Product #${item.product}`).substring(0, 45);
            const qty  = parseFloat(item.quantity ?? 1);
            const unit = parseFloat(item.unitPrice ?? 0);
            doc.setFontSize(8);
            doc.text(`• ${name}`,                      ML + 6,   y);
            doc.text(String(qty),                      ML + 115, y, { align: "right" });
            doc.text(`${currency} ${unit.toFixed(2)}`, ML + 140, y, { align: "right" });
            doc.text(`${currency} ${(qty * unit).toFixed(2)}`, MR, y, { align: "right" });
            y += 5.5;
          });
        }

        // Return subtotal line
        hline(y, 200, 200, 200, 0.2); y += 4;
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("Return Total:", ML + 110, y);
        doc.text(fmtCurrency(rowAmount), MR, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 7;
      });

      // ── Grand total ───────────────────────────────────────────────────────
      y = checkPage(y, 16);
      hline(y, 0, 0, 0, 0.5); y += 2;
      doc.setFillColor(30, 30, 30);
      doc.rect(ML, y, MR - ML, 10, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("GRAND TOTAL", ML + 4, y + 6.5);
      doc.text(fmtCurrency(totalReturnAmount), MR - 2, y + 6.5, { align: "right" });
      doc.setTextColor(0);

      doc.save(`purchase-returns-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleView = (r: PurchaseReturn) => {
    (window as any).__returnData = r;
    const isAttendant = window.location.pathname.startsWith("/attendant/");
    setLocation(isAttendant ? `/attendant/purchase-return-details/${r.id}` : `/purchase-return-details/${r.id}`);
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
              <div className="flex flex-wrap gap-2">
                <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 text-xs min-w-[130px]">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {(suppliers as any[]).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 items-center flex-1 min-w-[260px]">
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs flex-1" />
                  <span className="text-xs text-gray-400 shrink-0">–</span>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs flex-1" />
                </div>
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
                        <TableRow key={r.id} className="text-xs">
                          <TableCell className="py-2 px-3 font-medium">
                            {r.returnNo}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            {fmtCurrency(parseFloat(r.refundAmount) || 0)}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-gray-500">
                            {fmtDate(r.createdAt)}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-gray-500 hidden sm:table-cell">
                            {r.processedBy ? `#${r.processedBy}` : "—"}
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
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
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
