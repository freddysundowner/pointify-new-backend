import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronRight, ChevronDown, Trash2, Download, Settings, Shield, FileText, AlertTriangle } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Link } from "wouter";
import AlertModal from "@/components/ui/alert-modal";

interface Shop {
  _id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  email?: string;
  currency: string;
  allowOnlineSelling: boolean;
  adminId: string;
  createdAt: string;
  updatedAt: string;
}

interface ShopCategory {
  _id: string;
  name: string;
}

export default function ShopDetails() {
  const { id } = useParams();
  const { admin } = useAuth();
  const queryClient = useQueryClient();
  
  // Debug admin data to check primary shop status
  useEffect(() => {
    console.log('Current admin:', admin);
    console.log('Primary shop ID:', admin?.primaryShop);
    console.log('Current shop ID:', id);
    console.log('Has primary shop:', !!admin?.primaryShop);
  }, [admin, id]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  // Alert modal state
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

  // Shop settings form state (internal keys kept as camelCase matching API)
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
    // Receipt customization fields
    contact: "",
    paybillTill: "",
    paybillAccount: "",
    receiptAddress: "",
  });

  // Fetch categories from API
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiCall(ENDPOINTS.shop.getCategories, {
        method: "GET",
      });
      const data = await response.json();
      console.log('Categories loaded from API:', data);
      return data;
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch shop details from /shop/:id
  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiCall(ENDPOINTS.shop.getById(id), {
        method: "GET",
      });
      const shop = await response.json();
      console.log('Shop data loaded:', shop);
      return shop;
    },
    enabled: !!id,
  });

  // Update form data when shop loads
  useEffect(() => {
    if (shop) {
      console.log('Shop data loaded:', shop);
      console.log('Shop category:', shop.shopCategoryId?.name);
      setFormData({
        name: shop.name || "",
        receiptEmail: shop.receiptEmail || shop.email_receipt || "",
        taxRate: shop.taxRate ?? shop.tax ?? 0,
        categoryId: (shop.categoryId?._id || shop.categoryId) || (shop.shopCategoryId?._id || shop.shopCategoryId) || "",
        address: shop.address || "",
        currency: shop.currency || "KES",
        allowNegativeSelling: shop.allowNegativeSelling ?? shop.allownegativeselling ?? false,
        trackBatches: shop.trackBatches ?? shop.trackbatches ?? false,
        allowOnlineSelling: shop.allowOnlineSelling ?? true,
        showStockOnline: shop.showStockOnline ?? shop.showstockonline ?? false,
        showPriceOnline: shop.showPriceOnline ?? shop.showpriceonline ?? false,
        backupInterval: shop.backupInterval || "end_of_month",
        allowBackup: shop.allowBackup ?? true,
        contact: shop.contact || "",
        paybillTill: shop.paybillTill || shop.paybill_till || "",
        paybillAccount: shop.paybillAccount || shop.paybill_account || "",
        receiptAddress: shop.receiptAddress || shop.address_receipt || "",
      });
    }
  }, [shop]);

  // Debug: Log form data changes
  useEffect(() => {
    console.log('Form data updated:', formData);
  }, [formData]);

  // Update shop mutation
  const updateShopMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiCall(ENDPOINTS.shop.getById(id), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["shop", id] });
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      
      toast({
        title: "Shop Updated",
        description: "Shop settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update shop settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    const updateData = {
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
      contact: formData.contact,
      paybillTill: formData.paybillTill,
      paybillAccount: formData.paybillAccount,
      receiptAddress: formData.receiptAddress,
    };
    
    console.log('Saving shop data:', updateData);
    updateShopMutation.mutate(updateData);
  };

  const handleDeleteShopData = () => {
    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Shop Data",
      description: "This will permanently remove all products, transactions, and sales data for this shop. This action cannot be undone. Type 'DELETE' to confirm.",
      confirmText: "Delete Data",
      requiredInput: "DELETE",
      inputPlaceholder: "Type DELETE to confirm",
      onConfirm: () => {
        // Call the delete shop data API
        apiCall(ENDPOINTS.shop.getData(id), {
          method: 'DELETE',
        }).then(() => {
          toast({
            title: "Shop data deleted",
            description: "All shop data has been permanently deleted.",
            variant: "default",
          });
        }).catch((error) => {
          console.error('Error deleting shop data:', error);
          toast({
            title: "Error",
            description: "Failed to delete shop data. Please try again.",
            variant: "destructive",
          });
        });
      },
    });
  };

  const handleDeleteShop = () => {
    console.log('=== DELETE SHOP DEBUG ===');
    console.log('Admin data:', admin);
    console.log('Primary shop:', admin?.primaryShop);
    console.log('Current shop ID:', id);
    console.log('Admin exists:', !!admin);
    console.log('Primary shop exists:', !!admin?.primaryShop);
    console.log('========================');
    
    // Check if this is the primary shop
    if (admin?.primaryShop === id) {
      toast({
        title: "Cannot Delete Primary Shop",
        description: "This is your primary shop and cannot be deleted. Please set another shop as primary first, or contact support if this is your only shop.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has no primary shop - redirect to onboarding
    if (!admin?.primaryShop) {
      toast({
        title: "No Primary Shop",
        description: "You need to create a primary shop first.",
        variant: "destructive",
      });
      setLocation('/onboarding');
      return;
    }

    setAlertModal({
      isOpen: true,
      type: "input",
      title: "Delete Entire Shop",
      description: "This will permanently delete the entire shop and ALL associated data including products, sales, customers, and settings. This action is irreversible. Type 'DELETE SHOP' to confirm.",
      confirmText: "Delete Shop",
      requiredInput: "DELETE SHOP",
      inputPlaceholder: "Type DELETE SHOP to confirm",
      onConfirm: () => {
        // Call the delete shop API
        apiCall(ENDPOINTS.shop.getById(id), {
          method: 'DELETE',
        }).then(() => {
          toast({
            title: "Shop deleted",
            description: "The shop has been permanently deleted.",
            variant: "default",
          });
          // Invalidate cache and redirect to homepage
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [ENDPOINTS.shop.getAll] });
            setLocation('/');
          }, 1000);
        }).catch((error) => {
          console.error('Error deleting shop:', error);
          toast({
            title: "Error",
            description: "Failed to delete shop. Please try again.",
            variant: "destructive",
          });
        });
      },
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600">Loading shop details...</p>
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
            <p className="text-gray-600 mb-4">The shop you're looking for doesn't exist.</p>
            <Link href="/shops">
              <Button>Back to Shops</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }



  return (
    <DashboardLayout>
      <div className="h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b shadow-sm">
          <div className="px-8 py-6">
            <div className="flex items-center gap-4">
              <Link href="/shops">
                <Button variant="ghost" size="sm" className="p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
                <p className="text-gray-600">Manage your shop settings and configuration</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Quick Actions Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>Manage shop settings efficiently</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start h-10 bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Backup
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-10"
                    onClick={() => setExpandedSections(prev => ({ ...prev, backup: !prev.backup }))}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Backup Settings
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-10"
                    onClick={() => setExpandedSections(prev => ({ ...prev, receipt: !prev.receipt }))}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Receipt Settings
                  </Button>
                </CardContent>
              </Card>

              {/* Conditional Settings Panels */}
              {expandedSections.backup && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Backup Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Auto Backup</Label>
                      <Switch
                        checked={formData.allowBackup}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, allowBackup: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Backup Email</Label>
                      <Input
                        type="email"
                        value={admin?.email || ''}
                        readOnly
                        className="h-9 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500">Uses your admin email address</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Interval</Label>
                      <Select
                        value={formData.backupInterval}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, backupInterval: value }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Every day</SelectItem>
                          <SelectItem value="end_of_month">Every End of Month</SelectItem>
                          <SelectItem value="weekly">Every End of Week</SelectItem>
                          <SelectItem value="yearly">Every End of Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expandedSections.receipt && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Receipt Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Receipt Email</Label>
                      <Input
                        value={formData.receiptEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, receiptEmail: e.target.value }))}
                        placeholder="email@company.com"
                        type="email"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Contact</Label>
                      <Input
                        value={formData.contact}
                        onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                        placeholder="Contact info"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">M-Pesa Paybill/Till</Label>
                      <Input
                        value={formData.paybillTill}
                        onChange={(e) => setFormData(prev => ({ ...prev, paybillTill: e.target.value }))}
                        placeholder="Paybill or Till number"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Paybill Account</Label>
                      <Input
                        value={formData.paybillAccount}
                        onChange={(e) => setFormData(prev => ({ ...prev, paybillAccount: e.target.value }))}
                        placeholder="Account number"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Receipt Address</Label>
                      <Input
                        value={formData.receiptAddress}
                        onChange={(e) => setFormData(prev => ({ ...prev, receiptAddress: e.target.value }))}
                        placeholder="Address to show on receipts"
                        className="h-9"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Settings Form */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Settings className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Shop Information</CardTitle>
                        <CardDescription>Basic shop details and configuration</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveSettings}
                      disabled={updateShopMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {updateShopMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Information Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shopName" className="text-sm font-medium">Shop Name</Label>
                      <Input
                        id="shopName"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your shop name"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax" className="text-sm font-medium">Tax Rate (%)</Label>
                      <Input
                        id="tax"
                        type="number"
                        step="0.01"
                        value={formData.taxRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.0"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType" className="text-sm font-medium">Business Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, shopCategoryId: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category: ShopCategory) => (
                            <SelectItem key={category._id} value={category._id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-medium">Shop Address</Label>
                      <Input
                        id="location"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter your shop's physical address"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency" className="text-sm font-medium">Currency</Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Operational Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Operational Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                        <div>
                          <Label className="text-sm font-medium text-red-800">Negative Selling</Label>
                          <p className="text-xs text-red-600">Allow out-of-stock sales</p>
                        </div>
                        <Switch
                          checked={formData.allowNegativeSelling}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, allowNegativeSelling: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <Label className="text-sm font-medium text-blue-800">Batch Tracking</Label>
                          <p className="text-xs text-blue-600">Track product batches</p>
                        </div>
                        <Switch
                          checked={formData.trackBatches}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, trackBatches: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div>
                          <Label className="text-sm font-medium text-purple-800">Warehouse Mode</Label>
                          <p className="text-xs text-purple-600">Use warehouse system</p>
                        </div>
                        <Switch
                          checked={formData.useWarehouse}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, useWarehouse: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <Label className="text-sm font-medium text-green-800">Online Selling</Label>
                          <p className="text-xs text-green-600">Enable e-commerce</p>
                        </div>
                        <Switch
                          checked={formData.allowOnlineSelling}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, allowOnlineSelling: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div>
                          <Label className="text-sm font-medium text-orange-800">Show Stock Online</Label>
                          <p className="text-xs text-orange-600">Display stock levels on online store</p>
                        </div>
                        <Switch
                          checked={formData.showStockOnline}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, showStockOnline: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-200">
                        <div>
                          <Label className="text-sm font-medium text-teal-800">Show Prices Online</Label>
                          <p className="text-xs text-teal-600">Display product prices on online store</p>
                        </div>
                        <Switch
                          checked={formData.showPriceOnline}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, showPriceOnline: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>


                </CardContent>
              </Card>

              {/* Danger Zone - Delete Shop */}
              <Card className="shadow-sm border-red-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-800">Danger Zone</h3>
                      <p className="text-sm text-red-600">Irreversible actions that will permanently delete data</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800 mb-1">Delete Shop Data</h4>
                        <p className="text-xs text-red-600 mb-3">
                          Permanently delete all products, transactions, and sales data for this shop. 
                          This action cannot be undone.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-700 hover:bg-red-100"
                          onClick={() => handleDeleteShopData()}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Shop Data
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-red-100 rounded-lg border border-red-300">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-900 mb-1">Delete Entire Shop</h4>
                        <p className="text-xs text-red-700 mb-3">
                          Permanently delete this shop and all associated data including products, 
                          sales, customers, and settings. This action is irreversible.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteShop()}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Shop
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>


          </div>
        </div>
      </div>

      {/* Alert Modal for confirmations */}
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