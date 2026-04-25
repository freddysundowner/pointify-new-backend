import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import AddressInput from "@/components/ui/address-input";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

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

export default function ShopOnboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [placeDetails, setPlaceDetails] = useState<{ coordinates?: { lat: number; lng: number } } | null>(null);

  const handleAddressChange = (val: string, details?: any) => {
    setAddress(val);
    if (details?.coordinates) setPlaceDetails(details);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await apiCall(ENDPOINTS.shop.create, {
        method: "POST",
        body: JSON.stringify({
          name,
          address,
          currency,
          ...(placeDetails?.coordinates && {
            latitude: placeDetails.coordinates.lat,
            longitude: placeDetails.coordinates.lng,
          }),
        }),
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={() => step > 1 && setStep(1)}
          className={`flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors ${step === 1 ? "invisible" : ""}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {[1, 2].map((s) => (
            <div key={s} className={`rounded-full transition-all duration-300 ${s <= step ? "w-6 h-2 bg-purple-600" : "w-2 h-2 bg-gray-200"}`} />
          ))}
        </div>

        <span className="text-sm text-gray-400 w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">

          {/* Step 1 — Shop name */}
          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">
                What's your shop called?
              </h1>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Mensah General Store"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && setStep(2)}
                className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-purple-500 outline-none pb-3 placeholder-gray-300 bg-transparent transition-colors"
              />
              <div className="mt-10">
                <button
                  onClick={() => setStep(2)}
                  disabled={name.trim().length < 2}
                  className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </>
          )}

          {/* Step 2 — Address + Currency */}
          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">
                Where is your shop located?
              </h1>

              <div className="space-y-8">
                <AddressInput
                  value={address}
                  onChange={handleAddressChange}
                  placeholder="Start typing your address…"
                />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Currency
                  </label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-12 text-base border-0 border-b-2 border-gray-200 rounded-none focus:ring-0 shadow-none px-0 focus:border-purple-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !address.trim()}
                  className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
                >
                  {isLoading ? "Setting up…" : <> Create shop <ArrowRight className="w-5 h-5" /> </>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-300 pb-6">© 2025 Pointify. All rights reserved.</p>
    </div>
  );
}
