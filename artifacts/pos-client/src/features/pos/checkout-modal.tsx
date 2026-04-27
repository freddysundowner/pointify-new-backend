import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { normalizeIds } from "@/lib/utils";
import { X, CreditCard, Banknote, Check, UserX, User, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import type { CartItem, Transaction } from "@shared/schema";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  onComplete: (transaction: Transaction) => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems,
  totals,
  onComplete,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "credit" | null>(null);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const { toast } = useToast();
  const { admin, token } = useAuth();
  const queryClient = useQueryClient();

  // Fetch customers for credit sales
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const adminid = admin?._id || admin?.id;
      const params = new URLSearchParams({
        adminid: adminid || ''
      });
      
      const response = await apiRequest('GET', `${ENDPOINTS.customers.getAll}?${params.toString()}`);
      const data = await response.json();
      return normalizeIds(Array.isArray(data) ? data : data?.customers || data?.data || []);
    },
    enabled: !!admin && !!token
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      return await apiCall(ENDPOINTS.sales.create, {
        method: "POST",
        body: JSON.stringify(transactionData),
      });
    },
    onSuccess: (transaction: Transaction) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      onComplete(transaction);
      resetModal();
      toast({
        title: "Payment Successful",
        description: "Transaction completed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Payment Failed",
        description: "There was an error processing the payment",
        variant: "destructive",
      });
    },
  });

  const resetModal = () => {
    setPaymentMethod(null);
    setCashReceived("");
    setSelectedCustomer(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const calculateChange = () => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - totals.total);
  };

  const canComplete = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === "cash") {
      const received = parseFloat(cashReceived) || 0;
      return received >= totals.total;
    }
    if (paymentMethod === "credit") {
      return selectedCustomer !== null;
    }
    return true;
  };

  const handleComplete = () => {
    if (!canComplete()) return;

    const transactionData = {
      subtotal: totals.subtotal.toFixed(2),
      tax: totals.tax.toFixed(2),
      totalTax: totals.tax.toFixed(2),
      total: totals.total.toFixed(2),
      paymentMethod: paymentMethod!,
      cashReceived: paymentMethod === "cash" ? parseFloat(cashReceived).toFixed(2) : null,
      change: paymentMethod === "cash" ? calculateChange().toFixed(2) : null,
      customerId: paymentMethod === "credit" ? selectedCustomer?._id : null,
      customerName: paymentMethod === "credit" ? selectedCustomer?.name : null,
      items: cartItems,
      cashierId: 1, // Default cashier ID
    };

    createTransactionMutation.mutate(transactionData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-white/95 backdrop-blur-md border-0 shadow-2xl p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl sm:text-2xl font-bold">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Payment
            </span>
            <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-full hover:bg-gray-100">
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center bg-gradient-to-br from-primary/5 to-purple-50 p-4 sm:p-6 rounded-2xl">
            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
              Ksh {totals.total.toFixed(2)}
            </div>
            <p className="text-gray-600 font-medium text-sm sm:text-base">Total Amount Due</p>
          </div>
          
          {/* Payment Methods */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => setPaymentMethod("card")}
              className={`flex flex-col items-center p-4 sm:p-6 h-auto rounded-2xl border-2 transition-all duration-200 ${
                paymentMethod === "card" 
                  ? 'border-primary bg-primary/5 text-primary' 
                  : 'border-gray-200 hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
              <span className="font-semibold text-xs sm:text-sm">Card Payment</span>
              <span className="text-xs text-gray-500 mt-1">Tap, insert, or swipe</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPaymentMethod("cash")}
              className={`flex flex-col items-center p-4 sm:p-6 h-auto rounded-2xl border-2 transition-all duration-200 ${
                paymentMethod === "cash" 
                  ? 'border-primary bg-primary/5 text-primary' 
                  : 'border-gray-200 hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <Banknote className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
              <span className="font-semibold text-xs sm:text-sm">Cash Payment</span>
              <span className="text-xs text-gray-500 mt-1">Physical currency</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPaymentMethod("credit")}
              className={`flex flex-col items-center p-4 sm:p-6 h-auto rounded-2xl border-2 transition-all duration-200 ${
                paymentMethod === "credit" 
                  ? 'border-orange-500 bg-orange-50 text-orange-600' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <UserX className="h-6 w-6 sm:h-8 sm:w-8 mb-2" />
              <span className="font-semibold text-xs sm:text-sm">Credit Sale</span>
              <span className="text-xs text-gray-500 mt-1">Sell on credit</span>
            </Button>
          </div>
          
          {/* Cash Payment */}
          {paymentMethod === "cash" && (
            <div className="space-y-4 sm:space-y-6 bg-gray-50 p-4 sm:p-6 rounded-2xl">
              <div>
                <Label htmlFor="cashReceived" className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">
                  Cash Received
                </Label>
                <Input
                  id="cashReceived"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-lg sm:text-xl h-12 sm:h-14 rounded-xl border-gray-200 focus:border-primary"
                />
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between text-lg sm:text-xl font-bold">
                  <span>Change Due:</span>
                  <span className="text-green-600">
                    Ksh {calculateChange().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Card Payment */}
          {paymentMethod === "card" && (
            <div className="text-center py-12 bg-gradient-to-br from-primary/5 to-purple-50 rounded-2xl">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CreditCard className="h-10 w-10 text-white" />
              </div>
              <p className="text-gray-700 font-medium mb-4 text-lg">Ready for card payment</p>
              <p className="text-gray-500 mb-4">Insert, tap, or swipe your card</p>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          )}

          {/* Credit Payment */}
          {paymentMethod === "credit" && (
            <div className="space-y-4 bg-orange-50 p-4 sm:p-6 rounded-2xl border border-orange-200">
              <div className="flex items-center space-x-2 mb-4">
                <UserX className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Credit Sale</span>
              </div>
              <div>
                <Label htmlFor="customer" className="text-sm font-semibold mb-3 block">
                  Select Customer *
                </Label>
                <Select onValueChange={(value) => {
                  const customer = customers.find((c: { _id: string; }) => c._id === value);
                  setSelectedCustomer(customer);
                }}>
                  <SelectTrigger className="h-12 rounded-xl border-orange-200 focus:border-orange-500">
                    <SelectValue placeholder="Choose a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer._id} value={customer._id}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <span className="font-medium">{customer.name}</span>
                            {customer.phone && (
                              <span className="text-sm text-gray-500 ml-2">({customer.phone})</span>
                            )}
                          </div>
                          {customer.balance && Math.abs(customer.balance) > 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded ml-2">
                              Owes: Ksh {Math.abs(customer.balance).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCustomer && (
                <div className="bg-white p-4 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-500">
                        Current Balance: Ksh {Math.abs(selectedCustomer.balance || 0).toFixed(2)} 
                        {selectedCustomer.balance > 0 ? ' (Credit)' : selectedCustomer.balance < 0 ? ' (Owes)' : ''}
                      </p>
                    </div>
                    <User className="h-8 w-8 text-orange-500" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-14 rounded-2xl border-gray-200 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!canComplete() || createTransactionMutation.isPending}
              className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 font-bold text-lg shadow-lg"
            >
              <Check className="mr-2 h-5 w-5" />
              {createTransactionMutation.isPending ? "Processing..." : "Complete Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
