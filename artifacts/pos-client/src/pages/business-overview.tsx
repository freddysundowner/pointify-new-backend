import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  TrendingUp, TrendingDown, ArrowLeft, RefreshCw,
  Users, Package, AlertTriangle, ShoppingBag, Banknote, CreditCard
} from "lucide-react";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { apiRequest } from "@/lib/queryClient";

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? 0 : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const PERIODS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

export default function BusinessOverviewPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { primaryShop } = usePrimaryShop();
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/dashboard");
  const [days, setDays] = useState(30);

  const effectiveShopId = selectedShopId || primaryShop?.shopId;

  const { data: raw, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["business-summary", effectiveShopId, days],
    queryFn: async () => {
      const p = new URLSearchParams({ shopId: effectiveShopId || "", days: String(days) });
      const res = await apiRequest("GET", `/api/reports/business-summary?${p}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const sales = raw?.sales ?? {};
  const profit = raw?.profitability ?? {};
  const receivables = raw?.receivables ?? {};
  const payables = raw?.payables ?? {};
  const inventory = raw?.inventory ?? {};
  const topProducts: any[] = raw?.topProducts ?? [];
  const topCustomers: any[] = raw?.topCustomers ?? [];

  const netProfit = n(profit.netProfit);
  const grossProfit = n(profit.grossProfit);
  const revenue = n(sales.totalRevenue);

  const kpis = [
    { label: "Revenue", value: fmt(revenue), sub: `${n(sales.totalSales)} sales`, color: "blue", Icon: ShoppingBag },
    { label: "Net Profit", value: fmt(netProfit), sub: `${n(profit.netMarginPercent).toFixed(1)}% margin`, color: netProfit >= 0 ? "green" : "red", Icon: netProfit >= 0 ? TrendingUp : TrendingDown },
    { label: "Receivables", value: fmt(receivables.totalReceivables), sub: `${n(receivables.count)} customers owe`, color: "orange", Icon: CreditCard },
    { label: "Payables", value: fmt(payables.totalPayables), sub: `${n(payables.count)} suppliers`, color: "purple", Icon: Banknote },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goBack} className="hidden sm:flex gap-1 px-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">Business Overview</h1>
            <Button variant="outline" size="sm" className="text-xs hidden sm:inline-flex" onClick={() => setLocation("/profit-loss")}>
              Profit & Loss →
            </Button>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 sm:ml-auto flex-wrap">
            {PERIODS.map(p => (
              <Button
                key={p.days}
                variant={days === p.days ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
            <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-7 ml-1 gap-1">
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="text-xs sm:hidden" onClick={() => setLocation("/profit-loss")}>
            Profit & Loss →
          </Button>
        </div>

        {error && (
          <div className="text-center py-6 text-red-500 text-sm">
            Failed to load. <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        )}
        {isLoading && !raw && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        )}

        {raw && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map(({ label, value, sub, color, Icon }) => (
                <Card key={label} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg bg-${color}-100 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 text-${color}-600`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 truncate">{label}</p>
                      <p className={`text-sm font-bold text-${color}-600 truncate`}>{value}</p>
                      <p className="text-xs text-gray-400 truncate">{sub}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 3-column detail */}
            <div className="grid md:grid-cols-3 gap-3">

              {/* Profitability snapshot */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Profitability</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Revenue", value: fmt(revenue), color: "text-blue-700" },
                      { label: "Cost of Goods", value: fmt(profit.totalCost), color: "text-gray-600" },
                      { label: "Gross Profit", value: fmt(grossProfit), color: "text-green-700" },
                      { label: "Gross Margin", value: `${n(profit.grossMarginPercent).toFixed(1)}%`, color: "text-green-700" },
                      { label: "Expenses", value: fmt(profit.totalExpenses), color: "text-orange-600" },
                      { label: "Net Profit", value: fmt(netProfit), color: netProfit >= 0 ? "text-green-700 font-bold" : "text-red-600 font-bold" },
                      { label: "Net Margin", value: `${n(profit.netMarginPercent).toFixed(1)}%`, color: netProfit >= 0 ? "text-green-600" : "text-red-500" },
                      { label: "Avg Order Value", value: fmt(sales.averageOrderValue), color: "text-gray-700" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center border-b border-gray-50 pb-1 last:border-0">
                        <span className="text-gray-500">{label}</span>
                        <span className={color}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Money Owed to You</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Outstanding (customers)</span>
                      <span className="font-semibold text-orange-600">{fmt(receivables.totalReceivables)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">You owe (suppliers)</span>
                      <span className="font-semibold text-red-600">{fmt(payables.totalPayables)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top products */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-blue-500" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Products</p>
                    <span className="text-xs text-gray-400 ml-auto">last {days}d</span>
                  </div>
                  {topProducts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No sales data</p>
                  ) : (
                    <div className="space-y-2">
                      {topProducts.map((p: any, i: number) => {
                        const rev = n(p.totalRevenue);
                        const maxRev = n(topProducts[0]?.totalRevenue);
                        const barW = maxRev > 0 ? Math.round((rev / maxRev) * 100) : 0;
                        return (
                          <div key={p.productId ?? i}>
                            <div className="flex justify-between text-sm mb-0.5">
                              <span className="text-gray-700 truncate max-w-[60%]">{p.productName ?? "Unknown"}</span>
                              <span className="text-gray-500 text-xs">{fmt(rev)} · {n(p.totalQty).toLocaleString()} units</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barW}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inventory health */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inventory Health</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="font-bold text-gray-700">{n(inventory.totalProducts)}</p>
                        <p className="text-gray-400">Products</p>
                      </div>
                      <div className={`rounded p-2 ${n(inventory.lowStock) > 0 ? "bg-yellow-50" : "bg-gray-50"}`}>
                        <p className={`font-bold ${n(inventory.lowStock) > 0 ? "text-yellow-600" : "text-gray-700"}`}>{n(inventory.lowStock)}</p>
                        <p className="text-gray-400">Low Stock</p>
                      </div>
                      <div className={`rounded p-2 ${n(inventory.outOfStock) > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                        <p className={`font-bold ${n(inventory.outOfStock) > 0 ? "text-red-600" : "text-gray-700"}`}>{n(inventory.outOfStock)}</p>
                        <p className="text-gray-400">Out of Stock</p>
                      </div>
                    </div>
                    {n(inventory.outOfStock) > 0 && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {n(inventory.outOfStock)} product(s) need restocking
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top customers + quick links */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-green-500" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Customers</p>
                    <span className="text-xs text-gray-400 ml-auto">last {days}d</span>
                  </div>
                  {topCustomers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No customer data</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {topCustomers.map((c: any, i: number) => (
                        <div key={c.customerId ?? i} className="flex justify-between items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-xs font-bold text-green-700">
                              {i + 1}
                            </div>
                            <span className="text-gray-700 truncate">{c.customerName ?? "Walk-in"}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-medium text-xs">{fmt(c.totalSpent)}</p>
                            <p className="text-gray-400 text-xs">{n(c.totalSales)} orders</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick action links */}
                  <div className="mt-4 pt-3 border-t space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reports</p>
                    {[
                      { label: "Profit & Loss", path: "/profit-loss" },
                      { label: "Debtors & Credit", path: "/debtors" },
                      { label: "Sales", path: "/sales" },
                      { label: "Inventory", path: "/inventory" },
                    ].map(({ label, path }) => (
                      <Button
                        key={path}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => setLocation(path)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Alerts / action items */}
            {(n(receivables.totalReceivables) > 0 || n(payables.totalPayables) > 0 || n(inventory.outOfStock) > 0) && (
              <Card className="border-0 shadow-sm border-l-4 border-l-orange-400 bg-orange-50">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1.5 uppercase tracking-wide">Action Items</p>
                  <div className="space-y-1 text-sm">
                    {n(receivables.totalReceivables) > 0 && (
                      <p className="text-orange-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {fmt(receivables.totalReceivables)} outstanding from {n(receivables.count)} customer(s) — collect payments
                      </p>
                    )}
                    {n(payables.totalPayables) > 0 && (
                      <p className="text-orange-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {fmt(payables.totalPayables)} owed to {n(payables.count)} supplier(s) — clear balances
                      </p>
                    )}
                    {n(inventory.outOfStock) > 0 && (
                      <p className="text-orange-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {n(inventory.outOfStock)} product(s) out of stock — reorder now
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
