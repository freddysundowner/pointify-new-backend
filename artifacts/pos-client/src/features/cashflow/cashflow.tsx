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
import { format } from "date-fns";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, RefreshCw, ArrowUpRight, ArrowDownRight, Trash2, Settings,
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
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ description: "", amount: "", categoryId: "" });
  const PAGE_SIZE = 50;

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

  // Cashflow list
  const { data: raw, isLoading, refetch } = useQuery<any>({
    queryKey: ["cashflows", shopId, effectiveFrom, effectiveTo, page, categoryFilter],
    queryFn: async () => {
      const p = new URLSearchParams({
        shopId: shopId || "",
        from: effectiveFrom,
        to: effectiveTo,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (categoryFilter) p.set("categoryId", categoryFilter);
      const res = await apiRequest("GET", `${ENDPOINTS.cashflow.getAll}?${p}`);
      return res.json();
    },
    enabled: !!shopId,
    staleTime: 0,
  });

  const rows: any[] = raw?.data ?? [];
  const meta = raw?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const summary = raw?.summary ?? { totalCashIn: 0, totalCashOut: 0, totalUncategorized: 0, net: 0 };
  // Use server net which includes uncategorized entries; fallback to row-level calculation
  const net = summary.net !== undefined
    ? summary.net
    : rows.reduce((acc: number, r: any) => {
        const amt = parseFloat(r.amount ?? "0");
        if (r.category?.type === "cashin") return acc + amt;
        if (r.category?.type === "cashout") return acc - amt;
        return acc + amt;
      }, 0);
  const isPositive = net >= 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", ENDPOINTS.cashflow.create, {
        shopId,
        description: data.description.trim(),
        amount: parseFloat(data.amount),
        categoryId: data.categoryId || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflows"] });
      setIsDialogOpen(false);
      setFormData({ description: "", amount: "", categoryId: "" });
      toast({ title: "Entry added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/finance/cashflows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflows"] });
      toast({ title: "Entry deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) return toast({ title: "Description is required", variant: "destructive" });
    if (!formData.amount || parseFloat(formData.amount) <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    createMutation.mutate(formData);
  };

  const handleQuick = (days: number) => { setQuickDays(days); setPage(1); };

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
              <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="h-8 text-sm w-36" />
              <span className="text-gray-400 text-xs">to</span>
              <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="h-8 text-sm w-36" />
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

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setCategoryFilter(""); setPage(1); }}
              className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
                !categoryFilter ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {cashInCats.map((c: any) => (
              <button
                key={c.id}
                onClick={() => { setCategoryFilter(String(c.id)); setPage(1); }}
                className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
                  categoryFilter === String(c.id) ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                ↑ {c.name}
              </button>
            ))}
            {cashOutCats.map((c: any) => (
              <button
                key={c.id}
                onClick={() => { setCategoryFilter(String(c.id)); setPage(1); }}
                className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
                  categoryFilter === String(c.id) ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                ↓ {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-1 p-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
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
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-right px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row: any) => {
                    const isIn = row.category?.type === "cashin";
                    const isOut = row.category?.type === "cashout";
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/70">
                        <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {row.createdAt ? format(new Date(row.createdAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-800">{row.description}</span>
                          {row.cashflowNo && (
                            <span className="ml-1.5 text-[10px] text-gray-400">{row.cashflowNo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.category ? (
                            <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${
                              isIn ? "bg-green-100 text-green-700" : isOut ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"
                            }`}>
                              {isIn ? "↑" : isOut ? "↓" : ""} {row.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                          isIn ? "text-green-700" : isOut ? "text-red-600" : "text-gray-700"
                        }`}>
                          {isIn ? "+" : isOut ? "−" : ""}{fmt(row.amount, currency)}
                        </td>
                        <td className="px-3 py-2.5">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "{row.description}"? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(row.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-xs text-gray-400">{meta.total} entries</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-sm font-bold ${isPositive ? "text-green-700" : "text-red-600"}`}>
                        Net: {isPositive ? "+" : ""}{fmt(net, currency)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {meta.page} of {meta.totalPages} · {meta.total} entries
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                ← Prev
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                disabled={page >= meta.totalPages} onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}>
                Next →
              </Button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
