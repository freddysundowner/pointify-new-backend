import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Search, Check } from "lucide-react";
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
  const [categorySearch, setCategorySearch] = useState("");
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

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const selectedCategory = categories.find((c) => String(c.id) === category);

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

          {/* Step 2 — Business category */}
          {step === 2 && (
            <div className="w-full max-w-lg mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                What type of business is it?
              </h1>
              <p className="text-gray-400 text-sm mb-6">
                Pick the category that best describes <span className="font-medium text-gray-600">{name}</span>.
              </p>

              {/* Selected badge */}
              {selectedCategory && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm font-medium w-fit">
                  <Check className="w-4 h-4" />
                  {selectedCategory.name}
                </div>
              )}

              {/* Search input */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search categories…"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-gray-50"
                />
              </div>

              {/* Scrollable list */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {categoriesLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredCategories.length > 0 ? (
                  <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {filteredCategories.map((cat) => {
                      const isSelected = category === String(cat.id);
                      return (
                        <li key={cat.id}>
                          <button
                            onClick={() => setCategory(String(cat.id))}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                              isSelected
                                ? "bg-purple-50 text-purple-700 font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {cat.icon && <span>{cat.icon}</span>}
                              {cat.name}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-8 text-center text-sm text-gray-400">
                    No categories match "<span className="font-medium">{categorySearch}</span>"
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={() => setStep(3)}
                  disabled={!category}
                  className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-all text-lg"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setCategory(""); setCategorySearch(""); setStep(3); }}
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
