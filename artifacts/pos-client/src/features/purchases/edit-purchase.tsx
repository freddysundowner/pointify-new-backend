import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ArrowLeft, Save, Plus, Trash2, Package, Check, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation, useParams } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useState } from "react";
import type { Purchase, PurchaseItem } from "@shared/schema";

// Mock purchase data
const mockPurchases: Purchase[] = [
  {
    id: 1,
    supplierName: "Tech Supply Co",
    items: [
      { productName: "Premium Widget", quantity: 50, unitCost: 75.00, totalCost: 3750.00, received: 50 },
      { productName: "Basic Component", quantity: 100, unitCost: 15.50, totalCost: 1550.00, received: 100 }
    ],
    totalAmount: 5300.00,
    orderDate: "2024-06-15",
    expectedDate: "2024-06-22",
    receivedDate: "2024-06-20",
    status: "received",
    invoiceNumber: "INV-2024-001"
  },
  {
    id: 2,
    supplierName: "Global Parts Ltd",
    items: [
      { productName: "Advanced Module", quantity: 25, unitCost: 120.00, totalCost: 3000.00, received: 20 }
    ],
    totalAmount: 3000.00,
    orderDate: "2024-06-18",
    expectedDate: "2024-06-25",
    status: "partial",
    invoiceNumber: "INV-2024-002"
  }
];

const mockSuppliers = [
  "Tech Supply Co",
  "Global Parts Ltd",
  "Quality Materials Inc",
  "Express Supplies",
  "Bulk Distributors"
];

const mockProducts = [
  { name: "Premium Widget", cost: 75.00 },
  { name: "Basic Component", cost: 15.50 },
  { name: "Advanced Module", cost: 120.00 },
  { name: "Raw Material A", cost: 8.75 },
  { name: "Raw Material B", cost: 12.25 },
  { name: "Emergency Stock", cost: 22.50 },
  { name: "Office Supplies", cost: 3.25 },
  { name: "Packaging Materials", cost: 2.80 }
];

export default function EditPurchase() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute('purchases');
  
  const originalPurchase = mockPurchases.find(p => p.id === parseInt(id || "0"));

  if (!originalPurchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-6 w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Purchase Order Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The purchase order you're trying to edit doesn't exist.
            </p>
            <Button onClick={() => setLocation(purchasesRoute)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Purchases
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const [supplierName, setSupplierName] = useState(originalPurchase.supplierName);
  const [orderDate, setOrderDate] = useState(originalPurchase.orderDate);
  const [expectedDate, setExpectedDate] = useState(originalPurchase.expectedDate || "");
  const [invoiceNumber, setInvoiceNumber] = useState(originalPurchase.invoiceNumber || "");
  const [items, setItems] = useState<PurchaseItem[]>(originalPurchase.items.map(item => ({
    ...item,
    received: undefined // Remove received count for editing
  })));
  const [productSearchOpen, setProductSearchOpen] = useState<Record<number, boolean>>({});

  const addItem = () => {
    setItems([...items, {
      productName: "",
      quantity: 1,
      unitCost: 0,
      totalCost: 0
    }]);
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

  const selectProduct = (index: number, productName: string) => {
    const product = mockProducts.find(p => p.name === productName);
    if (product) {
      updateItem(index, 'productName', productName);
      updateItem(index, 'unitCost', product.cost);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.totalCost, 0);
  };

  const handleSave = () => {
    console.log("Saving purchase:", {
      id: originalPurchase.id,
      supplierName,
      orderDate,
      expectedDate,
      invoiceNumber,
      items: items.filter(item => item.productName && item.quantity > 0),
      totalAmount: calculateTotal()
    });
    setLocation(purchasesRoute);
  };

  const handleCancel = () => {
    setLocation(purchasesRoute);
  };

  const canSave = supplierName.trim() && items.some(item => item.productName && item.quantity > 0);

  return (
    <DashboardLayout title={`Edit Purchase Order #${originalPurchase.id}`}>
      <div className="p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Purchase Order #{originalPurchase.id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Update purchase order details and items
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Purchase Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier">Supplier *</Label>
                <Select value={supplierName} onValueChange={setSupplierName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockSuppliers.map(supplier => (
                      <SelectItem key={supplier} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice">Invoice Number</Label>
                <Input
                  id="invoice"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter invoice number"
                />
              </div>
              <div>
                <Label htmlFor="order-date">Order Date *</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="expected-date">Expected Date</Label>
                <Input
                  id="expected-date"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
              <Button onClick={addItem} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No items added yet</p>
                <Button onClick={addItem} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-4">
                        <Label>Product *</Label>
                        <Dialog open={productSearchOpen[index]} onOpenChange={(open) => setProductSearchOpen({...productSearchOpen, [index]: open})}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between"
                            >
                              {item.productName || "Select product..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Select Product</DialogTitle>
                            </DialogHeader>
                            <Command>
                              <CommandInput placeholder="Search products..." />
                              <CommandEmpty>No product found.</CommandEmpty>
                              <CommandGroup className="max-h-[300px] overflow-y-auto">
                                {mockProducts.map((product) => (
                                  <CommandItem
                                    key={product.name}
                                    value={product.name}
                                    onSelect={() => {
                                      selectProduct(index, product.name);
                                      setProductSearchOpen({...productSearchOpen, [index]: false});
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        item.productName === product.name ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{product.name}</span>
                                      <span className="text-sm text-muted-foreground">${product.cost.toFixed(2)} per unit</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Unit Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Total Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.totalCost.toFixed(2)}
                          readOnly
                          className="bg-gray-50 dark:bg-gray-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Total Amount:
                    </span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ${calculateTotal().toFixed(2)}
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
      </div>
    </DashboardLayout>
  );
}