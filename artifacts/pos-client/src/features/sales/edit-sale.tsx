import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useRoute } from "wouter";
import { useState, useEffect } from "react";
import type { Sale, SaleItem } from "@shared/schema";
import { useCurrency } from "@/utils";
import { ENDPOINTS } from "@/lib/api-endpoints";

export default function EditSale() {
  // Try both admin and attendant routes
  const [adminMatch, adminParams] = useRoute("/sales/edit/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/sales/edit/:id");
  
  // Extract sale ID from whichever route matched
  const match = adminMatch || attendantMatch;
  const params = adminParams || attendantParams;
  
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
    const currency = useCurrency();

  useEffect(() => {
    // Try to get data from navigation state first
    const navigationState = (window.history.state?.saleData as any);
    if (navigationState) {
      setOriginalSale(navigationState);
      setIsLoading(false);
      return;
    }

    // Fallback to API call if no navigation state
    const fetchSaleData = async () => {
      if (!params?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(ENDPOINTS.sales.getReceipt(params.id), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setOriginalSale(data);
        }
      } catch (error) {
        console.error('Error fetching sale data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaleData();
  }, [params?.id]);
  
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [saleDate, setSaleDate] = useState("");

  // Update state when originalSale changes
  useEffect(() => {
    if (originalSale) {
      setCustomerName(originalSale.customerId?.name || 'Walk-in');
      setItems(originalSale.items || []);
      setStatus(originalSale.status || 'completed');
      setSaleDate(originalSale.createdAt?.split('T')[0] || '');
    }
  }, [originalSale]);

  if (isLoading) {
    return (
      <DashboardLayout title="Loading Sale...">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading sale data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!originalSale) {
    return (
      <DashboardLayout title="Sale Not Found">
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Sale Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The requested sale could not be found.
          </p>
          <Button className="mt-4" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].totalPrice = quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  const updateItemPrice = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].unitPrice = price;
    newItems[index].totalPrice = price * newItems[index].quantity;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, {
      productName: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    }]);
  };

  const handleSave = () => {
    const updatedSale: Sale = {
      ...originalSale,
      customerName,
      items,
      totalAmount: calculateTotal(),
      status,
      saleDate
    };
    
    console.log("Saving updated sale:", updatedSale);
    // TODO: Implement API call to update sale
    
    // Navigate back to sales list
    window.history.back();
  };

  return (
    <DashboardLayout title={`Edit Sale #${originalSale._id}`}>
      <div className="p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Sale #{originalSale._id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Modify sale details and items
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Sale Information */}
          <Card>
            <CardHeader>
              <CardTitle>Sale Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="customer">Customer Name</Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="date">Sale Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Items</CardTitle>
                <Button onClick={addItem} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="md:col-span-2">
                        <Label htmlFor={`product-${index}`}>Product Name</Label>
                        <Input
                          id={`product-${index}`}
                          value={item.product?.name || item.productName || ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].productName = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Enter product name"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={item.quantity || 0}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`price-${index}`}>Unit Price</Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          step="0.01"
                          value={item.unitPrice || 0}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Total</Label>
                          <p className="font-medium">{currency} {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {items.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to get started.
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        Total: ${calculateTotal().toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}