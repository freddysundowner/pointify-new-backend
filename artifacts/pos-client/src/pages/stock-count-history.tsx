import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, ArrowLeft, Download, RefreshCw, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useAuth } from "@/features/auth/useAuth";
import { useGoBack } from "@/hooks/useGoBack";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCurrency } from "@/utils";

interface StockCountItem {
  id: number;
  product: number;
  productName: string;
  physicalCount: string | number;
  systemCount: string | number;
  variance: string | number;
  createdAt: string;
}

interface StockCountHistory {
  id: number;
  createdAt: string;
  conductedBy: number | null;
  shop: number;
  stockCountItems: StockCountItem[];
}

const fmt = (n: string | number) => parseFloat(String(n ?? 0));

export default function StockCountHistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { attendant } = useAttendantAuth();
  const { admin } = useAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const goBack = useGoBack("/stock/count");
  const currency = useCurrency();

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: [ENDPOINTS.stockCounts.getAll, shopId, adminId, attendantId, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (shopId) params.append("shopId", String(shopId));
      if (attendant) params.append("attendantId", String(attendant._id));
      const res = await apiRequest("GET", `${ENDPOINTS.stockCounts.getAll}?${params}`);
      return res.json();
    },
    enabled: !!shopId && !!adminId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const allCounts: StockCountHistory[] = Array.isArray(historyData?.data) ? historyData.data : Array.isArray(historyData) ? historyData : [];

  const filtered = allCounts.filter((c) =>
    String(c.id).includes(searchQuery) ||
    String(c.conductedBy ?? "").includes(searchQuery)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Aggregate stats
  const totalSessions = allCounts.length;
  const totalItems = allCounts.reduce((s, c) => s + c.stockCountItems.length, 0);
  const totalVariance = allCounts.reduce((s, c) =>
    s + c.stockCountItems.reduce((ss, i) => ss + fmt(i.variance), 0), 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16);
    doc.text("Stock Count History", pw / 2, 16, { align: "center" });
    doc.setFontSize(10);
    doc.text(`${fromDate} → ${toDate}`, pw / 2, 23, { align: "center" });
    const rows: any[] = [];
    filtered.forEach((c) => {
      const date = new Date(c.createdAt).toLocaleString();
      const by = c.conductedBy ? `#${c.conductedBy}` : "—";
      if (c.stockCountItems.length) {
        c.stockCountItems.forEach((i) => {
          const v = fmt(i.variance);
          rows.push([date, by, i.productName, i.systemCount, i.physicalCount, v > 0 ? `+${v}` : String(v)]);
        });
      } else {
        rows.push([date, by, "—", "—", "—", "0"]);
      }
    });
    autoTable(doc, {
      startY: 30,
      head: [["Date", "By", "Product", "System", "Physical", "Variance"]],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`stock-count-${fromDate}-${toDate}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2 gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <span className="font-semibold text-sm">Stock Count History</span>

          {/* Date range */}
          <div className="flex items-center gap-1.5 ml-2">
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            <span className="text-gray-400 text-xs">→</span>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs w-40" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportPDF}>
              <Download className="h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-b text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{totalSessions}</span> sessions</span>
          <span><span className="font-semibold text-gray-900">{totalItems}</span> items counted</span>
          <span>
            Net variance:{" "}
            <span className={`font-semibold ${totalVariance === 0 ? "text-gray-700" : totalVariance > 0 ? "text-blue-600" : "text-red-500"}`}>
              {totalVariance > 0 ? `+${totalVariance.toFixed(0)}` : totalVariance.toFixed(0)}
            </span>
          </span>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No sessions found for selected period
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Date & Time</th>
                  <th className="text-left px-3 py-2 font-medium">Conducted By</th>
                  <th className="text-center px-3 py-2 font-medium">Items</th>
                  <th className="text-center px-3 py-2 font-medium">Net Variance</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((count) => {
                  const isExpanded = expandedId === count.id;
                  const netVariance = count.stockCountItems.reduce((s, i) => s + fmt(i.variance), 0);

                  return (
                    <React.Fragment key={count.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? "bg-indigo-50/50" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : count.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900 leading-tight">
                            {new Date(count.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(count.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs">
                          {count.conductedBy ? `Attendant #${count.conductedBy}` : "Admin"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            {count.stockCountItems.length}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {count.stockCountItems.length > 0 ? (
                            <span className={`text-xs font-semibold ${netVariance === 0 ? "text-green-600" : netVariance > 0 ? "text-blue-600" : "text-red-500"}`}>
                              {netVariance > 0 ? `+${netVariance.toFixed(0)}` : netVariance.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                      </tr>

                      {/* Expanded items */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0 bg-indigo-50/30">
                            <div className="border-l-4 border-indigo-400 mx-4 my-2 rounded overflow-hidden">
                              {count.stockCountItems.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-gray-400">No items in this session</div>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-indigo-50 border-b border-indigo-100 text-indigo-700">
                                      <th className="text-left px-4 py-1.5 font-medium">Product</th>
                                      <th className="text-center px-3 py-1.5 font-medium">System</th>
                                      <th className="text-center px-3 py-1.5 font-medium">Physical</th>
                                      <th className="text-center px-3 py-1.5 font-medium">Variance</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-indigo-50">
                                    {count.stockCountItems.map((item) => {
                                      const v = fmt(item.variance);
                                      return (
                                        <tr key={item.id} className="bg-white">
                                          <td className="px-4 py-1.5 font-medium text-gray-800">{item.productName}</td>
                                          <td className="text-center px-3 py-1.5 text-gray-500">{item.systemCount}</td>
                                          <td className="text-center px-3 py-1.5 text-gray-700">{item.physicalCount}</td>
                                          <td className="text-center px-3 py-1.5">
                                            <span className={`font-semibold ${v === 0 ? "text-green-600" : v > 0 ? "text-blue-600" : "text-red-500"}`}>
                                              {v > 0 ? `+${v}` : v}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-white text-xs text-gray-500">
            <span>{filtered.length} sessions</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                ‹ Prev
              </Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                Next ›
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
