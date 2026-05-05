import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Eye, Users, AlertTriangle, ArrowLeft, RefreshCw, Download,
  Phone, Mail, X, TrendingUp, Wallet,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/features/auth/useAuth";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Link } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useGoBack } from "@/hooks/useGoBack";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/utils";

interface Debtor {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  outstandingBalance: string;
  customerNo?: number | null;
  type?: string | null;
  wallet?: string | null;
}

const fmt = (v: string | number | null | undefined, currency: string) => {
  const num = Math.abs(Number(v ?? 0));
  return `${currency} ${isNaN(num) ? "0" : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const getRiskLevel = (balance: number, avgDebt: number) => {
  if (balance >= avgDebt * 2) return { label: "High", cls: "bg-red-100 text-red-700 border-red-200" };
  if (balance >= avgDebt) return { label: "Med", cls: "bg-orange-100 text-orange-700 border-orange-200" };
  return { label: "Low", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" };
};

export default function DebtorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"balance" | "name">("balance");
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const customerOverviewRoute = useNavigationRoute("customerOverview");
  const goBack = useGoBack("/reports");
  const currency = useCurrency();

  const shopId = selectedShopId || (typeof admin?.primaryShop === "object" ? (admin?.primaryShop as any)?._id : admin?.primaryShop);

  const { data: debtors = [], isLoading, error, refetch } = useQuery<Debtor[]>({
    queryKey: ["debtors", shopId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/shops/${shopId}/reports/debtors`);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    enabled: !!shopId && !!admin?._id,
    staleTime: 0,
  });

  const totalDebt = useMemo(() => debtors.reduce((s, d) => s + Number(d.outstandingBalance ?? 0), 0), [debtors]);
  const avgDebt = debtors.length > 0 ? totalDebt / debtors.length : 0;
  const highRiskCount = useMemo(() => debtors.filter(d => Number(d.outstandingBalance) >= avgDebt * 2).length, [debtors, avgDebt]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const list = debtors.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) =>
      sortBy === "balance"
        ? Number(b.outstandingBalance) - Number(a.outstandingBalance)
        : a.name.localeCompare(b.name)
    );
  }, [debtors, searchTerm, sortBy]);

  const handleDownload = () => {
    if (!debtors.length) return;
    const headers = ["Name", "Phone", "Email", "Customer No", "Type", "Outstanding Balance", "Wallet"];
    const rows = debtors.map(d => [
      d.name, d.phone ?? "", d.email ?? "", d.customerNo ?? "", d.type ?? "",
      Number(d.outstandingBalance ?? 0).toFixed(2),
      Number(d.wallet ?? 0).toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: `debtors-${new Date().toISOString().split("T")[0]}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <DashboardLayout>
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm shrink-0">
          <div className="px-3 sm:px-4 h-12 flex items-center gap-2">
            <button onClick={goBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 leading-tight">Debtors</h1>
              {!isLoading && (
                <p className="text-xs text-muted-foreground leading-none mt-0.5">
                  {debtors.length} customer{debtors.length !== 1 ? "s" : ""} with outstanding balances
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={handleDownload} disabled={!debtors.length}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Export</span>
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── KPI strip ── */}
        {!isLoading && !error && (
          <div className="grid grid-cols-3 border-b divide-x">
            <div className="px-4 py-3 bg-red-50/60">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Total Owed</p>
              <p className="text-base font-bold text-red-700 mt-0.5 tabular-nums">{fmt(totalDebt, currency)}</p>
            </div>
            <div className="px-4 py-3 bg-orange-50/60">
              <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">Debtors</p>
              <p className="text-base font-bold text-orange-700 mt-0.5">{debtors.length}</p>
            </div>
            <div className="px-4 py-3 bg-yellow-50/60">
              <p className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wide">Avg / Customer</p>
              <p className="text-base font-bold text-yellow-700 mt-0.5 tabular-nums">{fmt(avgDebt, currency)}</p>
            </div>
          </div>
        )}

        {/* ── Search + sort bar ── */}
        <div className="px-3 sm:px-4 py-2.5 bg-white border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, phone or email…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setSortBy("balance")}
              className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${sortBy === "balance" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              By Amount
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`h-8 px-2.5 rounded-md text-xs font-medium border transition-colors ${sortBy === "name" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              By Name
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-3 sm:px-4 py-3 pb-24 lg:pb-6">
          {isLoading ? (
            <div className="space-y-2 pt-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertTriangle className="h-9 w-9 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Failed to load debtors</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-medium text-gray-700">
                {searchTerm ? "No debtors match your search" : "No debtors — all customers are paid up!"}
              </p>
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="text-xs text-purple-600 mt-1 hover:underline">Clear search</button>
              )}
            </div>
          ) : (
            <>
              {searchTerm && filtered.length !== debtors.length && (
                <p className="text-xs text-muted-foreground mb-2">{filtered.length} of {debtors.length} debtors</p>
              )}

              {/* ── Mobile cards ── */}
              <div className="sm:hidden space-y-2">
                {filtered.map(d => {
                  const risk = getRiskLevel(Number(d.outstandingBalance), avgDebt);
                  return (
                    <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <span className="text-red-600 font-bold text-sm">{d.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 border shrink-0 ${risk.cls}`}>{risk.label}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-2 mt-0.5">
                            {d.phone && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <Phone className="h-2.5 w-2.5" />{d.phone}
                              </span>
                            )}
                            {d.email && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5 truncate max-w-[140px]">
                                <Mail className="h-2.5 w-2.5" />{d.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right flex items-center gap-2">
                          <p className="text-sm font-bold text-red-600">{fmt(d.outstandingBalance, currency)}</p>
                          <Link href={`${customerOverviewRoute}?id=${d.id}`}>
                            <Button size="sm" className="h-7 w-7 p-0 bg-purple-600 hover:bg-purple-700">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {d.wallet && Number(d.wallet) > 0 && (
                        <div className="border-t px-3 py-1.5 bg-green-50/60 flex items-center gap-1.5">
                          <Wallet className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-700">Wallet: {fmt(d.wallet, currency)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden sm:block rounded-xl border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Risk</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Wallet</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {filtered.map(d => {
                      const risk = getRiskLevel(Number(d.outstandingBalance), avgDebt);
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <span className="text-red-600 font-bold text-xs">{d.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm leading-tight">{d.name}</p>
                                {d.customerNo && <p className="text-xs text-muted-foreground">#{d.customerNo}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {d.phone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3 text-gray-400" />{d.phone}</p>}
                              {d.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3 text-gray-400" />{d.email}</p>}
                              {!d.phone && !d.email && <p className="text-xs text-gray-300">—</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 border font-medium ${risk.cls}`}>{risk.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-red-600 tabular-nums">{fmt(d.outstandingBalance, currency)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {d.wallet && Number(d.wallet) > 0
                              ? <span className="text-xs text-green-600 font-medium tabular-nums">{fmt(d.wallet, currency)}</span>
                              : <span className="text-xs text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`${customerOverviewRoute}?id=${d.id}`}>
                              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200 gap-1">
                                <Eye className="h-3 w-3" /> View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t">
                      <td colSpan={3} className="px-4 py-2 text-xs text-muted-foreground">
                        {filtered.length} debtor{filtered.length !== 1 ? "s" : ""}
                        {highRiskCount > 0 && <span className="ml-2 text-red-500">· {highRiskCount} high risk</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-red-600 tabular-nums">
                        {fmt(filtered.reduce((s, d) => s + Number(d.outstandingBalance), 0), currency)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
