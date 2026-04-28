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
  ShoppingCart, Package, Banknote, CreditCard, AlertTriangle, Download,
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
  const returnsAmount = n(income.returnsAmount);
  const avgOrder = saleCount > 0 ? Math.round(revenue / saleCount) : 0;

  const isProfit = netProfit >= 0;
  const shopName = (primaryShop as any)?.name ?? (primaryShop as any)?.shopName ?? "My Shop";
  const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";
  const netMarginPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

  const handleDownload = () => {
    if (!raw) return;
    const generatedAt = new Date().toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" });
    const periodLabel = `${new Date(from).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} – ${new Date(to).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`;

    const expCategoryRows = (exp.byCategory ?? []).map((c: any) =>
      `<tr><td class="label indent">— ${c.categoryName ?? "Other"}</td><td class="num debit">(${fmt(c.total)})</td></tr>`
    ).join("");

    const paymentRows = byPayment.map(row =>
      `<tr><td class="label indent">— ${METHOD_LABELS[row.paymentType] ?? row.paymentType}</td><td class="num">${fmt(n(row.total))}</td></tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Profit & Loss — ${shopName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 48px 56px; max-width: 680px; margin: 0 auto; }

  .header { text-align: center; margin-bottom: 32px; }
  .header .shop { font-size: 22px; font-weight: 700; color: #111; letter-spacing: -0.3px; }
  .header .title { font-size: 14px; font-weight: 600; color: #6b21a8; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.6px; }
  .header .period { font-size: 12px; color: #555; margin-top: 6px; }
  .header .generated { font-size: 11px; color: #999; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #6b21a8; margin: 20px 0 24px; }

  .section-title { font-size: 10px; font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e9d5ff; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  tr td { padding: 5px 2px; vertical-align: top; }
  td.label { color: #374151; }
  td.label.bold { font-weight: 600; color: #111; }
  td.label.indent { padding-left: 18px; color: #6b7280; font-size: 12px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num.credit { color: #15803d; font-weight: 600; }
  td.num.debit { color: #b45309; }
  td.num.bold { font-weight: 700; color: #111; }

  .subtotal td { border-top: 1px solid #e5e7eb; font-weight: 600; padding-top: 7px; }
  .total-row td { background: ${isProfit ? "#f0fdf4" : "#fef2f2"}; padding: 10px 6px; font-weight: 700; font-size: 14px; color: ${isProfit ? "#15803d" : "#dc2626"}; border-radius: 4px; }
  .gross-row td { background: #f0fdf4; padding: 8px 6px; font-weight: 700; color: #15803d; border-radius: 4px; }

  .kpi-strip { display: flex; gap: 16px; margin-bottom: 28px; }
  .kpi { flex: 1; background: #faf5ff; border-radius: 8px; padding: 12px 14px; }
  .kpi .kpi-label { font-size: 10px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.6px; }
  .kpi .kpi-value { font-size: 18px; font-weight: 800; color: #111; margin-top: 2px; }
  .kpi .kpi-sub { font-size: 11px; color: #888; margin-top: 1px; }

  .note { font-size: 11px; color: #888; background: #f9fafb; border-radius: 6px; padding: 10px 12px; margin-top: 8px; }
  .note.warn { background: #fff7ed; color: #92400e; border: 1px solid #fed7aa; }

  .footer { margin-top: 36px; text-align: center; font-size: 10px; color: #bbb; border-top: 1px solid #f3f4f6; padding-top: 14px; }
  @media print {
    body { padding: 24px 32px; }
    @page { margin: 16mm; size: A4 portrait; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="shop">${shopName}</div>
  <div class="title">Profit &amp; Loss Statement</div>
  <div class="period">${periodLabel}</div>
  <div class="generated">Generated ${generatedAt}</div>
</div>
<hr class="divider"/>

<div class="kpi-strip">
  <div class="kpi">
    <div class="kpi-label">Net ${isProfit ? "Profit" : "Loss"}</div>
    <div class="kpi-value" style="color:${isProfit ? "#15803d" : "#dc2626"}">${fmt(Math.abs(netProfit))}</div>
    <div class="kpi-sub">${netMarginPct}% of revenue</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Gross Profit</div>
    <div class="kpi-value">${fmt(grossProfit)}</div>
    <div class="kpi-sub">${grossMarginPct}% margin</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Transactions</div>
    <div class="kpi-value">${saleCount}</div>
    <div class="kpi-sub">avg ${fmt(avgOrder)} per sale</div>
  </div>
</div>

<div class="section-title">Income</div>
<table>
  <tr>
    <td class="label bold">Revenue from Sales</td>
    <td class="num credit">${fmt(revenue)}</td>
  </tr>
  ${totalDiscount > 0 ? `<tr><td class="label indent">— Discounts given</td><td class="num debit">(${fmt(totalDiscount)})</td></tr>` : ""}
  ${(voidedAmount + refundedAmount) > 0 ? `<tr><td class="label indent">— Voided / Refunded</td><td class="num debit">(${fmt(voidedAmount + refundedAmount)})</td></tr>` : ""}
  ${returnsAmount > 0 ? `<tr><td class="label indent">— Sale Returns</td><td class="num debit">(${fmt(returnsAmount)})</td></tr>` : ""}
</table>

<div class="section-title">Cost of Goods Sold</div>
<table>
  <tr>
    <td class="label bold">Cost of stock sold</td>
    <td class="num debit">(${fmt(cost)})</td>
  </tr>
  <tr class="gross-row">
    <td class="label">Gross Profit &nbsp;<span style="font-size:11px;font-weight:400;color:#4ade80">${grossMarginPct}% margin</span></td>
    <td class="num">${fmt(grossProfit)}</td>
  </tr>
</table>

<div class="section-title">Operating Expenses</div>
<table>
  ${expCategoryRows || `<tr><td class="label indent">No expenses recorded</td><td class="num">—</td></tr>`}
  <tr class="subtotal">
    <td class="label bold">Total Expenses</td>
    <td class="num debit bold">(${fmt(expTotal)})</td>
  </tr>
</table>

${n(purchases.total) > 0 ? `
<div class="section-title">Stock Purchases (Cash Out)</div>
<table>
  <tr>
    <td class="label bold">Stock restocked this period</td>
    <td class="num debit">${fmt(purchases.total)}</td>
  </tr>
</table>` : ""}

<table>
  <tr class="total-row">
    <td class="label">Net ${isProfit ? "Profit" : "Loss"}</td>
    <td class="num">${isProfit ? "" : "("}${fmt(Math.abs(netProfit))}${isProfit ? "" : ")"}</td>
  </tr>
</table>

${byPayment.length > 0 ? `
<div class="section-title" style="margin-top:8px">Payment Breakdown</div>
<table>
  ${paymentRows}
  <tr class="subtotal">
    <td class="label bold">Total Collected</td>
    <td class="num bold">${fmt(revenue)}</td>
  </tr>
</table>` : ""}

${!isProfit ? `<p class="note warn">&#9888; Expenses exceeded gross profit this period. Consider reviewing recurring costs.</p>` : ""}

<div class="footer">Prepared by Pointify &nbsp;·&nbsp; Confidential &nbsp;·&nbsp; ${generatedAt}</div>

<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=760,height=900");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

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
          {raw && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          )}
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
                      {returnsAmount > 0 && (
                        <p className="text-xs text-red-400">{fmt(returnsAmount)} deducted for returns</p>
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
