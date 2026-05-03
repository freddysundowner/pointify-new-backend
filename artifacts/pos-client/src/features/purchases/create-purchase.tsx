import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, Package, Search, ShoppingCart, X } from "lucide-react";
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
  const { admin, isAuthenticated } = useAuth();
  const { currency } = useSelector((state: RootState) => state.currency);
  const { attendantId, shopId } = usePrimaryShop();
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInvoiceNumber(generateInvoiceNumber()); }, []);
  useEffect(() => {
    if (shop?.trackBatches !== undefined) setTrackBatches(shop.trackBatches);
  }, [shop?.trackBatches]);

  // Auto-focus search input when overlay opens
  useEffect(() => {
    if (productSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setSearchTerm("");
    }
  }, [productSearchOpen]);

  const filteredProducts = useMemo(() =>
    products.filter((p: any) =>
      !searchTerm ||
      (p.name || p.title || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      const newItem: PurchaseItem & { sellingPrice?: number } = {
        productName: product.name || product.title,
        quantity: 1,
        unitCost: parseFloat(String(product.buyingPrice || 0)),
        totalCost: parseFloat(String(product.buyingPrice || 0)),
        sellingPrice: parseFloat(String(product.sellingPrice || 0)),
      };
      setItems([...items, newItem]);
    }
    setSearchTerm("");
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
    if (window.history.length > 1) { window.history.back(); return; }
    setLocation(isAttendant ? "/attendant/purchases" : "/purchases");
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.productName && item.quantity > 0);
    if (validItems.length === 0) { alert("Please add at least one item."); return; }
    setIsSubmitting(true);
    try {
      const selectedSupplier = suppliers.find((s: any) => s.name === supplierName);
      const purchaseItems = validItems.map(item => {
        const product = products.find((p: any) => (p.name || p.title) === item.productName);
        return {
          productId: product?._id || product?.id || null,
          quantity: item.quantity,
          buyingPrice: item.unitCost,
          sellingPrice: (item as any).sellingPrice || product?.sellingPrice || item.unitCost * 1.5,
          discount: 0,
        };
      });
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
        setLocation(isAttendant ? "/attendant/purchases" : "/purchases");
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
      <div className="-mx-4 sm:mx-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={handleBack} className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">New Purchase Order</h1>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {items.length > 0 && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  {currency} {calculateTotal().toFixed(2)}
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={isSubmitting || items.length === 0}
                size="sm"
                className="h-8 gap-1 text-xs px-2.5"
              >
                <Save className="h-3.5 w-3.5" />
                {isSubmitting ? "Saving…" : "Save Order"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-3 space-y-3">

          {/* Order Details */}
          <Card className="rounded-none sm:rounded-lg border-x-0 sm:border-x">
            <CardHeader className="px-3 sm:px-6 py-3 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Supplier</Label>
                  <Select value={supplierName} onValueChange={setSupplierName}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliersLoading ? (
                        <SelectItem value="loading">Loading…</SelectItem>
                      ) : suppliers.length > 0 ? (
                        suppliers.map((supplier: any) => (
                          <SelectItem key={supplier._id} value={supplier.name}>
                            {supplier.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none">No suppliers</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Invoice #</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Invoice number"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Expected Delivery</Label>
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="trackBatches"
                  checked={trackBatches}
                  onCheckedChange={(checked) => setTrackBatches(checked === true)}
                />
                <label htmlFor="trackBatches" className="text-xs text-gray-600 cursor-pointer select-none leading-tight">
                  Enable batch tracking for this purchase
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="rounded-none sm:rounded-lg border-x-0 sm:border-x">
            <CardHeader className="px-3 sm:px-6 py-3 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-purple-600" />
                  Items
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{items.length}</Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs px-2.5"
                  onClick={() => setProductSearchOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Product
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-4">
              {items.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items yet. Tap "Add Product" to start.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                      {/* Product name + remove */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate pr-2">{item.productName}</p>
                        <button
                          onClick={() => removeItem(index)}
                          className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Compact 2×2 grid of inputs */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Qty</p>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Buying Price</p>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Selling Price</p>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={(item as any).sellingPrice || 0}
                            onChange={(e) => updateItem(index, 'sellingPrice' as keyof PurchaseItem, parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Total</p>
                          <div className="h-8 flex items-center px-3 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700">
                            {currency} {parseFloat(String(item.totalCost || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Order total */}
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      Order Total ({items.reduce((s, i) => s + i.quantity, 0)} units)
                    </span>
                    <span className="text-lg font-bold text-purple-600">
                      {currency} {calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom save button (visible on mobile, sticky feel) */}
          <div className="pb-4">
            <Button
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0}
              className="w-full h-11 text-sm font-medium"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating Order…" : `Create Purchase Order${items.length > 0 ? ` · ${currency} ${calculateTotal().toFixed(2)}` : ""}`}
            </Button>
          </div>

        </div>
      </div>

      {/* Full-screen product search overlay */}
      {productSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          {/* Search bar header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-white">
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
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          {searchTerm && (
            <div className="px-4 py-2 text-xs text-gray-400 border-b bg-gray-50">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
            </div>
          )}

          {/* Scrollable product list */}
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
                {filteredProducts.map((product: any, idx: number) => {
                  const alreadyAdded = items.some(i => i.productName === (product.name || product.title));
                  return (
                    <li key={product._id || product.id}>
                      <button
                        onClick={() => addProductToOrder(product)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50"
                      >
                        {/* Icon */}
                        <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-purple-500" />
                        </div>
                        {/* Name + price */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name || product.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {currency} {parseFloat(String(product.buyingPrice || 0)).toFixed(2)} buying
                            {product.sellingPrice ? ` · ${currency} ${parseFloat(String(product.sellingPrice)).toFixed(2)} selling` : ""}
                          </p>
                        </div>
                        {/* Added badge / plus */}
                        {alreadyAdded ? (
                          <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>
                        ) : (
                          <div className="h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
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
