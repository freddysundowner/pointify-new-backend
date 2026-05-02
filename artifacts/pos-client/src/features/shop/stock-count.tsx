import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Save, RefreshCw, Plus, Minus, History, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useLocation } from "wouter";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useGoBack } from "@/hooks/useGoBack";

interface Product {
  id: number;
  _id?: string;
  name: string;
  quantity: number;
  category?: string;
  sku?: string;
  virtual?: boolean;
  productType?: string;
  type?: string;
}

export default function StockCount() {
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/dashboard");
  const { attendant } = useAttendantAuth();
  const { shopId, adminId } = usePrimaryShop();
  const [searchQuery, setSearchQuery] = useState("");
  const [countData, setCountData] = useState<Record<string, number>>({});
  const [preservedCounts, setPreservedCounts] = useState<Record<string, number>>({});
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: productsResponse, isLoading } = useQuery({
    queryKey: [ENDPOINTS.products.getAll, "stock-count", adminId, shopId, currentPage, itemsPerPage, searchQuery, selectedStatus],
    enabled: !!adminId && !!shopId,
    queryFn: async () => {
      if (!adminId || !shopId) return { data: [], count: 0, totalPages: 0 };
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        name: searchQuery,
        shopId: shopId,
        type: "all",
        reason: "",
        date: "",
        sort: "",
        productid: "",
        barcodeid: "",
        productType: "",
        useWarehouse: "true",
        warehouse: "false",
        adminid: adminId,
      });
      const token = attendant ? localStorage.getItem("attendantToken") : localStorage.getItem("authToken");
      const res = await fetch(`${ENDPOINTS.products.getAll}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) return { data: [], count: 0, totalPages: 0 };
      const data = await res.json();
      const products = Array.isArray(data) ? data : (data?.data || []);
      return { data: products, count: data?.total || products.length, totalPages: Math.ceil((data?.total || products.length) / itemsPerPage) };
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const allProducts: Product[] = Array.isArray(productsResponse?.data) ? productsResponse.data : [];
  const products: Product[] = allProducts.filter(p => p.type !== "service" && p.type !== "virtual" && p.productType !== "service" && p.productType !== "virtual");
  const totalProducts = products.length;
  const totalPages = productsResponse?.totalPages || 1;
  const countedProducts = Object.keys(preservedCounts).length;

  const stockCountMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", ENDPOINTS.stockCounts.create, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Stock count submitted successfully" });
      setCountData({});
      setPreservedCounts({});
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
    },
    onError: () => toast({ title: "Error", description: "Failed to submit stock count", variant: "destructive" }),
  });

  const canStockCount = hasPermission("inventory_view") || hasAttendantPermission("stocks", "stock_count");
  if (!canStockCount) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          You don't have permission to perform stock counts.
        </div>
      </DashboardLayout>
    );
  }

  const handleCountChange = (pid: string, count: number) => {
    if (count < 0) return;
    setCountData(prev => ({ ...prev, [pid]: count }));
    setPreservedCounts(prev => ({ ...prev, [pid]: count }));
  };

  const handleSave = () => {
    const items = Object.entries(preservedCounts).filter(([pid]) => pid !== "undefined" && !isNaN(Number(pid)));
    if (!items.length) {
      toast({ title: "No counts", description: "Enter at least one physical count", variant: "destructive" });
      return;
    }
    stockCountMutation.mutate({
      shopId,
      items: items.map(([pid, physicalCount]) => ({ productId: Number(pid), physicalCount })),
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-wrap">
          {attendant && (
            <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2 gap-1 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          )}
          <div>
            <span className="font-semibold text-sm">Stock Count</span>
            <span className="ml-2 text-xs text-gray-400">
              <span className="text-green-600 font-medium">{countedProducts}</span>/{totalProducts} counted
            </span>
          </div>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setLocation(attendant ? "/attendant/stock/count-history" : "/stock/count-history")}
            >
              <History className="h-3.5 w-3.5" /> History
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => { setCountData({}); setPreservedCounts({}); }}
              disabled={!countedProducts}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleSave}
              disabled={!countedProducts || stockCountMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              {stockCountMutation.isPending ? "Saving…" : "Save Count"}
            </Button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No products found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-center px-3 py-2 font-medium w-24">System</th>
                  <th className="text-center px-3 py-2 font-medium w-40">Physical Count</th>
                  <th className="text-center px-3 py-2 font-medium w-24">Variance</th>
                  <th className="text-center px-3 py-2 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const pid = product._id ?? String(product.id);
                  const countValue = preservedCounts[pid] ?? countData[pid];
                  const systemQty = product.quantity || 0;
                  const physicalCount = countValue ?? 0;
                  const variance = countValue !== undefined ? physicalCount - systemQty : null;
                  const isCounted = countValue !== undefined;

                  return (
                    <tr key={pid} className={`hover:bg-gray-50 transition-colors ${isCounted ? "bg-green-50/40" : ""}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 leading-tight">{product.name}</div>
                        {product.category && <div className="text-xs text-gray-400">{product.category}</div>}
                      </td>
                      <td className="text-center px-3 py-2 text-gray-600">{systemQty}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                            onClick={() => handleCountChange(pid, Math.max(0, physicalCount - 1))}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <Input
                            type="number"
                            value={countValue !== undefined ? countValue.toString() : ""}
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                              if (!isNaN(v)) handleCountChange(pid, v);
                            }}
                            className="w-16 h-6 text-center text-xs px-1 border-gray-200"
                            min="0"
                          />
                          <button
                            className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                            onClick={() => handleCountChange(pid, physicalCount + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="text-center px-3 py-2">
                        {variance !== null && (
                          <span className={`font-semibold text-xs ${variance === 0 ? "text-green-600" : variance > 0 ? "text-blue-600" : "text-red-500"}`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2">
                        {isCounted && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Counted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-white text-xs text-gray-500">
            <span>
              {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                ‹ Prev
              </Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                Next ›
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
