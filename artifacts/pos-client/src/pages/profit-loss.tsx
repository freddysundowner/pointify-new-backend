import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { TrendingUp, TrendingDown, ShoppingCart, Receipt, Calculator, ArrowLeft, RefreshCw, DollarSign, Package } from "lucide-react";
import { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useLocation } from "wouter";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";

interface ProfitLossData {
  revenue: number;
  cost: number;
  expenses: number;
  profit: number;
}

interface Attendant {
  _id: string;
  username: string;
  uniqueDigits: number;
}

const fmt = (n: number | string | undefined | null) => {
  const num = Number(n ?? 0);
  if (isNaN(num)) return "KES 0";
  return `KES ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const pct = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "0.0%";

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
    return `${ENDPOINTS.analytics.netProfit}?${p}`;
  };

  const { data: raw, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["profit-loss", effectiveShopId, from, to, selectedAttendant],
    queryFn: async () => {
      const res = await apiRequest("GET", buildUrl());
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!effectiveShopId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const d: ProfitLossData | null = raw
    ? {
        revenue: Number(raw.revenue ?? 0),
        cost: Number(raw.cost ?? 0),
        expenses: Number(raw.expenses ?? 0),
        profit: Number(raw.profit ?? 0),
      }
    : null;

  const gross = d ? d.revenue - d.cost : 0;

  return (
    <DashboardLayout>
      <div className="p-4 space-y-3">

        {/* Header + filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost" size="sm"
            onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/dashboard")}
            className="gap-1 px-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-900">Profit & Loss</h1>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
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
            <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-8 gap-1 bg-purple-600 hover:bg-purple-700">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Apply
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-center py-6 text-red-500 text-sm">
            Failed to load data. <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && !d && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        )}

        {d && (
          <>
            {/* 4 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Revenue", value: fmt(d.revenue), color: "blue", Icon: ShoppingCart },
                { label: "Cost of Goods", value: fmt(d.cost), color: "orange", Icon: Package },
                { label: "Expenses", value: fmt(d.expenses), color: "red", Icon: Receipt },
                {
                  label: "Net Profit",
                  value: fmt(d.profit),
                  color: d.profit >= 0 ? "green" : "red",
                  Icon: d.profit >= 0 ? TrendingUp : TrendingDown,
                },
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

            {/* Breakdown + summary */}
            <div className="grid md:grid-cols-2 gap-3">

              {/* P&L Statement */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">P&L Statement</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revenue</span>
                      <span className="font-medium text-blue-700">{fmt(d.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost of Goods Sold</span>
                      <span className="font-medium text-orange-600">- {fmt(d.cost)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-t border-b font-semibold text-green-700">
                      <span>Gross Profit</span>
                      <span>{fmt(gross)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Operating Expenses</span>
                      <span className="font-medium text-red-600">- {fmt(d.expenses)}</span>
                    </div>
                    <div className={`flex justify-between pt-2 border-t font-bold text-base ${d.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      <span>Net Profit</span>
                      <span>{fmt(d.profit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Margin summary */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Margins & Ratios</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Gross Margin</span>
                      <span className="font-semibold text-green-700">{pct(gross, d.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Net Margin</span>
                      <span className={`font-semibold ${d.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {pct(d.profit, d.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Expense Ratio</span>
                      <span className="font-semibold text-orange-600">{pct(d.expenses, d.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">COGS Ratio</span>
                      <span className="font-semibold text-gray-700">{pct(d.cost, d.revenue)}</span>
                    </div>
                    <div className="mt-2 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <DollarSign className={`h-4 w-4 ${d.profit >= 0 ? "text-green-600" : "text-red-500"}`} />
                        <span className={`font-bold text-base ${d.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {d.profit >= 0 ? "Profitable" : "Operating at a loss"}
                        </span>
                      </div>
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
