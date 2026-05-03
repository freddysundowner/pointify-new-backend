import { useLocation, useParams } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { extractId } from "@/lib/utils";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
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
  const purchasesRoute = useNavigationRoute('purchases');
  const currency = useCurrency();
  // Get purchase data from navigation state
  const state = window.history.state;
  const purchaseFromState = state?.purchase;

  const [formData, setFormData] = useState({
    supplierId: "direct",
    paymentType: "cash",
    items: [] as any[],
    notes: ""
  });

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get shop ID — prefer Redux selected shop so it respects shop switching
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
  const shopId = selectedShopId || String(extractId(adminData?.primaryShop) ?? '');

  // Load suppliers with shopId parameter
  const { data: suppliers = [] } = useQuery({
    queryKey: [ENDPOINTS.suppliers.getAll, shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const response = await apiRequest('GET', `${ENDPOINTS.suppliers.getAll}?shopId=${shopId}`);
      const json = await response.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    enabled: !!shopId,
  });

  // Initialize form data from purchase
  useEffect(() => {
    if (purchaseFromState) {
      setFormData({
        supplierId: purchaseFromState.supplierId?._id || "direct",
        paymentType: purchaseFromState.paymentType || "cash",
        items: purchaseFromState.items?.map((item: any) => ({
          productId: item.product?._id || item.productId,
          productName: item.product?.name || item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sellingPrice: item.sellingPrice || 0,
          currency: item.product?.shopId?.currency || "KES"
        })) || [],
        notes: purchaseFromState.notes || ""
      });
    }
  }, [purchaseFromState]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', ENDPOINTS.purchases.update(id), data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Updated",
        description: "Purchase order has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.getAll] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.reportFilter] });
      setLocation(purchasesRoute);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!purchaseFromState) {
    return (
      <DashboardLayout title="Edit Purchase">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase data not found. Please go back and try again.</p>
          <Button onClick={goBack} className="mt-4">
            Back to Purchases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addProduct = (product: any) => {
    const existingItem = formData.items.find(item => item.productId === product._id);
    
    if (existingItem) {
      setFormData({
        ...formData,
        items: formData.items.map(item =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      const newItem = {
        productId: product._id,
        productName: product.name || product.title,
        quantity: 1,
        unitPrice: product.buyingPrice || product.sellingPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        currency: product.shopId?.currency || "KES"
      };
      
      setFormData({
        ...formData,
        items: [...formData.items, newItem]
      });
    }
    
    setShowProductDialog(false);
    setSearchTerm("");
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    setFormData({
      ...formData,
      items: formData.items.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    });
  };

  const updateItemPrice = (index: number, unitPrice: number) => {
    setFormData({
      ...formData,
      items: formData.items.map((item, i) =>
        i === index ? { ...item, unitPrice } : item
      )
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to the purchase order.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      supplierId: formData.supplierId === "direct" ? null : formData.supplierId,
      paymentType: formData.paymentType,
      items: formData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sellingPrice: item.sellingPrice
      })),
      notes: formData.notes
    };

    updateMutation.mutate(payload);
  };

  return (
    <DashboardLayout title="Edit Purchase">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goBack}
              className="hidden sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchases
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Purchase Order</h1>
              <p className="text-muted-foreground">#{purchaseFromState.purchaseNo}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier (Optional)</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier or leave empty for direct purchase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct Purchase (No Supplier)</SelectItem>
                      {(Array.isArray(suppliers) ? suppliers : []).map((supplier: any) => (
                        <SelectItem key={supplier._id || supplier.id} value={supplier._id || supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select
                    value={formData.paymentType}
                    onValueChange={(value) => setFormData({ ...formData, paymentType: value })}
                  >
                    <SelectTrigger>
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

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items ({formData.items.length})</CardTitle>
                <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Product</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredProducts.map((product: any) => (
                          <div
                            key={product._id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            onClick={() => addProduct(product)}
                          >
                            <div>
                              <p className="font-medium">{product.name || product.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Stock: {product.quantity || 0} | Cost: {product.shopId?.currency || "KES"} {(product.buyingPrice || product.sellingPrice || 0).toFixed(2)}
                              </p>
                            </div>
                            <Button type="button" size="sm">Add</Button>
                          </div>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="text-center text-muted-foreground py-4">No products found</p>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {formData.items.length > 0 ? (
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">{item.currency}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total</Label>
                          <p className="text-sm font-medium px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded">
                            {item.currency} {(item.quantity * item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        Total: {currency} {totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No items added yet. Click "Add Product" to get started.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes for this purchase order..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Updating..." : "Update Purchase"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}