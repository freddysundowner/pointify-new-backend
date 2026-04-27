import { useLocation, useParams } from "wouter";
import { useGoBack } from "@/hooks/useGoBack";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, User, Calendar, DollarSign, FileText, Building2, CreditCard } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useCurrency } from "@/utils";

export default function PurchaseViewPage() {
  const [, setLocation] = useLocation();
  const goBack = useGoBack("/purchases");
  const purchasesRoute = useNavigationRoute('purchases');
  
  // Get purchase data from navigation state
  const state = window.history.state;
  const purchase = state?.purchase;
  const currency = useCurrency()

  if (!purchase) {
    return (
      <DashboardLayout title="Purchase Details">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase data not found. Please go back and try again.</p>
          <Button onClick={goBack} className="mt-4">
            Back to Purchases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "received": return "default";
      case "ordered": return "secondary";
      case "partial": return "outline";
      case "pending": return "destructive";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout title="Purchase Details">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchases
          </Button>
          <Badge variant={getStatusBadgeVariant(purchase.paymentType)} className="text-sm capitalize">
            {purchase.paymentType}
          </Badge>
        </div>

        {/* Receipt-style Layout */}
        <div className="w-full max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-gray-300 pb-6 mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-wider mb-2">{purchase.shopId?.name || "BUSINESS NAME"}</h1>
                <p className="text-sm text-muted-foreground">{purchase.shopId?.address || "Business Address"}</p>
                <p className="text-sm text-muted-foreground">Purchase Receipt</p>
                <div className="mt-4 pt-4 border-t border-dashed border-gray-300">
                  <p className="text-lg font-bold">PURCHASE ORDER #{purchase.purchaseNo}</p>
                  <p className="text-sm text-muted-foreground">
                    {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Unknown Date'}
                  </p>
                </div>
              </div>

              {/* Purchase Details */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <p className="font-medium">Supplier:</p>
                  <p className="text-muted-foreground">
                    {purchase.supplierId?.name || "Direct Purchase"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Payment Method:</p>
                  <p className="text-muted-foreground capitalize">{purchase.paymentType}</p>
                </div>
                <div>
                  <p className="font-medium">Attendant:</p>
                  <p className="text-muted-foreground">{purchase.attendantId?.username || "System"}</p>
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
                
                {/* Items List */}
                <div className="space-y-1">
                  {purchase.items?.map((item: any, index: number) => (
                    <div key={index} className="grid grid-cols-12 gap-2 py-2 text-sm">
                      <div className="col-span-6 font-medium">
                        {item.product?.name}
                      </div>
                      <div className="col-span-2 text-center font-mono">
                        {item.quantity || 0}
                      </div>
                      <div className="col-span-2 text-right font-mono">
                        {(item.unitPrice || 0).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right font-mono font-medium">
                        {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  
                  {(!purchase.items || purchase.items.length === 0) && (
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
                    <span className="font-mono">{currency} {(purchase.totalAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span className="font-mono">{currency} 0.00</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 pt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>TOTAL:</span>
                      <span className="font-mono">{currency} {(purchase.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Payment Method:</span>
                    <span className="font-mono capitalize">{purchase.paymentType}</span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-6 mt-6 border-t border-dashed border-gray-300">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Thank you for your business!</p>
                  <p className="text-xs text-muted-foreground">
                    For inquiries, please contact us with reference: {purchase.purchaseNo}
                  </p>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">
                      Powered by Pointify POS System
                    </p>
                  </div>
                </div>
              </div>

              {/* Outstanding Balance Alert */}
              {(purchase.outstandingBalance && purchase.outstandingBalance > 0) && (
                <div className="mt-6 text-center">
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-4">
                    <p className="text-red-600 dark:text-red-400 font-medium mb-2">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                      {currency} {purchase.outstandingBalance.toFixed(2)}
                    </p>
                    <Button 
                      className="w-full max-w-xs" 
                      onClick={() => setLocation(`${purchasesRoute}/pay/${purchase._id}`, { state: { purchase } })}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Make Payment
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment History */}
              {purchase.payments && purchase.payments.length > 0 && (
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
                        {purchase.payments.map((payment: any, index: number) => (
                          <div key={payment._id || index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                            <div>
                              <p className="font-medium">{currency} {payment.amount.toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">
                                {payment.paymentNo} • {new Date(payment.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground font-mono">
                                Balance: {currency} {payment.balance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between font-semibold text-lg pt-4 border-t-2 border-gray-300 dark:border-gray-600 mt-4">
                        <span>Total Paid:</span>
                        <span className="font-mono">
                          {currency} {purchase.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0).toFixed(2)}
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