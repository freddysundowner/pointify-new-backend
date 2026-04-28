import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { ArrowLeft, DollarSign, ChevronLeft, ChevronRight, RefreshCw, User } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useGoBack } from "@/hooks/useGoBack";
import { apiRequest } from "@/lib/queryClient";

function fmt(val: any, currency = "KES") {
  const n = Number(val ?? 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: any) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(val: any) {
  if (!val) return "";
  return new Date(val).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function methodColor(m: string) {
  const l = (m ?? "").toLowerCase();
  if (l.includes("cash")) return "bg-green-100 text-green-700";
  if (l.includes("mpesa") || l.includes("m-pesa")) return "bg-emerald-100 text-emerald-700";
  if (l.includes("bank")) return "bg-blue-100 text-blue-700";
  if (l.includes("wallet")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

export default function CollectedPaymentsPage() {
  const [location] = useLocation();
  const goBack = useGoBack("/reports/sales");
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { shop } = usePrimaryShop();
  const shopId = selectedShopId || shop?.id;
  const currency = shop?.currency || "KES";

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const [startDate, setStartDate] = useState(params.get("startDate") || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(params.get("endDate") || new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["collected-payments", shopId, startDate, endDate, page],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (shopId) p.set("shopId", String(shopId));
      if (startDate) p.set("start", startDate);
      if (endDate) p.set("end", endDate);
      p.set("page", String(page));
      p.set("limit", String(limit));
      const res = await apiRequest("GET", `${ENDPOINTS.sales.collectedPayments}?${p}`);
      return res.json();
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = data?.data ?? [];
  const totalCount: number = data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const dateLabel = startDate === endDate
    ? fmtDate(startDate + "T12:00:00")
    : `${fmtDate(startDate + "T12:00:00")} – ${fmtDate(endDate + "T12:00:00")}`;

  return (
    <DashboardLayout>
      <div className="w-full max-w-4xl mx-auto space-y-4 pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Collected Debt</h1>
            <p className="text-xs text-gray-400">{dateLabel}</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        {/* Date filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card className="border-0 shadow-sm bg-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-teal-500 font-medium">Total Collected (this page)</p>
              <p className="text-2xl font-bold text-teal-700 leading-tight">{fmt(totalCollected, currency)}</p>
              <p className="text-xs text-teal-400">{totalCount} transaction{totalCount !== 1 ? "s" : ""} in period</p>
            </div>
          </CardContent>
        </Card>

        {/* Transactions table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <DollarSign className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No collections found</p>
                <p className="text-xs text-gray-400 mt-1">No debt payments were collected in this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium">Date & Time</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Sale</th>
                      <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Method</th>
                      <th className="text-right px-4 py-2.5 font-medium">Collected</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row: any) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{fmtDate(row.paid_at)}</p>
                          <p className="text-xs text-gray-400">{fmtTime(row.paid_at)}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-gray-700 font-mono text-xs">{row.receipt_no || `#${row.sale_id}`}</p>
                          <p className="text-xs text-gray-400">{fmt(row.total_with_discount, currency)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.customer_name ? (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-gray-300 shrink-0" />
                              <div>
                                <p className="text-gray-700 font-medium leading-tight">{row.customer_name}</p>
                                {row.customer_phone && <p className="text-xs text-gray-400">{row.customer_phone}</p>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Walk-in</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${methodColor(row.payment_type)}`}>
                            {row.payment_type ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-bold text-teal-700">{fmt(row.amount, currency)}</p>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {Number(row.balance) > 0
                            ? <p className="text-orange-500 font-medium text-xs">{fmt(row.balance, currency)}</p>
                            : <span className="text-xs text-green-600 font-medium">Cleared</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">Page {page} of {totalPages} · {totalCount} records</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
