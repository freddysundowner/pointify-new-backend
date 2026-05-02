import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Plus, Search, ArrowLeft, RefreshCw, Download, ChevronDown, ChevronUp, X, AlertTriangle, Package } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useGoBack } from "@/hooks/useGoBack";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { useShopDetails, drawShopHeader } from "@/hooks/useShopDetails";

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
  const shopDetails = useShopDetails(shopId);

  // Stock-error dialog
  interface StockError { productId: number; productName: string; required: number; available: number; fromBundle?: string; }
  const [transferErrors, setTransferErrors] = useState<StockError[]>([]);

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
  const [draftQty, setDraftQty] = useState<Record<number, string>>({});
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

  // ── Product search ──
  const { data: productResults } = useQuery({
    queryKey: ["transfer-product-search", fromShopId, productSearch],
    queryFn: async () => {
      if (!fromShopId || productSearch.length < 1) return [];
      const params = new URLSearchParams({ shopId: String(fromShopId), q: productSearch });
      const res = await apiRequest("GET", `${ENDPOINTS.transfers.productSearch}?${params}`);
      const json = await res.json();
      return (Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []) as ProductOption[];
    },
    enabled: !!fromShopId && productSearch.length >= 1,
  });

  // ── Create transfer ──
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!fromShopId || !toShopId || !cart.length) throw new Error("Missing fields");
      try {
        const res = await apiRequest("POST", ENDPOINTS.transfers.shopTransfer, {
          fromShopId: Number(fromShopId),
          toShopId: Number(toShopId),
          note: note || undefined,
          items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
        });
        return res.json();
      } catch (rawErr: any) {
        const bodyText = rawErr.message?.replace(/^\d+:\s*/, "") ?? "";
        try {
          const body = JSON.parse(bodyText);
          if (Array.isArray(body?.errors) && body.errors.length) {
            const err: any = new Error(body?.message || rawErr.message);
            err.stockErrors = body.errors;
            throw err;
          }
        } catch (inner: any) {
          if (inner.stockErrors) throw inner;
        }
        throw rawErr;
      }
    },
    onSuccess: () => {
      toast({ title: "Transfer created", description: "Inventory has been moved between shops" });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      resetForm();
    },
    onError: (e: any) => {
      if (e.stockErrors?.length) {
        setTransferErrors(e.stockErrors);
      } else {
        toast({ title: "Transfer failed", description: e.message, variant: "destructive" });
      }
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFromShopId(null);
    setToShopId(null);
    setNote("");
    setCart([]);
    setDraftQty({});
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
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const startY = drawShopHeader(doc, shopDetails, "Stock Transfer Report", `Generated: ${new Date().toLocaleString()}`);

    // Build rows: one section per transfer (header row + item rows)
    const body: any[] = [];
    const sectionHeaderIndices: number[] = [];

    transfers.forEach(t => {
      const date = new Date(t.createdAt).toLocaleString();
      const route = `${t.fromShopName}  →  ${t.toShopName}`;
      // Transfer section header
      sectionHeaderIndices.push(body.length);
      body.push([{ content: t.transferNo, styles: { fontStyle: "bold" } }, route, "", date]);

      if (t.transferItems.length === 0) {
        body.push(["", "No items", "", ""]);
      } else {
        t.transferItems.forEach((item: any) => {
          const label = item.productType === "bundle"
            ? `${item.productName} (bundle)`
            : item.productName;
          body.push(["", label, { content: parseFloat(String(item.quantity)), styles: { halign: "center" } }, ""]);
        });
      }

      if (t.transferNote) {
        body.push(["", { content: `Note: ${t.transferNote}`, styles: { fontStyle: "italic", textColor: [107, 114, 128] } }, "", ""]);
      }
    });

    autoTable(doc, {
      startY,
      head: [["Transfer #", "Product", "Qty", "Date"]],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 48 },
      },
      didParseCell: (data) => {
        if (sectionHeaderIndices.includes(data.row.index)) {
          data.cell.styles.fillColor = [237, 233, 254]; // purple-100
          data.cell.styles.textColor = [76, 29, 149];   // purple-900
        }
      },
    });

    doc.save(`transfers-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const fromShopName = shopOptions.find(s => s.id === fromShopId)?.name;
  const toShopName   = shopOptions.find(s => s.id === toShopId)?.name;
  const totalUnits   = cart.reduce((s, c) => s + c.quantity, 0);

  // ════════════════════════════════════════════════════════════════════════
  // FULL-PAGE CREATE FORM
  // ════════════════════════════════════════════════════════════════════════
  if (showForm) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full bg-gray-50">

          {/* ── Top bar ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
            <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 px-2 gap-1.5 text-xs text-gray-600">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <div className="w-px h-4 bg-gray-200" />
            <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="font-semibold text-sm">New Stock Transfer</span>
          </div>

          {/* ── Body ── */}
          <div className="flex-1">
            <div className="px-4 py-3 space-y-3">

              {/* Route + Note in one row */}
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-36">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">From Shop</label>
                  <Select
                    value={fromShopId ? String(fromShopId) : ""}
                    onValueChange={(v) => { setFromShopId(Number(v)); setCart([]); setProductSearch(""); }}
                  >
                    <SelectTrigger className="h-8 text-xs border-gray-300">
                      <SelectValue placeholder="Select source…" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopOptions.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-gray-400 mb-2 shrink-0" />

                <div className="flex-1 min-w-36">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">To Shop</label>
                  <Select
                    value={toShopId ? String(toShopId) : ""}
                    onValueChange={(v) => setToShopId(Number(v))}
                    disabled={!fromShopId}
                  >
                    <SelectTrigger className="h-8 text-xs border-gray-300">
                      <SelectValue placeholder="Select destination…" />
                    </SelectTrigger>
                    <SelectContent>
                      {shopOptions.filter(s => s.id !== fromShopId).map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-48">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Note (optional)</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Transfer reason…"
                    className="h-8 text-xs border-gray-300 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Product search + cart */}
              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 space-y-2 overflow-visible">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder={fromShopId ? "Search product name…" : "Select a source shop first…"}
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      disabled={!fromShopId}
                      className="pl-8 h-8 text-xs border-gray-300 focus:border-purple-500"
                    />
                    {productResults && productResults.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                        {productResults.map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                            onClick={() => addToCart(p)}
                          >
                            <span className="font-medium">{p.name}</span>
                            {p.quantity !== undefined && (
                              <span className="text-xs text-gray-400">Stock: {parseFloat(String(p.quantity))}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {cart.length > 0 && (
                    <span className="text-xs text-gray-500 shrink-0">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="space-y-1">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5">
                        <span className="flex-1 text-xs font-medium text-gray-800">{item.productName}</span>
                        <div className="flex items-center gap-1">
                          <button
                            className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold flex items-center justify-center"
                            onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                          >−</button>
                          <input
                            type="number"
                            value={draftQty[item.productId] ?? String(item.quantity)}
                            onChange={(e) => setDraftQty(d => ({ ...d, [item.productId]: e.target.value }))}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value);
                              const qty = parsed > 0 ? parsed : 1;
                              setDraftQty(d => { const next = { ...d }; delete next[item.productId]; return next; });
                              updateCartQty(item.productId, qty);
                            }}
                            className="w-12 h-6 text-center text-xs font-semibold border border-gray-300 rounded bg-white outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="1"
                          />
                          <button
                            className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold flex items-center justify-center"
                            onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                          >+</button>
                        </div>
                        <button className="text-gray-300 hover:text-red-500" onClick={() => setCart(prev => prev.filter(c => c.productId !== item.productId))}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary + submit */}
              {fromShopId && toShopId && cart.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                    <span><span className="font-semibold text-gray-900">{fromShopName}</span></span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span><span className="font-semibold text-gray-900">{toShopName}</span></span>
                    <span className="text-gray-400">·</span>
                    <span><span className="font-semibold text-gray-900">{totalUnits}</span> unit{totalUnits !== 1 ? "s" : ""}</span>
                    <span className="text-gray-400">·</span>
                    <span><span className="font-semibold text-gray-900">{cart.length}</span> product{cart.length !== 1 ? "s" : ""}</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 px-4 text-xs font-semibold bg-purple-600 hover:bg-purple-700 shrink-0 gap-1.5"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Transferring…</>
                      : <><ArrowRight className="h-3.5 w-3.5" /> Confirm Transfer</>
                    }
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stock Error Dialog ── */}
        <Dialog open={transferErrors.length > 0} onOpenChange={(open) => { if (!open) setTransferErrors([]); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base text-red-600">
                <AlertTriangle className="h-4 w-4" /> Insufficient Stock
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mt-1">
              The following items don't have enough stock in the source shop to complete this transfer:
            </p>
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {transferErrors.map((err, i) => (
                <div key={i} className="rounded-md border border-red-100 bg-red-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{err.productName}</p>
                      {err.fromBundle && (
                        <p className="text-xs text-gray-500 mt-0.5">Component of bundle: <span className="font-medium">{err.fromBundle}</span></p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-red-600 font-medium">Need {err.required}</p>
                      <p className="text-xs text-gray-500">Have {err.available}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setTransferErrors([])}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // HISTORY PAGE
  // ════════════════════════════════════════════════════════════════════════
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
                                    {t.transferItems.map((item) => {
                                      const isBundle = (item as any).productType === "bundle";
                                      return (
                                        <tr key={item.id} className={isBundle ? "bg-purple-50/60" : "bg-white"}>
                                          <td className="px-4 py-1.5">
                                            <div className="flex items-center gap-2">
                                              {isBundle ? (
                                                <>
                                                  <Package className="h-3 w-3 text-purple-500 shrink-0" />
                                                  <span className="font-semibold text-gray-800">{item.productName}</span>
                                                  <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Bundle</span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="ml-4 text-gray-400 shrink-0">└</span>
                                                  <span className="font-medium text-gray-700">{item.productName}</span>
                                                  <span className="text-[10px] text-gray-400">component</span>
                                                </>
                                              )}
                                            </div>
                                          </td>
                                          <td className="text-center px-3 py-1.5 text-gray-700 font-semibold">
                                            {parseFloat(String(item.quantity))}
                                          </td>
                                        </tr>
                                      );
                                    })}
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
    </DashboardLayout>
  );
}
