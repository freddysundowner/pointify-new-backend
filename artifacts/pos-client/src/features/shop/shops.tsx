import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { extractId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Store, Plus, Search, Edit, Eye } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Link, useLocation } from "wouter";

interface Shop {
  _id: string;
  name: string;
  shopCategoryId: {
    _id: string;
    name: string;
    active: boolean;
  };
  address: string;
  contact?: string;
  currency: string;
  allowOnlineSelling: boolean;
  adminId: string;
  createAt: string;
  __v: number;
  subscription?: {
    packageId: {
      title: string;
      type: string;
    };
    status: boolean;
    endDate: string;
  };
}

export default function Shops() {
  const { admin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const getPrimaryShopId = () => {
    if (!admin?.primaryShop) return null;
    return extractId(admin.primaryShop) ?? null;
  };

  const primaryShopId = getPrimaryShopId();

  const { data: shopsResponse, isLoading, error } = useQuery({
    queryKey: ["shops", admin?._id],
    queryFn: async () => {
      if (!admin?._id) return [];
      const response = await apiCall(ENDPOINTS.shop.getAll, { method: "GET" });
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
    },
    enabled: !!admin?._id,
    retry: false,
  });

  const shops = Array.isArray(shopsResponse) ? shopsResponse : [];

  useEffect(() => {
    if (!isLoading && shopsResponse !== undefined && shops.length === 0) {
      setLocation("/shop-setup");
    }
  }, [isLoading, shopsResponse, shops.length, setLocation]);

  const filteredShops = shops.filter((shop: Shop) =>
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (shop.address ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <DashboardLayout title="My Shops">
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="My Shops">
        <div className="flex items-center justify-center h-40 text-sm text-gray-500">
          Failed to load shops. Please try again.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Shops">
      <div className="h-full bg-gray-50">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="bg-white border-b px-4 sm:px-6 py-3 space-y-2 sm:space-y-0">
          {/* Row 1: title + Add button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-900">My Shops</h1>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {shops.length}
              </span>
            </div>
            <Link href="/shop-setup">
              <Button
                size="sm"
                className="h-9 sm:h-8 bg-purple-600 hover:bg-purple-700 text-xs px-3 shrink-0"
              >
                <Plus className="w-4 h-4 mr-1 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Add Shop</span>
                <span className="xs:hidden">Add</span>
              </Button>
            </Link>
          </div>

          {/* Row 2: search — full-width on mobile, fixed-width on desktop */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm w-full"
            />
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-4">
          {filteredShops.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                {searchQuery ? "No shops found" : "No shops yet"}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Get started by creating your first shop"}
              </p>
              {!searchQuery && (
                <Link href="/shop-setup">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create First Shop
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredShops.map((shop: any) => {
                const shopId = shop.id ?? shop._id;
                const isPrimary =
                  String(admin?.primaryShop) === String(shopId) ||
                  String(primaryShopId) === String(shopId);
                return (
                  <div
                    key={shopId}
                    className="bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all duration-150 p-4 flex flex-col gap-3"
                  >
                    {/* Name + primary badge */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
                        {shop.name}
                      </p>
                      {isPrimary && (
                        <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 font-medium">
                          Primary
                        </Badge>
                      )}
                    </div>

                    {/* Address */}
                    {shop.address && (
                      <div className="flex items-start gap-1.5 text-gray-500">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="text-xs line-clamp-2 leading-relaxed">
                          {shop.address}
                        </span>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(shop.shopCategoryId?.name || shop.categoryName) && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                          {shop.shopCategoryId?.name ?? shop.categoryName}
                        </span>
                      )}
                      <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {shop.currency}
                      </span>
                      {shop.subscription && (
                        <span
                          className={`text-[10px] rounded-full px-2 py-0.5 ${
                            shop.subscription.status
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {shop.subscription.packageId?.title || "Plan"}
                        </span>
                      )}
                    </div>

                    {/* Actions — full-width touch-friendly buttons */}
                    <div className="flex gap-2 pt-1 border-t border-gray-100 mt-auto">
                      <Link href={`/shop/${shopId}`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </Link>
                      <Link href={`/shop/${shopId}/settings`} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Settings
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
