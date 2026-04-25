import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, CheckCircle, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import type { Purchase, PurchaseItem } from "@shared/schema";

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
  }
];

interface ReceiveItem extends PurchaseItem {
  receivingNow: number;
  previouslyReceived: number;
}

export default function ReceivePurchase() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const originalPurchase = mockPurchases.find(p => p.id === parseInt(id || "0"));

  if (!originalPurchase) {
    return (
      <DashboardLayout title="Purchase Not Found">
        <div className="p-6 w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Purchase Order Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The purchase order you're trying to receive doesn't exist.
            </p>
            <Button onClick={() => setLocation("/purchases")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Purchases
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>(
    originalPurchase.items.map(item => ({
      ...item,
      receivingNow: item.quantity - (item.received || 0),
      previouslyReceived: item.received || 0
    }))
  );

  const updateReceivingQuantity = (index: number, quantity: number) => {
    const newItems = [...receiveItems];
    const maxReceivable = newItems[index].quantity - newItems[index].previouslyReceived;
    newItems[index].receivingNow = Math.max(0, Math.min(quantity, maxReceivable));
    setReceiveItems(newItems);
  };

  const receiveAll = (index: number) => {
    const newItems = [...receiveItems];
    newItems[index].receivingNow = newItems[index].quantity - newItems[index].previouslyReceived;
    setReceiveItems(newItems);
  };

  const handleReceive = () => {
    const itemsToReceive = receiveItems.filter(item => item.receivingNow > 0);
    
    console.log("Receiving items:", {
      purchaseId: originalPurchase.id,
      items: itemsToReceive.map(item => ({
        productName: item.productName,
        receivingNow: item.receivingNow,
        newTotal: item.previouslyReceived + item.receivingNow
      }))
    });
    
    setLocation("/purchases");
  };

  const handleCancel = () => {
    setLocation("/purchases");
  };

  const totalReceivingNow = receiveItems.reduce((sum, item) => sum + item.receivingNow, 0);
  const hasItemsToReceive = totalReceivingNow > 0;

  const getItemStatus = (item: ReceiveItem) => {
    const totalReceived = item.previouslyReceived + item.receivingNow;
    if (totalReceived >= item.quantity) return "complete";
    if (totalReceived > 0) return "partial";
    return "pending";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <DashboardLayout title={`Receive Purchase Order #${originalPurchase.id}`}>
      <div className="p-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Receive Purchase Order #{originalPurchase.id}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Record received items from {originalPurchase.supplierName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={!hasItemsToReceive}>
              <Package className="mr-2 h-4 w-4" />
              Receive Items ({totalReceivingNow})
            </Button>
          </div>
        </div>

        {/* Purchase Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Purchase Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Supplier</div>
                <div className="font-medium">{originalPurchase.supplierName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Order Date</div>
                <div className="font-medium">{new Date(originalPurchase.orderDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Expected Date</div>
                <div className="font-medium">
                  {originalPurchase.expectedDate ? new Date(originalPurchase.expectedDate).toLocaleDateString() : "TBD"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
                <div className="font-bold text-lg">${originalPurchase.totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receive Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items to Receive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {receiveItems.map((item, index) => {
              const status = getItemStatus(item);
              const totalAfterReceiving = item.previouslyReceived + item.receivingNow;
              const progress = (totalAfterReceiving / item.quantity) * 100;
              
              return (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.productName}
                        </h4>
                        {getStatusIcon(status)}
                        <Badge variant={status === "complete" ? "default" : status === "partial" ? "outline" : "secondary"}>
                          {status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div>Unit Cost: ${item.unitCost.toFixed(2)}</div>
                        <div>Total Cost: ${item.totalCost.toFixed(2)}</div>
                        <div>Previously Received: {item.previouslyReceived} / {item.quantity}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Receiving Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {totalAfterReceiving} / {item.quantity} units
                      </div>
                    </div>

                    {/* Receive Input */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`receive-${index}`} className="text-sm">
                          Receiving Now
                        </Label>
                        <Input
                          id={`receive-${index}`}
                          type="number"
                          min="0"
                          max={item.quantity - item.previouslyReceived}
                          value={item.receivingNow}
                          onChange={(e) => updateReceivingQuantity(index, parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div className="pt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => receiveAll(index)}
                          disabled={item.previouslyReceived >= item.quantity}
                        >
                          Receive All
                        </Button>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Previously:</span>
                          <div className="font-medium">{item.previouslyReceived}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Receiving:</span>
                          <div className="font-medium text-blue-600">{item.receivingNow}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total After:</span>
                          <div className="font-medium">{totalAfterReceiving}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Summary */}
            <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Total Items Receiving Now:
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {totalReceivingNow} units
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}