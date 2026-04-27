import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  TrendingUp, TrendingDown, ShoppingCart, Receipt, Calculator,
  ArrowLeft, RefreshCw, CreditCard, Package, AlertTriangle, Tag, RotateCcw
} from "lucide-react";
import { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

interface Attendant { _id: string; username: string; uniqueDigits: number; }

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? 0 : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const pct = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "—";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", mpesa: "M-Pesa", mpesa_stk: "M-Pesa STK", bank: "Bank",
  card: "Card", wallet: "Wallet", credit: "Credit",
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
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
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

  const buildUrl = () => {
    const p = new URLSearchParams({ shopId: effectiveShopId || "", from, to });
    if (selectedAttendant && selectedAttendant !== "all") p.append("attendant", selectedAttendant);
    return `${ENDPOINTS.analytics.profitLossDetail}?${p}`;
  };

  const { data: raw, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["profit-loss-detail", effectiveShopId, from, to, selectedAttendant],
    queryFn: async () => {
      const res = await apiRequest("GET", buildUrl());
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const income = raw?.income ?? {};
  const cogs = raw?.cogs ?? {};
  const exp = raw?.expenses ?? {};
  const purchases = raw?.purchases ?? {};
  const byPayment: { paymentType: string; total: string }[] = raw?.byPaymentMethod ?? [];

  const revenue = n(income.revenue);
  const cost = n(cogs.cost);
  const grossProfit = n(cogs.grossProfit);
  const grossMargin = n(cogs.grossMarginPercent);
  const expTotal = n(exp.total);
  const netProfit = n(raw?.netProfit);
  const netMargin = n(raw?.netMarginPercent);
  const saleCount = n(income.saleCount);
  const totalDiscount = n(income.totalDiscount);
  const voidedAmount = n(income.voidedAmount);
  const refundedAmount = n(income.refundedAmount);
  const avgOrder = saleCount > 0 ? revenue / saleCount : 0;

  const kpis = [
    { label: "Revenue", value: fmt(revenue), sub: `${saleCount} sales`, color: "blue", Icon: ShoppingCart },
    { label: "Gross Profit", value: fmt(grossProfit), sub: `${grossMargin.toFixed(1)}% margin`, color: "green", Icon: TrendingUp },
    { label: "Net Profit", value: fmt(netProfit), sub: `${netMargin.toFixed(1)}% margin`, color: netProfit >= 0 ? "green" : "red", Icon: netProfit >= 0 ? TrendingUp : TrendingDown },
    { label: "Expenses", value: fmt(expTotal), sub: `${pct(expTotal, revenue)} of revenue`, color: "orange", Icon: Receipt },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 space-y-3">

        {/* Header + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/dashboard")} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-900">Profit & Loss</h1>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setLocation("/reports/business")}>
            Business Overview →
          </Button>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
            {user && (
              <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                <SelectTrigger className="h-8 text-sm w-38">
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
            <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-8 gap-1 bg-purple-600 hover:bg-purple-700">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Apply
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-center py-6 text-red-500 text-sm">
            Failed to load data. <button onClick={() => refetch()} className="underline">Retry</button>
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

              {/* P&L Statement */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">P&L Statement</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue</span>
                      <span className="font-medium text-blue-700">{fmt(revenue)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-1"><Tag className="h-3 w-3" /> Discounts given</span>
                        <span className="text-orange-500">- {fmt(totalDiscount)}</span>
                      </div>
                    )}
                    {(voidedAmount > 0 || refundedAmount > 0) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Voids / Refunds</span>
                        <span className="text-red-400">{fmt(voidedAmount + refundedAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost of Goods</span>
                      <span className="font-medium text-gray-700">- {fmt(cost)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-t border-b font-semibold">
                      <span className="text-green-800">Gross Profit</span>
                      <span className="text-green-700">{fmt(grossProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Operating Expenses</span>
                      <span className="font-medium text-orange-600">- {fmt(expTotal)}</span>
                    </div>

                    {/* Expense breakdown by category */}
                    {(exp.byCategory ?? []).map((c: any) => (
                      <div key={c.categoryName} className="flex justify-between text-xs pl-2">
                        <span className="text-gray-400">{c.categoryName ?? "Uncategorised"}</span>
                        <span className="text-gray-500">{fmt(c.total)}</span>
                      </div>
                    ))}

                    <div className={`flex justify-between pt-2 border-t font-bold text-base ${netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      <span>Net Profit</span>
                      <span>{fmt(netProfit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment method breakdown */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue by Payment Method</p>
                  {byPayment.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No payment data</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {byPayment.map(row => {
                        const amt = n(row.total);
                        const share = pct(amt, revenue);
                        const barW = revenue > 0 ? Math.round((amt / revenue) * 100) : 0;
                        return (
                          <div key={row.paymentType}>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-gray-600 flex items-center gap-1">
                                <CreditCard className="h-3 w-3 text-gray-400" />
                                {METHOD_LABELS[row.paymentType] ?? row.paymentType}
                              </span>
                              <span className="font-medium">{fmt(amt)} <span className="text-gray-400 font-normal text-xs">({share})</span></span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${barW}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-between pt-2 border-t font-semibold text-purple-700 text-sm">
                        <span>Total Collected</span>
                        <span>{fmt(byPayment.reduce((s, r) => s + n(r.total), 0))}</span>
                      </div>
                    </div>
                  )}

                  {/* Purchases info */}
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stock Purchases</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1"><Package className="h-3 w-3" /> Total Purchased</span>
                      <span className="font-medium">{fmt(purchases.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Margins & health */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Margins & Health</p>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Gross Margin", value: `${grossMargin.toFixed(1)}%`, good: grossMargin > 20 },
                      { label: "Net Margin", value: `${netMargin.toFixed(1)}%`, good: netMargin > 0 },
                      { label: "Expense Ratio", value: pct(expTotal, revenue), good: expTotal / revenue < 0.3 },
                      { label: "COGS Ratio", value: pct(cost, revenue), good: cost / revenue < 0.7 },
                      { label: "Avg Order Value", value: fmt(avgOrder), good: true },
                    ].map(({ label, value, good }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-gray-600">{label}</span>
                        <span className={`font-semibold ${good ? "text-green-700" : "text-orange-600"}`}>{value}</span>
                      </div>
                    ))}

                    {/* Verdict */}
                    <div className={`mt-3 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${netProfit >= 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                      {netProfit >= 0
                        ? <TrendingUp className="h-4 w-4 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 shrink-0" />}
                      {netProfit >= 0
                        ? `Profitable — ${netMargin.toFixed(1)}% net margin`
                        : `Operating at a loss — review expenses`}
                    </div>

                    {/* Quick actions */}
                    <div className="pt-2 border-t space-y-1">
                      <p className="text-xs text-gray-400 mb-1.5">Quick Reports</p>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-7" onClick={() => setLocation("/reports/business")}>
                        Business Overview
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs h-7" onClick={() => setLocation("/debtors")}>
                        Debtors & Credit
                      </Button>
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
