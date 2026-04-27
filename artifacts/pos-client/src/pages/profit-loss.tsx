import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { TrendingUp, TrendingDown, ShoppingCart, Receipt, Calculator, ArrowLeft, RefreshCw } from "lucide-react";
import { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

interface ProfitLossData {
  creditTotals: number;
  debtPaid: number;
  totalProfitAndSalesValue: {
    totalProfit: number;
    totalCashSales: number;
    totalSales: number;
    totalPurchases: number;
    totalTaxes: number;
  };
  badStockValue: { badStockValue: number };
  totalExpenses: { totalExpenses: number };
  totalTaxes: number;
  gross: number;
  net: number;
}

interface Attendant {
  _id: string;
  username: string;
  uniqueDigits: number;
}

const fmt = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(n)) return "KES 0";
  return `KES ${n.toLocaleString()}`;
};

export default function ProfitLossPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { user } = useSelector((state: RootState) => state.auth);
  const { attendant } = useAttendantAuth();
  const { primaryShop } = usePrimaryShop();
  const [, setLocation] = useLocation();

  const effectiveShopId = selectedShopId || primaryShop?.shopId;
  const effectiveAdminId = user?.id || attendant?.adminId;

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [selectedAttendant, setSelectedAttendant] = useState("all");

  const { data: attendants = [] } = useQuery<Attendant[]>({
    queryKey: [ENDPOINTS.attendants.getByShop, effectiveShopId, effectiveAdminId],
    queryFn: async () => {
      const p = new URLSearchParams({ shopId: effectiveShopId || "", adminId: effectiveAdminId || "" });
      const res = await apiRequest("GET", `${ENDPOINTS.attendants.getByShop}?${p}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    select: (raw: any) => Array.isArray(raw) ? raw : (raw?.data ?? []),
    enabled: !!effectiveShopId && !!effectiveAdminId && !!user,
  });

  const queryUrl = (() => {
    const p = new URLSearchParams({ shopId: effectiveShopId || "", fromDate, toDate });
    if (selectedAttendant && selectedAttendant !== "all") p.append("attendant", selectedAttendant);
    return `${ENDPOINTS.analytics.netProfit}?${p}`;
  })();

  const { data: d, isLoading, error, refetch } = useQuery<ProfitLossData>({
    queryKey: [queryUrl, effectiveShopId, fromDate, toDate, selectedAttendant],
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const totalCosts = d
    ? d.totalProfitAndSalesValue.totalPurchases +
      d.totalExpenses.totalExpenses +
      d.badStockValue.badStockValue +
      d.totalTaxes
    : 0;

  const profitMargin = d && d.totalProfitAndSalesValue.totalSales > 0
    ? ((d.net / d.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)
    : "0.0";

  return (
    <DashboardLayout>
      <div className="p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/dashboard")} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-900">Profit & Loss</h1>
          </div>

          {/* Inline filters */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-sm w-36" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-sm w-36" />
            {user && (
              <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue placeholder="All attendants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All attendants</SelectItem>
                  {(Array.isArray(attendants) ? attendants : []).map(a => (
                    <SelectItem key={a._id} value={a._id}>{a.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => refetch()} className="h-8 gap-1 bg-purple-600 hover:bg-purple-700">
              <RefreshCw className="h-3.5 w-3.5" /> Apply
            </Button>
          </div>
        </div>

        {/* Loading / error */}
        {isLoading && (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}
        {error && (
          <div className="text-center py-8 text-red-500 text-sm">Failed to load data. <button onClick={() => refetch()} className="underline">Retry</button></div>
        )}

        {d && (
          <>
            {/* 4 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Sales", value: fmt(d.totalProfitAndSalesValue.totalSales), color: "blue", Icon: ShoppingCart },
                { label: "Gross Profit", value: fmt(d.gross), color: "green", Icon: TrendingUp },
                { label: "Net Profit", value: fmt(d.net), color: d.net >= 0 ? "green" : "red", Icon: d.net >= 0 ? TrendingUp : TrendingDown },
                { label: "Expenses", value: fmt(d.totalExpenses.totalExpenses), color: "orange", Icon: Receipt },
              ].map(({ label, value, color, Icon }) => (
                <Card key={label} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg bg-${color}-100 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 text-${color}-600`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 truncate">{label}</p>
                      <p className={`text-sm font-bold text-${color}-600 truncate`}>{value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Breakdown table + summary side by side */}
            <div className="grid md:grid-cols-3 gap-3">

              {/* Revenue */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue</p>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ["Total Sales", fmt(d.totalProfitAndSalesValue.totalSales)],
                      ["Cash Sales", fmt(d.totalProfitAndSalesValue.totalCashSales)],
                      ["Credit Sales", fmt(d.creditTotals)],
                      ["Debt Collected", fmt(d.debtPaid)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1.5 border-t font-semibold text-green-700">
                      <span>Total Revenue</span>
                      <span>{fmt(d.totalProfitAndSalesValue.totalSales + d.debtPaid)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Costs */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Costs</p>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ["Purchases", fmt(d.totalProfitAndSalesValue.totalPurchases)],
                      ["Expenses", fmt(d.totalExpenses.totalExpenses)],
                      ["Bad Stock", fmt(d.badStockValue.badStockValue)],
                      ["Taxes", fmt(d.totalTaxes)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1.5 border-t font-semibold text-orange-700">
                      <span>Total Costs</span>
                      <span>{fmt(totalCosts)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gross Profit</span>
                      <span className="font-medium text-green-700">{fmt(d.gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profit Margin</span>
                      <span className="font-medium">
                        {d.totalProfitAndSalesValue.totalSales > 0
                          ? `${((d.totalProfitAndSalesValue.totalProfit / d.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tax Rate</span>
                      <span className="font-medium">
                        {d.totalProfitAndSalesValue.totalSales > 0
                          ? `${((d.totalTaxes / d.totalProfitAndSalesValue.totalSales) * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                    <div className={`flex justify-between pt-2 border-t font-bold text-base ${d.net >= 0 ? "text-green-700" : "text-red-600"}`}>
                      <span>Net Profit</span>
                      <span>{fmt(d.net)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Net Margin</span>
                      <span className={d.net >= 0 ? "text-green-600" : "text-red-500"}>{profitMargin}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
