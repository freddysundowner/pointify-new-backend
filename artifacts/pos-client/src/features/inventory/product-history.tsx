import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, TrendingUp, TrendingDown, Package, AlertTriangle,
  ClipboardList, ArrowLeftRight, Clock, RefreshCw, ShoppingCart,
  RotateCcw, Plus, Minus,
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { navigate } from "wouter/use-browser-location";
import { useAuth } from "@/features/auth/useAuth";
import { useCurrency } from "@/utils";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

// ── Event type config ──────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  sale:               { label: "Sale",           color: "bg-green-100 text-green-700 border-green-200",   icon: TrendingDown },
  purchase:           { label: "Purchase",       color: "bg-blue-100 text-blue-700 border-blue-200",     icon: TrendingUp },
  adjustment_add:     { label: "Stock Added",    color: "bg-teal-100 text-teal-700 border-teal-200",     icon: Plus },
  adjustment_remove:  { label: "Stock Removed",  color: "bg-orange-100 text-orange-700 border-orange-200", icon: Minus },
  bad_stock:          { label: "Write-off",      color: "bg-red-100 text-red-700 border-red-200",        icon: AlertTriangle },
  stock_count:        { label: "Stock Count",    color: "bg-purple-100 text-purple-700 border-purple-200", icon: ClipboardList },
  transfer_in:        { label: "Transfer In",    color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: ArrowLeftRight },
  transfer_out:       { label: "Transfer Out",   color: "bg-amber-100 text-amber-700 border-amber-200",  icon: ArrowLeftRight },
  transfer:           { label: "Transfer",       color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: ArrowLeftRight },
  sale_return:        { label: "Sale Return",    color: "bg-pink-100 text-pink-700 border-pink-200",     icon: RotateCcw },
  purchase_return:    { label: "Purchase Return",color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: RotateCcw },
};

