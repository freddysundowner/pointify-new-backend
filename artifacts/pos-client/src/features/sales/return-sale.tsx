import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useCurrency } from "@/utils";
import { useProducts } from "@/contexts/ProductsContext";

interface ReturnItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  returnQuantity: number;
  shouldReturn: boolean;
}

export default function ReturnSale() {
  const [adminMatch, adminParams] = useRoute("/sales/return/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/sales/return/:id");
  const [, setLocation] = useLocation();
  const currency = useCurrency();
  const { refreshProducts } = useProducts();

  const params = adminParams || attendantParams;
  const saleId = params?.id;
  const isAttendant = !!attendantMatch;

  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnNotes, setReturnNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    description: string;
    type: "success" | "error";
  }>({ title: "", description: "", type: "success" });

  // Fetch the sale from the API directly
  const { data: originalSale, isLoading } = useQuery<any>({
    queryKey: ["sale-detail", saleId],
    queryFn: async () => {
      const res = await apiRequest("GET", ENDPOINTS.sales.getById(saleId!));
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!saleId,
    staleTime: 0,
  });

  // Populate return items once sale is loaded
  useEffect(() => {
    if (!originalSale?.saleItems) return;
    setReturnItems(
      originalSale.saleItems.map((item: any) => ({
        id: item.id,
        productId: item.product?.id ?? item.product,
        productName: item.productName ?? item.product?.name ?? "Unknown Product",
        quantity: parseFloat(String(item.quantity)),
        unitPrice: parseFloat(String(item.unitPrice ?? 0)),
        totalPrice: parseFloat(String(item.totalPrice ?? 0)),
        returnQuantity: parseFloat(String(item.quantity)),
        shouldReturn: false,
      }))
    );
  }, [originalSale]);

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: any) => {
    setReturnItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const calculateRefundAmount = () =>
    returnItems
      .filter(i => i.shouldReturn)
      .reduce((sum, i) => sum + i.unitPrice * i.returnQuantity, 0);

  const handleProcessReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.shouldReturn);
    if (!itemsToReturn.length) {
      setAlertConfig({ title: "No Items Selected", description: "Please select at least one item to return.", type: "error" });
      setShowAlert(true);
      return;
    }

    setIsProcessing(true);
    const shopId = originalSale.shop ?? originalSale.shopId;

    const payload = {
      saleId: Number(saleId),
      shopId: Number(shopId),
      reason: returnNotes.trim() || "Return processed",
      refundMethod,
      items: itemsToReturn.map(item => ({
        productId: item.productId,
        saleItemId: item.id,
        quantity: item.returnQuantity,
        unitPrice: item.unitPrice,
      })),
    };

    try {
      const res = await apiRequest("POST", ENDPOINTS.saleReturns.create, payload);
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.sales.getAll] });
        queryClient.invalidateQueries({ queryKey: ["sale-detail", saleId] });
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.analytics.netProfit] });
        queryClient.invalidateQueries({ queryKey: [ENDPOINTS.analytics.profitLoss] });
        refreshProducts();
        setAlertConfig({ title: "Return Successful", description: "The return has been processed successfully.", type: "success" });
        setShowAlert(true);
      } else {
        const errorText = await res.text();
        let msg = errorText;
        try { msg = JSON.parse(errorText)?.message ?? errorText; } catch {}
        setAlertConfig({ title: "Return Failed", description: msg, type: "error" });
        setShowAlert(true);
      }
    } catch (err: any) {
      setAlertConfig({ title: "Return Error", description: err?.message ?? "An error occurred.", type: "error" });
      setShowAlert(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const salesRoute = isAttendant ? "/attendant/sales" : "/sales";
  const selectedCount = returnItems.filter(i => i.shouldReturn).length;

  if (isLoading) {
    return (
      <DashboardLayout title="Loading…">
        <div className="p-6 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading sale data…
        </div>
      </DashboardLayout>
    );
  }

  if (!originalSale) {
    return (
      <DashboardLayout title="Sale Not Found">
        <div className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">The requested sale could not be found.</p>
          <Button variant="outline" onClick={() => setLocation(salesRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (originalSale.status === "returned") {
    return (
      <DashboardLayout title="Already Returned">
        <div className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">This sale has already been processed as a return.</p>
          <Button variant="outline" onClick={() => setLocation(salesRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Return — ${originalSale.receiptNo ?? `Sale #${saleId}`}`}>
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Process Return</h1>
            <p className="text-sm text-gray-500">{originalSale.receiptNo ?? `Sale #${saleId}`}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation(salesRoute)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedCount === 0 || isProcessing}
              onClick={handleProcessReturn}
            >
              {isProcessing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
              {isProcessing ? "Processing…" : `Return ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
            </Button>
          </div>
        </div>

        {/* Sale Info */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Customer</p>
                <p className="font-medium">{originalSale.customer?.name ?? "Walk-in"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date</p>
                <p className="font-medium">{originalSale.createdAt ? new Date(originalSale.createdAt).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total</p>
                <p className="font-medium">{currency} {parseFloat(String(originalSale.totalWithDiscount ?? originalSale.totalAmount ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                <Badge variant="outline" className="capitalize">{originalSale.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Items to Return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {returnItems.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No items found for this sale.</p>
            )}
            {returnItems.map((item, index) => (
              <div key={item.id} className={`border rounded-lg p-4 transition-colors ${item.shouldReturn ? "border-blue-200 bg-blue-50/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={item.shouldReturn}
                    onCheckedChange={checked => updateReturnItem(index, "shouldReturn", !!checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.quantity} × {currency} {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Return Qty (max {item.quantity})</Label>
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={item.returnQuantity}
                        onChange={e => {
                          const v = Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1));
                          updateReturnItem(index, "returnQuantity", v);
                        }}
                        disabled={!item.shouldReturn}
                        className="h-8 mt-1 text-sm"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="text-xs text-gray-400">Refund amount</p>
                      <p className="font-semibold text-sm text-green-700">
                        {item.shouldReturn
                          ? `${currency} ${(item.unitPrice * item.returnQuantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Summary */}
        {selectedCount > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Return Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Refund Method</Label>
                  <select
                    value={refundMethod}
                    onChange={e => setRefundMethod(e.target.value)}
                    className="w-full mt-1 h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="original">Original Payment Method</option>
                    <option value="store-credit">Store Credit</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Refund</p>
                  <p className="text-2xl font-bold text-green-600 mt-0.5">
                    {currency} {calculateRefundAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Any notes about this return…"
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Processing a return restores inventory and records a refund. This cannot be undone.
          </AlertDescription>
        </Alert>
      </div>

      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {alertConfig.type === "success"
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-red-500" />}
              {alertConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{alertConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowAlert(false);
              if (alertConfig.type === "success") setLocation(salesRoute);
            }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
