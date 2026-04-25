import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "GHS", label: "GHS — Ghanaian Cedi" },
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "UGX", label: "UGX — Ugandan Shilling" },
  { value: "TZS", label: "TZS — Tanzanian Shilling" },
];

const TOTAL_STEPS = 3;

export default function ShopOnboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
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

  const canAdvance = () => {
    if (step === 1) return formData.name.trim().length >= 2;
    if (step === 2) return formData.address.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address) {
      toast({ title: "Missing fields", description: "Please enter a shop name and address.", variant: "destructive" });
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
      const shopId = newShop?._id ?? newShop?.data?._id ?? newShop?.data?.id ?? newShop?.id;

      if (shopId && admin) {
        updateAdmin({ ...admin, primaryShop: shopId });
        try {
          await apiCall(ENDPOINTS.auth.adminProfile, {
            method: "PUT",
            body: JSON.stringify({ shop: shopId }),
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

  const firstName = admin?.username?.split(" ")[0] ?? admin?.email?.split("@")[0] ?? "";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={() => step > 1 && setStep((s) => s - 1)}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            step > 1 ? "text-gray-500 hover:text-gray-800" : "text-transparent pointer-events-none"
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i + 1 <= step ? "w-6 h-2 bg-purple-600" : "w-2 h-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <span className="text-sm text-gray-400">{step} / {TOTAL_STEPS}</span>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">

          {/* Logo mark */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full" />
            </div>
            <span className="text-sm font-semibold text-gray-500">Pointify</span>
          </div>

          {/* ── STEP 1: Shop name ── */}
          {step === 1 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 mb-3">Step 1 of {TOTAL_STEPS}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                What's your shop called{firstName ? `, ${firstName}` : ""}?
              </h1>
              <p className="text-gray-500 mb-8">This is the name your customers will see.</p>

              <input
                autoFocus
                type="text"
                placeholder="e.g. Mensah General Store"
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdvance() && setStep(2)}
                className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 bg-transparent transition-colors"
              />
            </>
          )}

          {/* ── STEP 2: Location ── */}
          {step === 2 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 mb-3">Step 2 of {TOTAL_STEPS}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Where is your shop located?</h1>
              <p className="text-gray-500 mb-8">Enter the physical address of <strong>{formData.name || "your shop"}</strong>.</p>

              <div className="w-full">
                <AddressInput
                  value={formData.address}
                  onChange={handleAddressChange}
                  placeholder="Start typing your address…"
                />
              </div>
            </>
          )}

          {/* ── STEP 3: Details ── */}
          {step === 3 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 mb-3">Step 3 of {TOTAL_STEPS}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Almost done!</h1>
              <p className="text-gray-500 mb-8">Just a few last details to set up your shop.</p>

              <div className="space-y-6">
                {/* Category */}
                {(categories as ShopCategory[]).length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Type of shop
                    </label>
                    <Select value={formData.category} onValueChange={(v) => set("category", v)}>
                      <SelectTrigger className="h-12 text-base border-0 border-b-2 border-gray-200 rounded-none focus:ring-0 shadow-none px-0">
                        <SelectValue placeholder="Select category…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories as ShopCategory[]).map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Currency */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    Currency
                  </label>
                  <Select value={formData.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger className="h-12 text-base border-0 border-b-2 border-gray-200 rounded-none focus:ring-0 shadow-none px-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Online selling */}
                <div className="flex items-center justify-between py-4 border-b-2 border-gray-200">
                  <div>
                    <p className="text-base font-medium text-gray-800">Enable online selling</p>
                    <p className="text-sm text-gray-400 mt-0.5">Let customers place orders online</p>
                  </div>
                  <Switch
                    checked={formData.allowOnlineSelling}
                    onCheckedChange={(v) => set("allowOnlineSelling", v)}
                  />
                </div>
              </div>
            </>
          )}

          {/* CTA */}
          <div className="mt-10">
            {step < TOTAL_STEPS ? (
              <button
                onClick={() => canAdvance() && setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold rounded-2xl transition-all text-lg"
              >
                {isLoading ? "Creating your shop…" : "Create shop"}
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            )}
          </div>

          {step === 3 && (
            <p className="mt-5 text-xs text-gray-400">
              You can always add more shops and update these details later.
            </p>
          )}
        </div>
      </div>

      <div className="text-center pb-6">
        <p className="text-xs text-gray-300">© 2025 Pointify. All rights reserved.</p>
      </div>
    </div>
  );
}
