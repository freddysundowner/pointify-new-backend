import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";

interface Shop {
  _id: string;
  name: string;
  currency: string;
  tax: number;
  address: string;
  allowOnlineSelling: boolean;
  useWarehouse: boolean;
  warehouse: boolean;
  // Add other shop properties as needed
}

export function useShop() {
  const { admin } = useAuth();
  
  // Helper function to extract shop ID
  const getShopId = () => {
    if (!admin?.primaryShop) return "";
    if (typeof admin.primaryShop === 'string') return admin.primaryShop;
    return (admin.primaryShop as any)?._id || (admin.primaryShop as any)?.id || "";
  };
  
  const shopId = getShopId();
  
  const { data: shop, isLoading, error } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: async () => {
      if (!shopId) return null;
      
      const shopResponse = await apiCall(ENDPOINTS.shop.getById(shopId), {
        method: "GET",
      });
      const shopData = await shopResponse.json();
      return shopData as Shop;
    },
    enabled: !!shopId,
  });

  return {
    shop,
    isLoading,
    error,
    currency: shop?.currency || "KES", // Default fallback
  };
}