import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  TrendingUp, ArrowLeft, RefreshCw, Package, AlertTriangle,
  BarChart2, Layers, Tag,
} from "lucide-react";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
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

const QUICK = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
];

const TABS = [
  { id: "sales", label: "Sales Performance", icon: BarChart2 },
  { id: "stock", label: "Stock Health", icon: Layers },
];

export default function ProductsReportPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { primaryShop } = usePrimaryShop();
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/reports");

  const shopId = selectedShopId || primaryShop?.shopId;

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [quickDays, setQuickDays] = useState(30);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [activeTab, setActiveTab] = useState("sales");
  const [salesPage, setSalesPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const PAGE_SIZE = 50;
  const isCustom = quickDays === 0;

  const buildParams = (page = 1) => {
    const base = isCustom
      ? { shopId: shopId || "", from, to }
      : { shopId: shopId || "", from: new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0], to: today };
    return new URLSearchParams({ ...base, page: String(page), limit: String(PAGE_SIZE) });
  };

  const effectiveFrom = isCustom ? from : new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];

  const handleApply = () => { setSalesPage(1); refetch(); };
  const handleQuickDays = (days: number) => { setQuickDays(days); setSalesPage(1); };

  const { data: raw, isLoading: salesLoading, refetch } = useQuery<any>({
    queryKey: ["products-report", shopId, from, to, quickDays, salesPage],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/sales/by-product/detail?${buildParams(salesPage)}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const { data: inventoryData, isLoading: invLoading } = useQuery<any>({
    queryKey: ["inventory-report", shopId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/inventory?shopId=${shopId}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
  });

  const { data: stockValueData, isLoading: svLoading } = useQuery<any>({
    queryKey: ["stock-value-report", shopId, stockPage],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/stock-value?shopId=${shopId}&page=${stockPage}&limit=${PAGE_SIZE}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
  });

  const { data: discountData, isLoading: discLoading } = useQuery<any>({
    queryKey: ["discounted-sales-report", shopId, from, to, quickDays],
    queryFn: async () => {
      const params = new URLSearchParams({ shopId: shopId || "", from: effectiveFrom, to: today });
      const res = await apiRequest("GET", `/api/reports/discounted-sales?${params}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = raw?.rows ?? [];
  const summary = raw?.summary ?? {};
  const salesPagination = raw?.pagination ?? { page: 1, totalPages: 1, total: 0 };
  const inv = inventoryData ?? {};
  const stockRows: any[] = stockValueData?.rows ?? [];
  const stockPagination = stockValueData?.pagination ?? { page: 1, totalPages: 1, total: 0 };
  const discSummary = discountData?.summary ?? {};

  const outOfStock = stockRows.filter(r => n(r.quantity) <= 0);
  const lowStock = stockRows.filter(r => n(r.quantity) > 0 && n(r.quantity) <= 10).sort((a, b) => n(a.quantity) - n(b.quantity));

  const isLoading = salesLoading;
  const stockLoading = invLoading || svLoading;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">Products Report</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
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
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Products — Best Selling First</p>

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
                                      {row.productType && row.productType !== "product" && (
                                        <span className="ml-1.5 text-xs text-gray-400 capitalize">{row.productType}</span>
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
                        {salesPagination.totalPages > 1 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                              Page {salesPagination.page} of {salesPagination.totalPages} &nbsp;·&nbsp; {salesPagination.total} products
                            </p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={salesPagination.page <= 1}
                                onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                              >
                                ← Prev
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={salesPagination.page >= salesPagination.totalPages}
                                onClick={() => setSalesPage(p => Math.min(salesPagination.totalPages, p + 1))}
                              >
                                Next →
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ── STOCK TAB ────────────────────────────────────────────── */}
        {activeTab === "stock" && (
          <>
            {stockLoading && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            )}

            {!stockLoading && (
              <>
                {/* Inventory health cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  <Card className="border-0 shadow-sm bg-blue-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-blue-500 font-medium">Total Products</p>
                      <p className="text-xl font-bold text-blue-700 leading-tight">{n(inv.totalProducts)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 shadow-sm ${n(inv.outofstock) > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        {n(inv.outofstock) > 0 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                        <p className={`text-xs font-medium ${n(inv.outofstock) > 0 ? "text-red-500" : "text-gray-400"}`}>Out of Stock</p>
                      </div>
                      <p className={`text-xl font-bold leading-tight ${n(inv.outofstock) > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {n(inv.outofstock)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={`border-0 shadow-sm ${n(inv.lowstock) > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        {n(inv.lowstock) > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        <p className={`text-xs font-medium ${n(inv.lowstock) > 0 ? "text-amber-500" : "text-gray-400"}`}>Low Stock</p>
                      </div>
                      <p className={`text-xl font-bold leading-tight ${n(inv.lowstock) > 0 ? "text-amber-600" : "text-gray-400"}`}>
                        {n(inv.lowstock)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-purple-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-purple-500 font-medium">Stock Value (Cost)</p>
                      <p className="text-xl font-bold text-purple-700 leading-tight">{fmt(stockValueData?.summary?.totalAtCost)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-indigo-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-indigo-500 font-medium">Stock Value (Retail)</p>
                      <p className="text-xl font-bold text-indigo-700 leading-tight">{fmt(stockValueData?.summary?.totalAtSale)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-green-50">
                    <CardContent className="p-3">
                      <p className="text-xs text-green-500 font-medium">Potential Profit</p>
                      <p className="text-xl font-bold text-green-700 leading-tight">
                        {fmt((stockValueData?.summary?.totalAtSale ?? 0) - (stockValueData?.summary?.totalAtCost ?? 0))}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Out of stock list */}
                {outOfStock.length > 0 && (
                  <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Out of Stock ({outOfStock.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b">
                              <th className="text-left pb-2 font-medium">Product</th>
                              <th className="text-right pb-2 font-medium">Qty</th>
                              <th className="text-right pb-2 font-medium">Buy Price</th>
                              <th className="text-right pb-2 font-medium">Sell Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {outOfStock.map((r: any) => (
                              <tr key={r.productId} className="hover:bg-red-50/50">
                                <td className="py-2 font-medium text-gray-800">{r.productName ?? "—"}</td>
                                <td className="py-2 text-right text-red-600 font-semibold">{qty(r.quantity)}</td>
                                <td className="py-2 text-right text-gray-500">{fmt(r.buyingPrice)}</td>
                                <td className="py-2 text-right text-gray-700">{fmt(r.sellingPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Low stock list */}
                {lowStock.length > 0 && (
                  <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Low Stock — under 10 units ({lowStock.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b">
                              <th className="text-left pb-2 font-medium">Product</th>
                              <th className="text-right pb-2 font-medium">Qty Left</th>
                              <th className="text-right pb-2 font-medium">Stock Value</th>
                              <th className="text-right pb-2 font-medium">Retail Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {lowStock.map((r: any) => (
                              <tr key={r.productId} className="hover:bg-amber-50/50">
                                <td className="py-2 font-medium text-gray-800">{r.productName ?? "—"}</td>
                                <td className="py-2 text-right">
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                    n(r.quantity) <= 3 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {qty(r.quantity)}
                                  </span>
                                </td>
                                <td className="py-2 text-right text-gray-500">{fmt(r.stockValueAtCost)}</td>
                                <td className="py-2 text-right text-gray-700">{fmt(r.stockValueAtSale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {outOfStock.length === 0 && lowStock.length === 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <Package className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-500">All products are well stocked</p>
                      <p className="text-xs text-gray-400 mt-1">No items at or near zero</p>
                    </CardContent>
                  </Card>
                )}

                {/* Full stock value table */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">All Products — Stock Value</p>
                    {stockRows.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No inventory data</p>
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
                                <th className="text-right pb-2 font-medium">Cost Value</th>
                                <th className="text-right pb-2 font-medium">Retail Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {stockRows.map((r: any) => (
                                <tr key={r.productId} className="hover:bg-gray-50">
                                  <td className="py-2 font-medium text-gray-800">{r.productName ?? "—"}</td>
                                  <td className={`py-2 text-right font-semibold ${n(r.quantity) <= 0 ? "text-red-500" : n(r.quantity) <= 10 ? "text-amber-600" : "text-gray-700"}`}>
                                    {qty(r.quantity)}
                                  </td>
                                  <td className="py-2 text-right text-gray-500">{fmt(r.buyingPrice)}</td>
                                  <td className="py-2 text-right text-gray-500">{fmt(r.sellingPrice)}</td>
                                  <td className="py-2 text-right text-gray-700">{fmt(r.stockValueAtCost)}</td>
                                  <td className="py-2 text-right font-medium text-gray-900">{fmt(r.stockValueAtSale)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-bold">
                                <td colSpan={4} className="pt-2 text-gray-700">Total ({stockPagination.total} products)</td>
                                <td className="pt-2 text-right text-purple-700">{fmt(stockValueData?.summary?.totalAtCost)}</td>
                                <td className="pt-2 text-right text-indigo-700">{fmt(stockValueData?.summary?.totalAtSale)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {stockPagination.totalPages > 1 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                              Page {stockPagination.page} of {stockPagination.totalPages} &nbsp;·&nbsp; {stockPagination.total} products
                            </p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={stockPagination.page <= 1}
                                onClick={() => setStockPage(p => Math.max(1, p - 1))}
                              >
                                ← Prev
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={stockPagination.page >= stockPagination.totalPages}
                                onClick={() => setStockPage(p => Math.min(stockPagination.totalPages, p + 1))}
                              >
                                Next →
                              </Button>
                            </div>
                          </div>
                        )}
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
