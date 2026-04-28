import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Trash2, Store, Receipt, Settings2, Shield, Save, Star,
} from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Link } from "wouter";
import AlertModal from "@/components/ui/alert-modal";

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
    warehouseEmail: "",

    // Loyalty
    loyaltyEnabled: false,
    pointsPerAmount: "0",
    pointsValue: "0",
  });

  const set = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.shop.getCategories, { method: "GET" });
      const data = await response.json();
      return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    },
  });

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
      warehouseEmail: shop.warehouseEmail || "",

      // Loyalty
      loyaltyEnabled: shop.loyaltyEnabled ?? false,
      pointsPerAmount: shop.pointsPerAmount ?? "0",
      pointsValue: shop.pointsValue ?? "0",
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
      warehouseEmail: formData.warehouseEmail,

      // Loyalty
      loyaltyEnabled: formData.loyaltyEnabled,
      pointsPerAmount: formData.pointsPerAmount,
      pointsValue: formData.pointsValue,
    });
  };

  const handleDeleteShopData = () => {
    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Shop Data",
      description: "Permanently removes all products, transactions and sales for this shop. Type 'DELETE' to confirm.",
      confirmText: "Delete Data",
      requiredInput: "DELETE",
      inputPlaceholder: "Type DELETE to confirm",
      onConfirm: () => {
        apiCall(ENDPOINTS.shop.getData(id), { method: "DELETE" })
          .then(() => toast({ title: "Shop data deleted", description: "All data permanently removed." }))
          .catch(() => toast({ title: "Error", description: "Failed to delete shop data.", variant: "destructive" }));
      },
    });
  };

  const handleDeleteShop = () => {
    if (String(admin?.primaryShop) === String(id)) {
      toast({ title: "Cannot Delete Primary Shop", description: "Set another shop as primary first.", variant: "destructive" });
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
      onConfirm: () => {
        apiCall(ENDPOINTS.shop.getById(id), { method: "DELETE" })
          .then(() => {
            toast({ title: "Shop deleted", description: "The shop has been permanently deleted." });
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getAll] });
              setLocation("/");
            }, 1000);
          })
          .catch(() => toast({ title: "Error", description: "Failed to delete shop.", variant: "destructive" }));
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
          <div className="px-6 py-4 flex items-center justify-between gap-4">
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
              className="shrink-0 bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {updateShopMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8">
          <Tabs defaultValue="general">
            <TabsList className="mb-6 bg-white border shadow-sm w-full justify-start h-auto p-1 gap-1 rounded-lg">
              <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <Store className="w-4 h-4" /> General
              </TabsTrigger>
              <TabsTrigger value="receipt" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <Receipt className="w-4 h-4" /> Receipt
              </TabsTrigger>
              <TabsTrigger value="operations" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <Settings2 className="w-4 h-4" /> Operations
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <Star className="w-4 h-4" /> Loyalty
              </TabsTrigger>
              <TabsTrigger value="backup" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <Shield className="w-4 h-4" /> Backup
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-2 data-[state=active]:bg-red-600 data-[state=active]:text-white rounded text-red-600">
                <Trash2 className="w-4 h-4" /> Danger
              </TabsTrigger>
            </TabsList>

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
                      <Select value={formData.categoryId} onValueChange={v => set("categoryId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {(categories as any[]).map((cat: any) => {
                            const catId = String(cat.id ?? cat._id);
                            return <SelectItem key={catId} value={catId}>{cat.name}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Address</Label>
                      <Input
                        placeholder="Physical address"
                        value={formData.address}
                        onChange={e => set("address", e.target.value)}
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

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-5 transition-opacity ${formData.loyaltyEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                    <div className="space-y-1.5">
                      <Label>Points per Amount Spent</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 1"
                        value={formData.pointsPerAmount}
                        onChange={e => set("pointsPerAmount", e.target.value)}
                      />
                      <p className="text-xs text-gray-400">Points earned per 1 unit of currency spent</p>
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
                    <div className="space-y-1.5">
                      <Label>Warehouse Email</Label>
                      <Input
                        type="email"
                        placeholder="warehouse@yourshop.com"
                        value={formData.warehouseEmail}
                        onChange={e => set("warehouseEmail", e.target.value)}
                      />
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
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-red-50 border border-red-200">
                    <div>
                      <p className="text-sm font-medium text-red-800">Delete Shop Data</p>
                      <p className="text-xs text-red-600 mt-1">
                        Permanently delete all products, transactions and sales. The shop itself remains.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
                      onClick={handleDeleteShopData}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete Data
                    </Button>
                  </div>

                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-red-100 border border-red-300">
                    <div>
                      <p className="text-sm font-medium text-red-900">Delete Entire Shop</p>
                      <p className="text-xs text-red-700 mt-1">
                        Permanently delete this shop and everything linked to it. This cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0"
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
    </DashboardLayout>
  );
}
