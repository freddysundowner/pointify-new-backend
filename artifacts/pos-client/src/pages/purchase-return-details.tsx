import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Calendar, User, Receipt, DollarSign, Tag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/utils";

interface PurchaseReturnItem {
  id: number;
  product: number;
  productName: string;
  quantity: string;
  unitPrice: string;
}

interface PurchaseReturn {
  id: number;
  purchase: number;
  shop: number;
  refundAmount: string;
  reason: string;
  refundMethod: string;
  processedBy: number | null;
  returnNo: string;
  createdAt: string;
  purchaseReturnItems?: PurchaseReturnItem[];
}

export default function PurchaseReturnDetails() {
  const [adminMatch, adminParams] = useRoute("/purchase-return-details/:id");
  const [attendantMatch, attendantParams] = useRoute("/attendant/purchase-return-details/:id");
  const id = adminParams?.id || attendantParams?.id;
  const [, setLocation] = useLocation();
  const isAttendant = window.location.pathname.startsWith("/attendant/");
  const backRoute = isAttendant ? "/attendant/dashboard" : "/purchase-returns";
  const currency = useCurrency();

  const [returnData, setReturnData] = useState<PurchaseReturn | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const passed = (window as any).__returnData;
    if (passed && (String(passed.id) === String(id))) {
      setReturnData(passed);
      delete (window as any).__returnData;
      setIsLoading(false);
      return;
    }
    if (!id) { setIsLoading(false); return; }
    apiRequest("GET", `/api/purchase-returns/${id}`)
      .then(r => r.json())
      .then(json => setReturnData(json?.data ?? json))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  const fmt = (n: number | string) =>
    `${currency} ${(parseFloat(String(n)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleString() : "—";

  if (isLoading) {
    return (
      <DashboardLayout title="Return Details">
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!returnData) {
    return (
      <DashboardLayout title="Return Details">
        <div className="p-4 space-y-4">
          <Button variant="outline" size="sm" onClick={() => setLocation(backRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Returns
          </Button>
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Return details not found. Please go back and try again.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const items = returnData.purchaseReturnItems ?? [];
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity), 0);

  return (
    <DashboardLayout title="Purchase Return Details">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setLocation(backRoute)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Returns
            </Button>
            <h2 className="text-lg font-semibold hidden sm:block">Return Details</h2>
          </div>
          <Badge variant="outline" className="font-mono text-sm">{returnData.returnNo}</Badge>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Return #
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm font-bold font-mono">{returnData.returnNo}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Refund Amount
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm font-bold text-green-600">{fmt(returnData.refundAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Total Qty
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm font-bold">{totalQty}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xs">{fmtDate(returnData.createdAt)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Return Info
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refund Method</span>
                <span className="font-medium capitalize">{returnData.refundMethod || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processed By</span>
                <span className="font-medium">{returnData.processedBy ? `Attendant #${returnData.processedBy}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original PO</span>
                <span className="font-medium font-mono">#{returnData.purchase}</span>
              </div>
            </CardContent>
          </Card>

          {returnData.reason && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Reason
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm bg-muted rounded p-2.5">{returnData.reason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Returned items */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" /> Returned Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No items recorded for this return.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="pl-4">Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead className="pr-4 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="text-sm">
                      <TableCell className="pl-4 font-medium">{item.productName}</TableCell>
                      <TableCell>{parseFloat(item.quantity)}</TableCell>
                      <TableCell>{fmt(item.unitPrice)}</TableCell>
                      <TableCell className="pr-4 text-right font-medium">
                        {fmt(parseFloat(item.unitPrice) * parseFloat(item.quantity))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell className="pl-4" colSpan={3}>Total Refund</TableCell>
                    <TableCell className="pr-4 text-right text-green-600">{fmt(returnData.refundAmount)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
