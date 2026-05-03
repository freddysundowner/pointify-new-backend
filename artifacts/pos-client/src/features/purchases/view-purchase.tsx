import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Calendar, FileText, Edit, Truck, AlertCircle, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation, useParams } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import type { Purchase } from "@shared/schema";

// Mock purchase data - replace with API call
const mockPurchases: Purchase[] = [
  {
    id: 1,
    supplierName: "Tech Supply Co",
    items: [
      { productName: "Premium Widget", quantity: 50, unitCost: 75.00, totalCost: 3750.00, received: 50 },
      { productName: "Basic Component", quantity: 100, unitCost: 15.50, totalCost: 1550.00, received: 100 }
    ],
    totalAmount: 5300.00,
    orderDate: "2024-06-15",
    expectedDate: "2024-06-22",
    receivedDate: "2024-06-20",
    status: "received",
    invoiceNumber: "INV-2024-001"
  },
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
  }
];

export default function ViewPurchase() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const purchasesRoute = useNavigationRoute('purchases');
  
  const purchase = mockPurchases.find(p => p.id === parseInt(id || "0"));

  if (!purchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-6 w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Purchase Order Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The purchase order you're looking for doesn't exist.
            </p>
            <Button onClick={() => window.history.length > 1 ? window.history.back() : setLocation(purchasesRoute)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Purchases
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "received":
        return "default";
      case "ordered":
        return "secondary";
      case "partial":
        return "outline";
      case "pending":
        return "destructive";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "received":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "ordered":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Calendar className="h-4 w-4 text-gray-600" />;
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const handleEdit = () => {
    setLocation(`${purchasesRoute}/edit/${purchase.id}`);
  };

  const handleReceive = () => {
    setLocation(`${purchasesRoute}/receive/${purchase.id}`);
  };

  return (
    <DashboardLayout title={`Purchase Order #${purchase.id}`}>
      <div className="p-6 w-full">
        {/* Action Buttons */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => window.history.length > 1 ? window.history.back() : setLocation(purchasesRoute)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchases
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleEdit}
              disabled={purchase.status === "received" || purchase.status === "cancelled"}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Order
            </Button>
            <Button 
              onClick={handleReceive}
              disabled={purchase.status === "received" || purchase.status === "cancelled" || purchase.status === "pending"}
            >
              <Package className="mr-2 h-4 w-4" />
              Receive Items
            </Button>
          </div>
        </div>

        {/* Purchase Header */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-2">Purchase Order #{purchase.id}</CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusIcon(purchase.status)}
                  <Badge variant={getStatusBadgeVariant(purchase.status)} className="text-sm">
                    {purchase.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Amount</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  ${purchase.totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Supplier</h4>
                <p className="text-gray-600 dark:text-gray-400">{purchase.supplierName}</p>
              </div>
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
              {purchase.receivedDate && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Received Date</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {new Date(purchase.receivedDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {purchase.invoiceNumber && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Invoice Number</h4>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{purchase.invoiceNumber}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items ({purchase.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchase.items.map((item, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Unit Cost: ${item.unitCost.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${item.totalCost.toFixed(2)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Qty: {item.quantity}
                      </div>
                    </div>
                  </div>
                  
                  {item.received !== undefined && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium">Received Status:</span>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          {item.received} / {item.quantity} received
                        </div>
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${(item.received / item.quantity) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round((item.received / item.quantity) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Order Total:
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${purchase.totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Total Items:</span>
                <span>{purchase.items.reduce((sum, item) => sum + item.quantity, 0)} units</span>
              </div>
              {purchase.status === "partial" && (
                <div className="flex justify-between items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>Items Received:</span>
                  <span>
                    {purchase.items.reduce((sum, item) => sum + (item.received || 0), 0)} units
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}