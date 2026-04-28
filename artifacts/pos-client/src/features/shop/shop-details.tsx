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
  ArrowLeft, Trash2, Store, CreditCard, Receipt, Settings2, Shield, Save,
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
    name: "",
    receiptEmail: "",
    taxRate: 0,
    categoryId: "",
    address: "",
    currency: "KES",
    allowNegativeSelling: false,
    trackBatches: false,
    allowOnlineSelling: true,
    showStockOnline: false,
    showPriceOnline: false,
    backupInterval: "end_of_month",
    allowBackup: true,
    useWarehouse: false,
    contact: "",
    paybillTill: "",
    paybillAccount: "",
    receiptAddress: "",
  });

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
    if (shop) {
      setFormData({
        name: shop.name || "",
        receiptEmail: shop.receiptEmail || shop.email_receipt || "",
        taxRate: shop.taxRate ?? shop.tax ?? 0,
        categoryId: String((shop.categoryId?._id ?? shop.categoryId) ?? (shop.shopCategoryId?._id ?? shop.shopCategoryId) ?? ""),
        address: shop.address || "",
        currency: shop.currency || "KES",
        allowNegativeSelling: shop.allowNegativeSelling ?? false,
        trackBatches: shop.trackBatches ?? false,
        allowOnlineSelling: shop.allowOnlineSelling ?? true,
        showStockOnline: shop.showStockOnline ?? false,
        showPriceOnline: shop.showPriceOnline ?? false,
        backupInterval: shop.backupInterval || "end_of_month",
        allowBackup: shop.allowBackup ?? true,
        useWarehouse: shop.useWarehouse ?? false,
        contact: shop.contact || "",
        paybillTill: shop.paybillTill || shop.paybill_till || "",
        paybillAccount: shop.paybillAccount || shop.paybill_account || "",
        receiptAddress: shop.receiptAddress || shop.address_receipt || "",
      });
    }
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
      name: formData.name,
      receiptEmail: formData.receiptEmail,
      categoryId: formData.categoryId || undefined,
      address: formData.address,
      taxRate: formData.taxRate,
      currency: formData.currency,
      allowNegativeSelling: formData.allowNegativeSelling,
      trackBatches: formData.trackBatches,
      allowOnlineSelling: formData.allowOnlineSelling,
      showStockOnline: formData.showStockOnline,
      showPriceOnline: formData.showPriceOnline,
      backupInterval: formData.backupInterval,
      allowBackup: formData.allowBackup,
      useWarehouse: formData.useWarehouse,
      contact: formData.contact,
      paybillTill: formData.paybillTill,
      paybillAccount: formData.paybillAccount,
      receiptAddress: formData.receiptAddress,
    });
  };

  const handleDeleteShopData = () => {
    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Shop Data",
      description: "This will permanently remove all products, transactions, and sales data. Type 'DELETE' to confirm.",
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
      description: "This will permanently delete this shop and ALL associated data. Type 'DELETE SHOP' to confirm.",
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

  const field = (key: keyof typeof formData) => ({
    value: formData[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

  const toggle = (key: keyof typeof formData) => ({
    checked: formData[key] as boolean,
    onCheckedChange: (v: boolean) => setFormData(prev => ({ ...prev, [key]: v })),
  });

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
              <TabsTrigger value="backup" className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded">
                <CreditCard className="w-4 h-4" /> Backup
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-2 data-[state=active]:bg-red-600 data-[state=active]:text-white rounded text-red-600">
                <Shield className="w-4 h-4" /> Danger
              </TabsTrigger>
            </TabsList>

            {/* ── GENERAL ── */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shop Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Shop Name</Label>
                      <Input placeholder="Your shop name" {...field("name")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Business Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, categoryId: v }))}
                      >
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
                      <Input placeholder="Physical address" {...field("address")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Financial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}
                      >
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
                        onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── RECEIPT ── */}
            <TabsContent value="receipt" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Receipt & Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label>Receipt Email</Label>
                      <Input type="email" placeholder="email@yourshop.com" {...field("receiptEmail")} />
                      <p className="text-xs text-gray-400">Shown on printed receipts</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contact / Phone</Label>
                      <Input placeholder="+254 7xx xxx xxx" {...field("contact")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Receipt Address</Label>
                      <Input placeholder="Address shown on receipts" {...field("receiptAddress")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>M-Pesa Paybill / Till</Label>
                      <Input placeholder="e.g. 522522 or 0123456" {...field("paybillTill")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Paybill Account</Label>
                      <Input placeholder="Account number" {...field("paybillAccount")} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── OPERATIONS ── */}
            <TabsContent value="operations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Operational Settings</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {[
                    {
                      key: "allowNegativeSelling",
                      label: "Negative Selling",
                      desc: "Allow sales even when stock is at zero",
                    },
                    {
                      key: "trackBatches",
                      label: "Batch Tracking",
                      desc: "Track product batches and expiry dates",
                    },
                    {
                      key: "useWarehouse",
                      label: "Warehouse Mode",
                      desc: "Enable warehouse-based inventory management",
                    },
                    {
                      key: "allowOnlineSelling",
                      label: "Online Selling",
                      desc: "List products on your online storefront",
                    },
                    {
                      key: "showStockOnline",
                      label: "Show Stock Levels Online",
                      desc: "Display available quantity to online customers",
                    },
                    {
                      key: "showPriceOnline",
                      label: "Show Prices Online",
                      desc: "Display product prices on your online store",
                    },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Switch {...toggle(key as keyof typeof formData)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── BACKUP ── */}
            <TabsContent value="backup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Backup Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Auto Backup</p>
                      <p className="text-xs text-gray-400 mt-0.5">Automatically email shop data backups</p>
                    </div>
                    <Switch {...toggle("allowBackup")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Backup Email</Label>
                    <Input value={admin?.email || ""} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400">Uses your admin account email</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Backup Frequency</Label>
                    <Select
                      value={formData.backupInterval}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, backupInterval: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="end_of_month">Monthly (end of month)</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
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
