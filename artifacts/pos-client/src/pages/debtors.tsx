import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Eye, Users, AlertTriangle, ArrowLeft, RefreshCw, Download,
  Phone, Mail, X,
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

export default function DebtorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
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

  const filtered = debtors.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = debtors.reduce((s, d) => s + Number(d.outstandingBalance ?? 0), 0);

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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <DashboardLayout>
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6">

        {/* ── Sticky header ────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
          <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2">
            <button onClick={goBack} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, phone or email…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={handleDownload} disabled={!debtors.length}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" className="h-9 w-9 p-0 shrink-0" variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="px-3 sm:px-4 py-2.5 flex gap-6 border-b bg-gray-50/60">
            <div>
              <p className="text-[10px] text-muted-foreground leading-none">Total Outstanding</p>
              <p className="text-sm font-bold text-red-600 mt-0.5">{fmt(totalDebt, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground leading-none">Debtors</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{debtors.length} customer{debtors.length !== 1 ? "s" : ""}</p>
            </div>
            {searchTerm && filtered.length !== debtors.length && (
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Matching</p>
                <p className="text-sm font-bold text-gray-700 mt-0.5">{filtered.length}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
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
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "No debtors match your search" : "No debtors — all customers are paid up"}
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobile cards ──────────────────────────────────────── */}
              <div className="sm:hidden space-y-2">
                {filtered.map(d => (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 px-3 py-2.5">
                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <span className="text-red-600 font-bold text-sm">{d.name.charAt(0).toUpperCase()}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
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
                    {/* Amount + action */}
                    <div className="shrink-0 text-right flex items-center gap-2">
                      <p className="text-sm font-bold text-red-600">{fmt(d.outstandingBalance, currency)}</p>
                      <Link href={`${customerOverviewRoute}?id=${d.id}`}>
                        <Button size="sm" className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ─────────────────────────────────────── */}
              <div className="hidden sm:block rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(d => (
                      <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                              <span className="text-red-600 font-bold text-xs">{d.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{d.name}</p>
                              {d.customerNo && <p className="text-xs text-muted-foreground">#{d.customerNo}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {d.phone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</p>}
                            {d.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{d.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-red-600">{fmt(d.outstandingBalance, currency)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`${customerOverviewRoute}?id=${d.id}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-muted/20 border-t text-xs text-muted-foreground">
                  {filtered.length} debtor{filtered.length !== 1 ? "s" : ""}
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
