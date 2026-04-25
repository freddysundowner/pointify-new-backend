import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useRoute } from "wouter";
import { useState } from "react";
import type { Sale } from "@shared/schema";

const getSaleById = (id: string): Sale | null => {
  const mockSales: Sale[] = [
    {
      id: 1,
      customerName: "John Smith",
      items: [
        { productName: "Premium Widget", quantity: 2, unitPrice: 149.99, totalPrice: 299.98 },
        { productName: "Extended Warranty", quantity: 1, unitPrice: 49.99, totalPrice: 49.99 }
      ],
      totalAmount: 349.97,
      saleDate: "2024-06-18",
      status: "completed"
    }
  ];
  
  return mockSales.find(sale => sale.id === parseInt(id)) || null;
};

export default function DeleteSale() {
  const [match, params] = useRoute("/sales/delete/:id");
  const sale = params?.id ? getSaleById(params.id) : null;
  
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [acknowledgeConsequences, setAcknowledgeConsequences] = useState(false);

  if (!sale) {
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

  const isValidConfirmation = confirmationText === `DELETE-${sale.id}`;
  const canDelete = isValidConfirmation && acknowledgeConsequences && deleteReason.trim().length > 0;

  const handleDelete = () => {
    if (!canDelete) return;

    const deleteData = {
      saleId: sale.id,
      reason: deleteReason,
      deletedBy: "Current User", // TODO: Get from auth context
      deletedAt: new Date().toISOString(),
      originalSale: sale
    };

    console.log("Deleting sale:", deleteData);
    // TODO: Implement API call to delete sale

    // Navigate back to sales list
    window.history.back();
  };

  return (
    <DashboardLayout title={`Delete Sale #${sale.id}`}>
      <div className="p-6 w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Delete Sale #{sale.id}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This action cannot be undone. Please review carefully before proceeding.
          </p>
        </div>

        <div className="space-y-6">
          {/* Sale Information */}
          <Card>
            <CardHeader>
              <CardTitle>Sale Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Customer:</p>
                  <p>{sale.customerName}</p>
                </div>
                <div>
                  <p className="font-medium">Sale Date:</p>
                  <p>{new Date(sale.saleDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-medium">Total Amount:</p>
                  <p className="font-bold">${sale.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-medium">Status:</p>
                  <Badge variant={sale.status === "completed" ? "default" : "secondary"}>
                    {sale.status}
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              <div>
                <p className="font-medium mb-2">Items ({sale.items.length}):</p>
                <ul className="space-y-1 text-sm">
                  {sale.items.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span>{item.productName} × {item.quantity}</span>
                      <span>${item.totalPrice.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Consequences Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Deleting this sale will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Permanently remove the sale record from the system</li>
                <li>Affect your sales reports and analytics</li>
                <li>Remove transaction history for this customer</li>
                <li>Impact inventory tracking if items were deducted</li>
                <li>Cannot be recovered once deleted</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Delete Form */}
          <Card>
            <CardHeader>
              <CardTitle>Deletion Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Deletion *</Label>
                <Textarea
                  id="reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Please provide a detailed reason for deleting this sale..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="confirmation">
                  Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">DELETE-{sale.id}</code> to confirm
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={`DELETE-${sale.id}`}
                  className="mt-1 font-mono"
                />
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="acknowledge"
                  checked={acknowledgeConsequences}
                  onChange={(e) => setAcknowledgeConsequences(e.target.checked)}
                  className="mt-1"
                />
                <Label htmlFor="acknowledge" className="text-sm leading-5">
                  I understand the consequences of deleting this sale and acknowledge that this action cannot be undone.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={!canDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Sale Permanently
            </Button>
          </div>

          {!canDelete && (
            <p className="text-center text-sm text-muted-foreground">
              Complete all requirements above to enable deletion.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}