import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGoBack } from "@/hooks/useGoBack";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, DollarSign, CreditCard, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useCurrency } from "@/utils";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiRequest } from "@/lib/queryClient";
import { useShop } from "@/features/shop/useShop";

const pf = (v: any) => parseFloat(String(v || 0));

const shortPurchaseNo = (purchaseNo: string | undefined) => {
  if (!purchaseNo) return "—";
  const digits = purchaseNo.replace(/\D/g, "");
  return "PUR-" + digits.slice(-6);
};

export default function PurchaseViewPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const goBack = useGoBack("/purchases");
  const purchasesRoute = useNavigationRoute("purchases");
  const currency = useCurrency();
  const { shop: shopDetails } = useShop();

  const purchaseId = params?.id;

  const { data: purchase, isLoading, isError } = useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: async () => {
      const res = await apiRequest("GET", ENDPOINTS.purchases.getById(purchaseId!));
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!purchaseId,
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Purchase Details">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !purchase) {
    return (
      <DashboardLayout title="Purchase Details">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase not found.</p>
          <Button onClick={goBack} className="mt-4">Back to Purchases</Button>
        </div>
      </DashboardLayout>
    );
  }

  const items: any[] = purchase.purchaseItems ?? [];
  const payments: any[] = purchase.purchasePayments ?? [];
  const outstandingBalance = pf(purchase.outstandingBalance);
  const paymentType = purchase.paymentType ?? "cash";

  const getStatusBadgeVariant = (type: string) => {
    switch (type) {
      case "cash": return "default";
      case "credit": return "destructive";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout title="Purchase Details">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-end mb-2">
          <Badge variant={getStatusBadgeVariant(paymentType)} className="text-sm capitalize">
            {paymentType}
          </Badge>
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-gray-300 pb-6 mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-wider mb-2">
                  {shopDetails?.name ?? "—"}
                </h1>
                {(shopDetails?.receiptAddress || shopDetails?.address) && (
                  <p className="text-sm text-muted-foreground">
                    {shopDetails.receiptAddress || shopDetails.address}
                  </p>
                )}
                {shopDetails?.contact && (
                  <p className="text-sm text-muted-foreground">{shopDetails.contact}</p>
                )}
                <p className="text-sm text-muted-foreground">Purchase Receipt</p>
                <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
                  <p className="text-lg font-bold">
                    PURCHASE ORDER #{shortPurchaseNo(purchase.purchaseNo)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {purchase.createdAt
                      ? new Date(purchase.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown Date"}
                  </p>
                </div>
              </div>

              {/* Purchase Details */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <p className="font-medium">Supplier:</p>
                  <p className="text-muted-foreground">
                    {purchase.supplier?.name ?? "Direct Purchase"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Payment Method:</p>
                  <p className="text-muted-foreground capitalize">{paymentType}</p>
                </div>
                <div>
                  <p className="font-medium">Attendant:</p>
                  <p className="text-muted-foreground">
                    {purchase.attendant?.username ?? "System"}
                  </p>
                </div>
              </div>

              {/* Items Table Header */}
              <div className="border-t border-dashed border-gray-300 pt-4">
                <div className="grid grid-cols-12 gap-2 py-2 border-b border-dashed border-gray-300 font-medium text-sm">
                  <div className="col-span-6">ITEM</div>
                  <div className="col-span-2 text-center">QTY</div>
                  <div className="col-span-2 text-right">PRICE</div>
                  <div className="col-span-2 text-right">TOTAL</div>
                </div>

                <div className="space-y-1">
                  {items.map((item: any, index: number) => (
                    <div key={item.id ?? index} className="grid grid-cols-12 gap-2 py-2 text-sm">
                      <div className="col-span-6 font-medium">
                        {item.product?.name ?? `Product #${item.product}`}
                      </div>
                      <div className="col-span-2 text-center font-mono">
                        {pf(item.quantity)}
                      </div>
                      <div className="col-span-2 text-right font-mono">
                        {pf(item.unitPrice).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-medium">
                        {(pf(item.quantity) * pf(item.unitPrice)).toFixed(2)}
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground text-sm">No items found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t border-dashed border-gray-300 pt-4 mt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-mono">{currency} {pf(purchase.totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span className="font-mono">{currency} 0.00</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>TOTAL:</span>
                      <span className="font-mono">{currency} {pf(purchase.totalAmount).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Amount Paid:</span>
                    <span className="font-mono">{currency} {pf(purchase.amountPaid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Payment Method:</span>
                    <span className="font-mono capitalize">{paymentType}</span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-6 mt-6 border-t border-dashed border-gray-300">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Thank you for your business!</p>
                  <p className="text-xs text-muted-foreground">
                    For inquiries, reference: {shortPurchaseNo(purchase.purchaseNo)}
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">
                    Powered by Pointify POS System
                  </p>
                </div>
              </div>

              {/* Outstanding Balance Alert */}
              {outstandingBalance > 0 && (
                <div className="mt-6 text-center">
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 font-medium mb-2">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                      {currency} {outstandingBalance.toFixed(2)}
                    </p>
                    <Button
                      className="w-full max-w-xs"
                      onClick={() =>
                        setLocation(`${purchasesRoute}/pay/${purchaseId}`, { state: { purchase } })
                      }
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Make Payment
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="mt-6">
                  <Card className="bg-gray-50 dark:bg-gray-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {payments.map((payment: any, index: number) => (
                          <div
                            key={payment.id ?? index}
                            className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                          >
                            <div>
                              <p className="font-medium">
                                {currency} {pf(payment.amount).toFixed(2)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {payment.paymentNo} •{" "}
                                {payment.date
                                  ? new Date(payment.date).toLocaleDateString()
                                  : payment.createdAt
                                  ? new Date(payment.createdAt).toLocaleDateString()
                                  : "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground font-mono">
                                Balance: {currency} {pf(payment.balance).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between font-semibold text-lg pt-4 border-t-2 border-gray-300 dark:border-gray-600 mt-4">
                        <span>Total Paid:</span>
                        <span className="font-mono">
                          {currency}{" "}
                          {payments
                            .reduce((sum, p) => sum + pf(p.amount), 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
