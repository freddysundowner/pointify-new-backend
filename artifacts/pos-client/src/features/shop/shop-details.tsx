import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ArrowLeft, Trash2, Store, Receipt, Settings2, Shield, Save, Star, ChevronsUpDown, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Link } from "wouter";
import AlertModal from "@/components/ui/alert-modal";
import GooglePlacesInput from "@/components/ui/google-places-input";

export default function ShopDetails() {
  const { id } = useParams();
  const { admin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: "warning" | "danger" | "input";
    title: string;
    description: string;
    confirmText?: string;
    inputPlaceholder?: string;
    requiredInput?: string;
    onConfirm: (inputValue?: string) => void;
  }>({
    isOpen: false,
    type: "warning",
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    type: "data" | "shop";
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    // General
    name: "",
    categoryId: "",
    address: "",
    currency: "KES",
    taxRate: 0,

    // Receipt
    receiptEmail: "",
    phone: "",                   // API field: phone → DB column: contact
    paybillTill: "",
    paybillAccount: "",
    receiptAddress: "",
    receiptFooter: "",
    receiptShowTax: true,
    receiptShowDiscount: true,

    // Operations
    allowNegativeSelling: false,
    trackBatches: false,
    isWarehouse: false,          // API field: isWarehouse (was useWarehouse — bug fixed)
    allowOnlineSelling: true,
    showStockOnline: false,
    showPriceOnline: false,

    // Backup
    allowBackup: true,
    backupInterval: "end_of_month",
    backupEmail: "",

    // Loyalty
    loyaltyEnabled: false,
    loyaltyRedemptionEnabled: false,
    pointsPerAmount: "0",
    pointsValue: "0",

    // Location
    locationLat: undefined as number | undefined,
    locationLng: undefined as number | undefined,
  });

  const set = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleAddressChange = (address: string, place?: google.maps.places.PlaceResult) => {
    setFormData(prev => ({
      ...prev,
      address,
      locationLat: place?.geometry?.location ? place.geometry.location.lat() : prev.locationLat,
      locationLng: place?.geometry?.location ? place.geometry.location.lng() : prev.locationLng,
    }));
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.shop.getCategories, { method: "GET" });
      const data = await response.json();
      return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    },
  });

  const selectedCategory = (categories as any[]).find(
    (c: any) => String(c.id ?? c._id) === formData.categoryId
  );

  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiCall(ENDPOINTS.shop.getById(id), { method: "GET" });
      const json = await response.json();
      return json?.data ?? json;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!shop) return;
    setFormData({
      // General
      name: shop.name || "",
      // API GET returns `category` (integer), not `categoryId`
      categoryId: shop.category != null ? String(shop.category) : "",
      address: shop.address || "",
      currency: shop.currency || "KES",
      taxRate: parseFloat(shop.taxRate ?? shop.tax ?? "0") || 0,

      // Receipt — DB column is `contact`, API GET returns `contact`
      receiptEmail: shop.receiptEmail || "",
      phone: shop.contact || "",
      paybillTill: shop.paybillTill || "",
      paybillAccount: shop.paybillAccount || "",
      receiptAddress: shop.receiptAddress || "",
      receiptFooter: shop.receiptFooter || "",
      receiptShowTax: shop.receiptShowTax ?? true,
      receiptShowDiscount: shop.receiptShowDiscount ?? true,

      // Operations — API GET returns `isWarehouse`, not `useWarehouse`
      allowNegativeSelling: shop.allowNegativeSelling ?? false,
      trackBatches: shop.trackBatches ?? false,
      isWarehouse: shop.isWarehouse ?? false,
      allowOnlineSelling: shop.allowOnlineSelling ?? true,
      showStockOnline: shop.showStockOnline ?? false,
      showPriceOnline: shop.showPriceOnline ?? false,

      // Backup
      allowBackup: shop.allowBackup ?? true,
      backupInterval: shop.backupInterval || "end_of_month",
      backupEmail: shop.backupEmail || "",

      // Loyalty
      loyaltyEnabled: shop.loyaltyEnabled ?? false,
      loyaltyRedemptionEnabled: shop.loyaltyRedemptionEnabled ?? false,
      pointsPerAmount: shop.pointsPerAmount ?? "0",
      pointsValue: shop.pointsValue ?? "0",

      // Location
      locationLat: shop.locationLat ?? undefined,
      locationLng: shop.locationLng ?? undefined,
    });
  }, [shop]);

  const updateShopMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiCall(ENDPOINTS.shop.getById(id), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop", id] });
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast({ title: "Shop Updated", description: "Settings saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateShopMutation.mutate({
      // General
      name: formData.name,
      categoryId: formData.categoryId || undefined,
      address: formData.address,
      currency: formData.currency,
      taxRate: formData.taxRate,

      // Receipt — API PUT reads `phone` for the contact field
      receiptEmail: formData.receiptEmail,
      phone: formData.phone,
      paybillTill: formData.paybillTill,
      paybillAccount: formData.paybillAccount,
      receiptAddress: formData.receiptAddress,
      receiptFooter: formData.receiptFooter,
      receiptShowTax: formData.receiptShowTax,
      receiptShowDiscount: formData.receiptShowDiscount,

      // Operations — API PUT reads `isWarehouse`
      allowNegativeSelling: formData.allowNegativeSelling,
      trackBatches: formData.trackBatches,
      isWarehouse: formData.isWarehouse,
      allowOnlineSelling: formData.allowOnlineSelling,
      showStockOnline: formData.showStockOnline,
      showPriceOnline: formData.showPriceOnline,

      // Backup
      allowBackup: formData.allowBackup,
      backupInterval: formData.backupInterval,
      backupEmail: formData.backupEmail,

      // Loyalty
      loyaltyEnabled: formData.loyaltyEnabled,
      loyaltyRedemptionEnabled: formData.loyaltyRedemptionEnabled,
      pointsPerAmount: formData.pointsPerAmount,
      pointsValue: formData.pointsValue,

      // Location
      locationLat: formData.locationLat,
      locationLng: formData.locationLng,
    });
  };

  const handleDeleteShopData = () => {
    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Shop Data",
      description: "Permanently removes all products, sales, purchases, customers, expenses and loyalty data for this shop. The shop itself stays intact. Type 'DELETE' to confirm.",
      confirmText: "Delete All Data",
      requiredInput: "DELETE",
      inputPlaceholder: "Type DELETE to confirm",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await apiCall(ENDPOINTS.shop.getData(id), { method: "DELETE" });
          queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getById(id!)] });
          setDeleteResult({ type: "data", success: true, message: "All products, sales, purchases, customers, expenses and loyalty data have been permanently cleared." });
        } catch {
          setDeleteResult({ type: "data", success: false, message: "Something went wrong while deleting shop data. Please try again." });
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteShop = () => {
    if (String(admin?.primaryShop) === String(id)) {
      setDeleteResult({ type: "shop", success: false, message: "This is your primary shop. Set another shop as primary before deleting this one." });
      return;
    }
    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Entire Shop",
      description: "Permanently deletes this shop and ALL associated data. Type 'DELETE SHOP' to confirm.",
      confirmText: "Delete Shop",
      requiredInput: "DELETE SHOP",
      inputPlaceholder: "Type DELETE SHOP to confirm",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await apiCall(ENDPOINTS.shop.getById(id), { method: "DELETE" });
          queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getAll] });
          setDeleteResult({ type: "shop", success: true, message: "The shop and all its data have been permanently deleted." });
        } catch {
          setDeleteResult({ type: "shop", success: false, message: "Something went wrong while deleting the shop. Please try again." });
          setIsDeleting(false);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading shop…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!shop) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Shop Not Found</h3>
            <Link href="/shops"><Button>Back to Shops</Button></Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full bg-gray-50">

        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/shops">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{shop.name}</h1>
                <p className="text-xs text-gray-500">Shop settings</p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={updateShopMutation.isPending}
              className="shrink-0 bg-purple-600 hover:bg-purple-700 gap-2 h-9 px-3 sm:px-4"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">
                {updateShopMutation.isPending ? "Saving…" : "Save Changes"}
              </span>
              <span className="sm:hidden">
                {updateShopMutation.isPending ? "…" : "Save"}
              </span>
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <Tabs defaultValue="general">
            {/* Scrollable tab bar on mobile */}
            <div className="overflow-x-auto pb-1 mb-5 -mx-1 px-1">
              <TabsList className="bg-white border shadow-sm w-max sm:w-full justify-start h-auto p-1 gap-1 rounded-lg flex-nowrap sm:flex-wrap">
                <TabsTrigger value="general" className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded whitespace-nowrap text-xs sm:text-sm">
                  <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> General
                </TabsTrigger>
                <TabsTrigger value="receipt" className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded whitespace-nowrap text-xs sm:text-sm">
                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Receipt
                </TabsTrigger>
                <TabsTrigger value="operations" className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded whitespace-nowrap text-xs sm:text-sm">
                  <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Operations
                </TabsTrigger>
                <TabsTrigger value="loyalty" className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded whitespace-nowrap text-xs sm:text-sm">
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Loyalty
                </TabsTrigger>
                <TabsTrigger value="backup" className="gap-1.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded whitespace-nowrap text-xs sm:text-sm">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Backup
                </TabsTrigger>
                <TabsTrigger value="danger" className="gap-1.5 data-[state=active]:bg-red-600 data-[state=active]:text-white rounded text-red-600 whitespace-nowrap text-xs sm:text-sm">
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Danger
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── GENERAL ── */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Shop Information</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Shop Name</Label>
                      <Input
                        placeholder="Your shop name"
                        value={formData.name}
                        onChange={e => set("name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Business Category</Label>
                      <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={categoryOpen}
                            className={cn(
                              "w-full h-9 justify-between font-normal",
                              !selectedCategory && "text-gray-400"
                            )}
                          >
                            <span className="truncate">
                              {selectedCategory
                                ? `${selectedCategory.icon ? selectedCategory.icon + " " : ""}${selectedCategory.name}`
                                : "Search business type…"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search business type…" className="h-9" />
                            <CommandList className="max-h-56">
                              <CommandEmpty>No matching category found.</CommandEmpty>
                              <CommandGroup>
                                {(categories as any[]).map((cat: any) => {
                                  const catId = String(cat.id ?? cat._id);
                                  return (
                                    <CommandItem
                                      key={catId}
                                      value={`${cat.icon ?? ""} ${cat.name}`}
                                      onSelect={() => {
                                        set("categoryId", catId);
                                        setCategoryOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          formData.categoryId === catId ? "opacity-100 text-purple-600" : "opacity-0"
                                        )}
                                      />
                                      {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Address</Label>
                      <GooglePlacesInput
                        placeholder="Start typing your shop address..."
                        value={formData.address}
                        onChange={handleAddressChange}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Financial</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Select value={formData.currency} onValueChange={v => set("currency", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                          <SelectItem value="USD">USD — US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR — Euro</SelectItem>
                          <SelectItem value="GBP">GBP — British Pound</SelectItem>
                          <SelectItem value="UGX">UGX — Ugandan Shilling</SelectItem>
                          <SelectItem value="TZS">TZS — Tanzanian Shilling</SelectItem>
                          <SelectItem value="ZAR">ZAR — South African Rand</SelectItem>
                          <SelectItem value="NGN">NGN — Nigerian Naira</SelectItem>
                          <SelectItem value="GHS">GHS — Ghanaian Cedi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={formData.taxRate}
                        onChange={e => set("taxRate", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── RECEIPT ── */}
            <TabsContent value="receipt" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Contact & Payment Details</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Receipt Email</Label>
                      <Input
                        type="email"
                        placeholder="email@yourshop.com"
                        value={formData.receiptEmail}
                        onChange={e => set("receiptEmail", e.target.value)}
                      />
                      <p className="text-xs text-gray-400">Shown on printed receipts</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contact / Phone</Label>
                      <Input
                        placeholder="+254 7xx xxx xxx"
                        value={formData.phone}
                        onChange={e => set("phone", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Receipt Address</Label>
                      <Input
                        placeholder="Address shown on receipts"
                        value={formData.receiptAddress}
                        onChange={e => set("receiptAddress", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Receipt Footer</Label>
                      <Input
                        placeholder="e.g. Thank you for shopping with us!"
                        value={formData.receiptFooter}
                        onChange={e => set("receiptFooter", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>M-Pesa Paybill / Till</Label>
                      <Input
                        placeholder="e.g. 522522 or 0123456"
                        value={formData.paybillTill}
                        onChange={e => set("paybillTill", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Paybill Account</Label>
                      <Input
                        placeholder="Account number"
                        value={formData.paybillAccount}
                        onChange={e => set("paybillAccount", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Receipt Display Options</CardTitle></CardHeader>
                <CardContent className="divide-y">
                  <div className="flex items-center justify-between py-4 first:pt-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Show Tax on Receipt</p>
                      <p className="text-xs text-gray-400 mt-0.5">Display the tax line on printed and digital receipts</p>
                    </div>
                    <Switch
                      checked={formData.receiptShowTax}
                      onCheckedChange={v => set("receiptShowTax", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-4 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Show Discount on Receipt</p>
                      <p className="text-xs text-gray-400 mt-0.5">Display the discount line on printed and digital receipts</p>
                    </div>
                    <Switch
                      checked={formData.receiptShowDiscount}
                      onCheckedChange={v => set("receiptShowDiscount", v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── OPERATIONS ── */}
            <TabsContent value="operations" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Operational Settings</CardTitle></CardHeader>
                <CardContent className="divide-y">
                  {[
                    { key: "allowNegativeSelling", label: "Negative Selling", desc: "Allow sales even when stock is at zero" },
                    { key: "trackBatches",          label: "Batch Tracking",    desc: "Track product batches and expiry dates" },
                    { key: "isWarehouse",            label: "Warehouse Mode",    desc: "Enable warehouse-based inventory management" },
                    { key: "allowOnlineSelling",     label: "Online Selling",    desc: "List products on your online storefront" },
                    { key: "showStockOnline",        label: "Show Stock Online", desc: "Display available quantity to online customers" },
                    { key: "showPriceOnline",        label: "Show Prices Online",desc: "Display product prices on your online store" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Switch
                        checked={formData[key as keyof typeof formData] as boolean}
                        onCheckedChange={v => set(key as keyof typeof formData, v as any)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── LOYALTY ── */}
            <TabsContent value="loyalty" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Loyalty Programme</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Enable Loyalty Programme</p>
                      <p className="text-xs text-gray-400 mt-0.5">Reward customers with points on every purchase</p>
                    </div>
                    <Switch
                      checked={formData.loyaltyEnabled}
                      onCheckedChange={v => set("loyaltyEnabled", v)}
                    />
                  </div>

                  <div className={`space-y-5 transition-opacity ${formData.loyaltyEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label>Spend Threshold per Point</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 10"
                          value={formData.pointsPerAmount}
                          onChange={e => set("pointsPerAmount", e.target.value)}
                        />
                        <p className="text-xs text-gray-400">Amount spent to earn 1 loyalty point (e.g. 10 = 1 point per KES 10)</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Point Value</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 0.01"
                          value={formData.pointsValue}
                          onChange={e => set("pointsValue", e.target.value)}
                        />
                        <p className="text-xs text-gray-400">Cash value of 1 loyalty point</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Allow Point Redemption at Checkout</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          When off, points keep accumulating but cannot be used at the POS
                        </p>
                      </div>
                      <Switch
                        checked={formData.loyaltyRedemptionEnabled}
                        onCheckedChange={v => set("loyaltyRedemptionEnabled", v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── BACKUP ── */}
            <TabsContent value="backup" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Backup Settings</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Auto Backup</p>
                      <p className="text-xs text-gray-400 mt-0.5">Automatically email shop data backups on schedule</p>
                    </div>
                    <Switch
                      checked={formData.allowBackup}
                      onCheckedChange={v => set("allowBackup", v)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Backup Frequency</Label>
                      <Select value={formData.backupInterval} onValueChange={v => set("backupInterval", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="end_of_month">Monthly (end of month)</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Backup Email</Label>
                      <Input
                        type="email"
                        placeholder="backup@yourshop.com"
                        value={formData.backupEmail}
                        onChange={e => set("backupEmail", e.target.value)}
                      />
                      <p className="text-xs text-gray-400">Leave blank to use your admin email</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── DANGER ── */}
            <TabsContent value="danger" className="space-y-4">
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                    <div>
                      <p className="text-sm font-medium text-red-800">Delete Shop Data</p>
                      <p className="text-xs text-red-600 mt-1">
                        Permanently delete all products, transactions and sales. The shop itself remains.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto shrink-0 border-red-300 text-red-700 hover:bg-red-100 h-9"
                      onClick={handleDeleteShopData}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete Data
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 rounded-lg bg-red-100 border border-red-300">
                    <div>
                      <p className="text-sm font-medium text-red-900">Delete Entire Shop</p>
                      <p className="text-xs text-red-700 mt-1">
                        Permanently delete this shop and everything linked to it. This cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full sm:w-auto shrink-0 h-9"
                      onClick={handleDeleteShop}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete Shop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertModal.onConfirm}
        title={alertModal.title}
        description={alertModal.description}
        type={alertModal.type}
        confirmText={alertModal.confirmText}
        inputPlaceholder={alertModal.inputPlaceholder}
        requiredInput={alertModal.requiredInput}
      />

      {/* ── Full-screen loading overlay shown while deletion is in progress ── */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white shadow-xl border border-gray-100 max-w-xs w-full mx-4 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-red-200 border-t-red-600 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Deleting…</p>
              <p className="text-xs text-gray-500 mt-1">
                Sending backup email then clearing data. This may take a moment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Result dialog shown after deletion completes ── */}
      <Dialog
        open={deleteResult !== null}
        onOpenChange={(open) => {
          if (!open) {
            const wasShopDeleted = deleteResult?.type === "shop" && deleteResult.success;
            setDeleteResult(null);
            if (wasShopDeleted) setLocation("/shops");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
              deleteResult?.success ? "bg-green-100" : "bg-red-100"
            }`}>
              {deleteResult?.success ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <Trash2 className="w-6 h-6 text-red-600" />
              )}
            </div>
            <DialogTitle className="text-center">
              {deleteResult?.success
                ? deleteResult.type === "shop" ? "Shop Deleted" : "Data Cleared"
                : "Could Not Delete"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {deleteResult?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              className={deleteResult?.success ? "bg-gray-900 hover:bg-gray-800" : "bg-red-600 hover:bg-red-700"}
              onClick={() => {
                const wasShopDeleted = deleteResult?.type === "shop" && deleteResult.success;
                setDeleteResult(null);
                if (wasShopDeleted) setLocation("/shops");
              }}
            >
              {deleteResult?.type === "shop" && deleteResult?.success ? "Back to Shops" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
