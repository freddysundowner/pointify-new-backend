import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  TrendingUp, ArrowLeft, RefreshCw, Package,
  BarChart2, Tag, Download, Search, ArrowUpDown,
  TrendingDown, Filter, X,
} from "lucide-react";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useGoBack } from "@/hooks/useGoBack";
import { apiRequest } from "@/lib/queryClient";

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const qty = (v: any) => {
  const num = n(v);
  return isNaN(num) ? "0" : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const pct = (v: any) => `${Math.round(n(v))}%`;

const downloadCSV = (rows: any[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const val = r[h] ?? "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const QUICK = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
];

const TABS = [
  { id: "sales", label: "Sales Performance", icon: BarChart2 },
  { id: "slow", label: "Slow Movers", icon: TrendingDown },
];

export default function ProductsReportPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { primaryShop } = usePrimaryShop();
  const goBack = useGoBack("/reports");

  const shopId = selectedShopId || primaryShop?.shopId;

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [quickDays, setQuickDays] = useState(30);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [activeTab, setActiveTab] = useState("sales");

  // Sales tab state
  const [salesPage, setSalesPage] = useState(1);
  const [salesSort, setSalesSort] = useState<"desc" | "asc">("desc");
  const [salesCategory, setSalesCategory] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesSearchInput, setSalesSearchInput] = useState("");

  // Slow movers tab state
  const [slowPage, setSlowPage] = useState(1);

  const PAGE_SIZE = 50;
  const isCustom = quickDays === 0;

  const effectiveFrom = isCustom ? from : new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];
  const effectiveTo = today;

  const buildSalesParams = (page = 1) => {
    const p = new URLSearchParams({
      shopId: shopId || "",
      from: effectiveFrom,
      to: effectiveTo,
      page: String(page),
      limit: String(PAGE_SIZE),
      sort: salesSort,
    });
    if (salesCategory) p.set("categoryId", salesCategory);
    if (salesSearch) p.set("search", salesSearch);
    return p;
  };

  const handleApply = () => { setSalesPage(1); setSlowPage(1); };
  const handleQuickDays = (days: number) => { setQuickDays(days); setSalesPage(1); setSlowPage(1); };

  const handleSalesSearch = () => { setSalesSearch(salesSearchInput); setSalesPage(1); };
  const clearSalesSearch = () => { setSalesSearch(""); setSalesSearchInput(""); setSalesPage(1); };

  // Categories
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["categories", shopId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/categories?shopId=${shopId}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
  const categories: any[] = Array.isArray(categoriesData) ? categoriesData : [];

  // Sales report
  const { data: raw, isLoading: salesLoading, refetch: refetchSales } = useQuery<any>({
    queryKey: ["products-report", shopId, effectiveFrom, effectiveTo, salesPage, salesSort, salesCategory, salesSearch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/sales/by-product/detail?${buildSalesParams(salesPage)}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  // Discounted sales
  const { data: discountData, isLoading: discLoading } = useQuery<any>({
    queryKey: ["discounted-sales-report", shopId, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const params = new URLSearchParams({ shopId: shopId || "", from: effectiveFrom, to: effectiveTo });
      const res = await apiRequest("GET", `/api/reports/discounted-sales?${params}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  // Slow movers
  const { data: slowData, isLoading: slowLoading } = useQuery<any>({
    queryKey: ["slow-movers", shopId, effectiveFrom, effectiveTo, slowPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: shopId || "",
        from: effectiveFrom,
        to: effectiveTo,
        page: String(slowPage),
        limit: String(PAGE_SIZE),
      });
      const res = await apiRequest("GET", `/api/reports/slow-movers?${params}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId && activeTab === "slow",
    staleTime: 0,
  });

  // Derived data
  const rows: any[] = raw?.rows ?? [];
  const summary = raw?.summary ?? {};
  const salesPagination = raw?.pagination ?? { page: 1, totalPages: 1, total: 0 };
  const discSummary = discountData?.summary ?? {};
  const slowRows: any[] = slowData?.rows ?? [];
  const slowSummary = slowData?.summary ?? {};
  const slowPagination = slowData?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  const isLoading = salesLoading;

  // Pagination controls component
  const PaginationBar = ({ pg, onPrev, onNext }: { pg: any; onPrev: () => void; onNext: () => void }) =>
    pg.totalPages > 1 ? (
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Page {pg.page} of {pg.totalPages} &nbsp;·&nbsp; {pg.total} products
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pg.page <= 1} onClick={onPrev}>← Prev</Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pg.page >= pg.totalPages} onClick={onNext}>Next →</Button>
        </div>
      </div>
    ) : null;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="hidden sm:flex gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">Products Report</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── SALES TAB ────────────────────────────────────────────── */}
        {activeTab === "sales" && (
          <>
            {/* Period + filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK.map(q => (
                <Button
                  key={q.days}
                  variant={quickDays === q.days ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-sm"
                  onClick={() => handleQuickDays(q.days)}
                >
                  {q.label}
                </Button>
              ))}
              {isCustom && (
                <>
                  <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setSalesPage(1); }} className="h-8 text-sm w-36" />
                  <span className="text-gray-400 text-sm">to</span>
                  <Input type="date" value={to} onChange={e => { setTo(e.target.value); setSalesPage(1); }} className="h-8 text-sm w-36" />
                </>
              )}
              <Button size="sm" onClick={handleApply} disabled={isLoading} className="h-8 gap-1 ml-auto bg-blue-600 hover:bg-blue-700">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Apply
              </Button>
            </div>

            {/* Search + Category + Sort bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search product…"
                    value={salesSearchInput}
                    onChange={e => setSalesSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSalesSearch()}
                    className="h-8 pl-7 pr-7 text-sm"
                  />
                  {salesSearchInput && (
                    <button onClick={clearSalesSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={handleSalesSearch}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {categories.length > 0 && (
                  <div className="flex items-center gap-1 flex-1 sm:flex-none">
                    <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <select
                      value={salesCategory}
                      onChange={e => { setSalesCategory(e.target.value); setSalesPage(1); }}
                      className="h-8 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700 flex-1 sm:flex-none"
                    >
                      <option value="">All categories</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 gap-1 text-xs shrink-0"
                  onClick={() => { setSalesSort(s => s === "desc" ? "asc" : "desc"); setSalesPage(1); }}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {salesSort === "desc" ? "Best first" : "Worst first"}
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            )}

            {!isLoading && (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <Card className="border-0 shadow-sm bg-blue-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-blue-500 font-medium">Revenue</p>
                      <p className="text-lg font-bold text-blue-700 leading-tight">{fmt(summary.grandRevenue)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-green-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-green-500 font-medium">Gross Profit</p>
                      <p className="text-lg font-bold text-green-700 leading-tight">{fmt(summary.grandProfit)}</p>
                      <p className="text-xs text-green-400">{pct(summary.overallMarginPercent)} margin</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gray-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400 font-medium">Products Sold</p>
                      <p className="text-lg font-bold text-gray-700 leading-tight">{n(summary.productCount)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 shadow-sm ${n(discSummary.totalDiscount) > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Tag className={`h-3 w-3 ${n(discSummary.totalDiscount) > 0 ? "text-amber-500" : "text-gray-300"}`} />
                        <p className={`text-xs font-medium ${n(discSummary.totalDiscount) > 0 ? "text-amber-500" : "text-gray-400"}`}>Discounts Given</p>
                      </div>
                      <p className={`text-lg font-bold leading-tight ${n(discSummary.totalDiscount) > 0 ? "text-amber-700" : "text-gray-400"}`}>
                        {discLoading ? "…" : fmt(discSummary.totalDiscount)}
                      </p>
                      {n(discSummary.totalSales) > 0 && (
                        <p className="text-xs text-amber-400">{n(discSummary.totalSales)} discounted sale{n(discSummary.totalSales) !== 1 ? "s" : ""}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Products table */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Products — {salesSort === "desc" ? "Best Selling First" : "Worst Selling First"}
                        {salesSearch && <span className="ml-1 normal-case font-normal text-blue-500">· "{salesSearch}"</span>}
                        {salesCategory && categories.length > 0 && (
                          <span className="ml-1 normal-case font-normal text-blue-500">
                            · {categories.find((c: any) => String(c.id) === salesCategory)?.name}
                          </span>
                        )}
                      </p>
                      {rows.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => downloadCSV(
                            rows.map((r, i) => ({
                              "#": (salesPagination.page - 1) * PAGE_SIZE + i + 1,
                              Product: r.productName ?? "",
                              Category: r.categoryName ?? "",
                              Type: r.productType ?? "",
                              Units: qty(r.totalQty),
                              "Revenue (KES)": n(r.totalRevenue),
                              "Cost (KES)": n(r.totalCost),
                              "Gross Profit (KES)": n(r.grossProfit),
                              "Margin %": n(r.marginPercent),
                            })),
                            "sales-by-product.csv"
                          )}
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </Button>
                      )}
                    </div>

                    {rows.length === 0 ? (
                      <div className="text-center py-10">
                        <Package className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No sales found in this period</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 border-b">
                                <th className="text-left pb-2 font-medium">#</th>
                                <th className="text-left pb-2 font-medium">Product</th>
                                <th className="text-right pb-2 font-medium">Units</th>
                                <th className="text-right pb-2 font-medium">Revenue</th>
                                <th className="text-right pb-2 font-medium">Profit</th>
                                <th className="text-right pb-2 font-medium">Margin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {rows.map((row, i) => {
                                const profit = n(row.grossProfit);
                                const margin = n(row.marginPercent);
                                const globalIndex = (salesPagination.page - 1) * PAGE_SIZE + i + 1;
                                return (
                                  <tr key={row.productId ?? i} className="hover:bg-gray-50">
                                    <td className="py-2.5 text-gray-400 text-xs">{globalIndex}</td>
                                    <td className="py-2.5">
                                      <span className="font-medium text-gray-800">{row.productName ?? "—"}</span>
                                      {row.categoryName && (
                                        <span className="ml-1.5 text-xs text-gray-400">{row.categoryName}</span>
                                      )}
                                      {row.productType && row.productType !== "product" && (
                                        <span className="ml-1.5 text-xs text-gray-300 capitalize">{row.productType}</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-right text-gray-600">{qty(row.totalQty)}</td>
                                    <td className="py-2.5 text-right font-medium text-gray-900">{fmt(row.totalRevenue)}</td>
                                    <td className={`py-2.5 text-right font-semibold ${profit >= 0 ? "text-green-700" : "text-red-500"}`}>
                                      {profit > 0 ? fmt(profit) : profit < 0 ? `-${fmt(Math.abs(profit))}` : "—"}
                                    </td>
                                    <td className="py-2.5 text-right">
                                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                        margin >= 30 ? "bg-green-100 text-green-700"
                                        : margin >= 10 ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-600"
                                      }`}>
                                        {pct(margin)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-bold">
                                <td colSpan={3} className="pt-2 text-gray-700">Total ({salesPagination.total} products)</td>
                                <td className="pt-2 text-right text-blue-700">{fmt(summary.grandRevenue)}</td>
                                <td className="pt-2 text-right text-green-700">{fmt(summary.grandProfit)}</td>
                                <td className="pt-2 text-right">
                                  <span className="text-xs text-gray-500">{pct(summary.overallMarginPercent)}</span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <PaginationBar
                          pg={salesPagination}
                          onPrev={() => setSalesPage(p => Math.max(1, p - 1))}
                          onNext={() => setSalesPage(p => Math.min(salesPagination.totalPages, p + 1))}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ── SLOW MOVERS TAB ──────────────────────────────────────── */}
        {activeTab === "slow" && (
          <>
            {/* Period selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK.map(q => (
                <Button
                  key={q.days}
                  variant={quickDays === q.days ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-sm"
                  onClick={() => handleQuickDays(q.days)}
                >
                  {q.label}
                </Button>
              ))}
              {isCustom && (
                <>
                  <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setSlowPage(1); }} className="h-8 text-sm w-36" />
                  <span className="text-gray-400 text-sm">to</span>
                  <Input type="date" value={to} onChange={e => { setTo(e.target.value); setSlowPage(1); }} className="h-8 text-sm w-36" />
                </>
              )}
              <Button size="sm" onClick={handleApply} disabled={slowLoading} className="h-8 gap-1 ml-auto bg-blue-600 hover:bg-blue-700">
                <RefreshCw className={`h-3.5 w-3.5 ${slowLoading ? "animate-spin" : ""}`} />
                Apply
              </Button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
              Showing products that have stock on hand but <strong>zero sales</strong> between <strong>{effectiveFrom}</strong> and <strong>{effectiveTo}</strong>.
            </div>

            {slowLoading && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            )}

            {!slowLoading && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <Card className="border-0 shadow-sm bg-amber-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-amber-500 font-medium">Slow Mover Products</p>
                      <p className="text-xl font-bold text-amber-700 leading-tight">{n(slowSummary.total)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-purple-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-purple-500 font-medium">Stock Tied Up (Cost)</p>
                      <p className="text-xl font-bold text-purple-700 leading-tight">{fmt(slowSummary.totalAtCost)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-indigo-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-indigo-500 font-medium">Retail Value (if sold)</p>
                      <p className="text-xl font-bold text-indigo-700 leading-tight">{fmt(slowSummary.totalAtSale)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Products with no sales in period
                      </p>
                      {slowRows.length > 0 && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => downloadCSV(
                            slowRows.map(r => ({
                              Product: r.productName ?? "",
                              Type: r.productType ?? "",
                              "Qty On Hand": n(r.quantity),
                              "Reorder Level": n(r.reorderLevel),
                              "Buy Price (KES)": n(r.buyingPrice),
                              "Sell Price (KES)": n(r.sellingPrice),
                              "Stock Value Cost (KES)": n(r.stockValueAtCost),
                              "Stock Value Retail (KES)": n(r.stockValueAtSale),
                            })),
                            "slow-movers.csv"
                          )}
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </Button>
                      )}
                    </div>

                    {slowRows.length === 0 ? (
                      <div className="text-center py-10">
                        <TrendingDown className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-500">No slow movers</p>
                        <p className="text-xs text-gray-400 mt-1">All stocked products had sales in this period</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 border-b">
                                <th className="text-left pb-2 font-medium">Product</th>
                                <th className="text-right pb-2 font-medium">Qty</th>
                                <th className="text-right pb-2 font-medium">Buy Price</th>
                                <th className="text-right pb-2 font-medium">Sell Price</th>
                                <th className="text-right pb-2 font-medium">Stock Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {slowRows.map((r: any, i: number) => (
                                <tr key={r.productId ?? i} className="hover:bg-amber-50/40">
                                  <td className="py-2.5">
                                    <span className="font-medium text-gray-800">{r.productName ?? "—"}</span>
                                    {r.productType && r.productType !== "product" && (
                                      <span className="ml-1.5 text-xs text-gray-400 capitalize">{r.productType}</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right font-semibold text-gray-700">{qty(r.quantity)}</td>
                                  <td className="py-2.5 text-right text-gray-500">{fmt(r.buyingPrice)}</td>
                                  <td className="py-2.5 text-right text-gray-500">{fmt(r.sellingPrice)}</td>
                                  <td className="py-2.5 text-right text-purple-700 font-medium">{fmt(r.stockValueAtCost)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-bold">
                                <td colSpan={4} className="pt-2 text-gray-700">Total ({slowPagination.total} products)</td>
                                <td className="pt-2 text-right text-purple-700">{fmt(slowSummary.totalAtCost)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <PaginationBar
                          pg={slowPagination}
                          onPrev={() => setSlowPage(p => Math.max(1, p - 1))}
                          onNext={() => setSlowPage(p => Math.min(slowPagination.totalPages, p + 1))}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
