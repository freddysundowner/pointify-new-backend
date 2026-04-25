import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, MapPin, Phone, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import GooglePlacesInput from "@/components/ui/google-places-input";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface ShopCategory {
  _id: string;
  name: string;
}

interface ShopFormProps {
  title: string;
  subtitle: string;
  submitButtonText: string;
  isAdditionalShop?: boolean;
  onSuccess?: () => void;
}

export default function ShopForm({ 
  title, 
  subtitle, 
  submitButtonText, 
  isAdditionalShop = false,
  onSuccess 
}: ShopFormProps) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    address: "",
    phone: "",
    email: "",
    currency: "KES",
    allowOnlineSelling: true,
  });
  const [placeDetails, setPlaceDetails] = useState<google.maps.places.PlaceResult | null>(null);

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

  const handleAddressChange = (address: string, details?: google.maps.places.PlaceResult) => {
    setFormData(prev => ({
      ...prev,
      address: address
    }));
    if (details) {
      setPlaceDetails(details);
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

      // Prepare shop data
      const shopData = {
        name: formData.name,
        categoryId: formData.category || undefined,
        address: formData.address,
        phone: formData.phone,
        currency: formData.currency,
        allowOnlineSelling: formData.allowOnlineSelling,
        locationLat: placeDetails?.geometry?.location
          ? placeDetails.geometry.location.lat()
          : undefined,
        locationLng: placeDetails?.geometry?.location
          ? placeDetails.geometry.location.lng()
          : undefined,
      };

      const shopResponse = await apiCall(ENDPOINTS.shop.create, {
        method: "POST",
        body: JSON.stringify(shopData),
      });
      const createdShop = await shopResponse.json();

      if (createdShop && createdShop.id) {
        // If this is the user's first shop, update their primary shop
        if (!isAdditionalShop && admin) {
          const updatedAdmin = { ...admin, primaryShop: createdShop.id };
          updateAdmin(updatedAdmin);
          
          // Update admin's primary shop in backend
          await apiCall(ENDPOINTS.auth.adminProfile, {
            method: "PUT",
            body: JSON.stringify({ primaryShop: createdShop.id }),
          });
        }

        // Invalidate shops query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["shops"] });
        
        toast({
          title: "Success",
          description: `Shop "${formData.name}" has been created successfully!`,
        });

        // Call onSuccess callback or navigate to dashboard
        if (onSuccess) {
          onSuccess();
        } else {
          setLocation("/dashboard");
        }
      }
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
    <div className="min-h-screen w-full">
      {/* Header Section */}
      <div className="bg-white border-b px-6 py-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {title}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Form Section */}
      <div className="p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-none space-y-6">
          {/* Row 1: Shop Name and Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Shop Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Mike's Electronics Store"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Business Category *</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger>
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

          {/* Row 2: Address (full width) */}
          <div className="space-y-2">
            <Label htmlFor="address">Shop Address *</Label>
            <GooglePlacesInput
              value={formData.address}
              onChange={handleAddressChange}
              placeholder="Start typing your shop address..."
              id="address"
              required
            />
          </div>

          {/* Row 3: Phone and Email */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+254 700 000 000"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="shop@example.com"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-6">
            <Button 
              type="submit" 
              disabled={isLoading || !formData.name || !formData.category || !formData.address}
              className="px-8 py-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Shop...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {submitButtonText}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}