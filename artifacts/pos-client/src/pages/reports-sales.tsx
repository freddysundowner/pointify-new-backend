import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  DollarSign, ArrowLeft, RefreshCw, CreditCard, Smartphone,
  Banknote, Building, Clock, ShoppingCart, ExternalLink,
  RotateCcw, Pause, ChevronRight,
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
  const goBack = useGoBack("/reports");

  const shopId = selectedShopId || primaryShop?.shopId;
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [quickDays, setQuickDays] = useState(1);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const isCustom = quickDays === 0;

  // Returns the effective from/to dates for the current selection
  const getDateRange = (): { from: string; to: string } => {
    if (isCustom) return { from, to };
    const sinceDate = new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];
    return { from: sinceDate, to: today };
  };

  const buildParams = () => {
    const { from: f, to: t } = getDateRange();
    return new URLSearchParams({ shopId: shopId || "", from: f, to: t });
  };

  const buildStatsParams = () => {
    const { from: f, to: t } = getDateRange();
    return new URLSearchParams({ shopId: shopId || "", start: f, end: t });
  };

  // Navigate to sales list pre-filtered by status + current date range
  const goToSales = (status: string) => {
    const { from: f, to: t } = getDateRange();
    setLocation(`/sales?startDate=${f}&endDate=${t}&status=${status}`);
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

  const { data: statsData, isLoading: loadingStats, refetch: refetchStats } = useQuery<any>({
    queryKey: ["sales-stats-tally", shopId, from, to, quickDays],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/stats?${buildStatsParams()}`);
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const cashCollected = n(paymentData?.grandTotal);
  const dailyRows: any[] = (dailyData?.rows ?? []).slice().reverse();

  const totalSalesValue   = dailyRows.reduce((s: number, r: any) => s + n(r.totalRevenue), 0);
  const totalTransactions = dailyRows.reduce((s: number, r: any) => s + n(r.totalSales), 0);
  const totalOnCredit     = Math.max(0, totalSalesValue - cashCollected);

  const refetch = () => { refetchPay(); refetchDaily(); refetchStats(); };
  const isLoading = loadingPay || loadingDaily || loadingStats;

  // Tally cards config — each links to the sales list filtered by the given status
  const TALLIES = [
    {
      key: "cash",
      label: "Cash Sales",
      subtitle: "Paid in cash",
      amount: n(statsData?.cashtransactions),
      icon: Banknote,
      bg: "bg-green-50 hover:bg-green-100",
      text: "text-green-700",
      iconBg: "bg-green-100",
      border: "border-green-200",
      status: "cash",
    },
    {
      key: "mpesa",
      label: "M-Pesa Collected",
      subtitle: "Mobile money",
      amount: n(statsData?.mpesa),
      icon: Smartphone,
      bg: "bg-emerald-50 hover:bg-emerald-100",
      text: "text-emerald-700",
      iconBg: "bg-emerald-100",
      border: "border-emerald-200",
      status: "mpesa",
    },
    {
      key: "wallet",
      label: "Wallet Sales",
      subtitle: "Paid from wallet",
      amount: n(statsData?.wallet),
      icon: CreditCard,
      bg: "bg-purple-50 hover:bg-purple-100",
      text: "text-purple-700",
      iconBg: "bg-purple-100",
      border: "border-purple-200",
      status: "wallet",
    },
    {
      key: "bank",
      label: "Bank Transfer",
      subtitle: "Bank payments",
      amount: n(statsData?.bank),
      icon: Building,
      bg: "bg-blue-50 hover:bg-blue-100",
      text: "text-blue-700",
      iconBg: "bg-blue-100",
      border: "border-blue-200",
      status: "bank",
    },
    {
      key: "credit",
      label: "Credit Sales",
      subtitle: "Outstanding balance",
      amount: n(statsData?.credit),
      icon: Clock,
      bg: "bg-orange-50 hover:bg-orange-100",
      text: "text-orange-700",
      iconBg: "bg-orange-100",
      border: "border-orange-200",
      status: "credit",
    },
    {
      key: "hold",
      label: "On Hold",
      subtitle: "Parked, not yet paid",
      amount: n(statsData?.hold),
      icon: Pause,
      bg: "bg-yellow-50 hover:bg-yellow-100",
      text: "text-yellow-700",
      iconBg: "bg-yellow-100",
      border: "border-yellow-200",
      status: "held",
    },
    {
      key: "returns",
      label: "Returns",
      subtitle: "Refunds issued",
      amount: n(statsData?.returns),
      icon: RotateCcw,
      bg: "bg-red-50 hover:bg-red-100",
      text: "text-red-700",
      iconBg: "bg-red-100",
      border: "border-red-200",
      status: "returned",
    },
  ];

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
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
            {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-500 font-medium">Total Sales Value</p>
                  <p className="text-xl font-bold text-blue-700 leading-tight mt-0.5">{fmt(totalSalesValue)}</p>
                  <p className="text-xs text-blue-400 mt-0.5">{totalTransactions} transaction{totalTransactions !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-green-50">
                <CardContent className="p-3">
                  <p className="text-xs text-green-500 font-medium">Money Received</p>
                  <p className="text-xl font-bold text-green-700 leading-tight mt-0.5">{fmt(cashCollected)}</p>
                  <p className="text-xs text-green-400 mt-0.5">cash + mpesa + bank</p>
                </CardContent>
              </Card>
              <Card className={`border-0 shadow-sm ${totalOnCredit > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
                <CardContent className="p-3">
                  <p className={`text-xs font-medium ${totalOnCredit > 0 ? "text-orange-500" : "text-gray-400"}`}>Still on Credit</p>
                  <p className={`text-xl font-bold leading-tight mt-0.5 ${totalOnCredit > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmt(totalOnCredit)}</p>
                  <p className={`text-xs mt-0.5 ${totalOnCredit > 0 ? "text-orange-400" : "text-gray-300"}`}>
                    {totalOnCredit > 0 ? "not yet paid" : "all paid"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* === TALLY CARDS — click any to view those sales === */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                Sales Tallies — click to view
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {TALLIES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => goToSales(t.status)}
                      className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${t.bg} ${t.border}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`h-7 w-7 rounded-lg ${t.iconBg} flex items-center justify-center`}>
                          <Icon className={`h-3.5 w-3.5 ${t.text}`} />
                        </div>
                      </div>
                      <p className={`text-base font-bold leading-tight ${t.text}`}>{fmt(t.amount)}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${t.text}`}>{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.subtitle}</p>
                      <div className={`flex items-center gap-0.5 mt-2 text-xs font-medium ${t.text} opacity-70`}>
                        <span>View all</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5 px-1">
                * <strong>Credit</strong> = completed sales with unpaid balance &nbsp;|&nbsp;
                <strong>Hold</strong> = parked sales not yet checked out (these are different)
              </p>
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
                          <th className="text-right pb-2 font-medium hidden sm:table-cell">Sales</th>
                          <th className="text-right pb-2 font-medium">Total Value</th>
                          <th className="text-right pb-2 font-medium">Received</th>
                          <th className="text-right pb-2 font-medium hidden sm:table-cell">Discounts</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dailyRows.map((row: any) => (
                          <tr key={row.day} className="hover:bg-gray-50">
                            <td className="py-2.5 text-gray-700 font-medium">
                              <span className="hidden sm:inline">{new Date(row.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                              <span className="sm:hidden">{new Date(row.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                            </td>
                            <td className="py-2.5 text-right text-gray-500 hidden sm:table-cell">{n(row.totalSales)}</td>
                            <td className="py-2.5 text-right font-semibold text-blue-700">{fmt(row.totalRevenue)}</td>
                            <td className="py-2.5 text-right font-semibold text-green-700">{fmt(row.totalPaid)}</td>
                            <td className="py-2.5 text-right text-orange-500 hidden sm:table-cell">{n(row.totalDiscount) > 0 ? fmt(row.totalDiscount) : "—"}</td>
                            <td className="py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                                onClick={() => setLocation(`/sales?startDate=${row.day}&endDate=${row.day}`)}
                              >
                                <span className="hidden sm:inline">View</span> <ExternalLink className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-bold">
                          <td className="pt-2.5 text-gray-700">Total</td>
                          <td className="pt-2.5 text-right text-gray-600 hidden sm:table-cell">{totalTransactions}</td>
                          <td className="pt-2.5 text-right text-blue-700">{fmt(totalSalesValue)}</td>
                          <td className="pt-2.5 text-right text-green-700">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalPaid), 0))}</td>
                          <td className="pt-2.5 text-right text-orange-500 hidden sm:table-cell">{fmt(dailyRows.reduce((s: number, r: any) => s + n(r.totalDiscount), 0))}</td>
                          <td></td>
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
