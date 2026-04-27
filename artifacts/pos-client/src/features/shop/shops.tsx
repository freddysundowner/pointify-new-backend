import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { extractId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Store, Plus, Search, Edit, Eye } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Link } from "wouter";

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

  // Get primary shop ID from admin data (could be string or object)
  const getPrimaryShopId = () => {
    if (!admin?.primaryShop) return null;
    return extractId(admin.primaryShop) ?? null;
  };

  const primaryShopId = getPrimaryShopId();

  // Fetch shops
  const { data: shopsResponse, isLoading, error } = useQuery({
    queryKey: ["shops", admin?._id],
    queryFn: async () => {
      if (!admin?._id) return [];
      const response = await apiCall(ENDPOINTS.shop.getAll, {
        method: "GET",
      });
      const data = await response.json();
      console.log("Shops API Response:", data);
      return Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
    },
    enabled: !!admin?._id,
    retry: false,
  });

  const shops = Array.isArray(shopsResponse) ? shopsResponse : [];
  console.log("Processed shops:", shops, "Length:", shops.length);

  // Filter shops based on search query
  const filteredShops = shops.filter((shop: Shop) =>
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <DashboardLayout title="My Shops">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600">Loading shops...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="My Shops">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Shops</h3>
            <p className="text-gray-600">Failed to load your shops. Please try again.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Shops">
      <div className="h-full bg-gray-50">
        {/* Header Section */}
        <div className="bg-white border-b shadow-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Shops</h1>
                <p className="text-lg text-gray-600 mt-2">
                  Manage all your shop locations and settings
                </p>
              </div>
              <Link href="/shop-setup">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Shop
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-8 py-8">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Shops Grid */}
          {filteredShops.length === 0 ? (
            <div className="text-center py-16">
              <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? "No shops found" : "No shops yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : "Get started by creating your first shop"
                }
              </p>
              {!searchQuery && (
                <Link href="/shop-setup">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Shop
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.map((shop: Shop) => (
                <Card key={shop._id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                          {shop.name}
                        </CardTitle>
                        <CardDescription className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                          {shop.address}
                        </CardDescription>
                      </div>
                      {admin?.primaryShop === shop._id && (
                        <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="py-3">
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Category:</span> {shop.shopCategoryId?.name || 'N/A'}
                      </div>
                      {shop.contact && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Contact:</span> {shop.contact}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Currency:</span> {shop.currency}
                      </div>
                      {shop.subscription && (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={shop.subscription.status ? "default" : "secondary"}
                            className={shop.subscription.status ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                          >
                            {shop.subscription.packageId?.title || 'Unknown Plan'}
                          </Badge>
                        </div>
                      )}

                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 flex gap-2">
                    <Link href={`/shop/${shop._id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/shop/${shop._id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Summary Stats */}
          {filteredShops.length > 0 && (
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Shops</p>
                    <p className="text-2xl font-bold text-gray-900">{shops.length}</p>
                  </div>
                  <Store className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Primary Shop</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {shops.find((shop: Shop) => shop._id === primaryShopId)?.name || "None"}
                    </p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">
                    Primary
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}