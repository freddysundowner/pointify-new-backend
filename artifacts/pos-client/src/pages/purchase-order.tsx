import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Search, X, DollarSign, CreditCard, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/useAuth';
import { usePrimaryShop } from '@/hooks/usePrimaryShop';
import { useProducts } from '@/contexts/ProductsContext';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useCurrency } from '@/utils';

interface Product {
  _id?: string;
  name?: string;
  sellingPrice?: number;
  buyingPrice?: number;
  quantity?: number;
  shopId?: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export default function PurchaseOrderPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { admin } = useAuth();
  const { shopId, attendantId, adminId } = usePrimaryShop();
  const { products, refreshProducts } = useProducts();
  const queryClient = useQueryClient();

  // Get effective shop ID for admin or attendant
  const getEffectiveShopId = (): string => {
    return shopId || '';
  };

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const currency = useCurrency();

  const [trackBatches, setTrackBatches] = useState(false);
  const [quantityInputs, setQuantityInputs] = useState<{[key: number]: string}>({});

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate purchase order number
  const generatePurchaseOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO${timestamp}${random}`;
  };

  const [purchaseOrderNumber] = useState(generatePurchaseOrderNumber());

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async (purchaseData: any) => {
      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseData),
      });

      if (!response.ok) {
        throw new Error('Failed to create purchase');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Order Created",
        description: "Purchase order has been created successfully",
      });
      
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/product'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refreshProducts();
      
      // Navigate back to purchases list
      setLocation('/purchases');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  // Add product to order
  const addProduct = (product: any) => {
    const productId = product._id || '';
    const productName = product.name || '';
    const buyingPrice = product.buyingPrice || product.sellingPrice || 0;
    
    const existingIndex = orderItems.findIndex(item => item.productId === productId);
    
    if (existingIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingIndex].quantity += 1;
      updatedItems[existingIndex].total = updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitCost;
      setOrderItems(updatedItems);
    } else {
      const newItem: OrderItem = {
        productId,
        productName,
        quantity: 1,
        unitCost: buyingPrice,
        total: buyingPrice,
      };
      setOrderItems([...orderItems, newItem]);
    }
    
    setProductSearchOpen(false);
    setSearchTerm("");
  };

  // Remove product from order
  const removeProduct = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    
    // Clean up quantity inputs
    const updatedQuantityInputs = { ...quantityInputs };
    delete updatedQuantityInputs[index];
    
    // Reindex remaining quantity inputs
    const newQuantityInputs: {[key: number]: string} = {};
    Object.entries(updatedQuantityInputs).forEach(([key, value]) => {
      const numKey = parseInt(key);
      if (numKey > index) {
        newQuantityInputs[numKey - 1] = value;
      } else {
        newQuantityInputs[numKey] = value;
      }
    });
    
    setQuantityInputs(newQuantityInputs);
  };

  // Update quantity
  const updateQuantity = (index: number, quantity: number) => {
    const updatedItems = [...orderItems];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = quantity * updatedItems[index].unitCost;
    setOrderItems(updatedItems);
  };

  // Update unit cost
  const updateUnitCost = (index: number, unitCost: number) => {
    const updatedItems = [...orderItems];
    updatedItems[index].unitCost = unitCost;
    updatedItems[index].total = updatedItems[index].quantity * unitCost;
    setOrderItems(updatedItems);
  };

  // Calculate total
  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the order",
        variant: "destructive",
      });
      return;
    }

    const effectiveShopId = getEffectiveShopId();
    // Ensure attendantId is a string, not an object
    console.log('Debug - attendantId:', attendantId, 'adminId:', adminId, 'typeof adminId:', typeof adminId);
    
    // Force to string in all cases
    let effectiveAttendantId = '';
    if (attendantId && typeof attendantId === 'string') {
      effectiveAttendantId = attendantId;
    } else if (adminId) {
      // If adminId is object, extract _id, otherwise use as string
      effectiveAttendantId = typeof adminId === 'object' ? (adminId as any)?._id || '' : String(adminId);
    }
    
    console.log('Debug - effectiveAttendantId:', effectiveAttendantId, 'typeof:', typeof effectiveAttendantId);

    const purchaseData = {
      purchase: {
        shopId: effectiveShopId,
        supplierId: selectedSupplier?._id || null,
        attendantId: effectiveAttendantId,
        paymentType: paymentMethod,
      },
      purchaseItems: orderItems.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitCost,
        sellingPrice: item.unitCost, // Use same price for both
        lineDiscount: 0,
        attendantId: effectiveAttendantId,
      })),
      amountpaid: calculateTotal(),
      trackBatches,
      useWarehouse: true,
    };

    console.log('Purchase creation payload:', JSON.stringify(purchaseData, null, 2));
    createPurchaseMutation.mutate(purchaseData);
  };

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Create Purchase Order">
      <div className="p-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/purchases')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Purchases
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Order #{purchaseOrderNumber}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "cash"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="font-medium">Cash Purchase</h3>
                      <p className="text-sm text-gray-600">Direct payment</p>
                    </div>
                  </div>
                </div>
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    paymentMethod === "credit"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setPaymentMethod("credit")}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    <div>
                      <h3 className="font-medium">Credit Purchase</h3>
                      <p className="text-sm text-gray-600">Pay later</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Supplier (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedSupplier ? selectedSupplier.name : "Select supplier..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0">
                  <Command>
                    <CommandInput placeholder="Search suppliers..." />
                    <CommandList>
                      <CommandEmpty>No suppliers found.</CommandEmpty>
                      <CommandGroup>
                        {filteredSuppliers.map((supplier) => (
                          <CommandItem
                            key={supplier._id}
                            value={supplier.name}
                            onSelect={() => {
                              setSelectedSupplier(supplier);
                              setSupplierSearchOpen(false);
                            }}
                          >
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Add Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Add Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Search className="mr-2 h-4 w-4" />
                    Search products to add...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search products..." 
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No products found.</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((product) => (
                          <CommandItem
                            key={product._id}
                            value={product.name}
                            onSelect={() => addProduct(product)}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{product.name}</span>
                              <Badge variant="secondary">
                                {currency} {((product as any)?.buyingPrice || (product as any)?.sellingPrice || 0).toFixed(2)}
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{item.productName}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantityInputs[index] ?? item.quantity.toString()}
                          onChange={(e) => {
                            const value = e.target.value;
                            
                            // Update display value immediately
                            setQuantityInputs(prev => ({
                              ...prev,
                              [index]: value
                            }));
                            
                            // Update internal state if valid
                            if (value === '') {
                              return;
                            }
                            
                            if (/^\d+$/.test(value)) {
                              const numValue = parseInt(value);
                              if (numValue > 0) {
                                updateQuantity(index, numValue);
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '' || !/^\d+$/.test(value) || parseInt(value) <= 0) {
                              setQuantityInputs(prev => ({
                                ...prev,
                                [index]: item.quantity.toString()
                              }));
                            }
                          }}
                          onFocus={(e) => {
                            e.target.select();
                          }}
                          className="h-8"
                          placeholder="Enter quantity"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Buying Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateUnitCost(index, parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total Cost</Label>
                        <div className="h-8 px-3 py-1 bg-gray-50 border rounded-md flex items-center">
                          <span className="text-sm font-medium">{currency} {item.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Batch Tracking */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="trackBatches" 
                  checked={trackBatches}
                  onCheckedChange={(checked) => setTrackBatches(checked as boolean)}
                />
                <Label htmlFor="trackBatches" className="text-sm font-medium">
                  Enable batch tracking for this purchase
                </Label>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Track individual product batches for better inventory management and expiration control
              </p>
            </CardContent>
          </Card>

          {/* Total Amount */}
          {orderItems.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {currency} {calculateTotal().toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}



          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setLocation('/purchases')}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createPurchaseMutation.isPending || orderItems.length === 0}
              className="min-w-[120px]"
            >
              {createPurchaseMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}