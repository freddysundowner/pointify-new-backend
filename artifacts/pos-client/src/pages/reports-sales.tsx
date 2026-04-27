import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DollarSign, ArrowLeft, RefreshCw, CreditCard, Smartphone, Banknote, Building, Clock, ShoppingCart } from "lucide-react";
import { RootState } from "@/store";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const METHOD_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; bar: string }> = {
  cash:      { label: "Cash",          icon: Banknote,   bg: "bg-green-50",   text: "text-green-700",  bar: "bg-green-500" },
  mpesa:     { label: "M-Pesa",        icon: Smartphone, bg: "bg-emerald-50", text: "text-emerald-700",bar: "bg-emerald-500" },
  mpesa_stk: { label: "M-Pesa STK",   icon: Smartphone, bg: "bg-emerald-50", text: "text-emerald-700",bar: "bg-emerald-500" },
  bank:      { label: "Bank Transfer", icon: Building,   bg: "bg-blue-50",    text: "text-blue-700",   bar: "bg-blue-500" },
  card:      { label: "Card",          icon: CreditCard, bg: "bg-indigo-50",  text: "text-indigo-700", bar: "bg-indigo-500" },
  wallet:    { label: "Wallet",        icon: CreditCard, bg: "bg-purple-50",  text: "text-purple-700", bar: "bg-purple-500" },
  credit:    { label: "Credit",        icon: Clock,      bg: "bg-orange-50",  text: "text-orange-700", bar: "bg-orange-400" },
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

  const totalSalesValue  = dailyRows.reduce((s: number, r: any) => s + n(r.totalRevenue), 0);
  const totalTransactions = dailyRows.reduce((s: number, r: any) => s + n(r.totalSales), 0);
  const totalOnCredit    = Math.max(0, totalSalesValue - cashCollected);

  // Build full payment method list: real payments + credit remainder
  const allMethods = [
    ...paymentRows.map((r: any) => ({ type: r.paymentType, amount: n(r.totalAmount), count: n(r.saleCount) })),
    ...(totalOnCredit > 0 ? [{ type: "credit", amount: totalOnCredit, count: 0 }] : []),
  ];

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
            <Button key={q.days} variant={quickDays === q.days ? "default" : "outline"} size="sm" className="h-8 text-sm" onClick={() => setQuickDays(q.days)}>
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
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Apply
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && totalTransactions === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <ShoppingCart className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No sales in this period</p>
              <p className="text-xs text-gray-300 mt-1">Try a different date range</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && totalTransactions > 0 && (
          <>
            {/* Top summary row */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-blue-50 col-span-1">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-500 font-medium">Total Sales Value</p>
                  <p className="text-2xl font-bold text-blue-700">{fmt(totalSalesValue)}</p>
                  <p className="text-xs text-blue-400 mt-1">{totalTransactions} transaction{totalTransactions !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-green-50 col-span-1">
                <CardContent className="p-4">
                  <p className="text-xs text-green-500 font-medium">Money Received</p>
                  <p className="text-2xl font-bold text-green-700">{fmt(cashCollected)}</p>
                  <p className="text-xs text-green-400 mt-1">cash + mpesa + bank</p>
                </CardContent>
              </Card>
              <Card className={`border-0 shadow-sm col-span-1 ${totalOnCredit > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                <CardContent className="p-4">
                  <p className={`text-xs font-medium ${totalOnCredit > 0 ? "text-orange-500" : "text-gray-400"}`}>Still on Credit</p>
                  <p className={`text-2xl font-bold ${totalOnCredit > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmt(totalOnCredit)}</p>
                  <p className={`text-xs mt-1 ${totalOnCredit > 0 ? "text-orange-400" : "text-gray-300"}`}>
                    {totalOnCredit > 0 ? "not yet paid" : "all paid"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payment method cards — the main section */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">How Money Came In</p>
              {allMethods.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-8 text-center text-sm text-gray-400">
                    No payments recorded yet
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {allMethods.map(m => {
                    const cfg = METHOD_CONFIG[m.type] ?? { label: m.type, icon: CreditCard, bg: "bg-gray-50", text: "text-gray-700", bar: "bg-gray-400" };
                    const Icon = cfg.icon;
                    const shareOfTotal = totalSalesValue > 0 ? Math.round((m.amount / totalSalesValue) * 100) : 0;
                    return (
                      <Card key={m.type} className={`border-0 shadow-sm ${cfg.bg}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`h-8 w-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0`}>
                              <Icon className={`h-4 w-4 ${cfg.text}`} />
                            </div>
                            <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
                          </div>
                          <p className={`text-2xl font-bold ${cfg.text}`}>{fmt(m.amount)}</p>
                          {m.count > 0 && <p className={`text-xs mt-1 opacity-70 ${cfg.text}`}>{m.count} sale{m.count !== 1 ? "s" : ""}</p>}
                          {m.count === 0 && m.type === "credit" && <p className={`text-xs mt-1 opacity-70 ${cfg.text}`}>awaiting payment</p>}
                          {/* Share bar */}
                          <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${shareOfTotal}%` }} />
                          </div>
                          <p className={`text-xs mt-1 opacity-60 ${cfg.text}`}>{shareOfTotal}% of total</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Day-by-day table */}
            {dailyRows.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Day-by-Day</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b">
                          <th className="text-left pb-2 font-medium">Date</th>
                          <th className="text-right pb-2 font-medium">Sales</th>
                          <th className="text-right pb-2 font-medium">Total Value</th>
                          <th className="text-right pb-2 font-medium">Cash Received</th>
                          <th className="text-right pb-2 font-medium">Discounts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dailyRows.map((row: any) => (
                          <tr key={row.day} className="hover:bg-gray-50">
                            <td className="py-2.5 text-gray-700 font-medium">
                              {new Date(row.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </td>
                            <td className="py-2.5 text-right text-gray-500">{n(row.totalSales)}</td>
                            <td className="py-2.5 text-right font-semibold text-blue-700">{fmt(row.totalRevenue)}</td>
                            <td className="py-2.5 text-right font-semibold text-green-700">{fmt(row.totalPaid)}</td>
                            <td className="py-2.5 text-right text-orange-500">{n(row.totalDiscount) > 0 ? fmt(row.totalDiscount) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-bold">
                          <td className="pt-2.5 text-gray-700">Total</td>
                          <td className="pt-2.5 text-right text-gray-600">{totalTransactions}</td>
                          <td className="pt-2.5 text-right text-blue-700">{fmt(totalSalesValue)}</td>
                          <td className="pt-2.5 text-right text-green-700">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalPaid), 0))}</td>
                          <td className="pt-2.5 text-right text-orange-500">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalDiscount), 0))}</td>
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
