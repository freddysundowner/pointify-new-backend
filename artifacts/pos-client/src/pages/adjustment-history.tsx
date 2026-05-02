import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Package, Plus, Minus } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useGoBack } from "@/hooks/useGoBack";

const fmt = (n: any) => parseFloat(String(n ?? 0));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
  " " + new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function AdjustmentHistoryPage() {
  const [location] = useLocation();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const goBack = useGoBack("/stock/products");

  const pathParts = location.split("/");
  const productId = pathParts[pathParts.indexOf("adjustment-history") + 1];

  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [fromDate,    setFromDate]    = useState(thirtyAgo);
  const [toDate,      setToDate]      = useState(today);
  const [filterType,  setFilterType]  = useState("all");
  const [page,        setPage]        = useState(1);
  const limit = 20;

  const shopId = selectedShopId || "";

  const { data: productResp } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => (await apiCall(ENDPOINTS.products.getById(productId))).json(),
    enabled: !!productId,
  });
  const product = productResp?.data ?? productResp;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["adj-history", productId, shopId, fromDate, toDate, filterType, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: String(shopId),
        page: String(page),
        limit: String(limit),
        ...(filterType !== "all" && { type: filterType }),
      });
      return (await apiCall(`${ENDPOINTS.products.stockHistory(productId)}?${params}`)).json();
    },
    enabled: !!productId,
    staleTime: 0,
  });

  const records: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total      = data?.meta?.total ?? records.length;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-white flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2 gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>

          <div className="leading-tight">
            <span className="font-semibold text-sm">Adjustment History</span>
            {product?.name && (
              <span className="ml-1.5 text-xs text-gray-400">— {product.name}</span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="add">Stock In</SelectItem>
                <SelectItem value="remove">Stock Out</SelectItem>
              </SelectContent>
            </Select>

            <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="h-8 text-xs w-34" />
            <span className="text-gray-400 text-xs">→</span>
            <Input type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} className="h-8 text-xs w-34" />

            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-50 border-b text-xs text-gray-500">
          <span><span className="font-semibold text-gray-800">{total}</span> records</span>
          {filterType !== "all" && (
            <span className="capitalize text-indigo-600 font-medium">{filterType === "add" ? "Stock In only" : "Stock Out only"}</span>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <Package className="h-8 w-8 opacity-40" />
              <span className="text-sm">No adjustment records found</span>
              <span className="text-xs">Try a wider date range or different filter</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Date & Time</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Before</th>
                  <th className="text-right px-3 py-2 font-medium">Change</th>
                  <th className="text-right px-3 py-2 font-medium">After</th>
                  <th className="text-left px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r: any, i: number) => {
                  const isAdd = r.type === "add" || (r.kind !== "adjustment" && fmt(r.quantityAdjusted ?? 0) > 0);
                  const qty   = fmt(r.quantityAdjusted ?? Math.abs(fmt(r.after) - fmt(r.before)));
                  return (
                    <tr key={r.id ?? i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(r.createdAt ?? r.date)}
                      </td>
                      <td className="px-3 py-2">
                        {isAdd ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                            <Plus className="h-3 w-3" /> Stock In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            <Minus className="h-3 w-3" /> Stock Out
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500">
                        {fmt(r.quantityBefore ?? r.before ?? 0)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${isAdd ? "text-teal-600" : "text-orange-600"}`}>
                        {isAdd ? "+" : "-"}{qty}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700 font-medium">
                        {fmt(r.quantityAfter ?? r.after ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {r.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-white text-xs text-gray-500">
            <span>{total} records · page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                ‹ Prev
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next ›
              </Button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
