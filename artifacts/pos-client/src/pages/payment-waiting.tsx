import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Smartphone, RefreshCw, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/utils';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { apiRequest } from '@/lib/queryClient';

interface PaymentWaitingProps {
  subscriptionId: string;
  planName: string;
  amount: number;
  phoneNumber: string;
  shopCount: number;
}

export default function PaymentWaiting() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes countdown
  const currency = useCurrency();
  
  // Get payment details from navigation state with localStorage fallback
  const navigationState = (window.history.state?.state) || {};
  
  // Prioritize history state over localStorage for consistency
  const historyState = window.history.state || {};
  
  // If we have valid history state data, use it and clear any conflicting localStorage
  if (historyState.subscriptionId && historyState.amount) {
    // Clear localStorage if it conflicts with history state
    const storedSubId = localStorage.getItem('pendingSubscriptionId');
    if (storedSubId && storedSubId !== historyState.subscriptionId) {
      localStorage.removeItem('pendingSubscriptionId');
      localStorage.removeItem('pendingAmount');
      localStorage.removeItem('pendingPlanName');
      localStorage.removeItem('pendingPhone');
      localStorage.removeItem('pendingShopCount');
    }
  }
  
  const subscriptionId = historyState.subscriptionId || navigationState.subscriptionId || localStorage.getItem('pendingSubscriptionId');
  const planName = historyState.planName || navigationState.planName || localStorage.getItem('pendingPlanName') || 'Subscription';
  const amount = historyState.amount || navigationState.amount || parseInt(localStorage.getItem('pendingAmount') || '0');
  const phoneNumber = historyState.phoneNumber || navigationState.phoneNumber || localStorage.getItem('pendingPhone') || '';
  const shopCount = historyState.shopCount || navigationState.shopCount || parseInt(localStorage.getItem('pendingShopCount') || '1');
  

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validatePayment = async () => {
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No subscription ID found. Please try creating the subscription again.",
        variant: "destructive",
      });
      setLocation('/subscription');
      return;
    }

    setIsValidating(true);
    
    try {
      // First get subscription details to extract shop information
      const subscriptionResponse = await apiRequest('GET', ENDPOINTS.subscriptions.getById(subscriptionId));
      const subscriptionData = await subscriptionResponse.json();
      console.log('Subscription data:', subscriptionData);

      // Confirm payment using the new endpoint
      const confirmPayload = {
        subscriptionid: subscriptionId,
        shopid: subscriptionData.shop, // Primary shop ID
        shops: subscriptionData.shops || [subscriptionData.shop] // Array of shop IDs
      };

      console.log('Confirming payment with payload:', confirmPayload);

      const confirmResponse = await apiRequest('POST', ENDPOINTS.payments.confirm, confirmPayload);
      const confirmResult = await confirmResponse.json();
      console.log('Payment confirmation result:', confirmResult);

      // Check if payment confirmation was successful
      if (confirmResult.status === true || confirmResult.paid === true || confirmResult.success === true) {
        // Clear any remaining localStorage data
        localStorage.removeItem('pendingSubscriptionId');
        localStorage.removeItem('pendingPlanName');
        localStorage.removeItem('pendingAmount');
        localStorage.removeItem('pendingPhone');
        localStorage.removeItem('pendingShopCount');

        toast({
          title: "Payment Successful!",
          description: `Your ${planName} subscription has been activated for ${shopCount} shops.`,
        });
        
        setLocation('/dashboard');
      } else if (confirmResult.status === false && confirmResult.message === 'no payment received yet') {
        // Payment not received yet - stay on page and inform user
        toast({
          title: "Payment Pending",
          description: "Payment not received yet. Please complete the M-Pesa payment on your phone and try again.",
        });
      } else if (confirmResult.status === 'pending' || confirmResult.message === 'waiting') {
        toast({
          title: "Payment Pending",
          description: "Your payment is still being processed. Please wait for the M-Pesa confirmation.",
        });
      } else if (confirmResult.status === 'failed') {
        toast({
          title: "Payment Failed",
          description: confirmResult.message || "Payment verification failed. Please try again.",
          variant: "destructive",
        });
        
        // Clear pending data and redirect to subscription page
        localStorage.removeItem('pendingSubscriptionId');
        localStorage.removeItem('pendingPlanName');
        localStorage.removeItem('pendingAmount');
        localStorage.removeItem('pendingPhone');
        localStorage.removeItem('pendingShopCount');
        
        setLocation('/subscription');
      } else {
        toast({
          title: "Payment Status Unknown",
          description: confirmResult.message || "Unable to determine payment status. Please check your M-Pesa messages and try again.",
        });
      }
    } catch (error) {
      console.error('Payment validation error:', error);
      toast({
        title: "Validation Error",
        description: "Failed to check payment status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const resendPushNotification = async () => {
    console.log('Resend validation check:', { subscriptionId, phoneNumber, amount });
    
    if (!subscriptionId || !phoneNumber) {
      toast({
        title: "Error",
        description: "Missing payment information. Please try creating the subscription again.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    
    try {
      const resendPayload = {
        subscriptionid: subscriptionId,
        phonenumber: phoneNumber,
        amount: amount || 0  // Ensure amount is never undefined
      };

      console.log('Resending push notification with payload:', resendPayload);

      const response = await apiRequest('POST', ENDPOINTS.payments.resend, resendPayload);
      const result = await response.json();
      console.log('Resend result:', result);

      if (result.status === true || result.success === true) {
        // Update subscription ID if a new one was created
        if (result.newSubscriptionId) {
          localStorage.setItem('pendingSubscriptionId', result.newSubscriptionId);
          console.log('Updated subscription ID to:', result.newSubscriptionId);
        }
        
        toast({
          title: "Push Notification Sent!",
          description: result.message || "A new M-Pesa payment request has been sent to your phone. Please check your phone and complete the payment.",
        });
      } else {
        toast({
          title: "Resend Failed",
          description: result.message || "Failed to resend push notification. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Resend push notification error:', error);
      toast({
        title: "Resend Error",
        description: "Failed to resend push notification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const cancelPayment = () => {
    // Clear pending data
    localStorage.removeItem('pendingSubscriptionId');
    localStorage.removeItem('pendingPlanName');
    localStorage.removeItem('pendingAmount');
    localStorage.removeItem('pendingPhone');
    localStorage.removeItem('pendingShopCount');
    
    setLocation('/subscription');
  };

  if (!subscriptionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">No Payment Found</CardTitle>
            <CardDescription>
              No pending payment found. Please start the subscription process again.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation('/subscription')} className="w-full">
              Back to Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Smartphone className="h-16 w-16 text-purple-600" />
              <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                <Clock className="h-4 w-4 text-white animate-pulse" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Waiting for Payment
          </CardTitle>
          <CardDescription className="text-lg">
            M-Pesa push notification sent to your phone
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Details */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Payment Details
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Plan:</span>
                <span className="font-medium">{planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Amount:</span>
                <span className="font-medium">{currency} {amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Shops:</span>
                <span className="font-medium">{shopCount} shop{shopCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Phone:</span>
                <span className="font-medium">{phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Subscription ID:</span>
                <span className="font-medium text-xs">{subscriptionId}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center space-x-2 text-orange-600 dark:text-orange-400">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Time remaining: {formatTime(countdown)}</span>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <p>1. Check your phone for M-Pesa push notification</p>
              <p>2. Enter your M-Pesa PIN to complete payment</p>
              <p>3. Click "Validate Payment" after payment confirmation</p>
              <p>4. If you didn't receive the notification, click "Resend Push Notification"</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={validatePayment} 
              disabled={isValidating || isResending}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Validating Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Validate Payment
                </>
              )}
            </Button>

            <Button 
              onClick={resendPushNotification} 
              disabled={isValidating || isResending}
              variant="outline"
              className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
              size="lg"
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending Push...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Resend Push Notification
                </>
              )}
            </Button>
            
            <Button 
              onClick={cancelPayment}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Cancel & Return
            </Button>
          </div>

          {/* Auto-validation notice */}
          <div className="text-xs text-center text-gray-500 dark:text-gray-400">
            Payment will be automatically validated upon successful M-Pesa transaction
          </div>
        </CardContent>
      </Card>
    </div>
  );
}