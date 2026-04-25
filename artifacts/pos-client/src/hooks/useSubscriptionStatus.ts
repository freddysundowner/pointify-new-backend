import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api-config';
import { ENDPOINTS } from '@/lib/api-endpoints';
import { useAuth } from '@/features/auth/useAuth';

interface SubscriptionStatus {
  isExpired: boolean;
  daysRemaining: number | null;
  hasActiveSubscription: boolean;
}

export const useSubscriptionStatus = (): SubscriptionStatus => {
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);

  const adminId = admin?.id ?? (admin as any)?._id;

  const { data: shopsData, isError: shopsError, isLoading: shopsLoading } = useQuery({
    queryKey: ["shops", adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const response = await apiCall(ENDPOINTS.shop.getAll, { method: "GET" });
      const json = await response.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    },
    enabled: !!adminId,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    // While loading, don't block the UI
    if (shopsLoading) {
      return { isExpired: false, daysRemaining: null, hasActiveSubscription: true };
    }

    // If API errored, don't block the UI
    if (shopsError) {
      return { isExpired: false, daysRemaining: null, hasActiveSubscription: true };
    }

    const shopsArray: any[] = Array.isArray(shopsData) ? shopsData : [];

    // Find the current shop: prefer selectedShopId, fallback to first shop
    const currentShop =
      shopsArray.find((s: any) => (s.id ?? s._id) === selectedShopId) ??
      shopsArray[0] ??
      null;

    if (!currentShop) {
      // No shops at all — don't expire (onboarding in progress)
      return { isExpired: false, daysRemaining: null, hasActiveSubscription: true };
    }

    // The API returns subscriptionInfo (not subscription)
    const subInfo = currentShop.subscriptionInfo ?? currentShop.subscription ?? null;

    if (!subInfo || subInfo.status === 'none') {
      // No subscription record — treat as expired so user can renew
      return { isExpired: true, daysRemaining: null, hasActiveSubscription: false };
    }

    const { endDate, isExpired, daysRemaining } = subInfo;

    if (typeof isExpired === 'boolean') {
      return {
        isExpired,
        daysRemaining: daysRemaining ?? null,
        hasActiveSubscription: !isExpired,
      };
    }

    // Fallback: compute from endDate
    if (endDate) {
      const diff = new Date(endDate).getTime() - Date.now();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const expired = days <= 0;
      return { isExpired: expired, daysRemaining: days, hasActiveSubscription: !expired };
    }

    return { isExpired: true, daysRemaining: null, hasActiveSubscription: false };
  }, [shopsData, selectedShopId, shopsError, shopsLoading]);
};
