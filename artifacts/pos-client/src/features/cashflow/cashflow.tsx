import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { extractId } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useCurrency } from "@/utils";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Link } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, RefreshCw, ArrowUpRight, ArrowDownRight, Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const n = (v: any) => Number(v ?? 0);
const fmt = (v: any, cur: string) => {
  const num = n(v);
  return `${cur} ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const QUICK = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
];

export default function CashFlow() {
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const currency = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dashboardRoute = useNavigationRoute("dashboard");

  const shopId = selectedShopId || extractId(admin?.primaryShop) || extractId(attendant?.shopId);

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [quickDays, setQuickDays] = useState(30);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ description: "", amount: "", categoryId: "", bankId: "" });

  const isCustom = quickDays === 0;
  const effectiveFrom = isCustom ? from : new Date(Date.now() - (quickDays - 1) * 86400000).toISOString().split("T")[0];
  const effectiveTo = today;

  // Cashflow categories
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["cashflow-categories", shopId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${ENDPOINTS.cashflow.categories}?shopId=${shopId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });

  const cashInCats = categories.filter((c: any) => c.type === "cashin");
  const cashOutCats = categories.filter((c: any) => c.type === "cashout");

  // Banks list for optional bank linking
  const { data: banks = [] } = useQuery<any[]>({
    queryKey: ["banks", shopId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/finance/banks?shopId=${shopId}`);
      const json = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    enabled: !!shopId,
    staleTime: 30 * 1000,
  });

  // Grouped tally from API
  const { data: raw, isLoading, refetch } = useQuery<any>({
    queryKey: ["cashflows-grouped", shopId, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const p = new URLSearchParams({
        shopId: shopId || "",
        from: effectiveFrom,
        to: effectiveTo,
        grouped: "true",
      });
      const res = await apiRequest("GET", `${ENDPOINTS.cashflow.getAll}?${p}`);
      return res.json();
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = raw?.data ?? [];
  const summary = raw?.summary ?? { totalCashIn: 0, totalCashOut: 0, totalUncategorized: 0, net: 0 };
  const net = summary.net !== undefined ? summary.net : 0;
  const isPositive = net >= 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", ENDPOINTS.cashflow.create, {
        shopId,
        description: data.description.trim(),
        amount: parseFloat(data.amount),
        categoryId: data.categoryId || undefined,
        bankId: data.bankId || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflows-grouped"] });
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      setIsDialogOpen(false);
      setFormData({ description: "", amount: "", categoryId: "", bankId: "" });
      toast({ title: "Entry added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) return toast({ title: "Description is required", variant: "destructive" });
    if (!formData.amount || parseFloat(formData.amount) <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    createMutation.mutate(formData);
  };

  const handleQuick = (days: number) => setQuickDays(days);

  return (
    <DashboardLayout title="Cash Flow">
      <div className="w-full space-y-3">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {attendant && (
            <Link href={dashboardRoute}>
              <Button variant="ghost" size="sm" className="gap-1 px-2 h-8">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
          )}
          <h2 className="text-lg font-bold text-gray-900 flex-1">Cash Flow</h2>
          <Link href={window.location.pathname.includes("/attendant/") ? "/attendant/cashflow-categories" : "/cashflow-categories"}>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Settings className="h-3.5 w-3.5" /> Categories
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>New Cash Flow Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Rent payment, Loan received…"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={formData.categoryId} onValueChange={v => setFormData(f => ({ ...f, categoryId: v }))}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashInCats.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] font-bold text-green-600 uppercase tracking-wide">Cash In</div>
                          {cashInCats.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </>
                      )}
                      {cashOutCats.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] font-bold text-red-500 uppercase tracking-wide">Cash Out</div>
                          {cashOutCats.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </>
                      )}
                      {categories.length === 0 && (
                        <div className="px-2 py-2 text-xs text-gray-400">No categories yet — add some first</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {banks.length > 0 && (
                  <div>
                    <Label className="text-xs">Bank Account <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Select value={formData.bankId} onValueChange={v => setFormData(f => ({ ...f, bankId: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue placeholder="No bank — cash only" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No bank — cash only</SelectItem>
                        {banks.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name} {b.balance !== undefined ? `· ${currency} ${parseFloat(String(b.balance)).toLocaleString()}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.bankId && formData.categoryId && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Balance will be {categories.find((c: any) => String(c.id) === formData.categoryId)?.type === "cashout" ? "decreased" : "increased"} by this amount
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1 h-8" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="flex-1 h-8" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving…" : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK.map(q => (
            <Button
              key={q.days}
              variant={quickDays === q.days ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleQuick(q.days)}
            >
              {q.label}
            </Button>
          ))}
          {isCustom && (
            <>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
              <span className="text-gray-400 text-xs">to</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
            </>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs ml-auto" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-0 shadow-sm bg-green-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                <p className="text-xs text-green-500 font-medium">Cash In</p>
              </div>
              <p className="text-xl font-bold text-green-700 leading-tight">{fmt(n(summary.totalCashIn) + n(summary.totalUncategorized), currency)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                <p className="text-xs text-red-500 font-medium">Cash Out</p>
              </div>
              <p className="text-xl font-bold text-red-700 leading-tight">{fmt(summary.totalCashOut, currency)}</p>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${isPositive ? "bg-blue-50" : "bg-orange-50"}`}>
            <CardContent className="p-3">
              <p className={`text-xs font-medium mb-0.5 ${isPositive ? "text-blue-500" : "text-orange-500"}`}>Net</p>
              <p className={`text-xl font-bold leading-tight ${isPositive ? "text-blue-700" : "text-orange-700"}`}>
                {isPositive ? "+" : ""}{fmt(net, currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tally table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-1 p-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm font-medium text-gray-500">No cash flow entries</p>
                <p className="text-xs text-gray-400 mt-1">Add your first entry using the button above</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left px-4 py-2.5 font-medium">Category</th>
                    <th className="text-center px-3 py-2.5 font-medium w-20">Entries</th>
                    <th className="text-right px-4 py-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row: any, idx: number) => {
                    const isIn = row.type === "cashin";
                    const isOut = row.type === "cashout";
                    return (
                      <tr key={row.categoryId ?? `none-${idx}`} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                            isIn ? "text-green-700" : isOut ? "text-red-600" : "text-gray-600"
                          }`}>
                            {isIn && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
                            {isOut && <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />}
                            {row.categoryName}
                          </span>
                          {isIn && <span className="ml-2 text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">IN</span>}
                          {isOut && <span className="ml-2 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">OUT</span>}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-400">{row.count}</td>
                        <td className={`px-4 py-3 text-right font-bold text-base whitespace-nowrap ${
                          isIn ? "text-green-700" : isOut ? "text-red-600" : "text-gray-700"
                        }`}>
                          {isIn ? "+" : isOut ? "−" : ""}{fmt(row.total, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50/60">
                    <td className="px-4 py-2.5 text-xs text-gray-400">{rows.length} {rows.length === 1 ? "category" : "categories"}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                      {rows.reduce((s: number, r: any) => s + (r.count ?? 0), 0)} total
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-sm font-bold ${isPositive ? "text-green-700" : "text-red-600"}`}>
                        Net: {isPositive ? "+" : ""}{fmt(net, currency)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
