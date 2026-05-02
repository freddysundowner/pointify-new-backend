import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Eye, Users, AlertTriangle, ArrowLeft, RefreshCw, Download,
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
      d.name,
      d.phone ?? "",
      d.email ?? "",
      d.customerNo ?? "",
      d.type ?? "",
      Number(d.outstandingBalance ?? 0).toFixed(2),
      Number(d.wallet ?? 0).toFixed(2),
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debtors-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-red-600" />
            <h1 className="text-lg font-bold text-gray-900">Debtors Report</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" onClick={() => refetch()} disabled={isLoading} className="h-8 gap-1 bg-green-600 hover:bg-green-700">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm bg-red-50">
              <CardContent className="p-3">
                <p className="text-xs text-red-500 font-medium">Total Outstanding Debt</p>
                <p className="text-xl font-bold text-red-700 leading-tight mt-0.5">{fmt(totalDebt, currency)}</p>
                <p className="text-xs text-red-400 mt-0.5">across all customers</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-orange-50">
              <CardContent className="p-3">
                <p className="text-xs text-orange-500 font-medium">Debtors</p>
                <p className="text-xl font-bold text-orange-700 leading-tight mt-0.5">{debtors.length}</p>
                <p className="text-xs text-orange-400 mt-0.5">customers with unpaid balances</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search + table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, phone or email…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Failed to load debtors</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try Again</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 font-medium">
                  {searchTerm ? "No matching debtors" : "No debtors — all customers are paid up"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b">
                      <th className="text-left pb-2 font-medium">Customer</th>
                      <th className="text-left pb-2 font-medium hidden sm:table-cell">Contact</th>
                      <th className="text-right pb-2 font-medium">Outstanding</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(debtor => (
                      <tr key={debtor.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                              <span className="text-red-600 font-semibold text-xs">
                                {debtor.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{debtor.name}</p>
                              {debtor.customerNo && (
                                <p className="text-xs text-gray-400">#{debtor.customerNo}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 hidden sm:table-cell">
                          <div className="space-y-0.5">
                            {debtor.phone && <p className="text-gray-500 text-xs">{debtor.phone}</p>}
                            {debtor.email && <p className="text-gray-400 text-xs">{debtor.email}</p>}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span className="font-semibold text-red-600">{fmt(debtor.outstandingBalance, currency)}</span>
                        </td>
                        <td className="py-3 text-right pl-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">Debt</Badge>
                            <Link href={`${customerOverviewRoute}?id=${debtor.id}`}>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
                                <Eye className="h-3 w-3" /> Pay
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-3 text-right">{filtered.length} debtor{filtered.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
