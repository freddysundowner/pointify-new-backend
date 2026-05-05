import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, Package, Search, ShoppingCart, X, CalendarDays, FileText, Truck, User } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const isAttendant = location.startsWith("/attendant/");

  const { data: suppliersResponse, isLoading: suppliersLoading } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      return response.json();
    },
    enabled: !!admin?._id && !!shopId,
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
        unitCost: item.unitCost,
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
        alert(`Failed to create purchase order: ${error}`);
      }
    } catch (error) {
      console.error("Error creating purchase order:", error);
      alert("Failed to create purchase order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="New Purchase Order">
      {/* Two-column layout on desktop; stacked on mobile */}
      <div className="-mx-4 sm:mx-0 flex flex-col lg:flex-row lg:h-[calc(100vh-56px)] lg:overflow-hidden">

        {/* ── Mobile sticky top bar ── */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b px-3 py-2.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 truncate">New Purchase Order</h1>
              {items.length > 0 && (
                <p className="text-xs text-purple-600 font-medium">{items.length} item{items.length !== 1 ? "s" : ""} · {currency} {calculateTotal().toFixed(2)}</p>
              )}
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSubmitting || items.length === 0} size="sm" className="h-8 gap-1 text-xs px-3 bg-purple-600 hover:bg-purple-700 shrink-0">
            <Save className="h-3.5 w-3.5" />
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>

        {/* ── LEFT PANEL — Order details ── */}
        <div className="lg:w-72 xl:w-80 lg:border-r lg:flex-shrink-0 lg:flex lg:flex-col lg:overflow-y-auto bg-white">

          {/* Desktop panel header */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-3 border-b bg-gray-50/60 shrink-0">
            <button onClick={handleBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-900">New Purchase Order</h1>
              <p className="text-[11px] text-gray-400">Fill in the order details</p>
            </div>
          </div>

          <div className="px-3 lg:px-4 py-4 space-y-4 flex-1">

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3 w-3" /> Supplier
              </Label>
              <Select value={supplierName} onValueChange={setSupplierName}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {suppliersLoading ? (
                    <SelectItem value="loading">Loading…</SelectItem>
                  ) : suppliers.length > 0 ? (
                    suppliers.map((supplier: any) => (
                      <SelectItem key={supplier._id} value={supplier.name}>{supplier.name}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none">No suppliers</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice # */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Invoice #
              </Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice number" className="h-9 text-sm" />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Order Date
                </Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Truck className="h-3 w-3" /> Expected Delivery
                </Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            {/* Batch tracking */}
            <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <Checkbox
                id="trackBatches"
                checked={trackBatches}
                onCheckedChange={(checked) => setTrackBatches(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="trackBatches" className="text-xs text-gray-600 cursor-pointer select-none leading-snug">
                <span className="font-medium text-gray-700">Enable batch tracking</span>
                <br />Track individual lots with expiry dates
              </label>
            </div>

          </div>

          {/* Desktop save button at bottom of left panel */}
          <div className="hidden lg:block px-4 py-3 border-t bg-gray-50/60 shrink-0">
            <Button
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0}
              className="w-full h-10 bg-purple-600 hover:bg-purple-700 font-medium gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting
                ? "Saving…"
                : items.length > 0
                  ? `Save · ${currency} ${calculateTotal().toFixed(2)}`
                  : "Save Order"}
            </Button>
          </div>
        </div>

        {/* ── RIGHT PANEL — Items ── */}
        <div className="flex-1 flex flex-col lg:overflow-hidden bg-gray-50/30">

          {/* Items panel header */}
          <div className="flex items-center justify-between px-3 lg:px-4 py-2.5 bg-white border-b sticky top-0 lg:static z-10 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold text-gray-800">Items</span>
              {items.length > 0 && (
                <Badge className="text-xs px-1.5 py-0 h-5 bg-purple-100 text-purple-700 border-0">{items.length}</Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setProductSearchOpen(true)}
              className="h-8 gap-1.5 text-xs px-3 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Product
            </Button>
          </div>

          {/* Items list */}
          <div className="flex-1 lg:overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">No items yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tap "Add Product" to start building your order</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProductSearchOpen(true)}
                  className="mt-1 gap-1.5 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Product
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 bg-white lg:mx-0">
                {items.map((item, index) => (
                  <div key={index} className="px-3 lg:px-4 py-3">
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

          {/* Order total + mobile save — always visible at bottom of right panel */}
          {items.length > 0 && (
            <div className="border-t bg-white px-3 lg:px-4 py-3 shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <p className="text-xs text-gray-400">Order Total</p>
                  <p className="text-[11px] text-gray-400">{items.reduce((s, i) => s + i.quantity, 0)} unit{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} · {items.length} product{items.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-xl font-bold text-purple-600 tabular-nums">
                  {currency} {calculateTotal().toFixed(2)}
                </span>
              </div>
              {/* Mobile-only save button */}
              <Button
                onClick={handleSave}
                disabled={isSubmitting || items.length === 0}
                className="w-full h-10 bg-purple-600 hover:bg-purple-700 font-medium gap-2 lg:hidden"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Creating Order…" : "Create Purchase Order"}
              </Button>
            </div>
          )}
        </div>
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
    </DashboardLayout>
  );
}
