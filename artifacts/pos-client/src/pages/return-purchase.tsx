import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  RotateCcw, 
  Loader2, 
  AlertCircle,
  Package,
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

interface ReturnItem {
  productId: string;
  purchaseItemId: number | null;
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
  const currency = useSelector((state: RootState) => state.currency) as string;
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
            purchaseItemId: item.id ?? item._id ?? null,
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
      toast({ title: "No items selected", description: "Please select at least one item to return.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);



    const returnPayload = {
      purchaseId: originalPurchase._id || originalPurchase.id,
      shopId,
      attendantId: attendantId || (attendant as any)?.id || (attendant as any)?._id || undefined,
      items: itemsToReturn.map(item => ({
        productId: item.productId,
        purchaseItemId: item.purchaseItemId,
        quantity: item.returnQuantity,
        unitPrice: item.unitCost,
        reason: item.returnReason,
      })),
      reason: returnNotes || 'Purchase return processed',
      refundMethod: refundMethod || 'supplier_credit',
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
        
        // Invalidate purchases and related queries so the list refreshes
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.getAll] });
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchases.reportFilter] });
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.purchaseReturns.getAll] });

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

  const totalQtyToReturn = returnItems.filter(i => i.shouldReturn).reduce((t, i) => t + i.returnQuantity, 0);
  const refundTotal = calculateRefundAmount();

  return (
    <DashboardLayout title={`Return ${purchaseNo}`}>
      <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-white border-b shadow-sm shrink-0">
          <div className="px-3 sm:px-4 h-12 flex items-center gap-2">
            <button onClick={goBack} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 leading-tight truncate">Return {purchaseNo}</h1>
              <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">{supplierName}</p>
            </div>
            <Button size="sm" className="h-8 gap-1 text-xs px-3 shrink-0" onClick={handleProcessReturn} disabled={selectedItemsCount === 0 || isProcessing}>
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1" />Process Return</>}
            </Button>
          </div>
        </div>

        {/* ── Info + controls bar ── */}
        <div className="bg-white border-b px-3 sm:px-4 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</p>
              <p className="text-sm font-medium">{purchaseDate ? new Date(purchaseDate).toLocaleDateString() : "—"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">PO Total</p>
              <p className="text-sm font-medium">{currency} {totalAmt.toFixed(2)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Selected</p>
              <p className="text-sm font-medium">{selectedItemsCount} item{selectedItemsCount !== 1 ? "s" : ""} · {totalQtyToReturn} qty</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Refund Total</p>
              <p className="text-sm font-bold text-green-600">{currency} {refundTotal.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block">Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Supplier Credit</SelectItem>
                  <SelectItem value="refund">Cash Refund</SelectItem>
                  <SelectItem value="exchange">Exchange Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block">Notes</Label>
              <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Optional notes…" className="text-xs resize-none h-8 min-h-0 py-1.5" />
            </div>
          </div>
        </div>

        {/* ── Items header ── */}
        <div className="px-3 sm:px-4 py-2.5 bg-white border-b shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Items to Return</h2>
            <p className="text-[11px] text-muted-foreground">{returnItems.length} product{returnItems.length !== 1 ? "s" : ""} — check the ones to return</p>
          </div>
          {selectedItemsCount > 0 && <Badge variant="secondary" className="text-xs shrink-0">{selectedItemsCount} selected</Badge>}
        </div>

        {/* ── Scrollable items ── */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2">
          {returnItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No items found in this purchase</p>
            </div>
          ) : (
            returnItems.map((item, index) => (
              <div key={index} className={`border rounded-lg transition-colors ${item.shouldReturn ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
                <div className="flex items-center gap-3 p-3">
                  <Checkbox checked={item.shouldReturn} onCheckedChange={(checked) => updateReturnItem(index, 'shouldReturn', checked)} />
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                    {item.productName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} × {currency} {item.unitCost.toFixed(2)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{currency} {item.totalCost.toFixed(2)}</p>
                  </div>
                </div>
                {item.shouldReturn && (
                  <div className="border-t px-3 pb-3 pt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Return Qty</Label>
                      <Input type="number" min="1" max={item.quantity} value={item.returnQuantity} onChange={(e) => updateReturnItem(index, 'returnQuantity', Math.min(item.quantity, parseInt(e.target.value) || 1))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Refund</Label>
                      <div className="h-8 flex items-center">
                        <span className="text-sm font-bold text-green-600">{currency} {(item.unitCost * item.returnQuantity).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 block">Reason</Label>
                      <Input value={item.returnReason} onChange={(e) => updateReturnItem(index, 'returnReason', e.target.value)} placeholder="e.g. Defective, Wrong item" className="h-8 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Sticky footer when items selected ── */}
        {selectedItemsCount > 0 && (
          <div className="border-t bg-white px-3 sm:px-4 py-3 shrink-0 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 font-medium">Refund Total</p>
              <p className="text-lg font-bold text-green-600">{currency} {refundTotal.toFixed(2)}</p>
            </div>
            <Button className="h-9 gap-1.5" onClick={handleProcessReturn} disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</> : <><RotateCcw className="h-4 w-4" />Process Return</>}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}