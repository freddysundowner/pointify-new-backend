import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Store, ChevronRight } from "lucide-react";
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

const CURRENCIES = [
  { value: "GHS", label: "GHS — Ghanaian Cedi" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "UGX", label: "UGX — Ugandan Shilling" },
  { value: "TZS", label: "TZS — Tanzanian Shilling" },
];

export default function ShopOnboarding() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    address: "",
    currency: "GHS",
    allowOnlineSelling: false,
  });
  const [placeDetails, setPlaceDetails] = useState<{
    address: string;
    placeId?: string;
    coordinates?: { lat: number; lng: number };
  } | null>(null);

  const { data: categories = [] } = useQuery<ShopCategory[]>({
    queryKey: [ENDPOINTS.shop.getCategories],
  });

  const set = (field: string, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleAddressChange = (address: string, details?: any) => {
    set("address", address);
    if (details?.coordinates) setPlaceDetails(details);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) {
      toast({
        title: "Missing fields",
        description: "Please enter a shop name and address.",
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

      const response = await apiCall(ENDPOINTS.shop.create, {
        method: "POST",
        body: JSON.stringify(shopData),
      });
      const newShop = await response.json();

      if (newShop?._id && admin) {
        const updatedAdmin = { ...admin, primaryShop: newShop._id };
        updateAdmin(updatedAdmin);
        try {
          await apiCall(ENDPOINTS.auth.adminProfile, {
            method: "PUT",
            body: JSON.stringify({ shop: newShop._id }),
          });
        } catch {}
      }

      queryClient.invalidateQueries({ queryKey: ["shops"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });

      toast({ title: "Shop created!", description: "Taking you to your dashboard." });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Could not create shop",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
          <div className="w-3.5 h-3.5 bg-white rounded-full" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Pointify</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-8">
        <span className="text-purple-600 font-medium">Account created</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-gray-700">Set up your shop</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <Store className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {admin?.username ? `Welcome, ${admin.username.split(" ")[0]}!` : "One last step!"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Tell us about your shop and we'll get everything ready for you.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Shop name */}
          <div>
            <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Shop name <span className="text-red-400">*</span>
            </label>
            <input
              id="shopName"
              type="text"
              placeholder="e.g. Mensah General Store"
              value={formData.name}
              onChange={(e) => set("name", e.target.value)}
              required
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>

          {/* Category + Currency side by side */}
          <div className="grid grid-cols-2 gap-3">
            {(categories as ShopCategory[]).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Category
                </label>
                <Select value={formData.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger className="h-10 text-sm border-gray-300 focus:ring-purple-500">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories as ShopCategory[]).map((cat) => (
                      <SelectItem key={cat._id} value={cat._id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className={(categories as ShopCategory[]).length > 0 ? "" : "col-span-2"}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Currency
              </label>
              <Select value={formData.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger className="h-10 text-sm border-gray-300 focus:ring-purple-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Shop address <span className="text-red-400">*</span>
            </label>
            <AddressInput
              value={formData.address}
              onChange={handleAddressChange}
              placeholder="Start typing your address…"
              required
            />
          </div>

          {/* Online selling toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-800">Enable online selling</p>
              <p className="text-xs text-gray-500 mt-0.5">Let customers place orders online</p>
            </div>
            <Switch
              checked={formData.allowOnlineSelling}
              onCheckedChange={(v) => set("allowOnlineSelling", v)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition"
          >
            {isLoading ? "Creating your shop…" : "Create shop & go to dashboard"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          You can add more shops and edit these details later from settings.
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-8">© 2025 Pointify. All rights reserved.</p>
    </div>
  );
}
