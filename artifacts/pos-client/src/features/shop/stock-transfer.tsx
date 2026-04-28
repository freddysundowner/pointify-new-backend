import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2, Search, ArrowLeft, RefreshCw, Download, ChevronDown, ChevronUp, X } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useGoBack } from "@/hooks/useGoBack";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TransferItem {
  id: number;
  product: number;
  productName: string;
  quantity: string | number;
  unitPrice: string | number;
}

interface Transfer {
  id: number;
  fromShop: number;
  fromShopName: string;
  toShop: number;
  toShopName: string;
  transferNo: string;
  transferNote: string | null;
  initiatedBy: number | null;
  createdAt: string;
  transferItems: TransferItem[];
}

interface ShopOption { id: number; name: string; }
interface ProductOption { id: number; name: string; quantity?: number; sellingPrice?: string | number; }

interface CartItem { productId: number; productName: string; quantity: number; }

export default function StockTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, userType } = usePrimaryShop();
  const goBack = useGoBack("/dashboard");

  // History filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const itemsPerPage = 20;

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [fromShopId, setFromShopId] = useState<number | null>(null);
  const [toShopId, setToShopId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // ── Shops ──
  const { data: shopsData } = useQuery({
    queryKey: ["shops", adminId],
    queryFn: async () => {
      const res = await apiRequest("GET", ENDPOINTS.shop.getAll);
      const json = await res.json();
      return (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []) as ShopOption[];
    },
    enabled: !!adminId,
  });
  const shopOptions: ShopOption[] = shopsData ?? [];

  // ── Transfer history ──
  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ["transfers", shopId, fromDate, toDate, currentPage],
    queryFn: async () => {
      if (!shopId) return null;
      const params = new URLSearchParams({ shopId: String(shopId), page: String(currentPage), limit: String(itemsPerPage) });
      if (fromDate) params.append("startDate", fromDate);
      if (toDate) params.append("endDate", toDate);
      const res = await apiRequest("GET", `${ENDPOINTS.transfers.filter}?${params}`);
      return res.json();
    },
    enabled: !!shopId,
    refetchOnMount: true,
  });

  const transfers: Transfer[] = Array.isArray(historyData?.data) ? historyData.data : [];
  const totalPages = historyData?.meta?.totalPages ?? 1;
  const totalCount = historyData?.meta?.total ?? transfers.length;

  // ── Product search (for create form) ──
  const { data: productResults } = useQuery({
    queryKey: ["transfer-product-search", fromShopId, productSearch],
    queryFn: async () => {
      if (!fromShopId || productSearch.length < 1) return [];
      const params = new URLSearchParams({ shopId: String(fromShopId), q: productSearch });
      const res = await apiRequest("GET", `${ENDPOINTS.stockCounts.productSearch}?${params}`);
      const json = await res.json();
      return (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []) as ProductOption[];
    },
    enabled: !!fromShopId && productSearch.length >= 1,
  });

  // ── Create transfer ──
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!fromShopId || !toShopId || !cart.length) throw new Error("Missing fields");
      const res = await apiRequest("POST", ENDPOINTS.transfers.shopTransfer, {
        fromShopId: Number(fromShopId),
        toShopId: Number(toShopId),
        note: note || undefined,
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transfer created", description: "Inventory has been moved between shops" });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setShowForm(false);
    setFromShopId(null);
    setToShopId(null);
    setNote("");
    setCart([]);
    setProductSearch("");
  };

  const addToCart = (p: ProductOption) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === p.id);
      if (existing) return prev.map(c => c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1 }];
    });
    setProductSearch("");
  };

  const updateCartQty = (productId: number, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.productId !== productId)); return; }
    setCart(prev => prev.map(c => c.productId === productId ? { ...c, quantity: qty } : c));
  };

  // ── PDF export ──
  const exportPDF = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.text("Stock Transfer Report", pw / 2, 16, { align: "center" });
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, pw / 2, 23, { align: "center" });
    const rows: any[] = [];
    transfers.forEach(t => {
      const date = new Date(t.createdAt).toLocaleDateString();
      if (t.transferItems.length) {
        t.transferItems.forEach(i => rows.push([t.transferNo, i.productName, i.quantity, t.fromShopName, t.toShopName, date]));
      } else {
        rows.push([t.transferNo, "—", 0, t.fromShopName, t.toShopName, date]);
      }
    });
    autoTable(doc, {
      startY: 30,
      head: [["Transfer #", "Product", "Qty", "From", "To", "Date"]],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
    });
    doc.save(`transfers-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-wrap">
          {(attendant || userType === "attendant") && (
            <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2 gap-1 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          )}
          <span className="font-semibold text-sm">Stock Transfer</span>

          {/* Date range */}
          <div className="flex items-center gap-1.5 ml-2">
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            <span className="text-gray-400 text-xs">→</span>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }} className="h-8 text-xs w-36" />
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setFromDate(""); setToDate(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={exportPDF} disabled={!transfers.length}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1 bg-purple-600 hover:bg-purple-700" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> New Transfer
            </Button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        <div className="flex items-center gap-6 px-4 py-2 bg-gray-50 border-b text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{totalCount}</span> transfers</span>
          <span><span className="font-semibold text-gray-900">
            {transfers.reduce((s, t) => s + t.transferItems.length, 0)}
          </span> items moved</span>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No transfers found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Transfer #</th>
                  <th className="text-left px-3 py-2 font-medium">From</th>
                  <th className="text-left px-3 py-2 font-medium">To</th>
                  <th className="text-center px-3 py-2 font-medium">Items</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => {
                  const isExpanded = expandedId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? "bg-purple-50/40" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                            {t.transferNo}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{t.fromShopName}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 text-gray-700">
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            {t.toShopName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                            {t.transferItems.length}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">
                          <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                          <div>{new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-0 py-0 bg-purple-50/20">
                            <div className="border-l-4 border-purple-400 mx-4 my-2 rounded overflow-hidden">
                              {t.transferItems.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-gray-400">No items</div>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-purple-50 border-b border-purple-100 text-purple-700">
                                      <th className="text-left px-4 py-1.5 font-medium">Product</th>
                                      <th className="text-center px-3 py-1.5 font-medium">Quantity</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-purple-50">
                                    {t.transferItems.map((item) => (
                                      <tr key={item.id} className="bg-white">
                                        <td className="px-4 py-1.5 font-medium text-gray-800">{item.productName}</td>
                                        <td className="text-center px-3 py-1.5 text-gray-700 font-semibold">
                                          {parseFloat(String(item.quantity))}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {t.transferNote && (
                                <div className="px-4 py-2 text-xs text-gray-500 border-t border-purple-50">
                                  Note: {t.transferNote}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-white text-xs text-gray-500">
            <span>{totalCount} transfers</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>‹ Prev</Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next ›</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Transfer Dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowRight className="h-4 w-4 text-purple-600" />
              New Stock Transfer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Shop selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">From Shop</label>
                <Select
                  value={fromShopId ? String(fromShopId) : ""}
                  onValueChange={(v) => { setFromShopId(Number(v)); setCart([]); setProductSearch(""); }}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Select source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopOptions.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">To Shop</label>
                <Select
                  value={toShopId ? String(toShopId) : ""}
                  onValueChange={(v) => setToShopId(Number(v))}
                  disabled={!fromShopId}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Select destination…" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopOptions.filter(s => s.id !== fromShopId).map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product search */}
            {fromShopId && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Add Products</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search product name…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 text-sm h-9"
                  />
                  {productResults && productResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-auto">
                      {productResults.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                          onClick={() => addToCart(p)}
                        >
                          <span>{p.name}</span>
                          {p.quantity !== undefined && (
                            <span className="text-xs text-gray-400">Stock: {p.quantity}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Items to Transfer ({cart.length})
                </label>
                <div className="space-y-1.5">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                      <span className="flex-1 text-sm font-medium">{item.productName}</span>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateCartQty(item.productId, parseInt(e.target.value) || 1)}
                        className="w-16 h-7 text-center text-xs"
                        min="1"
                      />
                      <button className="text-gray-300 hover:text-red-500" onClick={() => setCart(prev => prev.filter(c => c.productId !== item.productId))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Note (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transfer reason or notes…" className="text-sm h-9" />
            </div>

            {/* Summary */}
            {fromShopId && toShopId && cart.length > 0 && (
              <div className="bg-purple-50 border border-purple-100 rounded px-3 py-2 text-xs text-purple-700">
                Transfer <strong>{cart.reduce((s, c) => s + c.quantity, 0)}</strong> unit(s) across <strong>{cart.length}</strong> product(s) from{" "}
                <strong>{shopOptions.find(s => s.id === fromShopId)?.name}</strong> →{" "}
                <strong>{shopOptions.find(s => s.id === toShopId)?.name}</strong>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 text-sm" onClick={resetForm}>Cancel</Button>
              <Button
                className="flex-1 text-sm bg-purple-600 hover:bg-purple-700"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !fromShopId || !toShopId || !cart.length}
              >
                {createMutation.isPending ? "Transferring…" : "Transfer Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
