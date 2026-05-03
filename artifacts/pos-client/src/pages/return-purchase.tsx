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
import { useGoBack } from "@/hooks/useGoBack";
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
  const goBack = useGoBack("/purchases");
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
    
    if (passedData && (String(passedData._id) === String(purchaseId) || String(passedData.id) === String(purchaseId))) {
      setOriginalPurchase(passedData);
      setIsLoading(false);
      delete (window as any).__purchaseReturnData;
      return;
    }

    // Fallback: fetch directly from the API
    const fetchPurchase = async () => {
      try {
        const res = await apiRequest("GET", `/api/purchases/${purchaseId}`);
        const data = await res.json();
        if (data && (data._id || data.id)) {
          setOriginalPurchase(data);
        }
      } catch (err) {
        console.error("Failed to fetch purchase for return:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPurchase();
  }, [purchaseId]);

  // Update returnItems when originalPurchase data is loaded
  useEffect(() => {
    // Handle both raw API shape (purchaseItems) and normalized shape (items)
    const rawItems = originalPurchase?.purchaseItems || originalPurchase?.items;
    if (rawItems && products.length > 0) {
      setReturnItems(
        rawItems.map((item: any) => {
          // Support both raw API (item.product.id) and normalized (item.productId)
          let productId = item.product?.id || item.product?._id || item.productId;
          if (!productId && (item.product?.name || item.productName)) {
            const name = item.product?.name || item.productName;
            const matched = products.find(p => p.name === name || (p as any).title === name);
            productId = (matched as any)?._id || (matched as any)?.id;
          }
          const qty = parseFloat(String(item.quantity ?? 1));
          const unitCost = parseFloat(String(item.unitPrice ?? item.unitCost ?? 0));
          return {
            productId,
            productName: item.product?.name || item.productName || "Unknown",
            quantity: qty,
            unitCost,
            totalCost: item.totalCost || qty * unitCost,
            returnQuantity: qty,
            returnReason: "",
            shouldReturn: false,
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
        
        // Navigate back to purchases list (replace so return page isn't in history)
        setLocation(purchasesRoute, { replace: true });
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
        <div className="p-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading purchase data...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!originalPurchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-4 text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Purchase Not Found
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The requested purchase could not be found.
          </p>
          <Button className="mt-4" size="sm" onClick={goBack}>
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
        <div className="p-4 text-center">
          <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Purchase Cancelled
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This purchase has been cancelled and cannot be returned.
          </p>
          <Button className="mt-4" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const selectedItemsCount = returnItems.filter(item => item.shouldReturn).length;

  const purchaseNo = originalPurchase.purchaseNo || originalPurchase.invoiceNumber || `#${originalPurchase.id}`;
  const supplierName = originalPurchase.supplier?.name || originalPurchase.supplierName || "N/A";
  const purchaseDate = originalPurchase.createdAt || originalPurchase.orderDate;
  const totalAmt = parseFloat(String(originalPurchase.totalAmount ?? 0));

  return (
    <DashboardLayout title={`Return ${purchaseNo}`}>
      <div className="p-3 w-full space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              Return {purchaseNo}
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {supplierName} · {purchaseDate ? new Date(purchaseDate).toLocaleDateString() : "—"} · {currency} {totalAmt.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 hidden lg:flex" onClick={goBack}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleProcessReturn}
              disabled={selectedItemsCount === 0 || isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Processing...</>
              ) : (
                <><RotateCcw className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Process Return</span><span className="sm:hidden">Return</span></>
              )}
            </Button>
          </div>
        </div>

        {/* Items to Return */}
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle className="text-sm">Items to Return</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-2">
              {returnItems.map((item, index) => (
                <div key={index} className="border rounded-md p-2.5">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      checked={item.shouldReturn}
                      onCheckedChange={(checked) => updateReturnItem(index, 'shouldReturn', checked)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {item.quantity} × {currency} {item.unitCost.toFixed(2)}
                        </p>
                      </div>
                      {item.shouldReturn && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground mb-1 block">Return Qty</Label>
                            <Input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={item.returnQuantity}
                              onChange={(e) => updateReturnItem(index, 'returnQuantity', parseInt(e.target.value) || 1)}
                              className="h-7 text-xs px-2"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground mb-1 block">Refund</Label>
                            <p className="text-xs font-semibold text-green-600 pt-1.5">
                              {currency} {(item.unitCost * item.returnQuantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <Input
                              value={item.returnReason}
                              onChange={(e) => updateReturnItem(index, 'returnReason', e.target.value)}
                              placeholder="Reason (e.g. Defective, Wrong item)"
                              className="h-7 text-xs px-2"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Return Summary */}
        {selectedItemsCount > 0 && (
          <Card>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Refund Method</Label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full h-8 text-xs px-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="credit">Supplier Credit</option>
                    <option value="refund">Cash Refund</option>
                    <option value="exchange">Exchange Items</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Total Refund</Label>
                  <p className="text-base font-bold text-green-600">
                    {currency} {calculateRefundAmount().toFixed(2)}
                  </p>
                </div>
              </div>
              <Input
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Additional notes..."
                className="h-7 text-xs px-2"
              />
              <div className="bg-blue-50 dark:bg-blue-950/20 p-2.5 rounded-md text-xs space-y-0.5">
                <div className="flex justify-between items-center">
                  <span>Items selected:</span>
                  <span className="font-medium">{selectedItemsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total qty to return:</span>
                  <span className="font-medium">
                    {returnItems.filter(item => item.shouldReturn).reduce((total, item) => total + item.returnQuantity, 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}