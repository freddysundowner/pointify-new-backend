import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Search, Trash2, ArrowLeft, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useShop } from "@/features/shop/useShop";
import { usePermissions } from "@/hooks/usePermissions";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useLocation } from "wouter";

interface BadStockRow {
  id: number;
  product: number;
  productName: string;
  shop: number;
  writtenOffBy: number | null;
  quantity: string | number;
  unitPrice: string | number;
  reason: string;
  createdAt: string;
}

interface ProductOption {
  id: number;
  name: string;
  sellingPrice?: string | number;
  price?: string | number;
}

const fmt = (n: string | number | undefined) => parseFloat(String(n ?? 0));

const REASONS = ["damaged", "expired", "defective", "missing", "other"];

export default function StockBadStock() {
  const { hasPermission, hasAttendantPermission } = usePermissions();
  const { toast } = useToast();
  const { currency } = useShop();
  const queryClient = useQueryClient();
  const { attendant } = useAttendantAuth();
  const { shopId, adminId } = usePrimaryShop();
  const [, setLocation] = useLocation();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // ── Fetch bad stocks ──
  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ["bad-stock", shopId, adminId, currentPage, startDate, endDate],
    queryFn: async () => {
      if (!shopId) return { data: [], meta: { total: 0, totalPages: 1 } };
      const params = new URLSearchParams({ shopId: String(shopId), page: String(currentPage), limit: String(itemsPerPage) });
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const res = await apiRequest("GET", `${ENDPOINTS.badStock.getAll}?${params}`);
      return res.json();
    },
    enabled: !!shopId,
  });

  const allItems: BadStockRow[] = Array.isArray(response?.data) ? response.data : [];
  const totalItems = response?.meta?.total ?? allItems.length;
  const totalPages = response?.meta?.totalPages ?? 1;

  // Client-side search filter
  const items = searchQuery
    ? allItems.filter(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()) || i.reason.toLowerCase().includes(searchQuery.toLowerCase()))
    : allItems;

  // Summary stats computed from current page data
  const totalQty = allItems.reduce((s, i) => s + fmt(i.quantity), 0);
  const totalValue = allItems.reduce((s, i) => s + fmt(i.quantity) * fmt(i.unitPrice), 0);

  // ── Product search for form ──
  const { data: productOptions } = useQuery({
    queryKey: ["bad-stock-product-search", shopId, productSearch],
    queryFn: async () => {
      if (!shopId || productSearch.length < 1) return [];
      const params = new URLSearchParams({ shopId: String(shopId), q: productSearch });
      const res = await apiRequest("GET", `${ENDPOINTS.stockCounts.productSearch}?${params}`);
      const json = await res.json();
      return (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []) as ProductOption[];
    },
    enabled: !!shopId && productSearch.length >= 1,
  });

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", ENDPOINTS.badStock.create, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reported", description: "Bad stock entry recorded and inventory updated" });
      queryClient.invalidateQueries({ queryKey: ["bad-stock"] });
      setShowForm(false);
      setSelectedProduct(null);
      setProductSearch("");
      setQuantity("");
      setReason("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Failed to report bad stock", variant: "destructive" }),
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", ENDPOINTS.badStock.delete(String(id)));
      return res.status === 204 ? null : res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Entry removed" });
      queryClient.invalidateQueries({ queryKey: ["bad-stock"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!selectedProduct || !quantity || !reason) {
      toast({ title: "Required", description: "Select a product, enter quantity, and pick a reason", variant: "destructive" });
      return;
    }
    const unitPrice = fmt(selectedProduct.sellingPrice ?? selectedProduct.price ?? 0);
    createMutation.mutate({ shopId, productId: selectedProduct.id, quantity: parseFloat(quantity), unitPrice, reason });
  };

  const canManage = hasPermission("inventory_view") || hasAttendantPermission("stocks", "badstock");
  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
          You don't have permission to manage bad stock.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setLocation(attendant ? "/attendant/dashboard" : "/stock")} className="hidden lg:flex h-8 px-2 gap-1 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <span className="font-semibold text-sm">Bad Stock</span>

          {/* Date range */}
          <div className="flex items-center gap-1.5 ml-2">
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            <span className="text-gray-400 text-xs">→</span>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setStartDate(""); setEndDate(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs w-40" />
          </div>

          <div className="ml-auto">
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Report Bad Stock
            </Button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-b text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{totalItems}</span> entries</span>
          <span>Total qty: <span className="font-semibold text-red-600">{totalQty.toFixed(0)}</span></span>
          <span>Est. loss: <span className="font-semibold text-red-600">{currency} {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <AlertTriangle className="h-8 w-8 text-gray-200" />
              No bad stock entries found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-center px-3 py-2 font-medium">Qty</th>
                  <th className="text-center px-3 py-2 font-medium">Unit Price</th>
                  <th className="text-center px-3 py-2 font-medium">Est. Loss</th>
                  <th className="text-left px-3 py-2 font-medium">Reason</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const qty = fmt(item.quantity);
                  const unitPrice = fmt(item.unitPrice);
                  const loss = qty * unitPrice;
                  return (
                    <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-3 py-2.5 text-center text-red-600 font-semibold">{qty}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                        {currency} {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-center text-red-700 font-medium text-xs">
                        {currency} {loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="capitalize text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
                          {item.reason}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
            <span>{totalItems} entries</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>‹ Prev</Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next ›</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Report Bad Stock Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Report Bad Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Product search */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Product</label>
              {selectedProduct ? (
                <div className="flex items-center justify-between bg-gray-50 border rounded px-3 py-2 text-sm">
                  <span className="font-medium">{selectedProduct.name}</span>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => { setSelectedProduct(null); setProductSearch(""); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search product name…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 text-sm"
                  />
                  {productOptions && productOptions.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-auto">
                      {productOptions.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                          onClick={() => { setSelectedProduct(p); setProductSearch(""); }}
                        >
                          <span>{p.name}</span>
                          <span className="text-xs text-gray-400">{currency} {fmt(p.sellingPrice ?? p.price ?? 0).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Quantity to write off</label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" min="1" className="text-sm" />
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Reason</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select reason…" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && quantity && (
              <div className="bg-red-50 border border-red-100 rounded px-3 py-2 text-xs text-red-700">
                This will deduct <strong>{quantity}</strong> units from inventory and record a loss of{" "}
                <strong>{currency} {(parseFloat(quantity || "0") * fmt(selectedProduct.sellingPrice ?? selectedProduct.price ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 text-sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                className="flex-1 text-sm bg-red-600 hover:bg-red-700"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !selectedProduct || !quantity || !reason}
              >
                {createMutation.isPending ? "Saving…" : "Write Off Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
