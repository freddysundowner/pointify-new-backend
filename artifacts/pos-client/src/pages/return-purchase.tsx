import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  RotateCcw, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useProducts } from "@/contexts/ProductsContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  returnQuantity: number;
  returnReason: string;
  shouldReturn: boolean;
}

export default function ReturnPurchase() {
  const [match, params] = useRoute("/purchases/return/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/purchases/return/:id");
  const [location] = useLocation();
  const purchaseId = params?.id || attendantParams?.id;
  
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const { shopId, adminId, attendantId } = usePrimaryShop();
  const { products } = useProducts();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute('purchases');
  
  // Get purchase data from navigation state
  const [originalPurchase, setOriginalPurchase] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnNotes, setReturnNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("credit");

  useEffect(() => {
    if (!purchaseId) {
      setIsLoading(false);
      return;
    }

    // Try to get data from window object first (same pattern as sales)
    const passedData = (window as any).__purchaseReturnData;
    
    if (passedData && (passedData._id === purchaseId || passedData.id === purchaseId)) {
      setOriginalPurchase(passedData);
      setIsLoading(false);
      // Clear the data after use
      delete (window as any).__purchaseReturnData;
      return;
    }
    setIsLoading(false);
  }, [purchaseId]);

  // Update returnItems when originalPurchase data is loaded
  useEffect(() => {
    if (originalPurchase?.items && products.length > 0) {

      setReturnItems(
        originalPurchase.items.map((item: any) => {
          // Try to find product ID by matching product name
          let productId = item.product?._id || item.productId;
          
          if (!productId && item.productName) {
            const matchedProduct = products.find(p => 
              (p.name === item.productName) || (p.title === item.productName)
            );
            productId = matchedProduct?._id || matchedProduct?.id;

          }

          return {
            productId: productId,
            productName: item.product?.name || item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost || (item.quantity * item.unitCost),
            returnQuantity: item.quantity,
            returnReason: "",
            shouldReturn: false
          };
        })
      );
    }
  }, [originalPurchase, products]);

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const newItems = [...returnItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReturnItems(newItems);
  };

  const calculateRefundAmount = () => {
    return returnItems
      .filter(item => item.shouldReturn)
      .reduce((total, item) => total + (item.unitCost * item.returnQuantity), 0);
  };

  const handleProcessReturn = async () => {
    if (!originalPurchase || !adminId || !shopId) {
      console.error('Missing required data for return processing');
      return;
    }

    const itemsToReturn = returnItems.filter(item => item.shouldReturn);
    
    if (itemsToReturn.length === 0) {
      alert('Please select at least one item to return');
      return;
    }

    // Check if all selected items have return reasons
    const missingReasons = itemsToReturn.filter(item => !item.returnReason.trim());
    if (missingReasons.length > 0) {
      alert('Please provide return reasons for all selected items');
      return;
    }

    setIsProcessing(true);



    const returnPayload = {
      purchaseId: originalPurchase._id || originalPurchase.id,
      items: itemsToReturn.map(item => ({
        product: item.productId,
        quantity: item.returnQuantity,
        unitPrice: item.unitCost
      })),
      reason: returnNotes || 'Purchase return processed',
      deleteReceipt: false,
      invoiceType: ''
    };
    console.log(returnPayload)

    try {
      console.log("Processing purchase return with payload:", returnPayload);
      
      // Use appropriate token based on user type
      const token = attendant 
        ? localStorage.getItem('attendantToken') 
        : localStorage.getItem('authToken');

      const response = await fetch(ENDPOINTS.purchaseReturns.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(returnPayload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Purchase return processed successfully:', result);
        
        // Show success notification
        toast({
          title: "Success",
          description: "Purchase return processed successfully!",
        });
        
        // Navigate back to purchases list without page reload
        setLocation(purchasesRoute);
      } else {
        const error = await response.text();
        console.error('Purchase return processing failed:', error);
        toast({
          title: "Error",
          description: `Failed to process purchase return: ${error}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing purchase return:', error);
      toast({
        title: "Error",
        description: "An error occurred while processing the return. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Loading Return Data...">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading purchase data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!originalPurchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Purchase Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The requested purchase could not be found.
          </p>
          <Button className="mt-4" onClick={() => window.location.href = purchasesRoute}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (originalPurchase.status === "cancelled") {
    return (
      <DashboardLayout title="Return Not Available">
        <div className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Purchase Cancelled
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This purchase has been cancelled and cannot be returned.
          </p>
          <Button className="mt-4" onClick={() => window.location.href = purchasesRoute}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const selectedItemsCount = returnItems.filter(item => item.shouldReturn).length;

  return (
    <DashboardLayout title={`Return Purchase #${originalPurchase.invoiceNumber || originalPurchase.id}`}>
      <div className="p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Process Return - Purchase #{originalPurchase.invoiceNumber || originalPurchase.id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Select items to return to supplier and specify return reasons
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = purchasesRoute}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button 
              onClick={handleProcessReturn}
              disabled={selectedItemsCount === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Process Return
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Purchase Information */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Supplier</Label>
                  <p className="font-medium">{originalPurchase.supplierName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Order Date</Label>
                  <p className="font-medium">{new Date(originalPurchase.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total Amount</Label>
                  <p className="font-medium">{originalPurchase.currency} {originalPurchase.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <p className="font-medium capitalize">{originalPurchase.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items to Return</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select items you want to return to the supplier and specify quantities
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {returnItems.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={item.shouldReturn}
                        onCheckedChange={(checked) => 
                          updateReturnItem(index, 'shouldReturn', checked)
                        }
                        className="mt-1"
                      />
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <Label className="font-medium">{item.productName}</Label>
                          <p className="text-sm text-muted-foreground">
                            Purchased: {item.quantity} × {originalPurchase.currency} {item.unitCost.toFixed(2)} = {originalPurchase.currency} {item.totalCost.toFixed(2)}
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor={`quantity-${index}`}>Return Quantity</Label>
                          <Input
                            id={`quantity-${index}`}
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={item.returnQuantity}
                            onChange={(e) => updateReturnItem(index, 'returnQuantity', parseInt(e.target.value) || 1)}
                            disabled={!item.shouldReturn}
                          />
                        </div>
                        
                        <div>
                          <Label>Return Amount</Label>
                          <p className="font-medium">
                            {originalPurchase.currency} {item.shouldReturn ? (item.unitCost * item.returnQuantity).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {item.shouldReturn && (
                      <div className="mt-4">
                        <Label htmlFor={`reason-${index}`}>Return Reason</Label>
                        <Input
                          id={`reason-${index}`}
                          value={item.returnReason}
                          onChange={(e) => updateReturnItem(index, 'returnReason', e.target.value)}
                          placeholder="e.g., Defective, Wrong item, Damaged in transit"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Return Summary */}
          {selectedItemsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Return Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="refund-method">Refund Method</Label>
                      <select
                        id="refund-method"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="credit">Supplier Credit</option>
                        <option value="refund">Cash Refund</option>
                        <option value="exchange">Exchange Items</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label>Total Refund Amount</Label>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {originalPurchase.currency} {calculateRefundAmount().toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="return-notes">Additional Notes</Label>
                    <Input
                      id="return-notes"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Any additional notes about this return..."
                    />
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span>Items selected for return:</span>
                      <span className="font-medium">{selectedItemsCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Total items to return:</span>
                      <span className="font-medium">
                        {returnItems.filter(item => item.shouldReturn).reduce((total, item) => total + item.returnQuantity, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}