function EventBadge({ type }: { type: string }) {
  const cfg = EVENT_CONFIG[type] ?? { label: type, color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function fmt(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d as any);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹ Prev</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next ›</Button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductHistory() {
  const { id: productId } = useParams<{ id: string }>();
  const currency = useCurrency();
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);

  const isAdmin = !!admin && !localStorage.getItem("attendantData");
  const shopId = selectedShopId || "";

  // Date range filter – default: last 90 days
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; })();
  const defaultTo   = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(defaultFrom);
  const [to,   setTo]   = useState(defaultTo);
  const [activeTab, setActiveTab] = useState("sales");

  // Per-tab page state
  const [auditPage,    setAuditPage]    = useState(1);
  const [salesPage,    setSalesPage]    = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const [adjPage,      setAdjPage]      = useState(1);
  const [badPage,      setBadPage]      = useState(1);
  const [countPage,    setCountPage]    = useState(1);
  const [xferPage,     setXferPage]     = useState(1);

  const resetPages = () => { setAuditPage(1); setSalesPage(1); setPurchasePage(1); setAdjPage(1); setBadPage(1); setCountPage(1); setXferPage(1); };

  // ── Queries ──────────────────────────────────────────────────────────────────

  const qs = (extra: string, page: number) =>
    `?shopId=${shopId}&from=${from}&to=${to}&page=${page}&limit=20${extra}`;

  const { data: productResp, isLoading: productLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => (await apiCall(ENDPOINTS.products.getById(productId || ""))).json(),
    enabled: !!productId,
  });
  const product = productResp?.data ?? productResp;

  const { data: summaryResp } = useQuery({
    queryKey: ["product-summary", productId, shopId],
    queryFn: async () => (await apiCall(ENDPOINTS.products.summary(productId || ""))).json(),
    enabled: !!productId,
    staleTime: 0,
  });
  const summary = summaryResp?.data ?? summaryResp;

  const { data: auditResp, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-trail", productId, shopId, from, to, auditPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.auditTrail(productId || "")}${qs("", auditPage)}`)).json(),
    enabled: !!productId && activeTab === "audit",
    staleTime: 0,
  });

  const { data: salesResp, isLoading: salesLoading } = useQuery({
    queryKey: ["sales-history", productId, shopId, from, to, salesPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.salesHistory(productId || "")}${qs("", salesPage)}`)).json(),
    enabled: !!productId && activeTab === "sales",
    staleTime: 0,
  });

  const { data: purchaseResp, isLoading: purchaseLoading } = useQuery({
    queryKey: ["purchase-history", productId, shopId, from, to, purchasePage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.purchasesHistory(productId || "")}${qs("", purchasePage)}`)).json(),
    enabled: !!productId && activeTab === "purchases",
    staleTime: 0,
  });

  const { data: adjResp, isLoading: adjLoading } = useQuery({
    queryKey: ["stock-history", productId, shopId, adjPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.stockHistory(productId || "")}?shopId=${shopId}&page=${adjPage}&limit=20`)).json(),
    enabled: !!productId && activeTab === "adjustments",
    staleTime: 0,
  });

  const { data: badResp, isLoading: badLoading } = useQuery({
    queryKey: ["bad-stock", productId, shopId, from, to, badPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.badStockMovements}?productId=${productId}&shopId=${shopId}&from=${from}&to=${to}&page=${badPage}&limit=20`)).json(),
    enabled: !!productId && activeTab === "badstock",
    staleTime: 0,
  });

  const { data: countResp, isLoading: countLoading } = useQuery({
    queryKey: ["stock-count-history", productId, shopId, from, to, countPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.stockCountHistory(productId || "")}${qs("", countPage)}`)).json(),
    enabled: !!productId && activeTab === "counts",
    staleTime: 0,
  });

  const { data: xferResp, isLoading: xferLoading } = useQuery({
    queryKey: ["transfer-history", productId, shopId, from, to, xferPage],
    queryFn: async () => (await apiCall(`${ENDPOINTS.products.transferHistory(productId || "")}?shopId=${shopId}&page=${xferPage}&limit=20`)).json(),
    enabled: !!productId && activeTab === "transfers",
    staleTime: 0,
  });

  const auditEvents    = auditResp?.data    ?? [];
  const salesEvents    = salesResp?.data    ?? [];
  const purchaseEvents = purchaseResp?.data ?? [];
  const adjEvents      = Array.isArray(adjResp?.data) ? adjResp.data : Array.isArray(adjResp) ? adjResp : [];
  const badEvents      = badResp?.data      ?? [];
  const countEvents    = countResp?.data    ?? [];
  const xferEvents     = xferResp?.data     ?? [];

  const pg = (resp: any) => ({
    totalPages: resp?.meta?.totalPages ?? 1,
    total: resp?.meta?.total ?? 0,
  });

  const handleGoBack = () => {
    if (window.history.length > 1) { window.history.back(); return; }
    navigate(isAdmin ? "/products" : "/attendant/products");
  };

  if (!productId) return (
    <DashboardLayout>
      <div className="text-center py-8 text-gray-500">Product not found</div>
    </DashboardLayout>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleGoBack} className="hidden sm:flex gap-1 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {productLoading ? "Loading…" : (product?.name || "Product History")}
            </h1>
            <p className="hidden sm:block text-xs text-gray-400">
              {product?.type && <span className="capitalize">{product.type}</span>}
              {product?.category?.name && <span> · {product.category.name}</span>}
              {" · "}Full audit trail
            </p>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-green-600">{currency} {parseFloat(summary?.sales?.totalSoldValue ?? "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-400">{summary?.sales?.saleCount ?? 0} sales</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-gray-500">Units Sold</p>
              <p className="text-xl font-bold">{parseFloat(summary?.sales?.totalSoldQty ?? "0")}</p>
              <p className="text-xs text-gray-400">all time</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-gray-500">Current Stock</p>
              <p className="text-xl font-bold text-blue-600">{parseFloat(summary?.currentStock ?? "0")}</p>
              <p className="text-xs text-gray-400">{currency} {parseFloat(summary?.stockValue ?? "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-gray-500">Total Purchased</p>
              <p className="text-xl font-bold text-indigo-600">{parseFloat(summary?.purchases?.totalPurchasedQty ?? "0")}</p>
              <p className="text-xs text-gray-400">{summary?.purchases?.purchaseCount ?? 0} orders</p>
            </CardContent></Card>
          </div>
        )}

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-lg p-3 border">
          <span className="text-xs font-medium text-gray-600">Date range:</span>
          <Input type="date" value={from} onChange={e => { setFrom(e.target.value); resetPages(); }} className="h-7 text-xs w-36" />
          <span className="text-xs text-gray-400">to</span>
          <Input type="date" value={to} onChange={e => { setTo(e.target.value); resetPages(); }} className="h-7 text-xs w-36" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setFrom(defaultFrom); setTo(defaultTo); resetPages(); }}>
            Reset
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); }} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 mb-2">
            <TabsTrigger value="sales"       className="text-sm gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Sales</TabsTrigger>
            <TabsTrigger value="purchases"   className="text-sm gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Purchases</TabsTrigger>
            <TabsTrigger value="adjustments" className="text-sm gap-1.5"><Package className="h-3.5 w-3.5" />Adjustments</TabsTrigger>
            <TabsTrigger value="badstock"    className="text-sm gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Bad Stock</TabsTrigger>
            <TabsTrigger value="counts"      className="text-sm gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Stock Counts</TabsTrigger>
            <TabsTrigger value="transfers"   className="text-sm gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Transfers</TabsTrigger>
            <TabsTrigger value="audit"       className="text-sm gap-1.5"><Clock className="h-3.5 w-3.5" />Audit Trail</TabsTrigger>
          </TabsList>

          {/* ── AUDIT TRAIL ── */}
          <TabsContent value="audit">
            <Card>
              <CardContent className="p-0">
                {auditLoading ? <Loading /> : auditEvents.length === 0 ? <EmptyState icon={Clock} text="No activity found for this period" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date & Time</th>
                            <th className="text-left px-4 py-2">Event</th>
                            <th className="text-left px-4 py-2">Reference</th>
                            <th className="text-right px-4 py-2">Qty</th>
                            <th className="text-right px-4 py-2">Unit Price</th>
                            <th className="text-left px-4 py-2">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {auditEvents.map((e: any, i: number) => (
                            <tr key={`${e.eventType}-${e.id}-${i}`} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(e.date)}</td>
                              <td className="px-4 py-2"><EventBadge type={e.eventType} /></td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600">{e.refNo || "—"}</td>
                              <td className="px-4 py-2 text-right font-medium">
                                {e.eventType === "adjustment_remove" || e.eventType === "bad_stock" || e.eventType === "transfer_out"
                                  ? <span className="text-red-600">-{parseFloat(e.qty ?? 0)}</span>
                                  : <span className="text-green-700">+{parseFloat(e.qty ?? 0)}</span>}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-600">
                                {e.price ? `${currency} ${parseFloat(e.price).toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate">
                                {e.eventType === "stock_count"
                                  ? `Physical: ${parseFloat(e.a ?? 0)} | System: ${parseFloat(e.b ?? 0)} | Variance: ${parseFloat(e.variance ?? 0) >= 0 ? "+" : ""}${parseFloat(e.variance ?? 0)}`
                                  : e.eventType === "adjustment_add" || e.eventType === "adjustment_remove"
                                  ? `${e.note || ""} (${parseFloat(e.b ?? 0)} → ${parseFloat(e.a ?? 0)})`
                                  : e.customerName
                                  ? `Customer: ${e.customerName}`
                                  : e.note || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={auditPage} totalPages={pg(auditResp).totalPages} onPage={setAuditPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SALES ── */}
          <TabsContent value="sales">
            <Card>
              <CardContent className="p-0">
                {salesLoading ? <Loading /> : salesEvents.length === 0 ? <EmptyState icon={ShoppingCart} text="No sales found for this period" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Receipt No</th>
                            <th className="text-left px-4 py-2">Customer</th>
                            <th className="text-left px-4 py-2">Type</th>
                            <th className="text-right px-4 py-2">Qty</th>
                            <th className="text-right px-4 py-2">Unit Price</th>
                            <th className="text-right px-4 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {salesEvents.map((s: any, i: number) => (
                            <tr key={s.id ?? i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(s.saleDate ?? s.createdAt)}</td>
                              <td className="px-4 py-2 font-mono text-xs">{s.receiptNo || `#${s.saleId || s.id}`}</td>
                              <td className="px-4 py-2 text-xs">{s.customerId ? `Customer #${s.customerId}` : "Walk-in"}</td>
                              <td className="px-4 py-2 text-xs capitalize">{s.saleType || "cash"}</td>
                              <td className="px-4 py-2 text-right text-red-600 font-medium">-{parseFloat(s.quantity ?? 1)}</td>
                              <td className="px-4 py-2 text-right text-xs">{currency} {parseFloat(s.unitPrice ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-medium">{currency} {(parseFloat(s.quantity ?? 1) * parseFloat(s.unitPrice ?? 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={salesPage} totalPages={pg(salesResp).totalPages} onPage={setSalesPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PURCHASES ── */}
          <TabsContent value="purchases">
            <Card>
              <CardContent className="p-0">
                {purchaseLoading ? <Loading /> : purchaseEvents.length === 0 ? <EmptyState icon={TrendingUp} text="No purchases found for this period" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Purchase No</th>
                            <th className="text-left px-4 py-2">Supplier</th>
                            <th className="text-left px-4 py-2">Batch</th>
                            <th className="text-right px-4 py-2">Qty</th>
                            <th className="text-right px-4 py-2">Unit Price</th>
                            <th className="text-right px-4 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {purchaseEvents.map((p: any, i: number) => (
                            <tr key={p.id ?? i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(p.purchaseDate ?? p.createdAt)}</td>
                              <td className="px-4 py-2 font-mono text-xs">{p.purchaseNo || `#${p.purchaseId || p.id}`}</td>
                              <td className="px-4 py-2 text-xs">{p.supplierId ? `Supplier #${p.supplierId}` : "Direct"}</td>
                              <td className="px-4 py-2 text-xs text-gray-400">{p.batchCode || "—"}</td>
                              <td className="px-4 py-2 text-right text-green-700 font-medium">+{parseFloat(p.quantity ?? 1)}</td>
                              <td className="px-4 py-2 text-right text-xs">{currency} {parseFloat(p.unitPrice ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-medium">{currency} {(parseFloat(p.quantity ?? 1) * parseFloat(p.unitPrice ?? 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={purchasePage} totalPages={pg(purchaseResp).totalPages} onPage={setPurchasePage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ADJUSTMENTS ── */}
          <TabsContent value="adjustments">
            <Card>
              <CardContent className="p-0">
                {adjLoading ? <Loading /> : adjEvents.length === 0 ? <EmptyState icon={Package} text="No stock adjustments found" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Type</th>
                            <th className="text-right px-4 py-2">Before</th>
                            <th className="text-right px-4 py-2">Adjusted</th>
                            <th className="text-right px-4 py-2">After</th>
                            <th className="text-left px-4 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {adjEvents.map((a: any, i: number) => (
                            <tr key={a.id ?? i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(a.createdAt)}</td>
                              <td className="px-4 py-2">
                                {a.kind === "adjustment" ? (
                                  <EventBadge type={a.type === "add" ? "adjustment_add" : "adjustment_remove"} />
                                ) : (
                                  <EventBadge type="bad_stock" />
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{parseFloat(a.quantityBefore ?? 0)}</td>
                              <td className="px-4 py-2 text-right font-medium">
                                {a.type === "add"
                                  ? <span className="text-teal-600">+{parseFloat(a.quantityAdjusted ?? a.quantity ?? 0)}</span>
                                  : <span className="text-orange-600">-{parseFloat(a.quantityAdjusted ?? a.quantity ?? 0)}</span>}
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">{parseFloat(a.quantityAfter ?? 0)}</td>
                              <td className="px-4 py-2 text-xs text-gray-500">{a.reason || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={adjPage} totalPages={pg(adjResp).totalPages ?? 1} onPage={setAdjPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BAD STOCK / WRITE-OFFS ── */}
          <TabsContent value="badstock">
            <Card>
              <CardContent className="p-0">
                {badLoading ? <Loading /> : badEvents.length === 0 ? <EmptyState icon={AlertTriangle} text="No write-offs found for this period" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Reason</th>
                            <th className="text-right px-4 py-2">Qty Written Off</th>
                            <th className="text-right px-4 py-2">Unit Price</th>
                            <th className="text-right px-4 py-2">Total Loss</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {badEvents.map((b: any, i: number) => (
                            <tr key={b.id ?? i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(b.createdAt ?? b.date)}</td>
                              <td className="px-4 py-2 text-xs capitalize">{b.reason || "Bad Stock"}</td>
                              <td className="px-4 py-2 text-right text-red-600 font-medium">-{parseFloat(b.quantity ?? 1)}</td>
                              <td className="px-4 py-2 text-right text-xs">{currency} {parseFloat(b.unitPrice ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-medium text-red-600">{currency} {(parseFloat(b.quantity ?? 1) * parseFloat(b.unitPrice ?? 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={badPage} totalPages={pg(badResp).totalPages} onPage={setBadPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── STOCK COUNTS ── */}
          <TabsContent value="counts">
            <Card>
              <CardContent className="p-0">
                {countLoading ? <Loading /> : countEvents.length === 0 ? <EmptyState icon={ClipboardList} text="No stock counts recorded for this period" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Count #</th>
                            <th className="text-right px-4 py-2">System Qty</th>
                            <th className="text-right px-4 py-2">Physical Qty</th>
                            <th className="text-right px-4 py-2">Variance</th>
                            <th className="text-left px-4 py-2">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {countEvents.map((c: any, i: number) => {
                            const variance = parseFloat(c.variance ?? 0);
                            return (
                              <tr key={c.id ?? i} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(c.createdAt)}</td>
                                <td className="px-4 py-2 font-mono text-xs text-gray-500">#{c.stockCountId}</td>
                                <td className="px-4 py-2 text-right text-xs">{parseFloat(c.systemCount ?? 0)}</td>
                                <td className="px-4 py-2 text-right font-medium">{parseFloat(c.physicalCount ?? 0)}</td>
                                <td className={`px-4 py-2 text-right font-bold ${variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-gray-400"}`}>
                                  {variance > 0 ? "+" : ""}{variance}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${variance === 0 ? "bg-gray-100 text-gray-600" : variance > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {variance === 0 ? "Balanced" : variance > 0 ? "Surplus" : "Shortage"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={countPage} totalPages={pg(countResp).totalPages} onPage={setCountPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TRANSFERS ── */}
          <TabsContent value="transfers">
            <Card>
              <CardContent className="p-0">
                {xferLoading ? <Loading /> : xferEvents.length === 0 ? <EmptyState icon={ArrowLeftRight} text="No transfers found for this product" /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Transfer No</th>
                            <th className="text-left px-4 py-2">From</th>
                            <th className="text-left px-4 py-2">To</th>
                            <th className="text-right px-4 py-2">Qty</th>
                            <th className="text-right px-4 py-2">Unit Price</th>
                            <th className="text-left px-4 py-2">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {xferEvents.map((x: any, i: number) => (
                            <tr key={x.id ?? i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(x.createdAt)}</td>
                              <td className="px-4 py-2 font-mono text-xs">{x.transferNo || `#${x.transferId || x.id}`}</td>
                              <td className="px-4 py-2 text-xs">{x.fromShopName || `Shop #${x.fromShop}`}</td>
                              <td className="px-4 py-2 text-xs">{x.toShopName || `Shop #${x.toShop}`}</td>
                              <td className="px-4 py-2 text-right font-medium">{parseFloat(x.quantity ?? 0)}</td>
                              <td className="px-4 py-2 text-right text-xs">{x.unitPrice ? `${currency} ${parseFloat(x.unitPrice).toFixed(2)}` : "—"}</td>
                              <td className="px-4 py-2 text-xs text-gray-400">{x.transferNote || x.note || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={xferPage} totalPages={pg(xferResp).totalPages} onPage={setXferPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
