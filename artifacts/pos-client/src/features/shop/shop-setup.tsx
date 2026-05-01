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
import { apiRequest } from "@/lib/queryClient";
import { ENDPOINTS } from "@/lib/api-endpoints";
import AddressInput from "@/components/ui/address-input";
import { queryClient } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { ArrowLeft, Store, Globe } from "lucide-react";

interface ShopCategory {
  id: number;
  name: string;
  icon?: string;
}

export default function ShopSetup() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { admin } = useAuth();
  const { toast } = useToast();

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
  } | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ShopCategory[]>({
    queryKey: [ENDPOINTS.shop.getCategories],
    queryFn: async () => {
      const res = await apiRequest("GET", ENDPOINTS.shop.getCategories);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleAddressChange = (address: string, details?: any) => {
    setFormData(prev => ({ ...prev, address }));
    if (details?.coordinates) setPlaceDetails(details);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.address) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
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

      await apiCall(ENDPOINTS.shop.create, {
        method: "POST",
        body: JSON.stringify(shopData),
      });

      queryClient.invalidateQueries({ queryKey: ["shops"] });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getAll] });

      toast({
        title: "Shop created",
        description: `"${formData.name}" is ready to use`,
      });
      setTimeout(() => setLocation("/shops"), 400);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shop. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = !isLoading && formData.name && formData.category && formData.address;

  return (
    <DashboardLayout title="Shop Setup">
      <div className="min-h-full bg-gray-50">

        {/* ── Sticky mobile-friendly header ──────────────────────────────────── */}
        <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/shops">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Store className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 leading-tight truncate">
                {isAdditionalShop ? "Add New Shop" : "Setup Your First Shop"}
              </h1>
              <p className="text-xs text-gray-500 truncate">
                {isAdditionalShop
                  ? "Add another location to your business"
                  : "Get your point of sale ready"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 py-5 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Shop Name */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Shop Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Branch"
                className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500/20 text-base"
                required
              />
            </div>

            {/* Business Type */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Business Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500/20">
                  <SelectValue
                    placeholder={categoriesLoading ? "Loading…" : "Select a category"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {categoriesLoading ? (
                    <SelectItem value="__loading" disabled>Loading categories…</SelectItem>
                  ) : categories.length > 0 ? (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none" disabled>No categories available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Location <span className="text-red-500">*</span>
              </Label>
              <AddressInput
                value={formData.address}
                onChange={handleAddressChange}
                placeholder="Enter shop address"
                className="h-11"
                required
              />
            </div>

            {/* Currency */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Currency
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => setFormData(p => ({ ...p, currency: v }))}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                  <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                  <SelectItem value="GHS">GHS — Ghanaian Cedi</SelectItem>
                  <SelectItem value="ZAR">ZAR — South African Rand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Online discovery toggle */}
            <div className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-purple-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Online discovery</p>
                  <p className="text-xs text-gray-500 mt-0.5">Appear in public shop listings</p>
                </div>
              </div>
              <Switch
                checked={formData.allowOnlineSelling}
                onCheckedChange={(v) => setFormData(p => ({ ...p, allowOnlineSelling: v }))}
              />
            </div>

            {formData.allowOnlineSelling && (
              <p className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100 -mt-2">
                Your shop will be publicly visible and able to receive online orders from customers.
              </p>
            )}

            {/* Submit — full-width on mobile */}
            <div className="pt-2 pb-safe">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-sm font-semibold px-8 h-11"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  isAdditionalShop ? "Add Shop" : "Create Shop"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
