import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, DollarSign, Package, Search, Check, ChevronsUpDown, Plus, Minus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProducts } from "@/contexts/ProductsContext";
import { useAuth } from "@/features/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useCurrency } from "@/utils";

interface PurchaseOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface OrderItem {
  id: string;
  name: string;
  unitCost: number;
  sellingPrice: number;
  quantity: number;
  total: number;
  currency: string;
}

interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  currentBalance?: number;
}

export default function PurchaseOrderDialog({ isOpen, onClose, onSuccess }: PurchaseOrderDialogProps) {
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { products, refreshProducts } = useProducts();
  const currency  = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get shopId from either admin or attendant context
  const getShopId = () => {
    if (selectedShopId) return selectedShopId;
    if (attendant?.shopId) {
      return typeof attendant.shopId === 'string' ? attendant.shopId : attendant.shopId._id;
    }
    return admin?.primaryShop?._id;
  };

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [trackBatches, setTrackBatches] = useState(false);
  const [quantityInputs, setQuantityInputs] = useState<{[key: number]: string}>({});

  // Generate PO number
  const [poNumber] = useState(() => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `PO${timestamp}${random}`;
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod("cash");
      setSelectedSupplier(null);
      setOrderItems([]);
      setNotes("");
      setExpectedDate("");
      setSearchTerm("");
      setTrackBatches(false);
    }
  }, [isOpen]);

  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, getShopId()],
    queryFn: async () => {
      const shopId = getShopId();
      if (!shopId) return [];
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      return response.json();
    },
    enabled: isOpen && !!getShopId(),
  });

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const mainCurrency = orderItems[0]?.currency || "KES";

  // Add product to order
  const addProduct = (product: any) => {
    const existingItemIndex = orderItems.findIndex(item => item.id === (product._id || product.id));
    
    if (existingItemIndex >= 0) {
      updateQuantity(existingItemIndex, orderItems[existingItemIndex].quantity + 1);
    } else {
      const newItem: OrderItem = {
        id: product._id || product.id,
        name: product.name || product.title,
        unitCost: product.buyingPrice || product.unitPrice || 0,
        sellingPrice: product.sellingPrice || (product.buyingPrice * 1.5) || 0,
        quantity: 1,
        total: product.buyingPrice || product.unitPrice || 0,
        currency: (product.shopId && product.shopId.currency) ? product.shopId.currency : "KES"
      };
      setOrderItems([...orderItems, newItem]);
    }
    setProductSearchOpen(false);
    setSearchTerm("");
  };

  // Update item quantity
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(index);
      return;
    }
    
    const updatedItems = [...orderItems];
    updatedItems[index].quantity = newQuantity;
    updatedItems[index].total = updatedItems[index].unitCost * newQuantity;
    setOrderItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // Update item price
  const updateItemPrice = (index: number, field: 'unitCost', value: number) => {
    const updatedItems = [...orderItems];
    updatedItems[index][field] = value;
    updatedItems[index].total = updatedItems[index].unitCost * updatedItems[index].quantity;
    setOrderItems(updatedItems);
  };

  // Create purchase order mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async (purchaseData: any) => {
      const response = await apiRequest('POST', ENDPOINTS.purchases.create, purchaseData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Purchase order created successfully"
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.getAll] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.suppliers.getAll] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Also refresh products context to update POS immediately
      refreshProducts();
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const handleSubmit = () => {
    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive"
      });
      return;
    }

    if (paymentMethod === "credit" && !selectedSupplier) {
      toast({
        title: "Error",
        description: "Please select a supplier for credit purchases",
        variant: "destructive"
      });
      return;
    }

    // Get attendantId - if we're an attendant, use attendant._id, otherwise use admin's attendantId
    const attendantId = attendant?._id || 
                       (typeof admin?.attendantId === 'string' ? admin.attendantId : admin?.attendantId?._id) || 
                       admin?._id;
    
    const purchaseData = {
      purchase: {
        shopId: getShopId(),
        supplierId: selectedSupplier?._id || null,
        attendantId: attendantId,
        paymentType: paymentMethod
      },
      purchaseItems: orderItems.map(item => ({
        product: item.id,
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitCost.toString()),
        sellingPrice: parseFloat(item.sellingPrice.toString()),
        lineDiscount: 0,
        attendantId: attendantId
      })),
      amountpaid: paymentMethod === "cash" ? subtotal : 0,
      trackBatches: Boolean(trackBatches),
      useWarehouse: true
    };

    createPurchaseMutation.mutate(purchaseData);
  };

  // Handle dialog close
  const handleClose = () => {
    setPaymentMethod("cash");
    setSelectedSupplier(null);
    setOrderItems([]);
    setNotes("");
    setExpectedDate("");
    setSearchTerm("");
    setQuantityInputs({});
    onClose();
  };

  // Filter products for search
  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter suppliers for search
  const filteredSuppliers = Array.isArray(suppliers) ? suppliers.filter((supplier: any) =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Purchase Order - {poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={cn(
                  "cursor-pointer transition-all",
                  paymentMethod === "cash"
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
                onClick={() => setPaymentMethod("cash")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Cash Purchase</p>
                      <p className="text-xs text-muted-foreground">Direct payment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all",
                  paymentMethod === "credit"
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
                onClick={() => setPaymentMethod("credit")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Credit Purchase</p>
                      <p className="text-xs text-muted-foreground">Pay later</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="space-y-3">
              <Label className="text-sm font-medium">
                Select Supplier {paymentMethod === "credit" ? "(Required)" : "(Optional)"}
              </Label>
              <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedSupplier ? selectedSupplier.name : "Select supplier..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search suppliers..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        {filteredSuppliers.map((supplier: any) => (
                          <CommandItem
                            key={supplier._id}
                            onSelect={() => {
                              setSelectedSupplier(supplier);
                              setSupplierSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSupplier?._id === supplier._id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{supplier.name}</p>
                              {supplier.currentBalance && (
                                <p className="text-xs text-muted-foreground">
                                  Balance: {currency} {supplier.currentBalance.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {selectedSupplier && selectedSupplier.currentBalance && selectedSupplier.currentBalance > 0 && (
                <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        Outstanding Balance
                      </Badge>
                      <span className="font-medium text-orange-700">
                        {currency} {selectedSupplier.currentBalance.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

          {/* Product Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Add Products</Label>
            <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative cursor-pointer">
                  <Input
                    placeholder="Search products to add..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 cursor-pointer"
                    readOnly
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search products..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.slice(0, 10).map((product) => (
                        <CommandItem
                          key={product._id}
                          onSelect={() => addProduct(product)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Cost: {product.shopId?.currency || 'KES'} {(product.buyingPrice || 0).toFixed(2)}</span>
                              <span>•</span>
                              <span>Stock: {product.quantity || 0}</span>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Order Items</Label>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {orderItems.map((item, index) => (
                      <div key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
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
                                  // Don't update quantity yet, wait for valid input
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
                                  // Reset to current quantity if invalid
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
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItemPrice(index, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-8"
                              placeholder="Enter price"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total Cost</Label>
                            <Input
                              value={`${item.currency} ${item.total.toFixed(2)}`}
                              readOnly
                              className="h-8 bg-gray-50 dark:bg-gray-800"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Batch Tracking Option */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
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

              {/* Order Total */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Amount</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {mainCurrency} {subtotal.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expectedDate">Expected Delivery Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes for this order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={orderItems.length === 0 || createPurchaseMutation.isPending}
              className="flex-1"
            >
              {createPurchaseMutation.isPending ? (
                "Creating Order..."
              ) : (
                `Create ${paymentMethod === "credit" ? "Credit" : "Cash"} Order`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}