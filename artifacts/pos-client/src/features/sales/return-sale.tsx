import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ArrowLeft, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { queryClient } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import type { Sale, SaleItem } from "@shared/schema";



interface ReturnItem extends SaleItem {
  returnQuantity: number;
  returnReason: string;
  shouldReturn: boolean;
}

export default function ReturnSale() {
  // Try both admin and attendant routes
  const [adminMatch, adminParams] = useRoute("/sales/return/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/sales/return/:id");
  const [, setLocation] = useLocation();
  const { attendant } = useAttendantAuth();
  
  // Extract sale ID from whichever route matched
  const match = adminMatch || attendantMatch;
  const params = adminParams || attendantParams;
  const saleId = params?.id;
  
  // Determine if this is an attendant user
  const isAttendant = attendantMatch && attendant;
  
  // Get sale data from navigation state
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    description: string;
    type: 'success' | 'error';
  }>({ title: '', description: '', type: 'success' });

  useEffect(() => {
    if (!saleId) {
      setIsLoading(false);
      return;
    }

    // Get data from navigation state
    const navigationState = (window.history.state?.saleData as any);
    
    if (navigationState) {
      setOriginalSale(navigationState);
      setIsLoading(false);
      return;
    }

    // If no navigation state, we can't proceed with return
    setIsLoading(false);
  }, [saleId]);
  
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // Update returnItems when originalSale data is loaded
  useEffect(() => {
    if (originalSale?.items) {
      setReturnItems(
        originalSale.items.map((item: any) => ({
          ...item,
          productName: item.product?.name || item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice || (item.quantity * item.unitPrice),
          returnQuantity: item.quantity,
          returnReason: "",
          shouldReturn: false
        }))
      );
    }
  }, [originalSale]);
  
  const [returnNotes, setReturnNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");

  if (isLoading) {
    return (
      <DashboardLayout title="Loading Return Data...">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading sale data...</p>
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

  if (originalSale.status === "returned") {
    return (
      <DashboardLayout title="Return Not Available">
        <div className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Sale Already Returned
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This sale has already been processed as a return.
          </p>
          <Button className="mt-4" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    const newItems = [...returnItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReturnItems(newItems);
  };

  const calculateRefundAmount = () => {
    return returnItems
      .filter(item => item.shouldReturn)
      .reduce((sum, item) => sum + (item.unitPrice * item.returnQuantity), 0);
  };

  const handleProcessReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.shouldReturn);
    
    if (itemsToReturn.length === 0) {
      setAlertConfig({
        title: "No Items Selected",
        description: "Please select at least one item to return.",
        type: 'error'
      });
      setShowAlert(true);
      return;
    }

    setIsProcessing(true);

    // Extract attendantId and shopId from sale data
    const attendantIdRaw = originalSale.attendantId || originalSale.items?.[0]?.attendantId;
    const attendantId = typeof attendantIdRaw === 'string' ? attendantIdRaw : attendantIdRaw?._id;
    const shopId = originalSale.shopId?._id || originalSale.shopId || originalSale.items?.[0]?.shopId;

    // Format items for API
    const formattedItems = itemsToReturn.map((item: any) => ({
      productId: item.product?._id || item._id,
      quantity: parseFloat(item.returnQuantity.toString())
    }));

    const returnPayload = {
      saleId: originalSale._id,
      shopId: shopId,
      items: formattedItems,
      reason: returnNotes || "Return processed",
    };

    try {
      console.log("Processing return with payload:", returnPayload);
      
      // Get the appropriate token (admin or attendant)
      const authToken = localStorage.getItem('authToken');
      const attendantToken = localStorage.getItem('attendantToken');
      const token = authToken || attendantToken;
      
      const response = await fetch(ENDPOINTS.saleReturns.create, {
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
        console.log('Return processed successfully:', result);
        
        // Invalidate sales data to force refresh
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.sales.getAll] });
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.analytics.salesReport] });
        
        setAlertConfig({
          title: "Return Successful",
          description: "The return has been processed successfully.",
          type: 'success'
        });
        setShowAlert(true);
        
        // Navigate back to correct sales route
        const salesRoute = isAttendant ? '/attendant/sales' : '/sales';
        setLocation(salesRoute);
      } else {
        const error = await response.text();
        console.error('Return processing failed:', error);
        setAlertConfig({
          title: "Return Failed",
          description: `Failed to process return: ${error}`,
          type: 'error'
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error processing return:', error);
      setAlertConfig({
        title: "Return Error",
        description: "An error occurred while processing the return. Please try again.",
        type: 'error'
      });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedItemsCount = returnItems.filter(item => item.shouldReturn).length;

  return (
    <DashboardLayout title={`Return Sale #${originalSale.receiptNo || originalSale.id}`}>
      <div className="p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Process Return - Sale #{originalSale.receiptNo || originalSale.id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Select items to return and specify return reasons
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
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
          {/* Original Sale Info */}
          <Card>
            <CardHeader>
              <CardTitle>Original Sale Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Customer:</p>
                  <p>{originalSale.customerName}</p>
                </div>
                <div>
                  <p className="font-medium">Sale Date:</p>
                  <p>{new Date(originalSale.saleDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-medium">Original Total:</p>
                  <p>{originalSale.shopId?.currency || originalSale.shop?.currency || 'KES'} {originalSale.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-medium">Status:</p>
                  <Badge variant="default">{originalSale.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items to Return</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select items you want to return and specify quantities
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
                            Original: {item.quantity} × {originalSale.shopId?.currency || originalSale.shop?.currency || 'KES'} {item.unitPrice.toFixed(2)} = {originalSale.shopId?.currency || originalSale.shop?.currency || 'KES'} {item.totalPrice.toFixed(2)}
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
                            {originalSale.shopId?.currency || originalSale.shop?.currency || 'KES'} {item.shouldReturn ? (item.unitPrice * item.returnQuantity).toFixed(2) : '0.00'}
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
                          placeholder="e.g., Defective, Wrong size, Customer changed mind"
                          className="mt-1"
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
                        <option value="original">Original Payment Method</option>
                        <option value="cash">Cash</option>
                        <option value="store-credit">Store Credit</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label>Total Refund Amount</Label>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {originalSale.shopId?.currency || originalSale.shop?.currency || 'KES'} {calculateRefundAmount().toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="return-notes">Additional Notes</Label>
                    <Textarea
                      id="return-notes"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Any additional notes about this return..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Processing a return will update inventory levels and create a refund record. 
              This action cannot be undone. Please verify all details before proceeding.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {alertConfig.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {alertConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowAlert(false);
              if (alertConfig.type === 'success') {
                window.history.back();
              }
            }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}