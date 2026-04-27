import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DollarSign, ArrowLeft, RefreshCw, CreditCard, Smartphone, Banknote, Building, Clock } from "lucide-react";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const METHOD_ICONS: Record<string, any> = {
  cash: Banknote, mpesa: Smartphone, mpesa_stk: Smartphone,
  bank: Building, card: CreditCard, wallet: CreditCard, credit: CreditCard,
};
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", mpesa: "M-Pesa", mpesa_stk: "M-Pesa (STK)",
  bank: "Bank Transfer", card: "Card", wallet: "Wallet", credit: "Credit",
};
const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700",
  mpesa: "bg-emerald-100 text-emerald-700",
  mpesa_stk: "bg-emerald-100 text-emerald-700",
  bank: "bg-blue-100 text-blue-700",
  card: "bg-indigo-100 text-indigo-700",
  wallet: "bg-purple-100 text-purple-700",
  credit: "bg-orange-100 text-orange-700",
};

const QUICK = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
];

export default function SalesReportPage() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { primaryShop } = usePrimaryShop();
  const [, setLocation] = useLocation();

  const shopId = selectedShopId || primaryShop?.shopId;

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  // Default to Today
  const [quickDays, setQuickDays] = useState(1);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const isCustom = quickDays === 0;

  const buildParams = () => {
    if (isCustom) return new URLSearchParams({ shopId: shopId || "", from, to });
    const sinceDate = new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];
    return new URLSearchParams({ shopId: shopId || "", from: sinceDate, to: today });
  };

  const { data: paymentData, isLoading: loadingPay, refetch: refetchPay } = useQuery<any>({
    queryKey: ["sales-by-payment", shopId, from, to, quickDays],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/sales/by-payment-method?${buildParams()}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const { data: dailyData, isLoading: loadingDaily, refetch: refetchDaily } = useQuery<any>({
    queryKey: ["sales-daily", shopId, from, to, quickDays],
    queryFn: async () => {
      const daysParam = isCustom ? 365 : quickDays;
      const p = new URLSearchParams({ shopId: shopId || "", days: String(daysParam) });
      const res = await apiRequest("GET", `/api/reports/sales/daily?${p}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const paymentRows: any[] = paymentData?.rows ?? [];
  const cashCollected = n(paymentData?.grandTotal);
  const dailyRows: any[] = (dailyData?.rows ?? []).slice().reverse();

  const totalSalesValue = dailyRows.reduce((s: number, r: any) => s + n(r.totalRevenue), 0);
  const totalTransactions = dailyRows.reduce((s: number, r: any) => s + n(r.totalSales), 0);
  const totalOnCredit = Math.max(0, totalSalesValue - cashCollected);

  const refetch = () => { refetchPay(); refetchDaily(); };
  const isLoading = loadingPay || loadingDaily;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/reports")} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Reports
          </Button>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h1 className="text-lg font-bold text-gray-900">Sales Report</h1>
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
          <Button size="sm" onClick={refetch} disabled={isLoading} className="h-8 gap-1 ml-auto bg-green-600 hover:bg-green-700">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Apply
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Summary cards — 4 across */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-600 font-medium mb-1">Total Sales</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(totalSalesValue)}</p>
                  <p className="text-xs text-blue-400 mt-1">{totalTransactions} transaction{totalTransactions !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-green-50">
                <CardContent className="p-4">
                  <p className="text-xs text-green-600 font-medium mb-1">Cash & M-Pesa Received</p>
                  <p className="text-xl font-bold text-green-700">{fmt(cashCollected)}</p>
                  <p className="text-xs text-green-400 mt-1">actual payments collected</p>
                </CardContent>
              </Card>
              <Card className={`border-0 shadow-sm ${totalOnCredit > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                <CardContent className="p-4">
                  <p className={`text-xs font-medium mb-1 ${totalOnCredit > 0 ? "text-orange-600" : "text-gray-400"}`}>Still on Credit</p>
                  <p className={`text-xl font-bold ${totalOnCredit > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmt(totalOnCredit)}</p>
                  <p className={`text-xs mt-1 ${totalOnCredit > 0 ? "text-orange-400" : "text-gray-400"}`}>
                    {totalOnCredit > 0 ? "not yet paid by customers" : "all paid"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1">Transactions</p>
                  <p className="text-xl font-bold text-gray-700">{totalTransactions}</p>
                  <p className="text-xs text-gray-400 mt-1">completed sales</p>
                </CardContent>
              </Card>
            </div>

            {/* Payment breakdown */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How Payments Were Received</p>

                {paymentRows.length === 0 && totalOnCredit === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No sales in this period</p>
                )}

                {paymentRows.length === 0 && totalOnCredit > 0 && (
                  <div className="flex items-center gap-3 py-4 px-3 bg-orange-50 rounded-lg">
                    <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-800">All sales are on credit</p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        {fmt(totalOnCredit)} sold but not yet paid — customers owe this amount
                      </p>
                    </div>
                  </div>
                )}

                {paymentRows.length > 0 && (
                  <div className="space-y-3">
                    {paymentRows.map(row => {
                      const amt = n(row.totalAmount);
                      const Icon = METHOD_ICONS[row.paymentType] ?? CreditCard;
                      const colorClass = METHOD_COLORS[row.paymentType] ?? "bg-gray-100 text-gray-700";
                      const barW = cashCollected > 0 ? Math.round((amt / cashCollected) * 100) : 0;
                      return (
                        <div key={row.paymentType}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${colorClass}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-medium text-gray-800">
                                {METHOD_LABELS[row.paymentType] ?? row.paymentType}
                              </span>
                              <span className="text-xs text-gray-400">({n(row.saleCount)} sales)</span>
                            </div>
                            <span className="font-bold text-gray-900">{fmt(amt)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-9">
                            <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      );
                    })}

                    {/* Show credit remainder if any */}
                    {totalOnCredit > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600">
                              <Clock className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium text-gray-800">Credit (unpaid)</span>
                          </div>
                          <span className="font-bold text-orange-600">{fmt(totalOnCredit)}</span>
                        </div>
                        <div className="h-2 bg-orange-100 rounded-full overflow-hidden ml-9">
                          <div className="h-full bg-orange-300 rounded-full" style={{ width: `${totalSalesValue > 0 ? Math.round((totalOnCredit / totalSalesValue) * 100) : 0}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t font-bold text-base">
                      <span className="text-gray-700">Total Sales Value</span>
                      <span className="text-blue-700">{fmt(totalSalesValue)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily breakdown */}
            {dailyRows.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Day-by-Day Breakdown</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b">
                          <th className="text-left pb-2 font-medium">Date</th>
                          <th className="text-right pb-2 font-medium">Sales</th>
                          <th className="text-right pb-2 font-medium">Sales Value</th>
                          <th className="text-right pb-2 font-medium">Cash Received</th>
                          <th className="text-right pb-2 font-medium">Discounts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dailyRows.map((row: any) => (
                          <tr key={row.day} className="hover:bg-gray-50">
                            <td className="py-2 text-gray-700">
                              {new Date(row.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </td>
                            <td className="py-2 text-right text-gray-500">{n(row.totalSales)}</td>
                            <td className="py-2 text-right font-medium text-blue-700">{fmt(row.totalRevenue)}</td>
                            <td className="py-2 text-right font-medium text-green-700">{fmt(row.totalPaid)}</td>
                            <td className="py-2 text-right text-orange-500">{n(row.totalDiscount) > 0 ? fmt(row.totalDiscount) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold">
                          <td className="pt-2 text-gray-700">Total</td>
                          <td className="pt-2 text-right text-gray-600">{totalTransactions}</td>
                          <td className="pt-2 text-right text-blue-700">{fmt(totalSalesValue)}</td>
                          <td className="pt-2 text-right text-green-700">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalPaid), 0))}</td>
                          <td className="pt-2 text-right text-orange-500">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalDiscount), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
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
