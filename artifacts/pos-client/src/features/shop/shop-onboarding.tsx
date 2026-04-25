import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Store, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import AddressInput from "@/components/ui/address-input";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface ShopCategory {
  _id: string;
  name: string;
}

export default function ShopOnboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdShop, setCreatedShop] = useState(null);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();
  
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
    
    if (!formData.name || !formData.address) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
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
      
      const newShop = await response.json();
      console.log('Shop creation response:', newShop);

      // Update admin with new primary shop
      if (newShop && newShop._id && admin) {
        const updatedAdmin = { ...admin, primaryShop: newShop._id };
        updateAdmin(updatedAdmin);
        
        // Update primary shop on server
        try {
          const updateResponse = await apiCall(ENDPOINTS.auth.adminProfile, {
            method: "PUT",
            body: JSON.stringify({ shop: newShop._id }),
          });
          
          if (updateResponse.ok) {
            console.log('Admin updated with primary shop');
          }
        } catch (updateError) {
          console.error('Failed to update admin primaryShop:', updateError);
          // Don't fail the whole process if admin update fails
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });

      toast({
        title: "Shop Created",
        description: "Your primary shop has been created successfully!",
        variant: "default",
      });

      // Navigate to dashboard after successful creation
      setLocation('/dashboard');

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Pointify</h1>
          <p className="text-gray-600">Let's set up your first shop to get started</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Create Shop</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-purple-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step >= 2 ? <CheckCircle className="w-4 h-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto">
          {step === 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Set Up Your Primary Shop</CardTitle>
                <CardDescription>
                  This will be your main shop and primary business location. You can add more shops later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Shop Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Shop Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter your shop name"
                      required
                    />
                  </div>

                  {/* Category */}
                  {categories?.length > 0 ? <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((category: ShopCategory) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div> : <> </>}

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <AddressInput
                      id="address"
                      value={formData.address}
                      onChange={handleAddressChange}
                      placeholder="Enter your shop address"
                      required
                    />
                  </div>

                  {/* Currency */}
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => handleInputChange('currency', value)}>
                      <SelectTrigger>
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

                  {/* Allow Online Selling */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowOnlineSelling"
                      checked={formData.allowOnlineSelling}
                      onCheckedChange={(checked) => handleInputChange('allowOnlineSelling', checked)}
                    />
                    <Label htmlFor="allowOnlineSelling">Allow online selling</Label>
                  </div>

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    className="w-full bg-purple-600 hover:bg-purple-700" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating Shop...' : 'Create Primary Shop'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center">
              <CardContent className="pt-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
                <p className="text-gray-600 mb-6">
                  Your shop is ready and your data has been synced. You'll be redirected to your dashboard in a moment.
                </p>
                <Button onClick={() => setLocation('/dashboard')} className="bg-purple-600 hover:bg-purple-700">
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}