import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { TrendingUp, ArrowLeft, RefreshCw, Package } from "lucide-react";
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

const QUICK = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
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
  const isCustom = quickDays === 0;

  const buildParams = () => {
    if (isCustom) return new URLSearchParams({ shopId: shopId || "", from, to });
    const sinceDate = new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];
    return new URLSearchParams({ shopId: shopId || "", from: sinceDate, to: today });
  };

  const { data: raw, isLoading, refetch } = useQuery<any>({
    queryKey: ["products-report", shopId, from, to, quickDays],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/sales/by-product/detail?${buildParams()}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = raw?.rows ?? [];
  const summary = raw?.summary ?? {};

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

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK.map(q => (
            <Button
              key={q.days}
              variant={quickDays === q.days ? "default" : "outline"}
              size="sm"
              className="h-8 text-sm"
              onClick={() => setQuickDays(q.days)}
            >
              {q.label}
            </Button>
          ))}
          {isCustom && (
            <>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
              <span className="text-gray-400 text-sm">to</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
            </>
          )}
          <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-8 gap-1 ml-auto bg-blue-600 hover:bg-blue-700">
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
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-500 font-medium">Total Collected</p>
                  <p className="text-lg font-bold text-blue-700">{fmt(summary.grandRevenue)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-green-50">
                <CardContent className="p-3">
                  <p className="text-xs text-green-500 font-medium">Profit Earned</p>
                  <p className="text-lg font-bold text-green-700">{fmt(summary.grandProfit)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardContent className="p-3">
                  <p className="text-xs text-gray-400 font-medium">Products Sold</p>
                  <p className="text-lg font-bold text-gray-700">{n(summary.productCount)}</p>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b">
                          <th className="text-left pb-2 font-medium">#</th>
                          <th className="text-left pb-2 font-medium">Product</th>
                          <th className="text-right pb-2 font-medium">Units Sold</th>
                          <th className="text-right pb-2 font-medium">Collected</th>
                          <th className="text-right pb-2 font-medium">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {rows.map((row, i) => {
                          const profit = n(row.grossProfit);
                          return (
                            <tr key={row.productId ?? i} className="hover:bg-gray-50">
                              <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                              <td className="py-2.5">
                                <span className="font-medium text-gray-800">{row.productName ?? "—"}</span>
                              </td>
                              <td className="py-2.5 text-right text-gray-600">{qty(row.totalQty)}</td>
                              <td className="py-2.5 text-right font-medium text-gray-900">{fmt(row.totalRevenue)}</td>
                              <td className={`py-2.5 text-right font-semibold ${profit >= 0 ? "text-green-700" : "text-red-500"}`}>
                                {profit > 0 ? fmt(profit) : profit < 0 ? `- ${fmt(Math.abs(profit))}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-bold">
                          <td colSpan={3} className="pt-2 text-gray-700">Total</td>
                          <td className="pt-2 text-right text-blue-700">{fmt(summary.grandRevenue)}</td>
                          <td className="pt-2 text-right text-green-700">{fmt(summary.grandProfit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
