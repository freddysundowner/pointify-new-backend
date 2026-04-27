import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Plus, Trash2, Package, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
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

export default function CreatePurchase() {
  const [location, setLocation] = useLocation();
  const { admin, isAuthenticated } = useAuth();
  const { currency } = useSelector((state: RootState) => state.currency);
  const { attendantId,shopId } = usePrimaryShop();

  // Suppliers API integration
  const { data: suppliersResponse, isLoading: suppliersLoading } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      return response.json();
    },
    enabled: !!admin?._id && !!shopId,
  });

  // Use existing ProductsContext with cached data
  const { products: contextProducts, isLoading: productsLoading, error: productsError, refreshProducts } = useProducts();

  const suppliers = normalizeIds((suppliersResponse as any)?.data || []);
  const products = contextProducts || [];

  // Generate auto invoice number
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

  // Auto-generate invoice number on component mount
  useEffect(() => {
    setInvoiceNumber(generateInvoiceNumber());
  }, []);

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  const addProductToOrder = (product: any) => {
    // Check if product already exists in the order
    const existingIndex = items.findIndex(item => item.productName === (product.name || product.title));
    
    if (existingIndex >= 0) {
      // If product exists, increase quantity
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].totalCost = newItems[existingIndex].quantity * newItems[existingIndex].unitCost;
      setItems(newItems);
    } else {
      // Add new product to order  
      const newItem: PurchaseItem & { sellingPrice?: number } = {
        productName: product.name || product.title,
        quantity: 1,
        unitCost: product.buyingPrice || 0,
        totalCost: product.buyingPrice || 0,
        sellingPrice: product.sellingPrice || 0
      };
      setItems([...items, newItem]);
    }
    
    // Clear search and close dialog
    setSearchTerm("");
    setProductSearchOpen(false);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total cost when quantity or unit cost changes
    if (field === 'quantity' || field === 'unitCost') {
      newItems[index].totalCost = newItems[index].quantity * newItems[index].unitCost;
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.productName && item.quantity > 0);
    
    if (validItems.length === 0) {
      alert("Please add at least one item to the purchase order.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Find supplier ID if supplier is selected
      const selectedSupplier = suppliers.find((s: any) => s.name === supplierName);
      
      // Extract attendant ID properly
      // const attendantId = (admin?.attendantId as any)?._id || admin?.attendantId || admin?._id || null;

      // Map items to Pointify format
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
        shopId: shopId,
        supplierId: selectedSupplier?._id || null,
        paymentType: "cash",
        amountPaid: calculateTotal(),
        items: purchaseItems,
      };
      
      const response = await apiRequest('POST', ENDPOINTS.purchases.create, payload);

      if (response.ok) {
        if(isAttendant) {
          setLocation("/attendant/purchases");
        }else{
          setLocation("/purchases");
        }
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
  const isAttendant = location.startsWith("/attendant/");

  return (
    <DashboardLayout title="Create Purchase Order">
      <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Check if we came from stock summary by looking at URL parameters
              const urlParams = new URLSearchParams(window.location.search);
              const hasFilter = urlParams.has('filter');
              
              if (hasFilter) {
                // If we came from stock summary with a filter, go back there
                const backRoute = isAttendant ? '/attendant/stock/summary' : '/stock/summary';
                setLocation(backRoute);
              } else {
                // Otherwise go to dashboard
                const backRoute = isAttendant ? '/attendant/dashboard' : '/dashboard';
                setLocation(backRoute);
              }
            }}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Purchase Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select value={supplierName} onValueChange={setSupplierName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersLoading ? (
                      <SelectItem value="loading">Loading suppliers...</SelectItem>
                    ) : suppliers.length > 0 ? (
                      suppliers.map((supplier: any) => (
                        <SelectItem key={supplier._id} value={supplier.name}>
                          {supplier.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none">No suppliers found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter invoice number"
                />
              </div>

              <div>
                <Label htmlFor="orderDate">Order Date *</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="expectedDate">Expected Delivery Date</Label>
                <Input
                  id="expectedDate"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </div>
            
            {/* Batch Tracking Option */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="trackBatches" 
                  checked={trackBatches}
                  onCheckedChange={(checked) => setTrackBatches(checked === true)}
                />
                <Label 
                  htmlFor="trackBatches" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable batch tracking for this purchase
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Track individual product batches for better inventory management and expiration control
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5" />
              Purchase Order Items
            </CardTitle>
            <div className="space-y-3">
              <Dialog open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <DialogTrigger asChild>
                  <div className="relative cursor-pointer">
                    <Input
                      placeholder="Search products to add to purchase order..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 cursor-pointer"
                      readOnly
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Products to Add</DialogTitle>
                  </DialogHeader>
                  <Command>
                    <CommandInput
                      placeholder="Search products..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {productsLoading ? "Loading products..." : "No products found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {products
                          .filter((product: any) => 
                            !searchTerm || 
                            (product.name || product.title || '').toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((product: any) => (
                          <CommandItem
                            key={product._id}
                            onSelect={() => addProductToOrder(product)}
                            className="cursor-pointer"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name || product.title}</span>
                              <span className="text-sm text-muted-foreground">
                                {product.shopId?.currency || 'KES'} {(product.buyingPrice || 0).toFixed(2)} per unit
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products added yet. Use the search above to add products to your purchase order.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">{item.productName}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-8"
                              placeholder="Enter quantity"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Buying Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-8"
                              placeholder="Enter price"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Selling Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={(item as any).sellingPrice || 0}
                              onChange={(e) => updateItem(index, 'sellingPrice' as keyof PurchaseItem, parseFloat(e.target.value) || 0)}
                              className="h-8"
                              placeholder="Enter selling price"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total Cost</Label>
                            <Input
                              value={`${currency} ${item.totalCost.toFixed(2)}`}
                              readOnly
                              className="h-8 bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="ml-4 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Total Amount:
                    </span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {currency} {calculateTotal().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Total Items:</span>
                    <span>{items.reduce((sum, item) => sum + item.quantity, 0)} units</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => setLocation("/purchases")}>           
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting || items.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Creating..." : "Create Purchase Order"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}