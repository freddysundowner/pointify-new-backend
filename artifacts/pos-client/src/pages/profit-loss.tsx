import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  ArrowLeft, RefreshCw, FileText, TrendingUp, TrendingDown,
  ShoppingCart, Package, Banknote, CreditCard, AlertTriangle
} from "lucide-react";
import { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

interface Attendant { _id: string; username: string; }

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any) => {
  const num = n(v);
  return `KES ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

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
  const goBack = useGoBack("/reports");

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
  const expTotal = n(exp.total);
  const netProfit = n(raw?.netProfit);
  const saleCount = n(income.saleCount);
  const totalDiscount = n(income.totalDiscount);
  const voidedAmount = n(income.voidedAmount);
  const refundedAmount = n(income.refundedAmount);
  const avgOrder = saleCount > 0 ? Math.round(revenue / saleCount) : 0;

  const isProfit = netProfit >= 0;

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-900">Profit & Loss</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-gray-400 text-sm">to</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
          {user && (Array.isArray(attendants) && attendants.length > 0) && (
            <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {attendants.map(a => (
                  <SelectItem key={a._id} value={a._id}>{a.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-8 gap-1 bg-purple-600 hover:bg-purple-700">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Apply
          </Button>
        </div>

        {error && (
          <div className="text-center py-6 text-red-500 text-sm">
            Could not load data. <button onClick={() => refetch()} className="underline">Try again</button>
          </div>
        )}

        {isLoading && !raw && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}

        {raw && (
          <>
            {/* Result banner */}
            <div className={`rounded-xl p-4 flex items-center gap-3 ${isProfit ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {isProfit
                ? <TrendingUp className="h-6 w-6 text-green-600 shrink-0" />
                : <TrendingDown className="h-6 w-6 text-red-500 shrink-0" />}
              <div>
                <p className={`text-lg font-bold ${isProfit ? "text-green-700" : "text-red-600"}`}>
                  {isProfit ? "You made " : "You lost "}{fmt(Math.abs(netProfit))} {isProfit ? "profit" : "this period"}
                </p>
                <p className={`text-sm ${isProfit ? "text-green-600" : "text-red-500"}`}>
                  {saleCount} sales · Average sale: {fmt(avgOrder)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Where the money went</p>

                {/* Revenue */}
                <div className="flex justify-between items-center py-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Money collected from sales</p>
                      {totalDiscount > 0 && (
                        <p className="text-xs text-orange-500">{fmt(totalDiscount)} given as discounts</p>
                      )}
                      {(voidedAmount + refundedAmount) > 0 && (
                        <p className="text-xs text-red-400">{fmt(voidedAmount + refundedAmount)} voided/refunded</p>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-bold text-blue-700">{fmt(revenue)}</span>
                </div>

                {/* COGS */}
                <div className="flex justify-between items-center py-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">What you paid for that stock</p>
                      <p className="text-xs text-gray-400">Cost of goods sold</p>
                    </div>
                  </div>
                  <span className="text-base font-semibold text-gray-600">− {fmt(cost)}</span>
                </div>

                {/* Gross profit */}
                <div className="flex justify-between items-center py-3 border-b bg-green-50 -mx-4 px-4">
                  <p className="text-sm font-semibold text-green-800">Profit from selling goods</p>
                  <span className="text-base font-bold text-green-700">{fmt(grossProfit)}</span>
                </div>

                {/* Expenses */}
                <div className="flex justify-between items-center py-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Expenses paid</p>
                      {(exp.byCategory ?? []).map((c: any) => (
                        <p key={c.categoryName} className="text-xs text-gray-400">
                          {c.categoryName ?? "Other"}: {fmt(c.total)}
                        </p>
                      ))}
                    </div>
                  </div>
                  <span className="text-base font-semibold text-orange-600">− {fmt(expTotal)}</span>
                </div>

                {/* Stock purchases this period */}
                {n(purchases.total) > 0 && (
                  <div className="flex justify-between items-center py-3 border-b">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Stock restocked (purchases)</p>
                        <p className="text-xs text-gray-400">Money spent on buying stock</p>
                      </div>
                    </div>
                    <span className="text-base font-semibold text-indigo-600">{fmt(purchases.total)}</span>
                  </div>
                )}

                {/* Net profit */}
                <div className={`flex justify-between items-center py-4 -mx-4 px-4 ${isProfit ? "bg-green-100" : "bg-red-100"}`}>
                  <p className={`text-base font-bold ${isProfit ? "text-green-900" : "text-red-700"}`}>
                    {isProfit ? "Money in your pocket" : "Loss this period"}
                  </p>
                  <span className={`text-xl font-bold ${isProfit ? "text-green-700" : "text-red-600"}`}>
                    {isProfit ? "" : "− "}{fmt(Math.abs(netProfit))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payment method breakdown */}
            {byPayment.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How customers paid</p>
                  <div className="space-y-2">
                    {byPayment.map(row => {
                      const amt = n(row.total);
                      const barW = revenue > 0 ? Math.round((amt / revenue) * 100) : 0;
                      return (
                        <div key={row.paymentType}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{METHOD_LABELS[row.paymentType] ?? row.paymentType}</span>
                            <span className="font-semibold text-gray-900">{fmt(amt)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${barW}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* If loss, show a note */}
            {!isProfit && (
              <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-xl p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Your expenses are higher than your gross profit this period. Check if any expense categories can be reduced.</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
