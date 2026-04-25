import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Package } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation, useParams } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import type { Purchase } from "@shared/schema";

// Mock purchase data
const mockPurchases: Purchase[] = [
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
  },
  {
    id: 3,
    supplierName: "Quality Materials Inc",
    items: [
      { productName: "Raw Material A", quantity: 200, unitCost: 8.75, totalCost: 1750.00 },
      { productName: "Raw Material B", quantity: 150, unitCost: 12.25, totalCost: 1837.50 }
    ],
    totalAmount: 3587.50,
    orderDate: "2024-06-20",
    expectedDate: "2024-06-27",
    status: "ordered"
  },
  {
    id: 4,
    supplierName: "Express Supplies",
    items: [
      { productName: "Emergency Stock", quantity: 75, unitCost: 22.50, totalCost: 1687.50 }
    ],
    totalAmount: 1687.50,
    orderDate: "2024-06-22",
    expectedDate: "2024-06-24",
    status: "pending"
  }
];

export default function CancelPurchase() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute('purchases');
  
  const purchase = mockPurchases.find(p => p.id === parseInt(id || "0"));

  if (!purchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-6 w-full max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Purchase Order Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The purchase order you're trying to cancel doesn't exist.
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

  const handleConfirmCancel = () => {
    console.log("Cancelling purchase order:", purchase.id);
    setLocation(purchasesRoute);
  };

  const handleGoBack = () => {
    setLocation(purchasesRoute);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="default">Received</Badge>;
      case "ordered":
        return <Badge variant="secondary">Ordered</Badge>;
      case "partial":
        return <Badge variant="outline">Partial</Badge>;
      case "pending":
        return <Badge variant="destructive">Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title={`Cancel Purchase Order #${purchase.id}`}>
      <div className="p-6 w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Cancel Purchase Order
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This action cannot be undone. The purchase order will be permanently cancelled.
          </p>
        </div>

        {/* Purchase Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Purchase Order #{purchase.id}
                  {getStatusBadge(purchase.status)}
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {purchase.supplierName}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ${purchase.totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Order Date</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(purchase.orderDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Expected Date</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {purchase.expectedDate ? new Date(purchase.expectedDate).toLocaleDateString() : "TBD"}
                </p>
              </div>
              {purchase.invoiceNumber && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Invoice Number</h4>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{purchase.invoiceNumber}</p>
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items ({purchase.items.length})
              </h4>
              <div className="space-y-2">
                {purchase.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        ${item.unitCost.toFixed(2)} × {item.quantity}
                        {item.received !== undefined && item.received > 0 && (
                          <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                            • {item.received} already received
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-semibold">${item.totalCost.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning Messages */}
        <Card className="mb-6 border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 dark:text-red-100">
                    Cancellation Impact
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
                    <li>• This purchase order will be marked as cancelled</li>
                    <li>• You may need to contact the supplier to cancel the order</li>
                    <li>• Any payments made may need to be refunded manually</li>
                    {purchase.items.some(item => item.received && item.received > 0) && (
                      <li className="font-medium">• Some items have already been received - handle these separately</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={handleGoBack} className="min-w-32">
            Keep Purchase Order
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirmCancel}
            className="min-w-32"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Cancel Order
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}