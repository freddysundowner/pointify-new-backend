import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Save, Plus, Trash2, Package, Search, ShoppingCart, X, CalendarDays, FileText, Truck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeIds } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { useProducts } from "@/contexts/ProductsContext";
import type { PurchaseItem } from "@shared/schema";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { usePrimaryShop } from "../../hooks/usePrimaryShop";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";
import { useShop } from "@/features/shop/useShop";

export default function CreatePurchase() {
  const [location, setLocation] = useLocation();
  const { admin } = useAuth();
  const currency = useSelector((state: RootState) => state.currency) as string;
  const { shopId } = usePrimaryShop();
  const { shop } = useShop();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAttendant = location.startsWith("/attendant/");

  // ── Quick-add supplier ──────────────────────────────────────────────────
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setSavingSupplier(true);
    try {
      const res = await apiRequest("POST", ENDPOINTS.suppliers.getAll, {
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
        email: newSupplierEmail.trim() || undefined,
        shopId: Number(shopId),
      });
      const json = await res.json();
      const created = json?.data ?? json;
      await queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll, shopId, 'all'] });
      setSupplierName(created.name);
      setAddSupplierOpen(false);
      setNewSupplierName(""); setNewSupplierPhone(""); setNewSupplierEmail("");
      toast({ title: "Supplier added", description: `${created.name} was added successfully.` });
    } catch {
      toast({ title: "Error", description: "Failed to add supplier.", variant: "destructive" });
    } finally {
      setSavingSupplier(false);
    }
  };

  const { data: suppliersResponse, isLoading: suppliersLoading } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId, 'all'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}&limit=1000`);
      return response.json();
    },
    enabled: !!admin?._id && !!shopId,
    staleTime: 0,
  });

  const { products: contextProducts, isLoading: productsLoading } = useProducts();
  const suppliers = normalizeIds((suppliersResponse as any)?.data || []);
  const products = contextProducts || [];

  const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PT${timestamp}${randomSuffix}`;
  };

  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [trackBatches, setTrackBatches] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInvoiceNumber(generateInvoiceNumber()); }, []);
  useEffect(() => {
    if (shop?.trackBatches !== undefined) setTrackBatches(shop.trackBatches);
  }, [shop?.trackBatches]);

  useEffect(() => {
    if (productSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setSearchTerm("");
    }
  }, [productSearchOpen]);

  const filteredProducts = useMemo(() =>
    products.filter((p: any) =>
      p.type !== "service" &&
      (!searchTerm || (p.name || p.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [products, searchTerm]
  );

  const addProductToOrder = (product: any) => {
    const existingIndex = items.findIndex(item => item.productName === (product.name || product.title));
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].totalCost = newItems[existingIndex].quantity * newItems[existingIndex].unitCost;
      setItems(newItems);
    } else {
      const unitCost = parseFloat(String(product.buyingPrice || 0));
      setItems([...items, {
        productId: product._id || product.id,
        productName: product.name || product.title,
        quantity: 1,
        unitCost,
        totalCost: unitCost,
      } as PurchaseItem]);
    }
    setProductSearchOpen(false);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitCost') {
      newItems[index].totalCost = newItems[index].quantity * newItems[index].unitCost;
    }
    setItems(newItems);
  };

  const calculateTotal = () => items.reduce((sum, item) => sum + item.totalCost, 0);

  const handleBack = () => {
    setLocation(isAttendant ? "/attendant/purchases" : "/purchases", { replace: true });
  };

  const selectedSupplier = suppliers.find((s: any) => s.name === supplierName);

  const handleSave = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);
    try {
      const purchaseItems = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        buyingPrice: item.unitCost,
        unitPrice: item.unitCost,
        sellingPrice: (item as any).sellingPrice ?? 0,
        totalCost: item.totalCost,
      }));
      const payload = {
        shopId,
        supplierId: selectedSupplier?._id || null,
        paymentType: "cash",
        amountPaid: calculateTotal(),
        trackBatches,
        items: purchaseItems,
      };
      const response = await apiRequest('POST', ENDPOINTS.purchases.create, payload);
      if (response.ok) {
        setLocation(isAttendant ? "/attendant/purchases" : "/purchases", { replace: true });
      } else {
        const error = await response.text();
        toast({ title: "Failed to save order", description: error || "An error occurred.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error creating purchase order:", error);
      toast({ title: "Failed to save order", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="New Purchase Order">
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm shrink-0">
          <div className="px-3 sm:px-4 h-12 flex items-center gap-2">
            <button onClick={handleBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 leading-tight">New Purchase</h1>
              {items.length > 0 && (
                <p className="text-xs text-purple-600 font-medium leading-none mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} · {currency} {calculateTotal().toFixed(2)}</p>
              )}
            </div>
            <Button onClick={handleSave} disabled={isSubmitting || items.length === 0} size="sm" className="h-8 gap-1 text-xs px-3 bg-purple-600 hover:bg-purple-700 shrink-0">
              <Save className="h-3.5 w-3.5" />
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* ── Details bar ── */}
        <div className="bg-white border-b px-3 sm:px-4 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><User className="h-2.5 w-2.5" /> Supplier</Label>
              <div className="flex gap-1">
                <Select value={supplierName} onValueChange={setSupplierName}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {suppliersLoading ? <SelectItem value="loading">Loading…</SelectItem>
                      : suppliers.length > 0 ? suppliers.map((s: any) => <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>)
                      : <SelectItem value="none">No suppliers yet</SelectItem>}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" title="Add supplier" onClick={() => setAddSupplierOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> Invoice #</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Optional" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><CalendarDays className="h-2.5 w-2.5" /> Order Date</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Truck className="h-2.5 w-2.5" /> Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
            <Checkbox id="trackBatches" checked={trackBatches} onCheckedChange={(c) => setTrackBatches(c === true)} />
            <label htmlFor="trackBatches" className="text-xs cursor-pointer select-none">
              <span className="font-medium text-gray-800">Enable batch tracking</span>
              <span className="text-gray-400"> — track individual lots with expiry dates</span>
            </label>
          </div>
        </div>

        {/* ── Items header ── */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white border-b shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-gray-800">Items</span>
            {items.length > 0 && <Badge className="text-xs px-1.5 py-0 h-5 bg-purple-100 text-purple-700 border-0">{items.length}</Badge>}
          </div>
          <Button size="sm" onClick={() => setProductSearchOpen(true)} className="h-8 gap-1.5 text-xs px-3 bg-purple-600 hover:bg-purple-700">
            <Plus className="h-3.5 w-3.5" />
            Add Product
            </Button>
          </div>

        {/* ── Items list ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">No items yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Tap "Add Product" to start building your order</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setProductSearchOpen(true)} className="mt-1 gap-1.5 text-xs border-purple-200 text-purple-600 hover:bg-purple-50">
                <Plus className="h-3.5 w-3.5" /> Add Product
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {items.map((item, index) => (
                <div key={index} className="px-3 sm:px-4 py-3">
                    {/* Row 1: name + qty controls + total + delete */}
                    <div className="flex items-center gap-2">
                      {/* Product icon */}
                      <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{item.productName}</p>
                        <p className="text-xs text-gray-400 leading-tight">
                          {currency} {parseFloat(String(item.unitCost || 0)).toFixed(2)} / unit
                        </p>
                      </div>
                      {/* Qty controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            const newQty = Math.max(1, item.quantity - 1);
                            updateItem(index, 'quantity', newQty);
                            setQtyInputs(prev => ({ ...prev, [index]: String(newQty) }));
                          }}
                          className="h-7 w-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
                        >
                          <span className="text-sm leading-none select-none">−</span>
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={qtyInputs[index] !== undefined ? qtyInputs[index] : String(item.quantity)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setQtyInputs(prev => ({ ...prev, [index]: raw }));
                            const n = parseInt(raw);
                            if (!isNaN(n) && n > 0) updateItem(index, 'quantity', n);
                          }}
                          onBlur={() => {
                            const raw = qtyInputs[index];
                            const n = raw !== undefined ? (parseInt(raw) || 1) : item.quantity;
                            updateItem(index, 'quantity', Math.max(1, n));
                            setQtyInputs(prev => { const next = { ...prev }; delete next[index]; return next; });
                          }}
                          className="w-10 h-7 text-center text-sm font-bold border border-gray-200 rounded-md bg-gray-50 outline-none focus:border-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none mx-0.5"
                        />
                        <button
                          onClick={() => updateItem(index, 'quantity', item.quantity + 1)}
                          className="h-7 w-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors"
                        >
                          <span className="text-sm leading-none select-none">+</span>
                        </button>
                      </div>
                      {/* Line total */}
                      <span className="text-sm font-bold text-purple-600 shrink-0 w-20 text-right tabular-nums">
                        {currency} {parseFloat(String(item.totalCost || 0)).toFixed(2)}
                      </span>
                      {/* Remove */}
                      <button
                        onClick={() => removeItem(index)}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0 transition-colors ml-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Row 2: price inputs */}
                    <div className="flex gap-2 mt-2 pl-10">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-medium text-gray-400 shrink-0 w-16">Buy price</span>
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="h-6 text-xs px-2 flex-1 min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-medium text-gray-400 shrink-0 w-16">Sell price</span>
                        <Input
                          type="number" min="0" step="0.01"
                          value={(item as any).sellingPrice || 0}
                          onChange={(e) => updateItem(index, 'sellingPrice' as keyof PurchaseItem, parseFloat(e.target.value) || 0)}
                          className="h-6 text-xs px-2 flex-1 min-w-0"
                        />
                      </div>
                      {/* Spacer to align under total + remove */}
                      <div className="w-[calc(5rem+1.75rem+0.375rem)] shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* ── Order total footer ── */}
        {items.length > 0 && (
          <div className="border-t bg-white px-3 sm:px-4 py-3 shrink-0 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Order Total</p>
              <p className="text-xs text-gray-400">{items.reduce((s, i) => s + i.quantity, 0)} unit{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} · {items.length} product{items.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="text-xl font-bold text-purple-600 tabular-nums">{currency} {calculateTotal().toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Product search overlay */}
      {productSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-4 duration-200 lg:left-60 lg:inset-y-0 lg:right-0">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-white shrink-0">
            <button
              onClick={() => setProductSearchOpen(false)}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0 text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products…"
                className="w-full h-10 pl-9 pr-9 rounded-full border border-gray-200 bg-gray-50 text-sm outline-none focus:border-purple-400 focus:bg-white transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {searchTerm && (
            <div className="px-4 py-2 text-xs text-gray-400 border-b bg-gray-50 shrink-0">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <div className="h-6 w-6 rounded-full border-2 border-gray-200 border-t-purple-500 animate-spin" />
                <p className="text-sm">Loading products…</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                <Package className="h-8 w-8 opacity-30" />
                <p className="text-sm">{searchTerm ? "No products match your search" : "No products available"}</p>
              </div>
            ) : (
              <ul>
                {filteredProducts.map((product: any) => {
                  const alreadyAdded = items.some(i => i.productName === (product.name || product.title));
                  return (
                    <li key={product._id || product.id}>
                      <button
                        onClick={() => addProductToOrder(product)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
                      >
                        <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name || product.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {currency} {parseFloat(String(product.buyingPrice || 0)).toFixed(2)} buying
                            {product.sellingPrice ? ` · ${currency} ${parseFloat(String(product.sellingPrice)).toFixed(2)} selling` : ""}
                          </p>
                        </div>
                        {alreadyAdded ? (
                          <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>
                        ) : (
                          <div className="h-7 w-7 rounded-full border border-purple-200 bg-purple-50 flex items-center justify-center shrink-0 text-purple-500">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* ── Quick-add Supplier Dialog ── */}
      <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4" /> Add New Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Supplier name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSupplier()}
                autoFocus
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="+1 234 567 890"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                type="email"
                placeholder="supplier@example.com"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddSupplierOpen(false)} disabled={savingSupplier}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddSupplier} disabled={!newSupplierName.trim() || savingSupplier}>
              {savingSupplier ? "Saving…" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
