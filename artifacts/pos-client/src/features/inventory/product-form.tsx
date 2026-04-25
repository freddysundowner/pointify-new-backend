import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, X, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useNavigationRoute } from "@/lib/navigation-utils";
import BundleProductsSelector from "@/components/ui/bundle-products-selector";
import SupplierSelector from "@/components/ui/supplier-selector-simple";
import { useProducts } from "@/contexts/ProductsContext";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { apiCall } from "@/lib/api-config";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  unitOfMeasure: z.string().optional(),
  sellingPrice: z.number().min(0, "Selling price must be positive"),
  buyingPrice: z.number().min(0, "Buying price must be positive").optional(),
  quantity: z.number().min(0, "Quantity must be positive").optional(),
  isBundle: z.boolean().default(false),
  manageInventory: z.boolean().default(false),
  manageByPrice: z.boolean().default(false),
  productType: z.enum(["product", "service", "virtual"]).default("product"),
  barcode: z.string().optional().or(z.literal("")),
  isTaxable: z.boolean().default(false),
  minSellingPrice: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).optional(),
  ),
  manufacturer: z.string().optional().or(z.literal("")),
  serialnumber: z.string().optional().or(z.literal("")),
  wholesalePrice: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).optional(),
  ),
  dealerPrice: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).optional(),
  ),
  productCategoryId: z.string().optional().or(z.literal("")),
  supplier: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  reorderLevel: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).optional(),
  ),
  discount: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).max(100).optional(),
  ),
  maxDiscount: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.number().min(0).optional(),
  ),
  description: z.string().optional().or(z.literal("")),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductForm() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { shopId, adminId,  attendantId } = usePrimaryShop();
  const productsRoute = useNavigationRoute("products");
  const { products,refreshProducts } = useProducts();

  // Fetch categories for the dropdown
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: [ENDPOINTS.products.getCategories, shopId, adminId],
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: shopId || "",
        adminId: adminId || "",
      });
      
      const response = await fetch(`${ENDPOINTS.products.getCategories}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      const data = await response.json();
      return data.data || data || [];
    },
    enabled: !!(shopId && adminId),
  });

  const isEditMode = location.includes("/edit-product");
  const productId = isEditMode ? location.split("/edit-product/")[1] : null;

  const [selectedBundleProducts, setSelectedBundleProducts] = useState<{
    [key: string]:
      | number
      | {
          quantity: number;
          productId: string;
          inventoryId: string;
          productName?: string;
          sellingPrice?: number;
        };
  }>({});
  const [isBundleDialogOpen, setIsBundleDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [expandedSections, setExpandedSections] = useState({
    manufacturer: false,
    wholesalePrice: false,
    dealerPrice: false,
    minSellingPrice: false,
    category: false,
    supplier: false,
    expiryDate: false,
    reorderLevel: false,
    discount: false,
    maxDiscount: false,
    serialnumber: false,
    barcode: false,
    description: false,
    bundle: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => {
      const isCurrentlyExpanded = prev[section];

      // If closing the section, clear the associated data with proper empty values
      if (isCurrentlyExpanded) {
        switch (section) {
          case "manufacturer":
            form.setValue("manufacturer", "", { shouldValidate: true });
            break;
            case "serialnumber":
              form.setValue("serialnumber", "", { shouldValidate: true });
              break;
          case "wholesalePrice":
            form.setValue("wholesalePrice", undefined, {
              shouldValidate: true,
            });
            break;
          case "dealerPrice":
            form.setValue("dealerPrice", undefined, { shouldValidate: true });
            break;
          case "category":
            form.setValue("productCategoryId", "", { shouldValidate: true });
            break;
          case "supplier":
            form.setValue("supplier", "", { shouldValidate: true });
            break;
          case "reorderLevel":
            form.setValue("reorderLevel", undefined, { shouldValidate: true });
            break;
          case "expiryDate":
            form.setValue("expiryDate", "", { shouldValidate: true });
            break;
          case "description":
            form.setValue("description", "", { shouldValidate: true });
            break;
          case "maxDiscount":
            form.setValue("maxDiscount", undefined, { shouldValidate: true });
            break;
          case "barcode":
            form.setValue("barcode", "", { shouldValidate: true });
            break;
          case "minSellingPrice":
            form.setValue("minSellingPrice", undefined, { shouldValidate: true });
            break;
        }
      }

      return {
        ...prev,
        [section]: !prev[section],
      };
    });
  };

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      unitOfMeasure: "",
      sellingPrice: 0,
      buyingPrice: 0,
      quantity: 0,
      isBundle: false,
      manageInventory: false,
      manageByPrice: false,
      productType: "product",
      maxDiscount: 0,
    },
  });

  // Fetch product data for edit mode
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: [ENDPOINTS.products.getById(productId || '')],
    enabled: !!productId && isEditMode,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Use products from ProductsContext for bundle selector

  // Handle navigation state data for edit mode
  useEffect(() => {
    if (isEditMode && (window as any).productEditData) {
      const editData = (window as any).productEditData;
      const productData = editData.productData;

      // Set bundle products if passed through navigation
      if (editData.passedBundleItems && editData.bundleItems) {
        setSelectedBundleProducts(
          editData.bundleItems.reduce((acc: any, item: any) => {
            // Handle new API structure where item_product contains the product data
            if (item.item_product && item.item_product._id) {
              const productId = item.item_product._id;
              const productName = item.item_product.name || "";

              acc[productId] = {
                quantity: item.quantity || 1,
                productId: productId,
                inventoryId: item._id,
                productName: productName,
                sellingPrice: item.item_product.sellingPrice || 0,
              };
            }
            return acc;
          }, {}),
        );
      }

      const formData = {
        name: productData.name || "",
        unitOfMeasure: productData.measureUnit || productData.measure || productData.unitOfMeasure || "",
        sellingPrice: Number(productData.sellingPrice) || 0,
        buyingPrice:
          Number(productData.buyingPrice) || Number(productData.costPrice) || 0,
        quantity: Number(productData.quantity) || 0,
        isBundle: Boolean(productData.bundle || productData.isBundle || productData.type === "bundle"),
        manageInventory: false,
        manageByPrice: Boolean(productData.manageByPrice),
        productType: (
          productData.type === "service" ? "service"
          : productData.type === "virtual" ? "virtual"
          : "product"
        ) as "product" | "service" | "virtual",
        barcode: productData.barcode || "",
        isTaxable: Boolean(productData.isTaxable),
        minSellingPrice: productData.minSellingPrice != null ? Number(productData.minSellingPrice) : undefined,
        manufacturer: productData.manufacturer || "",
        serialnumber: productData.serialNumber || productData.serialnumber || "",
        wholesalePrice: Number(productData.wholesalePrice) || 0,
        dealerPrice: Number(productData.dealerPrice) || 0,
        productCategoryId:
          productData.productCategoryId?._id ||
          productData.productCategoryId ||
          productData.category?.id?.toString() ||
          (typeof productData.category === "number" ? String(productData.category) : "") ||
          "",
        supplier: productData.supplierId?._id || productData.supplierId || (productData.supplier && typeof productData.supplier === "object" ? productData.supplier?.id?.toString() : String(productData.supplier || "")),
        expiryDate: productData.expiryDate
          ? productData.expiryDate.split("T")[0]
          : "",
        reorderLevel:
          Number(productData.reorderLevel) ||
          Number(productData.lowStockThreshold) ||
          0,
        discount: Number(productData.discount) || 0,
        maxDiscount: Number(productData.maxDiscount) || 0,
        description: productData.description || "",
      };

      form.reset(formData as any);

      setExpandedSections({
        manufacturer: !!formData.manufacturer,
        wholesalePrice: !!(formData.wholesalePrice && formData.wholesalePrice > 0),
        dealerPrice: !!(formData.dealerPrice && formData.dealerPrice > 0),
        minSellingPrice: formData.minSellingPrice != null && formData.minSellingPrice > 0,
        category: !!formData.productCategoryId,
        supplier: !!formData.supplier,
        expiryDate: !!formData.expiryDate,
        reorderLevel: !!(formData.reorderLevel && formData.reorderLevel > 0),
        discount: !!(formData.discount && formData.discount > 0),
        maxDiscount: !!(formData.maxDiscount && formData.maxDiscount > 0),
        description: !!formData.description,
        bundle: !!formData.isBundle,
        serialnumber: !!formData.serialnumber,
        barcode: !!formData.barcode,
      });

      // Clean up navigation data after use
      delete (window as any).productEditData;
    }
  }, [isEditMode, form]);

  useEffect(() => {
    if (product && isEditMode && !(window as any).productEditData) {
      const productData = (product as any).data || product;
      const formData = {
        name: productData.name || "",
        unitOfMeasure: productData.measureUnit || productData.measure || productData.unitOfMeasure || "",
        sellingPrice: Number(productData.sellingPrice) || 0,
        buyingPrice: Number(productData.buyingPrice) || Number(productData.costPrice) || 0,
        quantity: Number(productData.quantity) || 0,
        isBundle: Boolean(productData.bundle || productData.isBundle || productData.type === "bundle"),
        manageInventory: false,
        manageByPrice: Boolean(productData.manageByPrice),
        productType: (
          productData.type === "service" ? "service"
          : productData.type === "virtual" ? "virtual"
          : "product"
        ) as "product" | "service" | "virtual",
        barcode: productData.barcode || "",
        isTaxable: Boolean(productData.isTaxable),
        minSellingPrice: productData.minSellingPrice != null ? Number(productData.minSellingPrice) : undefined,
        manufacturer: productData.manufacturer || "",
        serialnumber: productData.serialNumber || productData.serialnumber || "",
        wholesalePrice: Number(productData.wholesalePrice) || 0,
        dealerPrice: Number(productData.dealerPrice) || 0,
        productCategoryId:
          productData.productCategoryId?._id ||
          productData.productCategoryId ||
          productData.category?.id?.toString() ||
          (typeof productData.category === "number" ? String(productData.category) : "") ||
          "",
        supplier: productData.supplierId?._id || productData.supplierId || (productData.supplier && typeof productData.supplier === "object" ? productData.supplier?.id?.toString() : String(productData.supplier || "")),
        expiryDate: productData.expiryDate
          ? productData.expiryDate.split("T")[0]
          : "",
        reorderLevel:
          Number(productData.reorderLevel) ||
          Number(productData.lowStockThreshold) ||
          0,
        discount: Number(productData.discount) || 0,
        maxDiscount: Number(productData.maxDiscount) || 0,
        description: productData.description || "",
      };

      form.reset(formData as any);

      setExpandedSections({
        manufacturer: !!formData.manufacturer,
        serialnumber: !!formData.serialnumber,
        barcode: !!formData.barcode,
        wholesalePrice: !!(formData.wholesalePrice && formData.wholesalePrice > 0),
        dealerPrice: !!(formData.dealerPrice && formData.dealerPrice > 0),
        minSellingPrice: formData.minSellingPrice != null && formData.minSellingPrice > 0,
        category: !!formData.productCategoryId,
        supplier: !!formData.supplier,
        expiryDate: !!formData.expiryDate,
        reorderLevel: !!(formData.reorderLevel && formData.reorderLevel > 0),
        discount: !!(formData.discount && formData.discount > 0),
        maxDiscount: !!(formData.maxDiscount && formData.maxDiscount > 0),
        description: !!formData.description,
        bundle: !!formData.isBundle,
      });
    }
  }, [product, form, isEditMode]);

  const mutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const endpoint = isEditMode
        ? ENDPOINTS.products.update(productId || '')
        : ENDPOINTS.products.create;
      const method = isEditMode ? "PUT" : "POST";

      const payload = {
        name: formData.name,
        measureUnit: formData.unitOfMeasure || "",
        sellingPrice: formData.sellingPrice,
        buyingPrice: formData.buyingPrice,
        quantity: formData.quantity,
        manageByPrice: formData.manageByPrice,
        isTaxable: formData.isTaxable,
        barcode: formData.barcode || undefined,
        minSellingPrice: formData.minSellingPrice ?? undefined,
        manufacturer: formData.manufacturer || "",
        serialNumber: formData.serialnumber || "",
        wholesalePrice: formData.wholesalePrice || 0,
        dealerPrice: formData.dealerPrice || 0,
        categoryId:
          formData.productCategoryId === "none" || !formData.productCategoryId
            ? null
            : formData.productCategoryId,
        supplierId:
          formData.supplier === "none" || !formData.supplier
            ? null
            : formData.supplier,
        expiryDate: formData.expiryDate || "",
        reorderLevel: formData.reorderLevel || 0,
        alertQuantity: formData.reorderLevel || 0,
        maxDiscount: formData.maxDiscount || 0,
        description: formData.description || "",
        bundleItems: formData.isBundle
          ? Object.entries(selectedBundleProducts).map(([pid, data]) => ({
              componentProductId: Number(pid),
              quantity: typeof data === "number" ? data : data.quantity,
            }))
          : undefined,
        type:
          formData.productType === "service" ? "service"
          : formData.productType === "virtual" ? "virtual"
          : formData.isBundle ? "bundle"
          : "product",
        shopId,
      };

      const response = await apiCall(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Product ${isEditMode ? "updated" : "created"} successfully!`,
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINTS.products.getAll] });
      if (isEditMode) {
        queryClient.invalidateQueries({
          queryKey: [ENDPOINTS.products.getById(productId || '')],
        });
      }
        refreshProducts();
      navigate(productsRoute);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message ||
          `Failed to ${isEditMode ? "update" : "create"} product. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const response = await apiCall(ENDPOINTS.products.createCategory, {
        method: "POST",
        body: JSON.stringify({
          name: categoryName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Category created successfully!",
      });
      setIsCategoryDialogOpen(false);
      setNewCategoryName("");
      // Refresh categories list
      queryClient.invalidateQueries({
        queryKey: [ENDPOINTS.products.getCategories, shopId, adminId],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to create category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const onSubmit = (data: ProductFormData) => {
    console.log("Form submission attempted with data:", data);
    console.log("Form errors:", form.formState.errors);
    mutation.mutate(data);
  };

  if (isEditMode && isLoadingProduct) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading product...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isEditMode ? "Edit Product" : "Add New Product"}>
      <div className="-mx-6 px-2 py-4">
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(productsRoute)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Products</span>
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Basic Information */}
              <div className="lg:col-span-2 space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Product Type Selection */}
                    <FormField
                      control={form.control}
                      name="productType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <FormControl>
                            <div className="flex gap-4">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="product"
                                  checked={field.value === "product"}
                                  onChange={() => field.onChange("product")}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium">
                                  Product
                                </span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="service"
                                  checked={field.value === "service"}
                                  onChange={() => field.onChange("service")}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium">
                                  Service
                                </span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  value="virtual"
                                  checked={field.value === "virtual"}
                                  onChange={() => field.onChange("virtual")}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium">
                                  Virtual
                                </span>
                              </label>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* isTaxable checkbox — always visible */}
                    <FormField
                      control={form.control}
                      name="isTaxable"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Taxable product
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {form.watch("productType") === "service"
                              ? "Service Name *"
                              : "Product Name *"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                form.watch("productType") === "service"
                                  ? "Enter service name"
                                  : "Enter product name"
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Unit of Measure - only for products */}
                    {form.watch("productType") === "product" && (
                      <FormField
                        control={form.control}
                        name="unitOfMeasure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit of Measure</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., kg, pcs, liters"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="sellingPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Selling Price *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? undefined
                                    : parseFloat(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Wholesale Price - expandable */}
                    {expandedSections.wholesalePrice && (
                      <FormField
                        control={form.control}
                        name="wholesalePrice"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Wholesale Price</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("wholesalePrice")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : parseFloat(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Special price for wholesale customers
                            </p>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Dealer Price - expandable */}
                    {expandedSections.dealerPrice && (
                      <FormField
                        control={form.control}
                        name="dealerPrice"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Dealer Price</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("dealerPrice")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : parseFloat(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Special price for dealer customers
                            </p>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Max Discount - expandable */}
                    {expandedSections.maxDiscount && (
                      <FormField
                        control={form.control}
                        name="maxDiscount"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Maximum Discount Amount</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("maxDiscount")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : parseFloat(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Maximum fixed discount amount allowed for this
                              product (in currency)
                            </p>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Barcode - expandable */}
                    {expandedSections.barcode && (
                      <FormField
                        control={form.control}
                        name="barcode"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Barcode</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("barcode")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input placeholder="e.g., 1234567890128" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Min Selling Price - expandable */}
                    {expandedSections.minSellingPrice && (
                      <FormField
                        control={form.control}
                        name="minSellingPrice"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Minimum Selling Price</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("minSellingPrice")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : parseFloat(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Price floor — product cannot be sold below this price
                            </p>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Buying Price - only for products and non-bundle items */}
                    {form.watch("productType") === "product" &&
                      !form.watch("isBundle") && (
                        <FormField
                          control={form.control}
                          name="buyingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Buying Price</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === ""
                                        ? undefined
                                        : parseFloat(e.target.value),
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                    {/* Quantity field - only for products */}
                    {form.watch("productType") === "product" && (
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {form.watch("isBundle")
                                ? "Bundle Quantity Available"
                                : "Initial Quantity"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ""
                                      ? undefined
                                      : parseInt(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            {form.watch("isBundle") && (
                              <p className="text-xs text-gray-500 mt-1">
                                Number of complete bundle units available for
                                sale
                              </p>
                            )}
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Reorder Level - only for products, expandable */}
                    {form.watch("productType") === "product" &&
                      expandedSections.reorderLevel && (
                        <FormField
                          control={form.control}
                          name="reorderLevel"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel>Minimum Stock Level</FormLabel>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSection("reorderLevel")}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value),
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-500 mt-1">
                                Alert when stock falls below this level
                              </p>
                            </FormItem>
                          )}
                        />
                      )}

                    {/* Description - expandable */}
                    {expandedSections.description && (
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Description</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("description")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Enter product description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Manufacturer - expandable */}
                    {expandedSections.manufacturer && (
                      <FormField
                        control={form.control}
                        name="manufacturer"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Manufacturer</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("manufacturer")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                placeholder="Enter manufacturer name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {/* Serial Number - expandable */}
                    {expandedSections.serialnumber && (
                      <FormField
                        control={form.control}
                        name="serialnumber"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Serial Number</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("serialnumber")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                placeholder="Enter serialnumber name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Category - expandable */}
                    {expandedSections.category && (
                      <FormField
                        control={form.control}
                        name="productCategoryId"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Category</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("category")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      No category
                                    </SelectItem>
                                    {categoriesLoading ? (
                                      <SelectItem value="loading" disabled>
                                        Loading categories...
                                      </SelectItem>
                                    ) : (
                                      categories?.map((category: any) => (
                                        <SelectItem 
                                          key={category._id} 
                                          value={category._id}
                                        >
                                          {category.name}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Dialog
                                open={isCategoryDialogOpen}
                                onOpenChange={setIsCategoryDialogOpen}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="px-3"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>
                                      Create New Category
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Category Name
                                      </label>
                                      <Input
                                        value={newCategoryName}
                                        onChange={(e) =>
                                          setNewCategoryName(e.target.value)
                                        }
                                        placeholder="Enter category name"
                                        className="mt-2"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end space-x-2 mt-6">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setIsCategoryDialogOpen(false);
                                        setNewCategoryName("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={handleCreateCategory}
                                      disabled={
                                        !newCategoryName.trim() ||
                                        createCategoryMutation.isPending
                                      }
                                    >
                                      {createCategoryMutation.isPending
                                        ? "Creating..."
                                        : "Create"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Supplier - expandable */}
                    {expandedSections.supplier && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Supplier
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSection("supplier")}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <SupplierSelector
                          value={form.watch("supplier") || ""}
                          onChange={(value) => form.setValue("supplier", value)}
                          shopId={shopId}
                          adminId={adminId}
                        />
                      </div>
                    )}

                    {/* Expiry Date - expandable */}
                    {expandedSections.expiryDate && (
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Expiry Date</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection("expiryDate")}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-1">
                              Set expiry date for perishable products
                            </p>
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Additional Information - only for products */}
                {form.watch("productType") === "product" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Additional Information</CardTitle>
                      <p className="text-sm text-gray-500">
                        Add optional product details
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex flex-wrap gap-2">
                        {!expandedSections.manufacturer && (
                          <button
                            type="button"
                            onClick={() => toggleSection("manufacturer")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Manufacturer</span>
                          </button>
                        )}
                        {!expandedSections.serialnumber && (
                          <button
                            type="button"
                            onClick={() => toggleSection("serialnumber")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Serial Number</span>
                          </button>
                        )}

                        {!expandedSections.barcode && (
                          <button
                            type="button"
                            onClick={() => toggleSection("barcode")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Barcode</span>
                          </button>
                        )}

                        {!expandedSections.minSellingPrice && (
                          <button
                            type="button"
                            onClick={() => toggleSection("minSellingPrice")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Min Selling Price</span>
                          </button>
                        )}

                        {!expandedSections.wholesalePrice && (
                          <button
                            type="button"
                            onClick={() => toggleSection("wholesalePrice")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Wholesale Price</span>
                          </button>
                        )}

                        {!expandedSections.dealerPrice && (
                          <button
                            type="button"
                            onClick={() => toggleSection("dealerPrice")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Dealer Price</span>
                          </button>
                        )}

                        {!expandedSections.maxDiscount && (
                          <button
                            type="button"
                            onClick={() => toggleSection("maxDiscount")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Max Discount</span>
                          </button>
                        )}

                        {!expandedSections.description && (
                          <button
                            type="button"
                            onClick={() => toggleSection("description")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Description</span>
                          </button>
                        )}

                        {!expandedSections.category && (
                          <button
                            type="button"
                            onClick={() => toggleSection("category")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Category</span>
                          </button>
                        )}

                        {!expandedSections.supplier && (
                          <button
                            type="button"
                            onClick={() => toggleSection("supplier")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Supplier</span>
                          </button>
                        )}

                        {!expandedSections.reorderLevel && (
                          <button
                            type="button"
                            onClick={() => toggleSection("reorderLevel")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Reorder Level</span>
                          </button>
                        )}

                        {!expandedSections.expiryDate && (
                          <button
                            type="button"
                            onClick={() => toggleSection("expiryDate")}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-200 rounded-md hover:bg-blue-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Expiry Date</span>
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bundle Products Selector - only for bundle products */}
                {form.watch("productType") === "product" &&
                  form.watch("isBundle") && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Bundle Products</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Select products to include in this bundle
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBundleDialogOpen(true)}
                            className="w-full"
                          >
                            <Package className="h-4 w-4 mr-2" />
                            {Object.keys(selectedBundleProducts).length > 0
                              ? `Manage Bundle Products (${Object.keys(selectedBundleProducts).length} selected)`
                              : "Select Bundle Products"}
                          </Button>

                          {/* Show selected bundle products */}
                          {Object.keys(selectedBundleProducts).length > 0 && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-medium mb-3 text-gray-700">
                                Bundle Products (
                                {Object.keys(selectedBundleProducts).length})
                              </h4>
                              <div className="space-y-2">
                                {Object.entries(selectedBundleProducts).map(
                                  ([productId, data]) => {
                                    const productData =
                                      typeof data === "object" &&
                                      "productName" in data
                                        ? data
                                        : {
                                            quantity:
                                              typeof data === "object"
                                                ? data.quantity
                                                : data,
                                            productName: undefined,
                                          };
                                    const product = products?.find(
                                      (p) => p._id === productId,
                                    );
                                    return (
                                      <div
                                        key={productId}
                                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                                      >
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">
                                            {product?.name ||
                                              productData.productName ||
                                              `Product ${productId}`}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            min="1"
                                            value={productData.quantity}
                                            onChange={(e) => {
                                              const newQty =
                                                parseInt(e.target.value) || 1;
                                              setSelectedBundleProducts(
                                                (prev) => ({
                                                  ...prev,
                                                  [productId]: {
                                                    ...(typeof prev[
                                                      productId
                                                    ] === "object"
                                                      ? prev[productId]
                                                      : {
                                                          productId: productId,
                                                          inventoryId: "",
                                                          quantity: 1,
                                                        }),
                                                    quantity: newQty,
                                                  },
                                                }),
                                              );
                                            }}
                                            className="w-16 h-8 text-xs"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const newSelected = {
                                                ...selectedBundleProducts,
                                              };
                                              delete newSelected[productId];
                                              setSelectedBundleProducts(
                                                newSelected,
                                              );
                                            }}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <BundleProductsSelector
                          selectedBundleProducts={selectedBundleProducts}
                          onToggleProduct={(
                            productId: string,
                            productData?: any,
                          ) => {
                            if (selectedBundleProducts[productId]) {
                              // Remove product
                              const newSelected = { ...selectedBundleProducts };
                              delete newSelected[productId];
                              setSelectedBundleProducts(newSelected);
                            } else {
                              // Add product
                              setSelectedBundleProducts((prev) => ({
                                ...prev,
                                [productId]: {
                                  quantity: 1,
                                  productId: productId,
                                  inventoryId:
                                    productData?.inventoryId ||
                                    productData?._id ||
                                    "",
                                  productName: productData?.name,
                                  sellingPrice: productData?.sellingPrice,
                                },
                              }));
                            }
                          }}
                          onUpdateQuantity={(
                            productId: string,
                            quantity: number,
                          ) => {
                            setSelectedBundleProducts((prev) => ({
                              ...prev,
                              [productId]: {
                                ...(typeof prev[productId] === "object"
                                  ? prev[productId]
                                  : {
                                      productId: productId,
                                      inventoryId: "",
                                      quantity: 1,
                                    }),
                                quantity: quantity,
                              },
                            }));
                          }}
                          onRemoveProduct={(productId: string) => {
                            const newSelected = { ...selectedBundleProducts };
                            delete newSelected[productId];
                            setSelectedBundleProducts(newSelected);
                          }}
                          shopId={shopId}
                          adminId={adminId}
                          existingProducts={products || []}
                          excludeProductId={productId || ""}
                          isOpen={isBundleDialogOpen}
                          onClose={() => setIsBundleDialogOpen(false)}
                        />
                      </CardContent>
                    </Card>
                  )}
              </div>

              {/* Right Column - Product Settings & Actions */}
              <div className="space-y-8">
                {/* Product Settings - only for products */}
                {form.watch("productType") === "product" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Product Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="isBundle"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bundle Product</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                This product contains other products
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="manageInventory"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Manage Inventory</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Track stock quantity for this product
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="manageByPrice"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Manage by Price</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Sell products by price amount
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {mutation.isPending
                        ? isEditMode
                          ? "Updating..."
                          : "Creating..."
                        : isEditMode
                          ? "Update Product"
                          : "Create Product"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(productsRoute)}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
