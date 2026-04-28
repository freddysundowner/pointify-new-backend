import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { extractId } from "@/lib/utils";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface Shop {
  id: number;
  _id?: string;
  name: string;
  currency: string;
  taxRate: number;
  address: string;
  contact: string;
  receiptEmail: string;
  receiptAddress: string;
  receiptFooter: string;
  paybillTill: string;
  paybillAccount: string;
  allowOnlineSelling: boolean;
  isWarehouse: boolean;
  allowNegativeSelling: boolean;
  trackBatches: boolean;
  showStockOnline: boolean;
  showPriceOnline: boolean;
  allowBackup: boolean;
  backupInterval: string;
  loyaltyEnabled: boolean;
  pointsPerAmount: string;
  pointsValue: string;
}

export function useShop() {
  const { admin } = useAuth();

  const getShopId = () => {
    if (!admin?.primaryShop) return "";
    return String(extractId(admin.primaryShop) ?? "");
  };

  const shopId = getShopId();

  const { data: shop, isLoading, error } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: async () => {
      if (!shopId) return null;
      const response = await apiCall(ENDPOINTS.shop.getById(shopId), { method: "GET" });
      const json = await response.json();
      // API returns { success, data: {...} } — unwrap the inner object
      return (json?.data ?? json) as Shop;
    },
    enabled: !!shopId,
  });

  return {
    shop,
    isLoading,
    error,
    currency: shop?.currency || "KES",
  };
}
