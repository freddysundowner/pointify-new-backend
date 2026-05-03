import { useLocation, useParams } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { extractId } from "@/lib/utils";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/contexts/ProductsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCurrency } from "@/utils";

export default function PurchaseEditPage() {
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/purchases");
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { products } = useProducts();
  const purchasesRoute = useNavigationRoute("purchases");
  const currency = useCurrency();

  const state = window.history.state;
  const purchaseFromState = state?.purchase;

  const [formData, setFormData] = useState({
    supplierId: "direct",
    paymentType: "cash",
    items: [] as any[],
    notes: "",
  });

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const adminData = JSON.parse(localStorage.getItem("adminData") || "{}");
  const shopId = selectedShopId || String(extractId(adminData?.primaryShop) ?? "");

  const { data: suppliers = [] } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const response = await apiRequest("GET", `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    enabled: !!shopId,
  });

  useEffect(() => {
    if (purchaseFromState) {
      // Handle both raw API shape (purchaseItems, supplier) and normalized shape (items, supplierId)
      const rawItems = purchaseFromState.purchaseItems || purchaseFromState.items || [];
      const supplierId =
        purchaseFromState.supplier?.id ||
        purchaseFromState.supplier?._id ||
        purchaseFromState.supplierId?._id ||
        purchaseFromState.supplierId ||
        null;
      setFormData({
        supplierId: supplierId ? String(supplierId) : "direct",
        paymentType: purchaseFromState.paymentType || "cash",
        items: rawItems.map((item: any) => ({
          productId: item.product?.id || item.product?._id || item.productId,
          productName: item.product?.name || item.productName || "Unknown Product",
          quantity: parseFloat(String(item.quantity || 1)),
          unitPrice: parseFloat(String(item.unitPrice || item.unitCost || 0)),
          sellingPrice: parseFloat(String(item.sellingPrice || item.product?.sellingPrice || 0)),
          currency: item.product?.shopId?.currency || currency,
        })),
        notes: purchaseFromState.notes || "",
      });
    }
  }, [purchaseFromState]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", ENDPOINTS.purchases.update(id), data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Purchase updated successfully." });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.getAll] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.reportFilter] });
      setLocation(purchasesRoute, { replace: true });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  if (!purchaseFromState) {
    return (
      <DashboardLayout title="Edit Purchase">
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground text-sm">Purchase data not found. Please go back and try again.</p>
          <Button onClick={goBack} size="sm">Back to Purchases</Button>
        </div>
      </DashboardLayout>
    );
  }

  const filteredProducts = products.filter((p: any) =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addProduct = (product: any) => {
    const productId = String(product._id || product.id);
    const existing = formData.items.find(i => String(i.productId) === productId);
    if (existing) {
      setFormData({
        ...formData,
        items: formData.items.map(i =>
          String(i.productId) === productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          productId: productId,
          productName: product.name || product.title,
          quantity: 1,
          unitPrice: parseFloat(String(product.buyingPrice || product.sellingPrice || 0)),
          sellingPrice: parseFloat(String(product.sellingPrice || 0)),
          currency: product.shopId?.currency || currency,
        }],
      });
    }
    setShowProductDialog(false);
    setSearchTerm("");
  };

  const updateQty = (index: number, qty: number) => {
    if (qty <= 0) { removeItem(index); return; }
    setFormData({ ...formData, items: formData.items.map((it, i) => i === index ? { ...it, quantity: qty } : it) });
  };

  const updatePrice = (index: number, price: number) => {
    setFormData({ ...formData, items: formData.items.map((it, i) => i === index ? { ...it, unitPrice: price } : it) });
  };

  const removeItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const totalAmount = formData.items.reduce(
    (sum, it) => sum + parseFloat(String(it.quantity)) * parseFloat(String(it.unitPrice)), 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast({ title: "No items", description: "Add at least one item.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      supplierId: formData.supplierId === "direct" ? null : formData.supplierId,
      paymentType: formData.paymentType,
      items: formData.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sellingPrice: it.sellingPrice,
      })),
      notes: formData.notes,
    });
  };

  const purchaseNo = purchaseFromState.purchaseNo || purchaseFromState.invoiceNumber || "";
  // Normalise to "PUR-<suffix>" regardless of whether the stored value uses a hyphen or not
  const shortNo = purchaseNo
    ? purchaseNo.replace(/^PUR-?/i, "PUR-")
    : "";

  return (
    <DashboardLayout title="Edit Purchase">
      <div className="-mx-4 sm:mx-0 px-0 py-0">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2">
            <button
              onClick={goBack}
              className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight">Edit Purchase</h1>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">{shortNo}</p>
            </div>
            <Button
              form="purchase-edit-form"
              type="submit"
              size="sm"
              className="h-8 gap-1 text-xs px-3"
              disabled={updateMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <form id="purchase-edit-form" onSubmit={handleSubmit}>
          <div className="px-3 sm:px-4 py-3 space-y-3">

            {/* ── Purchase details ── */}
            <Card>
              <CardContent className="p-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Purchase Details</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Supplier</label>
                    <Select
                      value={formData.supplierId}
                      onValueChange={(v) => setFormData({ ...formData, supplierId: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Direct purchase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direct (No Supplier)</SelectItem>
                        {(Array.isArray(suppliers) ? suppliers : []).map((s: any) => (
                          <SelectItem key={s._id || s.id} value={s._id || s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Payment</label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={(v) => setFormData({ ...formData, paymentType: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Items ── */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Items ({formData.items.length})
                  </p>
                  <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Add Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl p-0">
                      <DialogHeader className="px-4 pt-4 pb-3 border-b">
                        <DialogTitle className="text-base">Select Product</DialogTitle>
                      </DialogHeader>
                      <div className="px-4 pt-3 pb-1">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search products…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto px-4 pb-4 pt-2 space-y-1.5">
                        {filteredProducts.length === 0 ? (
                          <p className="text-center text-sm text-gray-400 py-6">No products found</p>
                        ) : filteredProducts.map((p: any) => (
                          <div
                            key={p._id || p.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                            onClick={() => addProduct(p)}
                          >
                            <div>
                              <p className="text-sm font-medium leading-tight">{p.name || p.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Stock: {p.quantity ?? 0} · Cost: {currency} {parseFloat(String(p.buyingPrice || p.sellingPrice || 0)).toFixed(2)}
                              </p>
                            </div>
                            <Button type="button" size="sm" className="h-7 px-2.5 text-xs shrink-0">Add</Button>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {formData.items.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">No items yet. Click "Add Product" to begin.</p>
                ) : (
                  <div className="space-y-0 divide-y divide-gray-100">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_64px_88px_72px_32px] gap-1.5 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      <span>Product</span>
                      <span className="text-center">Qty</span>
                      <span className="text-center">Unit Price</span>
                      <span className="text-right">Total</span>
                      <span />
                    </div>
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-[1fr_64px_88px_72px_32px] gap-1.5 items-center py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate leading-tight">{item.productName}</p>
                          <p className="text-[10px] text-gray-400">{item.currency || currency}</p>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQty(index, parseInt(e.target.value) || 1)}
                          className="h-7 text-xs text-center px-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice ?? 0}
                          onChange={(e) => updatePrice(index, parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs text-center px-1"
                        />
                        <p className="text-xs font-medium text-right tabular-nums">
                          {(parseFloat(String(item.quantity)) * parseFloat(String(item.unitPrice))).toFixed(2)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {/* Total row */}
                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-xs text-gray-500">Order Total</span>
                      <span className="text-sm font-bold tabular-nums">
                        {currency} {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Notes ── */}
            <Card>
              <CardContent className="p-3 space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes (optional)…"
                  rows={2}
                  className="text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* ── Actions ── */}
            <div className="flex gap-2 pb-4">
              <Button type="button" variant="outline" size="sm" onClick={goBack} className="flex-1 h-9">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="flex-1 h-9 gap-1"
                disabled={updateMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" />
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>

          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
