import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { apiRequest } from "@/lib/queryClient";
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

interface ShopCategory {
  id: number;
  name: string;
  icon?: string;
}

const TOTAL_STEPS = 3;

export default function ShopOnboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { admin, updateAdmin } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [placeDetails, setPlaceDetails] = useState<{ coordinates?: { lat: number; lng: number } } | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ShopCategory[]>({
    queryKey: [ENDPOINTS.shop.getCategories],
    queryFn: async () => {
      const res = await apiRequest("GET", ENDPOINTS.shop.getCategories);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    },
    staleTime: 5 * 60 * 1000,
  });

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
          categoryId: category || undefined,
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
          onClick={() => step > 1 && setStep(step - 1)}
          className={`flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors ${step === 1 ? "invisible" : ""}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
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
                What is your business name?
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

          {/* Step 2 — Business category (wider container) */}
          {step === 2 && (
            <div className="w-full max-w-2xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                What type of business is it?
              </h1>
              <p className="text-gray-400 text-sm mb-8">
                Pick the category that best describes <span className="font-medium text-gray-600">{name}</span>.
              </p>

              {categoriesLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : categories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(String(cat.id))}
                      className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                        category === String(cat.id)
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      {cat.icon && <span className="text-xl">{cat.icon}</span>}
                      <span className="text-sm font-medium leading-tight">{cat.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-6">No categories available</div>
              )}

              <div className="mt-10 flex items-center gap-4">
                <button
                  onClick={() => setStep(3)}
                  disabled={!category}
                  className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setCategory(""); setStep(3); }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Address + Currency */}
          {step === 3 && (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-8">
                Where is your business located?
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
                  {isLoading ? "Setting up…" : <> Create business <ArrowRight className="w-5 h-5" /> </>}
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
