import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeIds } from "@/lib/utils";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, X, Package, Tag, ShoppingCart, Layers, ChevronDown, ChevronUp, DollarSign, Barcode, Calendar, Building2, Hash, AlignLeft, Percent, TrendingDown, Users, Store } from "lucide-react";

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
  sellingPrice: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.number().min(0, "Selling price must be positive").optional(),
  ),
  buyingPrice: z.number().min(0, "Buying price must be positive").optional(),
  quantity: z.number().min(0, "Quantity must be positive").optional(),
  isBundle: z.boolean().default(false),
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
}).superRefine((data, ctx) => {
  if (!data.manageByPrice && (data.sellingPrice == null || isNaN(data.sellingPrice as number))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selling price is required",
      path: ["sellingPrice"],
    });
  }
});

type ProductFormData = z.infer<typeof productSchema>;

function QuantityInput({ value, onChange, placeholder, className }: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(value != null ? String(value) : "");
  useEffect(() => {
    const external = value != null ? String(value) : "";
    setRaw(prev => {
      const asNum = prev === "" ? undefined : Number(prev);
      return asNum === value ? prev : external;
    });
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder={placeholder ?? "0"}
      className={className}
      value={raw}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9]/g, "");
        setRaw(cleaned);
        onChange(cleaned === "" ? undefined : Number(cleaned));
      }}
    />
  );
}

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
      return normalizeIds(data.data || data || []);
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
            // New API shape: { componentProduct, componentName, componentSellingPrice, quantity }
            if (item.componentProduct) {
              acc[item.componentProduct] = {
                quantity: Number(item.quantity) || 1,
                productId: item.componentProduct,
                productName: item.componentName || "",
                sellingPrice: Number(item.componentSellingPrice) || 0,
              };
            // Legacy shape: { item_product: { _id, name, sellingPrice } }
            } else if (item.item_product && item.item_product._id) {
              const pid = item.item_product._id;
              acc[pid] = {
                quantity: Number(item.quantity) || 1,
                productId: pid,
                inventoryId: item._id,
                productName: item.item_product.name || "",
                sellingPrice: Number(item.item_product.sellingPrice) || 0,
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

      // Populate bundle component selector from API response bundleItems
      const apiBundleItems: any[] = productData.bundleItems || [];
      if (apiBundleItems.length > 0) {
        setSelectedBundleProducts(
          apiBundleItems.reduce((acc: any, item: any) => {
            if (item.componentProduct) {
              acc[item.componentProduct] = {
                quantity: Number(item.quantity) || 1,
                productId: item.componentProduct,
                productName: item.componentName || "",
                sellingPrice: Number(item.componentSellingPrice) || 0,
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
        buyingPrice: Number(productData.buyingPrice) || Number(productData.costPrice) || 0,
        quantity: Number(productData.quantity) || 0,
        isBundle: Boolean(productData.bundle || productData.isBundle || productData.type === "bundle"),
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

  const productType = form.watch("productType");
  const isBundle = form.watch("isBundle");
  const manageByPrice = form.watch("manageByPrice");

  // Auto-derive isBundle from selected products
  useEffect(() => {
    const hasBundle = Object.keys(selectedBundleProducts).length > 0;
    if (hasBundle !== form.getValues("isBundle")) {
      form.setValue("isBundle", hasBundle);
    }
  }, [selectedBundleProducts]);

  if (isEditMode && isLoadingProduct) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600 mx-auto"></div>
            <p className="text-sm text-gray-500">Loading product details…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const typeOptions: { value: "product" | "service" | "virtual"; label: string }[] = [
    { value: "product", label: "Product" },
    { value: "service", label: "Service" },
    { value: "virtual", label: "Virtual" },
  ];

  const TypeIcon = ({ type }: { type: string }) => {
    if (type === "service") return <Tag className="h-4 w-4" />;
    if (type === "virtual") return <Layers className="h-4 w-4" />;
    return <ShoppingCart className="h-4 w-4" />;
  };

  const optionalFieldButtons: { key: keyof typeof expandedSections; label: string; forTypes: string[]; hideWhenByPrice?: boolean }[] = [
    { key: "manufacturer", label: "Manufacturer", forTypes: ["product"] },
    { key: "serialnumber", label: "Serial Number", forTypes: ["product"] },
    { key: "barcode", label: "Barcode", forTypes: ["product", "service", "virtual"] },
    { key: "minSellingPrice", label: "Min Price", forTypes: ["product", "service", "virtual"], hideWhenByPrice: true },
    { key: "wholesalePrice", label: "Wholesale Price", forTypes: ["product"], hideWhenByPrice: true },
    { key: "dealerPrice", label: "Dealer Price", forTypes: ["product"], hideWhenByPrice: true },
    { key: "maxDiscount", label: "Max Discount", forTypes: ["product", "service"], hideWhenByPrice: true },
    { key: "description", label: "Description", forTypes: ["product", "service", "virtual"] },
    { key: "category", label: "Category", forTypes: ["product", "service", "virtual"] },
    { key: "supplier", label: "Supplier", forTypes: ["product"] },
    { key: "reorderLevel", label: "Reorder Level", forTypes: ["product"], hideWhenByPrice: true },
    { key: "expiryDate", label: "Expiry Date", forTypes: ["product"] },
  ];

  return (
    <DashboardLayout title={isEditMode ? "Edit Product" : "Add New Product"}>
      <div className="-mx-6 px-3 pb-10">

        {/* Page header */}
        <div className="flex items-center gap-3 py-4 mb-2">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : navigate(productsRoute)}
            className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-800">
            {isEditMode ? "Edit Product" : "New Product"}
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── LEFT COLUMN ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Type selector */}
                <FormField
                  control={form.control}
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1">
                        {typeOptions.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              field.value === value
                                ? "bg-white text-purple-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <TypeIcon type={value} />
                            {label}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Core Information */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold text-gray-800">
                      {productType === "service" ? "Service Details" : "Product Details"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">
                            {productType === "service" ? "Service Name" : "Product Name"} <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={productType === "service" ? "e.g. Delivery, Installation…" : "e.g. Blue T-Shirt, 1kg Rice…"}
                              className="h-10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {productType === "product" && (
                      <FormField
                        control={form.control}
                        name="unitOfMeasure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Unit of Measure</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. kg, pcs, liters, boxes" className="h-10" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Pricing row */}
                    <div className={`grid gap-4 ${productType === "product" && !isBundle ? "grid-cols-2" : "grid-cols-1"}`}>
                      <FormField
                        control={form.control}
                        name="sellingPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">
                              {manageByPrice ? "Default Amount" : "Selling Price"}
                              {!manageByPrice && <span className="text-red-500"> *</span>}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  className="h-10 pl-9"
                                  {...field}
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                />
                              </div>
                            </FormControl>
                            {manageByPrice && (
                              <p className="text-xs text-gray-400 mt-1">Optional. Cashier enters the actual amount at the time of sale.</p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {productType === "product" && !isBundle && (
                        <FormField
                          control={form.control}
                          name="buyingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-700">Buying Price</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="h-10 pl-9"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                  />
                                </div>
                              </FormControl>
                              {manageByPrice && (
                                <p className="text-xs text-gray-400 mt-1">Optional. Used for profit tracking.</p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Quantity */}
                    {productType === "product" && !manageByPrice && (
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">
                              {isBundle ? "Bundle Quantity Available" : isEditMode ? "Stock Quantity" : "Initial Quantity"}
                            </FormLabel>
                            <FormControl>
                              <QuantityInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="0"
                                className="h-10"
                              />
                            </FormControl>
                            <FormMessage />
                            {isBundle && (
                              <p className="text-xs text-gray-400 mt-1">Number of complete bundle units available for sale</p>
                            )}
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Taxable toggle */}
                    <FormField
                      control={form.control}
                      name="isTaxable"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="font-medium text-gray-700 cursor-pointer">Taxable product</FormLabel>
                            <p className="text-xs text-gray-400 mt-0.5">Tax will be applied at checkout</p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Optional expandable fields */}
                {((!manageByPrice && (expandedSections.wholesalePrice || expandedSections.dealerPrice ||
                  expandedSections.maxDiscount || expandedSections.minSellingPrice || expandedSections.reorderLevel)) ||
                  expandedSections.barcode || expandedSections.description ||
                  expandedSections.manufacturer || expandedSections.serialnumber ||
                  expandedSections.category || expandedSections.supplier ||
                  expandedSections.expiryDate) && (
                  <Card className="shadow-sm border-gray-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-gray-800">Additional Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      {expandedSections.barcode && (
                        <FormField
                          control={form.control}
                          name="barcode"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Barcode className="h-3.5 w-3.5 text-gray-400" />Barcode</FormLabel>
                                <button type="button" onClick={() => toggleSection("barcode")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl><Input placeholder="e.g. 1234567890128" className="h-10" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {expandedSections.description && (
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><AlignLeft className="h-3.5 w-3.5 text-gray-400" />Description</FormLabel>
                                <button type="button" onClick={() => toggleSection("description")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl>
                                <textarea
                                  className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  placeholder="Describe this product…"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {expandedSections.category && (
                        <FormField
                          control={form.control}
                          name="productCategoryId"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-gray-400" />Category</FormLabel>
                                <button type="button" onClick={() => toggleSection("category")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                    <FormControl>
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select a category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">No category</SelectItem>
                                      {categoriesLoading ? (
                                        <SelectItem value="loading" disabled>Loading…</SelectItem>
                                      ) : (
                                        categories?.map((category: any) => (
                                          <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="h-10 px-3">
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-md">
                                    <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
                                    <div className="space-y-3 pt-2">
                                      <label className="text-sm font-medium text-gray-700">Category Name</label>
                                      <Input
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="e.g. Electronics, Clothing…"
                                        className="h-10"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                      <Button type="button" variant="outline" onClick={() => { setIsCategoryDialogOpen(false); setNewCategoryName(""); }}>Cancel</Button>
                                      <Button type="button" onClick={handleCreateCategory} disabled={!newCategoryName.trim() || createCategoryMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                                        {createCategoryMutation.isPending ? "Creating…" : "Create"}
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

                      {expandedSections.supplier && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-gray-400" />Supplier</label>
                            <button type="button" onClick={() => toggleSection("supplier")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                          </div>
                          <SupplierSelector
                            value={form.watch("supplier") || ""}
                            onChange={(value) => form.setValue("supplier", value)}
                            shopId={shopId}
                            adminId={adminId}
                          />
                        </div>
                      )}

                      {expandedSections.manufacturer && (
                        <FormField
                          control={form.control}
                          name="manufacturer"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-gray-400" />Manufacturer</FormLabel>
                                <button type="button" onClick={() => toggleSection("manufacturer")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl><Input placeholder="e.g. Samsung, Nike…" className="h-10" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {expandedSections.serialnumber && (
                        <FormField
                          control={form.control}
                          name="serialnumber"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-gray-400" />Serial Number</FormLabel>
                                <button type="button" onClick={() => toggleSection("serialnumber")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl><Input placeholder="Enter serial number" className="h-10" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Pricing extras — side by side when both visible */}
                      {!manageByPrice && (expandedSections.wholesalePrice || expandedSections.dealerPrice) && (
                        <div className={`grid gap-4 ${expandedSections.wholesalePrice && expandedSections.dealerPrice ? "grid-cols-2" : "grid-cols-1"}`}>
                          {expandedSections.wholesalePrice && (
                            <FormField
                              control={form.control}
                              name="wholesalePrice"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="text-gray-700 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-400" />Wholesale Price</FormLabel>
                                    <button type="button" onClick={() => toggleSection("wholesalePrice")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                                  </div>
                                  <FormControl>
                                    <div className="relative">
                                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                      <Input type="number" placeholder="0.00" className="h-10 pl-9" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          {expandedSections.dealerPrice && (
                            <FormField
                              control={form.control}
                              name="dealerPrice"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="text-gray-700 flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-gray-400" />Dealer Price</FormLabel>
                                    <button type="button" onClick={() => toggleSection("dealerPrice")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                                  </div>
                                  <FormControl>
                                    <div className="relative">
                                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                      <Input type="number" placeholder="0.00" className="h-10 pl-9" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      )}

                      {!manageByPrice && expandedSections.minSellingPrice && (
                        <FormField
                          control={form.control}
                          name="minSellingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-gray-400" />Minimum Selling Price</FormLabel>
                                <button type="button" onClick={() => toggleSection("minSellingPrice")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input type="number" placeholder="0.00" className="h-10 pl-9" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                                </div>
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-400 mt-1">Product cannot be sold below this price</p>
                            </FormItem>
                          )}
                        />
                      )}

                      {!manageByPrice && expandedSections.maxDiscount && (
                        <FormField
                          control={form.control}
                          name="maxDiscount"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Percent className="h-3.5 w-3.5 text-gray-400" />Maximum Discount</FormLabel>
                                <button type="button" onClick={() => toggleSection("maxDiscount")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input type="number" placeholder="0.00" className="h-10 pl-9" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                                </div>
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-400 mt-1">Max fixed discount allowed on this product</p>
                            </FormItem>
                          )}
                        />
                      )}

                      {productType === "product" && !manageByPrice && expandedSections.reorderLevel && (
                        <FormField
                          control={form.control}
                          name="reorderLevel"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700">Reorder Level</FormLabel>
                                <button type="button" onClick={() => toggleSection("reorderLevel")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl>
                                <Input type="number" placeholder="0" className="h-10" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-400 mt-1">Alert when stock falls below this level</p>
                            </FormItem>
                          )}
                        />
                      )}

                      {expandedSections.expiryDate && (
                        <FormField
                          control={form.control}
                          name="expiryDate"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-gray-700 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-400" />Expiry Date</FormLabel>
                                <button type="button" onClick={() => toggleSection("expiryDate")} className="text-gray-300 hover:text-gray-500"><X className="h-4 w-4" /></button>
                              </div>
                              <FormControl>
                                <Input type="date" className="h-10" {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Add optional fields */}
                {optionalFieldButtons.filter(f => f.forTypes.includes(productType as string) && !expandedSections[f.key] && !(f.hideWhenByPrice && manageByPrice)).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Add more fields</p>
                    <div className="flex flex-wrap gap-2">
                      {optionalFieldButtons
                        .filter(f => f.forTypes.includes(productType as string) && !expandedSections[f.key] && !(f.hideWhenByPrice && manageByPrice))
                        .map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleSection(key)}
                            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-700 bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-200 px-3 py-1.5 rounded-lg transition-all"
                          >
                            <Plus className="h-3 w-3" />
                            {label}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="space-y-5">

                {/* Actions */}
                <Card className="shadow-sm border-gray-100">
                  <CardContent className="pt-5 space-y-3">
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="w-full h-10 bg-purple-600 hover:bg-purple-700 font-medium"
                    >
                      {mutation.isPending
                        ? (isEditMode ? "Saving…" : "Creating…")
                        : (isEditMode ? "Save Changes" : "Create Product")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(productsRoute)}
                      className="w-full h-10"
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>

                {/* Product Settings */}
                {productType === "product" && (
                  <Card className="shadow-sm border-gray-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {/* Bundle Product — opens dialog directly */}
                      <button
                        type="button"
                        onClick={() => setIsBundleDialogOpen(true)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors w-full text-left"
                      >
                        <Package className={`h-4 w-4 flex-shrink-0 ${isBundle ? "text-green-600" : "text-gray-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700">Bundle Product</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isBundle
                              ? `${Object.keys(selectedBundleProducts).length} product${Object.keys(selectedBundleProducts).length !== 1 ? "s" : ""} selected — tap to edit`
                              : "Contains multiple products"}
                          </p>
                        </div>
                        {isBundle && (
                          <span className="text-xs font-semibold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                            {Object.keys(selectedBundleProducts).length}
                          </span>
                        )}
                      </button>

                      {/* Inline bundle items list */}
                      {isBundle && Object.keys(selectedBundleProducts).length > 0 && (
                        <div className="mx-3 mb-1 space-y-1.5">
                          {Object.entries(selectedBundleProducts).map(([productId, data]) => {
                            const productData = typeof data === "object" && "productName" in data
                              ? data
                              : { quantity: typeof data === "object" ? data.quantity : data, productName: undefined };
                            const prod = products?.find((p) => String(p.id) === productId);
                            return (
                              <div key={productId} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <p className="text-xs font-medium text-gray-700 flex-1 truncate">
                                  {prod?.name || productData.productName || `Product ${productId}`}
                                </p>
                                <div className="flex items-center gap-1.5 ml-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={productData.quantity}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value) || 1;
                                      setSelectedBundleProducts((prev) => ({
                                        ...prev,
                                        [productId]: {
                                          ...(typeof prev[productId] === "object" ? prev[productId] : { productId, inventoryId: "", quantity: 1 }),
                                          quantity: newQty,
                                        },
                                      }));
                                    }}
                                    className="w-14 h-7 text-xs text-center"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const n = { ...selectedBundleProducts };
                                      delete n[productId];
                                      setSelectedBundleProducts(n);
                                    }}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Other settings */}
                      {[
                        { name: "manageByPrice" as const, label: "Sell by Price", desc: "Use price-based selling" },
                      ].map(({ name, label, desc }) => (
                        <FormField
                          key={name}
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 space-y-0 transition-colors">
                              <FormControl>
                                <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="flex-1 min-w-0">
                                <FormLabel className="text-sm font-medium text-gray-700 cursor-pointer">{label}</FormLabel>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </CardContent>

                    {/* Bundle selector dialog lives here */}
                    <BundleProductsSelector
                      selectedBundleProducts={selectedBundleProducts}
                      onToggleProduct={(productId: string, productData?: any) => {
                        if (selectedBundleProducts[productId]) {
                          const n = { ...selectedBundleProducts };
                          delete n[productId];
                          setSelectedBundleProducts(n);
                        } else {
                          setSelectedBundleProducts((prev) => ({
                            ...prev,
                            [productId]: { quantity: 1, productId, inventoryId: productData?.inventoryId || productData?._id || "", productName: productData?.name, sellingPrice: productData?.sellingPrice },
                          }));
                        }
                      }}
                      onUpdateQuantity={(productId: string, quantity: number) => {
                        setSelectedBundleProducts((prev) => ({
                          ...prev,
                          [productId]: {
                            ...(typeof prev[productId] === "object" ? prev[productId] : { productId, inventoryId: "", quantity: 1 }),
                            quantity,
                          },
                        }));
                      }}
                      onRemoveProduct={(productId: string) => {
                        const n = { ...selectedBundleProducts };
                        delete n[productId];
                        setSelectedBundleProducts(n);
                      }}
                      shopId={shopId}
                      adminId={adminId}
                      existingProducts={products || []}
                      excludeProductId={productId || ""}
                      isOpen={isBundleDialogOpen}
                      onClose={() => setIsBundleDialogOpen(false)}
                    />
                  </Card>
                )}

                {/* Help hint */}
                <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3">
                  <p className="text-xs font-medium text-purple-700 mb-1">
                    {productType === "product" ? "Physical Product" : productType === "service" ? "Service" : "Virtual Item"}
                  </p>
                  <p className="text-xs text-purple-500 leading-relaxed">
                    {productType === "product"
                      ? "Track inventory, set buying & selling prices, and manage stock levels."
                      : productType === "service"
                      ? "Services don't require inventory tracking. Set a price and you're ready."
                      : "Virtual items are digital goods — no physical stock needed."}
                  </p>
                </div>
              </div>

            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
