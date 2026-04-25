import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import AddressInput from "@/components/ui/address-input";
import { queryClient } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { ArrowLeft } from "lucide-react";

interface ShopCategory {
  _id: string;
  name: string;
}

export default function ShopSetup() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();
  
  // Check if this is adding an additional shop or initial setup
  const isAdditionalShop = !!admin?.primaryShop;
  
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    address: "",
    currency: "KES",
    allowOnlineSelling: false,
  });
  const [placeDetails, setPlaceDetails] = useState<{
    address: string;
    placeId?: string;
    coordinates?: { lat: number; lng: number };
    name?: string;
    formatted_address?: string;
  } | null>(null);

  // Fetch shop categories from API
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: [ENDPOINTS.shop.getCategories],
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressChange = (address: string, placeDetails?: any) => {
    console.log('Address changed:', address, placeDetails);
    setFormData(prev => ({
      ...prev,
      address
    }));
    if (placeDetails && placeDetails.coordinates) {
      console.log('Place details with coordinates:', placeDetails);
      setPlaceDetails(placeDetails);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Basic validation
      if (!formData.name || !formData.category || !formData.address) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Prepare shop data with proper coordinate format
      const shopData = {
        name: formData.name,
        categoryId: formData.category || undefined,
        address: formData.address,
        currency: formData.currency,
        allowOnlineSelling: formData.allowOnlineSelling,
        ...(placeDetails?.coordinates && {
          latitude: placeDetails.coordinates.lat,
          longitude: placeDetails.coordinates.lng,
        }),
      };

      console.log('Submitting shop data:', shopData);

      const response = await apiCall(ENDPOINTS.shop.create, {
        method: "POST",
        body: JSON.stringify(shopData),
      });

      console.log('Shop creation response:', response);

      // The API call completed without throwing an error, meaning shop was created
      // Backend logs confirm successful creation with full shop details
      
      // Invalidate all shop-related queries to refresh everywhere
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      queryClient.invalidateQueries({ queryKey: ["shops", admin?._id] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getAll] });
      
      // Show success message
      toast({
        title: "Success",
        description: `Shop "${formData.name}" has been created successfully!`,
      });

      // Force navigation to shops page
      setTimeout(() => {
        setLocation("/shops");
      }, 500);
    } catch (error) {
      console.error("Error creating shop:", error);
      toast({
        title: "Error", 
        description: "Failed to create shop. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Shop Setup">
      <div className="h-full bg-gray-50 p-8">
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-8">
            <div className="mb-8 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <Link href="/shops">
                  <Button variant="ghost" size="sm" className="p-2">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {isAdditionalShop ? "Add New Shop" : "Setup Your First Shop"}
                  </h2>
                  <p className="text-gray-600 mt-2">
                    {isAdditionalShop 
                      ? "Expand your business by adding another shop location" 
                      : "Let's get your point of sale system ready for business"
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-base font-semibold text-gray-700">Shop Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter your shop name"
                    required
                    className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="category" className="text-base font-semibold text-gray-700">Business Type</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesLoading ? (
                        <SelectItem value="loading" disabled>Loading categories...</SelectItem>
                      ) : categories.length > 0 ? (
                        categories.map((category: ShopCategory) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-categories" disabled>No categories available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="address" className="text-base font-semibold text-gray-700">Location</Label>
                <AddressInput
                  value={formData.address}
                  onChange={handleAddressChange}
                  placeholder="Enter your shop location"
                  id="address"
                  required
                  className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="currency" className="text-base font-semibold text-gray-700">Currency</Label>
                  <Select value={formData.currency} onValueChange={(value) => handleInputChange("currency", value)}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div></div>
              </div>

              <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Label htmlFor="online-selling" className="text-base font-semibold text-gray-800">
                      Do you want your shop discovered online?
                    </Label>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                      When you allow this option, you will be able receive online orders from customers and your shop will be visible publicly on the website
                    </p>
                  </div>
                  <Switch
                    id="online-selling"
                    checked={formData.allowOnlineSelling}
                    onCheckedChange={(checked) => handleInputChange("allowOnlineSelling", checked)}
                    className="ml-6 mt-1"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isLoading || !formData.name || !formData.category || !formData.address}
                  className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Creating Shop...
                    </div>
                  ) : (
                    "Create Shop"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}