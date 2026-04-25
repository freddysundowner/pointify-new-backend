import { useLocation, useParams } from "wouter";
import { useNavigationRoute } from "@/lib/navigation-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, DollarSign, CreditCard, Banknote } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/utils";

export default function PurchasePaymentPage() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const purchasesRoute = useNavigationRoute('purchases');
  const currency = useCurrency()
  
  // Get purchase data from navigation state
  const state = window.history.state;
  const purchase = state?.purchase;

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: "cash",
    referenceNumber: "",
    notes: ""
  });

  // Initialize payment amount when purchase data loads
  useEffect(() => {
    if (purchase && purchase.outstandingBalance) {
      setPaymentData(prev => ({
        ...prev,
        amount: purchase.outstandingBalance
      }));
    }
  }, [purchase]);

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(ENDPOINTS.purchases.addPayment(id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: "Purchase payment has been recorded successfully.",
      });
      // Force refresh of all purchase-related data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/purchases') || key.includes('/api/analysis/report/purchases');
        }
      });
      
      // Force immediate refetch of current data
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('/api/purchases') || key.includes('/api/analysis/report/purchases');
        }
      });
      
      // Go back to purchases list
      setLocation(purchasesRoute);
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!purchase) {
    return (
      <DashboardLayout title="Make Payment">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase data not found. Please go back and try again.</p>
          <Button onClick={() => setLocation(purchasesRoute)} className="mt-4">
            Back to Purchases
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (paymentData.amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (paymentData.amount > purchase.outstandingBalance) {
      toast({
        title: "Amount Too High",
        description: "Payment amount cannot exceed the outstanding balance.",
        variant: "destructive",
      });
      return;
    }

    // Get attendant ID from localStorage (admin data)
    const adminData = localStorage.getItem('adminData');
    const admin = adminData ? JSON.parse(adminData) : null;
    const attendantId = admin?.attendantId;

    console.log('Admin data:', adminData);
    console.log('Extracted attendantId:', attendantId);

    const paymentPayload = {
      amount: paymentData.amount,
      attendantId: attendantId
    };

    console.log('Payment payload:', paymentPayload);
    paymentMutation.mutate(paymentPayload);
  };

  const maxAmount = purchase?.outstandingBalance || 0;

  return (
    <DashboardLayout title="Make Payment">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation(purchasesRoute)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchases
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Make Payment</h1>
            <p className="text-muted-foreground">Purchase Order #{purchase.purchaseNo}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-center">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold">{currency} {(purchase.totalAmount || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-lg font-semibold text-green-600">{currency} {(purchase.amountPaid || 0).toFixed(2)}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-semibold text-red-600">{currency} {(purchase.outstandingBalance || 0).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount ({currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAmount}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter payment amount"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Maximum: {currency} {maxAmount.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={paymentData.paymentMethod}
                  onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Cash Payment
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Bank Transfer
                      </div>
                    </SelectItem>
                    <SelectItem value="mpesa">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        M-Pesa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentData.paymentMethod !== "cash" && (
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                    placeholder="Enter transaction reference number"
                    required={paymentData.paymentMethod !== "cash"}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add any payment notes or comments"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(purchasesRoute)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={paymentMutation.isPending}
                >
                  {paymentMutation.isPending ? "Processing..." : "Make Payment"}
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}