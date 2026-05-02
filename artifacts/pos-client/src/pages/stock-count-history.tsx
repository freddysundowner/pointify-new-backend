import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, ArrowLeft, Download, RefreshCw, Search, ClipboardList } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useAuth } from "@/features/auth/useAuth";
import { useGoBack } from "@/hooks/useGoBack";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { useCurrency } from "@/utils";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";

interface StockCountItem {
  id: number;
  product: number;
  productName: string;
  physicalCount: string | number;
  systemCount: string | number;
  variance: string | number;
  createdAt: string;
}

interface StockCountSession {
  id: number;
  createdAt: string;
  conductedBy: number | null;
  shop: number;
  stockCountItems: StockCountItem[];
}

interface DateGroup {
  dateKey: string;         // "YYYY-MM-DD"
  label: string;           // "02 May 2026"
  sessions: StockCountSession[];
  totalItems: number;
  totalVariance: number;
}

const fmt = (n: string | number) => parseFloat(String(n ?? 0));

const toDateKey = (iso: string) => iso.slice(0, 10);

const formatDateLabel = (key: string) =>
  new Date(key + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function VarianceBadge({ v }: { v: number }) {
  if (v === 0) return <span className="text-green-600 font-semibold">0</span>;
  if (v > 0)   return <span className="text-blue-600 font-semibold">+{v.toFixed(0)}</span>;
  return              <span className="text-red-500 font-semibold">{v.toFixed(0)}</span>;
}

export default function StockCountHistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate,   setToDate]   = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { attendant } = useAttendantAuth();
  const { admin }     = useAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const goBack        = useGoBack("/stock/count");
  const currency      = useCurrency();
  const shopDetails   = useShopDetails(shopId);

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

  const allSessions: StockCountSession[] = Array.isArray(historyData?.data)
    ? historyData.data
    : Array.isArray(historyData) ? historyData : [];

  // ── Apply search filter across product names within sessions ─────────────
  const q = searchQuery.trim().toLowerCase();
  const filteredSessions = q
    ? allSessions.map(s => ({
        ...s,
        stockCountItems: s.stockCountItems.filter(i =>
          i.productName?.toLowerCase().includes(q),
        ),
      })).filter(s => s.stockCountItems.length > 0)
    : allSessions;

  // ── Group by calendar date ───────────────────────────────────────────────
  const groupMap = new Map<string, StockCountSession[]>();
  for (const s of filteredSessions) {
    const key = toDateKey(s.createdAt);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(s);
  }

  const dateGroups: DateGroup[] = Array.from(groupMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))   // newest date first
    .map(([dateKey, sessions]) => ({
      dateKey,
      label: formatDateLabel(dateKey),
      sessions,
      totalItems:    sessions.reduce((s, c) => s + c.stockCountItems.length, 0),
      totalVariance: sessions.reduce((s, c) =>
        s + c.stockCountItems.reduce((ss, i) => ss + fmt(i.variance), 0), 0),
    }));

  // ── Summary totals ───────────────────────────────────────────────────────
  const totalSessions  = filteredSessions.length;
  const totalItems     = filteredSessions.reduce((s, c) => s + c.stockCountItems.length, 0);
  const totalVariance  = filteredSessions.reduce((s, c) =>
    s + c.stockCountItems.reduce((ss, i) => ss + fmt(i.variance), 0), 0);

  // ── Toggle date group expansion ──────────────────────────────────────────
  const toggleDate = (key: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const expandAll   = () => setExpandedDates(new Set(dateGroups.map(g => g.dateKey)));
  const collapseAll = () => setExpandedDates(new Set());

  // ── PDF export ───────────────────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = drawShopHeader(doc, shopDetails, "Stock Count History",
      `Period: ${fromDate} → ${toDate}${q ? `  |  Filter: "${searchQuery}"` : ""}`);

    dateGroups.forEach((group, gi) => {
      // Date section header
      if (gi > 0) y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 48, 163);   // indigo-700
      doc.text(`${group.label}  (${group.sessions.length} session${group.sessions.length !== 1 ? "s" : ""}, ${group.totalItems} items, variance: ${group.totalVariance >= 0 ? "+" : ""}${group.totalVariance.toFixed(0)})`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 3;

      // Rows for every item in this date's sessions
      const rows: any[] = [];
      group.sessions.forEach(session => {
        const time = formatTime(session.createdAt);
        const by   = session.conductedBy ? `Attendant #${session.conductedBy}` : "Admin";
        if (session.stockCountItems.length === 0) {
          rows.push([time, by, "—", "—", "—", "—"]);
        } else {
          session.stockCountItems.forEach((item, ii) => {
            const v = fmt(item.variance);
            rows.push([
              ii === 0 ? time : "",     // time only on first row of session
              ii === 0 ? by   : "",     // same for "by"
              item.productName,
              String(item.systemCount),
              String(item.physicalCount),
              v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0),
            ]);
          });
        }
      });

      autoTable(doc, {
        startY: y,
        head: [["Time", "By", "Product", "System Qty", "Physical Qty", "Variance"]],
        body: rows,
        styles:      { fontSize: 8, cellPadding: 2 },
        headStyles:  { fillColor: [99, 102, 241], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 28 },
          5: { halign: "center", cellWidth: 20 },
          3: { halign: "center", cellWidth: 22 },
          4: { halign: "center", cellWidth: 24 },
        },
        didParseCell: (data) => {
          // Colour variance cell
          if (data.column.index === 5 && data.section === "body") {
            const raw = String(data.cell.raw ?? "");
            const n   = parseFloat(raw);
            if (!isNaN(n)) {
              data.cell.styles.textColor = n > 0 ? [37, 99, 235] : n < 0 ? [220, 38, 38] : [22, 163, 74];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 5;

      // Prevent running past page; jspdf-autotable handles page breaks but reset y
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 14;
      }
    });

    doc.save(`stock-count-${fromDate}-${toDate}.pdf`);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2 gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <span className="font-semibold text-sm">Stock Count History</span>

          {/* Date range */}
          <div className="flex items-center gap-1.5 ml-2">
            <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); }} className="h-8 text-xs w-36" />
            <span className="text-gray-400 text-xs">→</span>
            <Input type="date" value={toDate}   onChange={e => { setToDate(e.target.value); }}   className="h-8 text-xs w-36" />
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Filter by product…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs w-44"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-indigo-600 hover:text-indigo-700" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500" onClick={collapseAll}>
              Collapse all
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportPDF}>
              <Download className="h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-b text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{dateGroups.length}</span> date{dateGroups.length !== 1 ? "s" : ""}</span>
          <span><span className="font-semibold text-gray-900">{totalSessions}</span> sessions</span>
          <span><span className="font-semibold text-gray-900">{totalItems}</span> items counted</span>
          <span>Net variance: <VarianceBadge v={totalVariance} /></span>
        </div>

        {/* Date groups */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : dateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <ClipboardList className="h-8 w-8 opacity-40" />
              <span>No stock count records found for selected period</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dateGroups.map(group => {
                const isOpen = expandedDates.has(group.dateKey);
                return (
                  <div key={group.dateKey}>
                    {/* ── Date header row ── */}
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50/60 transition-colors ${isOpen ? "bg-indigo-50/40" : "bg-white"}`}
                      onClick={() => toggleDate(group.dateKey)}
                    >
                      {isOpen
                        ? <ChevronDown  className="h-4 w-4 text-indigo-500 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

                      <span className="font-semibold text-gray-800 text-sm w-36 shrink-0">
                        {group.label}
                      </span>

                      <span className="text-xs text-gray-400">
                        {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                      </span>

                      <span className="text-xs text-gray-400">·</span>

                      <span className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{group.totalItems}</span> items
                      </span>

                      <span className="text-xs text-gray-400">·</span>

                      <span className="text-xs">
                        Net variance: <VarianceBadge v={group.totalVariance} />
                      </span>
                    </button>

                    {/* ── Expanded product list ── */}
                    {isOpen && (
                      <div className="border-l-4 border-indigo-400 ml-4 mr-4 mb-2 rounded overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b text-gray-500 uppercase tracking-wide">
                              <th className="text-left px-4 py-1.5 font-medium">Product</th>
                              <th className="text-left px-3 py-1.5 font-medium">Time</th>
                              <th className="text-center px-3 py-1.5 font-medium">System Qty</th>
                              <th className="text-center px-3 py-1.5 font-medium">Physical Qty</th>
                              <th className="text-center px-3 py-1.5 font-medium">Variance</th>
                              <th className="text-left px-3 py-1.5 font-medium">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.sessions.map((session, si) => (
                              <React.Fragment key={session.id}>
                                {/* Session divider — only when >1 session */}
                                {group.sessions.length > 1 && (
                                  <tr className={si > 0 ? "border-t-2 border-indigo-100" : ""}>
                                    <td colSpan={6} className="px-4 py-1 bg-indigo-50/60 text-indigo-600 font-medium text-xs">
                                      Session {si + 1} — {formatTime(session.createdAt)}
                                      <span className="text-indigo-400 font-normal ml-2">
                                        · {session.conductedBy ? `Attendant #${session.conductedBy}` : "Admin"}
                                      </span>
                                    </td>
                                  </tr>
                                )}
                                {session.stockCountItems.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-3 text-gray-400">No items in this session</td>
                                  </tr>
                                ) : session.stockCountItems.map(item => {
                                  const v = fmt(item.variance);
                                  return (
                                    <tr key={item.id} className="border-t border-gray-50 hover:bg-indigo-50/20 transition-colors">
                                      <td className="px-4 py-2 font-medium text-gray-800">{item.productName}</td>
                                      <td className="px-3 py-2 text-gray-400">{formatTime(session.createdAt)}</td>
                                      <td className="text-center px-3 py-2 text-gray-500">{fmt(item.systemCount)}</td>
                                      <td className="text-center px-3 py-2 text-gray-700 font-medium">{fmt(item.physicalCount)}</td>
                                      <td className="text-center px-3 py-2"><VarianceBadge v={v} /></td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                                          v === 0 ? "bg-green-50 text-green-700"
                                          : v > 0  ? "bg-blue-50 text-blue-700"
                                          :          "bg-red-50 text-red-600"}`}>
                                          {v === 0 ? "Balanced" : v > 0 ? "Surplus" : "Shortage"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
