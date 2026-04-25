import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api-config';
import { useAuth } from '@/features/auth/useAuth';

interface SubscriptionStatus {
  isExpired: boolean;
  daysRemaining: number | null;
  hasActiveSubscription: boolean;
}

export const useSubscriptionStatus = (): SubscriptionStatus => {
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);

  // Fetch current shop data to get subscription info
  const { data: shopsData, isError: shopsError, isLoading: shopsLoading } = useQuery({
    queryKey: ["shops", admin?._id],
    queryFn: async () => {
      if (!admin?._id) return [];
      const response = await apiCall(`/api/shop/admin/${admin._id}`, {
        method: "GET",
      });
      return response.json();
    },
    enabled: !!admin?._id,
    retry: 1, // Only retry once to fail faster when offline
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const calculateDaysRemaining = (subscriptionEndDate: string) => {
    if (!subscriptionEndDate) return null;
    const endDate = new Date(subscriptionEndDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return useMemo(() => {
    // Always get admin data from localStorage for offline resilience
    const adminData = (() => {
      try {
        const adminData = localStorage.getItem('adminData');
        return adminData ? JSON.parse(adminData) : null;
      } catch (error) {
        return null;
      }
    })();

    // Find the currently selected shop from shops data or fallback to localStorage
    // Ensure shopsData is an array before using find
    const shopsArray = Array.isArray(shopsData) ? shopsData : [];
    let currentShop = shopsArray.find((shop: any) => shop._id === selectedShopId);
    
    // If API data is not available (offline/error), use cached admin data
    if (!currentShop && adminData?.primaryShop && (!shopsError && !shopsLoading)) {
      currentShop = adminData.primaryShop;
    }
    
    // If still no shop data and we have error/loading, use fallback from localStorage shops
    if (!currentShop && adminData?.shops?.length > 0) {
      currentShop = adminData.shops.find((shop: any) => shop._id === selectedShopId) || adminData.shops[0];
    }

    const currentSubscription = currentShop?.subscription;

    // Debug subscription validation
    console.log('=== SUBSCRIPTION DEBUG ===');
    console.log('Selected Shop ID:', selectedShopId);
    console.log('Shops API Error:', shopsError);
    console.log('Shops Loading:', shopsLoading);
    console.log('Current Shop:', currentShop);
    console.log('Current Subscription:', currentSubscription);

    // Only check by date - no status field validation
    if (currentSubscription?.endDate) {
      const daysRemaining = calculateDaysRemaining(currentSubscription.endDate);
      const isExpired = daysRemaining !== null ? daysRemaining <= 0 : false;
      console.log(`📅 Subscription check by date only: ${daysRemaining} days remaining, expired: ${isExpired}`);
      
      return {
        isExpired,
        daysRemaining,
        hasActiveSubscription: !isExpired,
      };
    }

    // Fallback to primary shop subscription from localStorage - date only
    const fallbackSubscription = adminData?.primaryShop?.subscription;
    if (fallbackSubscription?.endDate) {
      console.log('🔄 Using fallback subscription from localStorage - date only');
      
      const daysRemaining = calculateDaysRemaining(fallbackSubscription.endDate);
      const isExpired = daysRemaining !== null ? daysRemaining <= 0 : false;
      
      return {
        isExpired,
        daysRemaining,
        hasActiveSubscription: !isExpired,
      };
    }

    // If we're still loading or have an error, assume valid to avoid blocking UI
    if (shopsLoading || shopsError) {
      console.log('⏳ API loading/error - assuming valid subscription to avoid blocking UI');
      return {
        isExpired: false,
        daysRemaining: null,
        hasActiveSubscription: true,
      };
    }

    // Final fallback: No subscription data found
    console.log('❌ No subscription data found - marking as expired');
    return {
      isExpired: true,
      daysRemaining: null,
      hasActiveSubscription: false,
    };
  }, [shopsData, selectedShopId, shopsError, shopsLoading]);
};