import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeId, normalizeIds } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, Calculator, Package, Minus, Plus, Trash2, CreditCard, Wallet, Smartphone, Building, Banknote, Split, User, X, Edit3, Calendar, Clock, UserCheck, Grid3X3, Table, PlusCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiCall } from "@/lib/api-config";
import { ENDPOINTS } from "@/lib/api-endpoints";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useProducts } from "@/contexts/ProductsContext";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useAuth } from "@/features/auth/useAuth";
import { useSelector } from "react-redux";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useCurrency } from "@/utils";
import type { RootState } from "@/store";
import type { Product, CartItem, Customer, Transaction } from "@shared/schema";

interface ProductGridProps {
  activeCategory: string;
  searchQuery: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
  onAddToCart: (product: any) => void;
  onOpenCalculator: () => void;
  cartItems: CartItem[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  onUpdateQuantity: (id: string | number, quantity: number, productData?: any) => void;
  onUpdatePrice: (id: string | number, newPrice: number, buyingPrice?: number) => void;
  onApplyDiscount: (id: string | number, discountAmount: number) => void;
  onClearCart: () => void;
  onCheckout: (transaction: Transaction) => void;
  taxRate: number;
  shopId?: string;
  adminId?: string;
  saleType: string;
  onSaleTypeChange: (saleType: string) => void;
  getPriceForSaleType: (product: any, saleType: string) => number;
  // POS Permission flags
  canSetSaleDate?: boolean;
  canSell?: boolean;
  canSellToDealer?: boolean;
  canDiscount?: boolean;
  canEditPrice?: boolean;
  orderId?: string | number;
}


export default function ProductGrid({
  activeCategory,
  searchQuery,
  onCategoryChange,
  onSearchChange,
  onAddToCart,
  cartItems,
  totals,
  onUpdateQuantity,
  onUpdatePrice,
  onApplyDiscount,
  onClearCart,
  onCheckout,
  taxRate,
  shopId,
  adminId,
  saleType,
  onSaleTypeChange,
  getPriceForSaleType,
  canSetSaleDate = true,
  canSellToDealer = true,
  canDiscount = true,
  canEditPrice = true,
  orderId
}: ProductGridProps) {
  const { attendant } = useAttendantAuth();
  const { admin } = useAuth();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);
  const { shopData } = usePrimaryShop();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showCardInterface, setShowCardInterface] = useState(false);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [showCategoriesDrawer, setShowCategoriesDrawer] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [selectedPriceItem, setSelectedPriceItem] = useState<CartItem | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [showMinPriceWarning, setShowMinPriceWarning] = useState(false);
  const [minPriceWarningData, setMinPriceWarningData] = useState<{ attempted: number; minimum: number } | null>(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [selectedDiscountItem, setSelectedDiscountItem] = useState<CartItem | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
 
  // Payment-specific input states
  const [mpesaTransactionId, setMpesaTransactionId] = useState("");
  const [bankTransactionId, setBankTransactionId] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [splitAmounts, setSplitAmounts] = useState({
    cash: 0,
    mpesa: 0,
    bank: 0
  });
  
  // Date/time override states
  const [isCustomDateTime, setIsCustomDateTime] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const { toast } = useToast();
  const { hasAttendantPermission } = usePermissions();
  const queryClient = useQueryClient();
  const { products: allProducts, isLoading, refreshProducts,hasMore,fetchMoreProducts } = useProducts();
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table'); // Default to restaurant grid view

  // Custom item states
  const [showCustomItemDialog, setShowCustomItemDialog] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemType, setCustomItemType] = useState("service");
  const [customItemBuyingPrice, setCustomItemBuyingPrice] = useState("");
  const [customItemQuantity, setCustomItemQuantity] = useState("1");
  const [showCustomItemOptions, setShowCustomItemOptions] = useState(false);
  const [isCreatingCustomItem, setIsCreatingCustomItem] = useState(false);

  const currency = useCurrency();

  // Sell-by-price amount entry
  const [priceEntryProduct, setPriceEntryProduct] = useState<any>(null);
  const [priceEntryAmount, setPriceEntryAmount] = useState("");

  const handleAddToCart = (product: any) => {
    if (product.manageByPrice) {
      setPriceEntryAmount("");
      setPriceEntryProduct(product);
    } else {
      onAddToCart(product);
    }
  };

  const confirmPriceEntry = () => {
    const amount = parseFloat(priceEntryAmount);
    if (!priceEntryProduct || isNaN(amount) || amount <= 0) return;
    // Preserve the product's reference selling price (cost-per-unit basis) so
    // the cart can derive costPrice = amount × (buyingPrice / refSellingPrice)
    const refSellingPrice =
      parseFloat(String(priceEntryProduct.sellingPrice || priceEntryProduct.price || 0)) || 0;
    onAddToCart({
      ...priceEntryProduct,
      sellingPrice: amount,
      price: amount,
      _refSellingPrice: refSellingPrice,
    });
    setPriceEntryProduct(null);
    setPriceEntryAmount("");
  };

  // Local search function
  const searchLocally = (query: string) => {
    const searchTerm = query.toLowerCase();
    return allProducts.filter(product =>
      product.name?.toLowerCase().includes(searchTerm) ||
      product.title?.toLowerCase().includes(searchTerm) ||
      product.description?.toLowerCase().includes(searchTerm)
    );
  };

  // Server-side search function (fallback)
  const searchServer = async (query: string) => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        search: query,
        shopId: shopId || "",
      });

      const response = await apiCall(`${ENDPOINTS.products.getAll}?${params.toString()}`, {
        method: 'GET'
      });

      const data = await response.json();
      
      // Handle different response structures
      let productList: any[] = [];
      if (Array.isArray(data)) {
        productList = data;
      } else if (data.data && Array.isArray(data.data)) {
        productList = data.data;
      } else if (data.products && Array.isArray(data.products)) {
        productList = data.products;
      }

      return productList;
    } catch (error) {
      console.error('Server search failed:', error);
      return [];
    }
  };

  // Combined search function - local first, then server
  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // First, search locally
    const localResults = searchLocally(query);
    
    if (localResults.length > 0) {
      // Found results locally, use them
      setSearchResults(localResults);
      setIsSearching(false);
      return;
    }

    // No local results, search server
    const serverResults = await searchServer(query);
    
    setSearchResults(serverResults);
    setIsSearching(false);
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchProducts(searchQuery);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, shopId, adminId]);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
  
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreProducts();
        }
      },
      {
        rootMargin: "300px",
        threshold: 0.1
      }
    );
  
    const target = loaderRef.current;
    observer.observe(target);
  
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, fetchMoreProducts]);
  
  
  
  // Filter products based on category and search query
  const products = useMemo(() => {
    // If user is searching, use search results instead of local filtering
    if (searchQuery && searchResults.length > 0) {
      return searchResults;
    }

    // If user is searching but no results yet, show loading or empty state
    if (searchQuery && isSearching) {
      return [];
    }

    // If search query exists but no results and not searching, no matches found
    if (searchQuery && !isSearching && searchResults.length === 0) {
      return [];
    }

    // Default: use all products with category filtering
    let filteredProducts = allProducts;

    // Filter by category
    if (activeCategory !== "all") {
      filteredProducts = filteredProducts.filter(product =>
        product.category?.id?.toString() === activeCategory?.toString() ||
        product.category?.name === activeCategory
      );
    }

    return filteredProducts;
  }, [allProducts, activeCategory, searchQuery, searchResults, isSearching]);

  const { data: customersResponse, isLoading: customersLoading } = useQuery({
    queryKey: ["customers", adminId, shopId],
    queryFn: async () => {
      const params = new URLSearchParams({
        adminid: adminId || "",
        shopId: shopId || ""
      });
      const response = await apiCall(`${ENDPOINTS.customers.getAll}?${params.toString()}`, {
        method: "GET",
      });
      const data = await response.json();
      return data;
    },
    enabled: !!adminId && !!shopId, // Load customers when POS loads
    staleTime: 0, // No caching - always fetch fresh data
    gcTime: 0,    // No garbage collection time
    refetchOnMount: 'always' // Always refetch when component mounts
  });

  const { data: categoriesResponse } = useQuery({
    queryKey: ["categories", adminId, shopId],
    queryFn: async () => {
      const params = new URLSearchParams({
        adminid: adminId || "",
        shopId: shopId || ""
      });
      const response = await apiCall(`${ENDPOINTS.products.getCategories}?${params.toString()}`, {
        method: "GET",
      });
      return response.json();
    },
    enabled: !!adminId && !!shopId
  });

  const categories = Array.isArray(categoriesResponse) 
    ? categoriesResponse 
    : categoriesResponse?.categories || categoriesResponse?.data || [];

  const customers = normalizeIds(
    Array.isArray(customersResponse)
      ? customersResponse
      : customersResponse?.customers || customersResponse?.data || []
  );
    
  const selectedCustomer = Array.isArray(customers) 
    ? customers.find(c => {
        const customerId = c._id || c.id;
        return customerId != null && String(customerId) === String(selectedCustomerId);
      })
    : null;

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any): Promise<any> => {
      const response = await apiCall(ENDPOINTS.sales.create, {
        method: "POST",
        body: JSON.stringify(transactionData),
      });
      
      const data = await response.json();
      return data;
    },
    onSuccess: (response: any, variables: any) => {
      console.log("Transaction successful:", response);
      
      // Invalidate all sales-related and dashboard queries
      const isDashboardOrSalesKey = (query: any) => {
        const key = String(query.queryKey[0] || '');
        return (
          key.includes('/api/sales') ||
          key.includes('/api/analysis') ||
          key.includes('/api/reports') ||
          key.includes('/api/product') ||
          key.includes('recent-transactions') ||
          key.includes('overdue-customers') ||
          key.includes('dashboard') ||
          key.includes('shops')
        );
      };
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ predicate: isDashboardOrSalesKey });
      queryClient.refetchQueries({ predicate: isDashboardOrSalesKey });
      
      // Also refresh ProductsContext to update POS grid immediately
      refreshProducts();
      
      // Check if this was a hold transaction - don't show receipt for holds
      const isHoldTransaction = variables.status === "hold" || variables.salesnote === "HOLD TRANSACTION";
      
      if (!isHoldTransaction) {
        // Only show receipt for regular payments
        const realTransaction: Transaction = {
          id: response.data?.receiptNo || response.data?.id || response.sale?.receiptNo || response.sale?.id || Date.now(),
          items: cartItems,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          paymentMethod: selectedPaymentMethod,
          customerName: selectedCustomer?.name,
          timestamp: response.data?.createdAt || response.sale?.createdAt || new Date().toISOString(),
          shopId: shopId || "",
          adminId: adminId || "",
        };
        
        onCheckout(realTransaction);
      }
      
      setShowPaymentDialog(false);
      setSelectedPaymentMethod("");
      setSelectedCustomerId("");
      onClearCart();
    },
    onError: (error: any) => {
      console.error("Transaction error:", error);
      
      // Extract meaningful error message from API error response
      let errorMessage = "Failed to process payment. Please try again.";
      
      // Handle different error formats from the API
      if (error?.message) {
        // Check if it's our standard API request error format
        if (error.message.includes("API request failed:")) {
          // Format: "API request failed: 400 Bad Request - {"error":"customer has no enough balance in the wallet"}"
          const match = error.message.match(/API request failed: \d+ .+ - (.+)$/);
          if (match) {
            try {
              const errorData = JSON.parse(match[1]);
              if (errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (parseError) {
              errorMessage = match[1];
            }
          }
        } else if (error.message.match(/^(\d+):\s*(.+)$/)) {
          // Parse error message in format "status: response"
          const statusMatch = error.message.match(/^(\d+):\s*(.+)$/);
          if (statusMatch) {
            const [, statusCode, responseBody] = statusMatch;
            try {
              const errorData = JSON.parse(responseBody);
              if (errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (parseError) {
              errorMessage = responseBody || `Request failed with status ${statusCode}`;
            }
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      // Customize specific error messages for better user experience
      if (errorMessage.includes("customer has no enough balance in the wallet")) {
        errorMessage = "Customer doesn't have enough balance in their wallet. Please choose a different payment method or top up the wallet.";
      } else if (errorMessage.includes("Insufficient quantity of product")) {
        const productMatch = errorMessage.match(/Insufficient quantity of product (.+)/);
        const productName = productMatch ? productMatch[1] : "item";
        errorMessage = `Not enough stock for ${productName}. Please check inventory levels.`;
      }
      
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method);
    
    if (method === "card") {
      setShowCardInterface(true);
      setIsProcessingCard(true);
      
      // Simulate card reading process
      setTimeout(() => {
        setIsProcessingCard(false);
      }, 3000);
    }
  };

  const handlePriceChange = (item: CartItem) => {
    if (!canEditPrice) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit prices",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedPriceItem(item);
    setNewPrice(item.price.toString());
    setShowPriceDialog(true);
  };

  const handlePriceUpdate = () => {
    if (!selectedPriceItem) return;

    const price = parseFloat(newPrice);
    const allSources = [...allProducts, ...searchResults];
    const productData = allSources.find(p => (p as any)._id === selectedPriceItem.id || p.id === selectedPriceItem.id);
    const buyingPrice = (productData as any)?.buyingPrice;
    const rawMin = (productData as any)?.minSellingPrice;
    const minSellingPrice = rawMin != null ? (parseFloat(String(rawMin)) || 0) : 0;
    const existingDiscount = parseFloat(String(selectedPriceItem.discount || 0)) || 0;
    const effectivePrice = price - existingDiscount;

    if (minSellingPrice > 0 && effectivePrice < minSellingPrice) {
      setMinPriceWarningData({ attempted: effectivePrice, minimum: minSellingPrice });
      setShowMinPriceWarning(true);
      return;
    }

    onUpdatePrice(selectedPriceItem.id, price, buyingPrice);

    setShowPriceDialog(false);
    setSelectedPriceItem(null);
    setNewPrice("");
  };

  const handlePriceDialogClose = () => {
    setShowPriceDialog(false);
    setSelectedPriceItem(null);
    setNewPrice("");
  };

  const handleDiscountChange = (item: CartItem) => {
    if (!canDiscount) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to apply discounts",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedDiscountItem(item);
    setDiscountAmount(item.discount && item.discount > 0 ? item.discount.toString() : "");
    setShowDiscountDialog(true);
  };

  const handleDiscountUpdate = () => {
    if (!selectedDiscountItem) return;

    const discount = parseFloat(discountAmount) || 0;

    const allSources = [...allProducts, ...searchResults];
    const productData = allSources.find(p => (p as any)._id === selectedDiscountItem.id || p.id === selectedDiscountItem.id);
    const rawMin = (productData as any)?.minSellingPrice;
    const rawMax = (productData as any)?.maxDiscount ?? selectedDiscountItem.maxDiscount;
    const minSellingPrice = rawMin != null ? (parseFloat(String(rawMin)) || 0) : 0;
    const maxAllowedDiscount = parseFloat(String(rawMax ?? 0)) || 0;

    if (maxAllowedDiscount > 0 && discount > maxAllowedDiscount) {
      toast({
        title: "Discount Too High",
        description: `Maximum allowed discount for this product is Ksh ${maxAllowedDiscount.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    if (maxAllowedDiscount === 0 && discount > 0) {
      toast({
        title: "Discount Not Allowed",
        description: "This product does not allow any discount.",
        variant: "destructive",
      });
      return;
    }

    const finalPrice = selectedDiscountItem.price - discount;
    if (minSellingPrice > 0 && finalPrice < minSellingPrice) {
      setMinPriceWarningData({ attempted: finalPrice, minimum: minSellingPrice });
      setShowMinPriceWarning(true);
      return;
    }

    onApplyDiscount(selectedDiscountItem.id, discount);

    setShowDiscountDialog(false);
    setSelectedDiscountItem(null);
    setDiscountAmount("");
  };

  const handleDiscountDialogClose = () => {
    setShowDiscountDialog(false);
    setSelectedDiscountItem(null);
    setDiscountAmount("");
  };

  const handleCreateCustomItem = async () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim()) {
      toast({ title: "Item name required", variant: "destructive" });
      return;
    }
    if (!customItemPrice || isNaN(price) || price <= 0) {
      toast({ title: "Enter a valid price", variant: "destructive" });
      return;
    }
    setIsCreatingCustomItem(true);
    try {
      const buyingPrice = customItemType === "product" ? parseFloat(customItemBuyingPrice || "0") : 0;
      const quantity = customItemType === "product" ? parseInt(customItemQuantity || "1") : 0;

      const response = await apiCall(ENDPOINTS.products.create, {
        method: "POST",
        body: JSON.stringify({
          name: customItemName.trim(),
          shopId,
          sellingPrice: price,
          wholesalePrice: price,
          dealerPrice: price,
          buyingPrice,
          quantity,
          type: customItemType,
        }),
      });
      const json = await response.json();
      const product = normalizeId(json?.data || json);
      onAddToCart(product);
      setShowCustomItemDialog(false);
      setCustomItemName("");
      setCustomItemPrice("");
      setCustomItemType("service");
      setCustomItemBuyingPrice("");
      setCustomItemQuantity("1");
      setShowCustomItemOptions(false);
      toast({ title: "Custom item added", description: `"${product.name}" added to cart` });
    } catch (err: any) {
      toast({ title: "Failed to add item", description: err.message || "Could not create custom item", variant: "destructive" });
    } finally {
      setIsCreatingCustomItem(false);
    }
  };

  const processTransaction = async (isHold = false) => {
    // For hold transactions, skip payment method validations
    if (!isHold) {
      if (!selectedPaymentMethod) return;
      
      // Validate payment-specific requirements
      
      
      if (selectedPaymentMethod === "credit") {
        if (!selectedCustomerId) {
          toast({
            title: "Customer Required",
            description: "Please select a customer for credit sale",
            variant: "destructive",
          });
          return;
        }
        
        if (!creditDueDate) {
          toast({
            title: "Due Date Required",
            description: "Please select a due date for credit sale",
            variant: "destructive",
          });
          return;
        }
      }
      
      if (selectedPaymentMethod === "split") {
        const totalSplit = splitAmounts.cash + splitAmounts.mpesa + splitAmounts.bank;
        if (Math.abs(totalSplit - totals.total) > 0.01) {
          toast({
            title: "Amount Mismatch",
            description: `Split amounts (${totalSplit.toFixed(2)}) must equal total (${totals.total.toFixed(2)})`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Get attendant ID and shopId based on user type
    let attendantId: string | undefined;
    let shopId: string | undefined;

    if (attendant?._id) {
      // Attendant flow
      attendantId = attendant._id;
      shopId = typeof attendant.shopId === 'object' ? attendant.shopId._id : attendant.shopId;
    } else if (admin) {
      // Admin flow - extract string IDs properly
      const adminAttendantId = typeof admin.attendantId === 'object' && admin.attendantId ? (admin.attendantId as any)._id : admin.attendantId;
      const adminId = (admin as any)._id || (admin as any).id;
      attendantId = adminAttendantId || (adminId ? String(adminId) : undefined);
      
      // Ensure shopId is a string, not an object
      let adminShopId = selectedShopId || admin.primaryShop;
      if (typeof adminShopId === 'object' && adminShopId && (adminShopId as any)._id) {
        shopId = String((adminShopId as any)._id);
      } else if (typeof adminShopId === 'string') {
        shopId = adminShopId;
      } else if (typeof adminShopId === 'number') {
        shopId = String(adminShopId);
      } else {
        shopId = undefined;
      }
    }
    


    // Validate required fields
    if (!shopId) {
      toast({
        title: "Shop ID Missing",
        description: "Unable to determine shop ID. Please contact administrator.",
        variant: "destructive",
      });
      return;
    }

    if (!attendantId) {
      toast({
        title: "Attendant ID Missing", 
        description: "Unable to determine attendant ID. Please re-login.",
        variant: "destructive",
      });
      return;
    }

    // Normalize client slug → DB payment_methods.name (case-insensitive lookup)
    const normalizeMethod = (slug: string): string => {
      const map: Record<string, string> = {
        cash: "cash",
        mpesa: "m-pesa",
        "m-pesa": "m-pesa",
        bank: "bank transfer",
        "bank transfer": "bank transfer",
        card: "card",
        wallet: "wallet",
      };
      return map[slug.toLowerCase()] ?? slug.toLowerCase();
    };

    // Build the payments array for split payments
    const buildPayments = () => {
      if (isHold || selectedPaymentMethod !== "split") return undefined;
      const payments = [];
      if (splitAmounts.cash > 0) payments.push({ method: normalizeMethod("cash"), amount: splitAmounts.cash });
      if (splitAmounts.mpesa > 0) payments.push({ method: normalizeMethod("mpesa"), amount: splitAmounts.mpesa });
      if (splitAmounts.bank > 0) payments.push({ method: normalizeMethod("bank"), amount: splitAmounts.bank });
      return payments.length > 0 ? payments : undefined;
    };

    // For credit sales the sale-type is determined by outstanding > 0,
    // not by the paymentMethod field. Send "cash" so the API can resolve it.
    const effectivePaymentMethod = selectedPaymentMethod === "credit" ? "cash" : selectedPaymentMethod;

    const transactionData = {
      items: cartItems.map(item => ({
        productId: item.id,
        quantity: parseFloat(item.quantity.toString()),
        price: parseFloat(item.price.toString()),
        costPrice: parseFloat((item.buyingPrice || 0).toString()),
        discount: item.discount || 0,
        saleType: saleType,
      })),
      shopId: shopId || "",
      saleType: saleType,
      saleDate: (!isHold && isCustomDateTime && customDateTime) ? customDateTime : undefined,
      note: "",
      held: isHold ? true : undefined,
      dueDate: selectedPaymentMethod === "credit" ? creditDueDate : undefined,
      amountPaid: isHold || selectedPaymentMethod === "credit" ? 0.0 :
                 selectedPaymentMethod === "split" ? (splitAmounts.cash + splitAmounts.mpesa + splitAmounts.bank) :
                 parseFloat(totals.total.toString()),
      paymentMethod: isHold ? "cash" : effectivePaymentMethod !== "split" ? normalizeMethod(effectivePaymentMethod) : undefined,
      payments: buildPayments(),
      discount: parseFloat(totals.discount.toString()),
      customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
    };

    try {
      await createTransactionMutation.mutateAsync(transactionData);
      if (isHold) {
        setShowHoldSuccessDialog(true);
      } else if (selectedPaymentMethod === "credit") {
        toast({
          title: "Credit Sale Created",
          description: `Credit sale created for ${selectedCustomer?.name || 'customer'} due ${creditDueDate}`,
        });
      }
      // Receipt handling and cleanup is now done in mutation's onSuccess callback
    } catch (error: any) {
      console.error(`${isHold ? 'Hold' : 'Payment'} transaction failed:`, error);
      toast({
        title: `${isHold ? 'Hold' : 'Payment'} Failed`,
        description: error.message || `Failed to ${isHold ? 'hold' : 'process'} transaction`,
        variant: "destructive",
      });
    }
  };

  const handleCompletePayment = () => {
    processTransaction(false);
  };

  const isLaundryShop = (shopData?.shopCategoryId?.name || '').toLowerCase().includes('laundry');
  const [mainCustomerSearch, setMainCustomerSearch] = useState('');
  const [showMainCustomerDropdown, setShowMainCustomerDropdown] = useState(false);
  const [showHoldCustomerDialog, setShowHoldCustomerDialog] = useState(false);
  const [showHoldReadyDateDialog, setShowHoldReadyDateDialog] = useState(false);
  const [holdCustomerSearch, setHoldCustomerSearch] = useState('');
  const [readyDate, setReadyDate] = useState('');
  const [isHoldProcessing, setIsHoldProcessing] = useState(false);
  const [showHoldSuccessDialog, setShowHoldSuccessDialog] = useState(false);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '', address: '' });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomerForm) => {
      const response = await apiCall(ENDPOINTS.customers.create, {
        method: 'POST',
        body: JSON.stringify({
          name: data.name.trim(),
          phone: data.phone,
          email: data.email,
          address: data.address,
          shopId: shopId,
        }),
      });
      return response.json();
    },
    onSuccess: (createdCustomer: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.refetchQueries({ queryKey: ['customers'] });
      // API wraps in { success, data } — handle both shapes
      const raw = createdCustomer?.data ?? createdCustomer;
      const newId = String(raw?._id || raw?.id || raw?.customer?._id || '');
      if (newId) setSelectedCustomerId(String(newId));
      setNewCustomerForm({ name: '', phone: '', email: '', address: '' });
      setShowAddCustomerDialog(false);
      toast({ title: 'Customer added', description: `${variables.name} has been added and selected.` });
    },
    onError: () => {
      toast({ title: 'Failed to create customer', variant: 'destructive' });
    },
  });

  const handleHoldTransaction = async () => {
    if (cartItems.length === 0) return;
    if (!selectedCustomerId) {
      setShowHoldCustomerDialog(true);
      return;
    }
    // For laundry shops, always show ready date dialog even when customer is pre-selected
    if (isLaundryShop) {
      setShowHoldReadyDateDialog(true);
      return;
    }
    await processTransaction(true);
  };

  const handleConfirmHoldWithCustomer = async () => {
    if (!selectedCustomerId) {
      toast({
        title: "Customer Required",
        description: "Please select a customer to place this sale on hold.",
        variant: "destructive",
      });
      return;
    }
    setIsHoldProcessing(true);
    await processTransaction(true);
    setIsHoldProcessing(false);
    setShowHoldCustomerDialog(false);
  };

  const resetPaymentDialog = () => {
    setShowPaymentDialog(false);
    setSelectedPaymentMethod("");
    setShowCardInterface(false);
    setIsProcessingCard(false);
    setMpesaTransactionId("");
    setBankTransactionId("");
    setCreditDueDate("");
    setSplitAmounts({ cash: 0, mpesa: 0, bank: 0 });
    setIsCustomDateTime(false);
    setCustomDateTime("");
  };


  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Mobile Navigation Bar */}
      <div className="md:hidden bg-purple-600 text-white p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-400 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <h1 className="text-lg font-semibold">POS System</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Mobile View Toggle */}
            <div className="flex bg-purple-500 rounded-md p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-6 px-2 text-xs bg-transparent hover:bg-purple-400"
              >
                <Grid3X3 className="h-3 w-3" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-6 px-2 text-xs bg-transparent hover:bg-purple-400"
              >
                <Table className="h-3 w-3" />
              </Button>
            </div>
            
            <Button 
              onClick={() => setShowCategoriesDrawer(true)}
              variant="outline"
              className="border-purple-300 text-purple-100 hover:bg-purple-500 h-8 px-3 text-sm"
            >
              Category
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Header Bar - No search on mobile */}
      <div className="hidden md:block bg-white shadow-sm border-b border-gray-200">
        <div className="px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-800"></h1>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 px-2"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Cards</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-7 px-2"
                >
                  <Table className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
              </div>
              
              {viewMode === 'grid' ? <Button
                onClick={() => setShowCategoriesDrawer(true)}
                className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 text-sm whitespace-nowrap"
              >
                Category
              </Button> : <></>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Transaction Form */}
        <div className={`w-full ${viewMode === 'table' ? 'lg:w-2/3' : 'lg:w-2/3'} p-2 lg:p-6 bg-white order-2 lg:order-1 overflow-y-auto`}>
          {/* Mobile: Stack vertically, Desktop: 2 columns */}
          <div className="mb-3 lg:mb-6">
            <label className="text-xs lg:text-sm font-medium text-gray-700 block mb-1 lg:mb-2">Date</label>
            <Input 
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]} 
              className="h-8 lg:h-10 text-xs lg:text-sm" 
              disabled={!canSetSaleDate}
              readOnly={!canSetSaleDate}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-6 mb-3 lg:mb-6">
            <div>
              <label className="text-xs lg:text-sm font-medium text-gray-700 block mb-1 lg:mb-2">Select Customer</label>
              <div className="flex gap-1 lg:gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    className="h-8 lg:h-10 pl-7 pr-2 text-xs lg:text-sm"
                    placeholder="Walk-in"
                    value={showMainCustomerDropdown ? mainCustomerSearch : (selectedCustomer ? selectedCustomer.name : '')}
                    onFocus={() => {
                      setMainCustomerSearch('');
                      setShowMainCustomerDropdown(true);
                    }}
                    onChange={(e) => {
                      setMainCustomerSearch(e.target.value);
                      setShowMainCustomerDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowMainCustomerDropdown(false), 150)}
                  />
                  {showMainCustomerDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {/* Walk-in option */}
                      <div
                        className={`px-3 py-2 text-xs lg:text-sm cursor-pointer hover:bg-gray-50 ${!selectedCustomerId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                        onMouseDown={() => { setSelectedCustomerId(''); setMainCustomerSearch(''); setShowMainCustomerDropdown(false); }}
                      >
                        Walk-in
                      </div>
                      {/* Filtered customers */}
                      {customers
                        .filter((c: any) => {
                          if (!mainCustomerSearch) return true;
                          const term = mainCustomerSearch.toLowerCase();
                          return (
                            (c.name || '').toLowerCase().includes(term) ||
                            (c.phone || '').toLowerCase().includes(term) ||
                            (c.phonenumber || '').toLowerCase().includes(term)
                          );
                        })
                        .map((customer: any) => {
                          const cId = customer._id || customer.id;
                          return (
                            <div
                              key={cId}
                              className={`px-3 py-2 text-xs lg:text-sm cursor-pointer hover:bg-gray-50 ${String(selectedCustomerId) === String(cId) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                              onMouseDown={() => { setSelectedCustomerId(String(cId)); setMainCustomerSearch(''); setShowMainCustomerDropdown(false); }}
                            >
                              <div className="font-medium">{customer.name}</div>
                            </div>
                          );
                        })}
                      {/* Add new customer shortcut at bottom of dropdown */}
                      {(hasAttendantPermission('customers', 'manage') || !!admin) && (
                        <div
                          className="px-3 py-2 text-xs text-purple-600 font-medium cursor-pointer hover:bg-purple-50 border-t flex items-center gap-1.5"
                          onMouseDown={() => {
                            setShowMainCustomerDropdown(false);
                            setNewCustomerForm(f => ({ ...f, name: mainCustomerSearch.trim() }));
                            setShowAddCustomerDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          {mainCustomerSearch.trim()
                            ? `Add "${mainCustomerSearch.trim()}" as new customer`
                            : 'Add new customer'}
                        </div>
                      )}
                      {mainCustomerSearch && customers.filter((c: any) => {
                        const term = mainCustomerSearch.toLowerCase();
                        return (c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term) || (c.phonenumber || '').toLowerCase().includes(term);
                      }).length === 0 && !(hasAttendantPermission('customers', 'manage') || !!admin) && (
                        <div className="px-3 py-3 text-xs text-gray-400 text-center">No customers found</div>
                      )}
                    </div>
                  )}
                </div>
                {/* Add Customer Button */}
                {(hasAttendantPermission('customers', 'manage') || !!admin) && (
                  <Button
                    onClick={() => {
                      setNewCustomerForm({ name: '', phone: '', email: '', address: '' });
                      setShowAddCustomerDialog(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white h-8 lg:h-10 px-2 lg:px-4"
                    title="Add new customer"
                  >
                    <Plus className="h-3 w-3 lg:h-4 lg:w-4" />
                  </Button>
                )}
              </div>
              
              {/* Customer Balance Display */}
              {selectedCustomer && (
                <div className="mt-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-gray-500">Bal:</span>
                  <span className={`font-semibold ${
                    parseFloat(selectedCustomer.wallet || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Ksh {parseFloat(selectedCustomer.wallet || '0').toFixed(2)}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500">Limit: Ksh {parseFloat(selectedCustomer.creditLimit || '0').toFixed(2)}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs lg:text-sm font-medium text-gray-700 block mb-1 lg:mb-2">Sale Type</label>
              <select 
                value={saleType}
                onChange={(e) => onSaleTypeChange(e.target.value)}
                className="w-full h-8 lg:h-10 px-2 lg:px-3 border border-gray-300 rounded text-xs lg:text-sm bg-white cursor-pointer"
                disabled={false}
              >
                <option value="Retail">Retail</option>
                {canSellToDealer && <option value="Wholesale">Wholesale</option>}
                {canSellToDealer && <option value="Dealer">Dealer</option>}
              </select>
            </div>
          </div>

          {/* Table Mode - Product Search Bar */}
          {viewMode === 'table' && (
            <div className="mb-4">
              <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Scan barcode or search products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 h-10 text-sm border-gray-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  autoFocus
                />
                
                {/* Search Results Dropdown */}
                {searchQuery && viewMode === 'table' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-500">Searching...</p>
                      </div>
                    ) : isSearching ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">Searching...</p>
                      </div>
                    ) : products.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No products found</p>
                      </div>
                    ) : (
                      products.slice(0, 8).map((product: any) => {
                        const isService = product?.type === 'service' || product?.type === 'virtual';
                        const isOutOfStock = !isService && (product.quantity === 0);
                        return (
                        <div
                          key={product.id}
                          onClick={isOutOfStock ? undefined : () => {
                            handleAddToCart(product);
                            onSearchChange(''); // Clear search after adding
                          }}
                          className={`flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </h4>
                            <div className="flex items-center space-x-3 mt-1">
                              {isService ? (
                                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Service</span>
                              ) : isOutOfStock ? (
                                <span className="text-xs text-red-600">Out of stock</span>
                              ) : (
                                <span className="text-xs text-gray-500">Stock: {product.quantity || 0}</span>
                              )}
                              {product.barcode && (
                                <span className="text-xs text-purple-600 font-mono">
                                  {product.barcode}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <span className="text-sm font-semibold text-green-600">
                              Ksh {(+getPriceForSaleType(product, saleType)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomItemDialog(true)}
                className="h-10 px-3 border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 whitespace-nowrap shrink-0"
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />
                Custom Item
              </Button>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="border border-gray-200 rounded-lg mb-3 lg:mb-6 overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-3 lg:px-6 py-2 lg:py-3 border-b border-gray-200">
              <h3 className="text-xs lg:text-sm font-semibold text-gray-700">Transaction Items</h3>
            </div>

            {/* Desktop Table Header */}
            <div className="bg-gray-100 hidden lg:grid grid-cols-6 gap-2 lg:gap-4 px-3 lg:px-6 py-3 text-xs lg:text-sm font-medium text-gray-700 border-b border-gray-200">
              <div className="col-span-1">Item Name</div>
              <div className="text-right">Unit Price</div>
              <div className="text-center">Qty</div>
              <div className="text-right">Tax</div>
              <div className="text-right">Subtotal</div>
              <div className="text-center">Remove</div>
            </div>
            <div className="min-h-[120px] lg:min-h-[200px] bg-white">
              {cartItems.length === 0 ? (
                <div className="p-6 lg:p-12 text-center text-gray-500">
                  <Package className="h-8 w-8 lg:h-16 lg:w-16 mx-auto mb-3 lg:mb-6 text-gray-300" />
                  <p className="font-semibold text-sm lg:text-lg text-gray-600 mb-1 lg:mb-2">No items added</p>
                  <p className="text-xs lg:text-base text-gray-400">Add products to start the transaction</p>
                </div>
              ) : (
                <div>
                  {cartItems.map((item, index) => {
                    const itemTax = item.total * (taxRate / 100);
                    return (
                      <div key={item.id}>
                        {/* Mobile Layout */}
                        <div className={`lg:hidden px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 1 ? 'bg-gray-25' : 'bg-white'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                              <p className="text-gray-500 text-xs">
                                Ksh {(+item.price).toFixed(2)} × {item.quantity}
                                {item.discount && item.discount > 0 && (
                                  <span className="text-green-600"> (-Ksh {(+item.discount).toFixed(2)})</span>
                                )}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-800 text-sm">Ksh {(+item.total).toFixed(2)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, Math.max(1, item.quantity - 1), productData);
                                }}
                                className="w-6 h-6 p-0 rounded border-gray-300"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value) || 1;
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, Math.max(1, newQuantity), productData);
                                }}
                                className="w-12 h-6 p-1 text-center text-xs font-semibold border-gray-300"
                                min="1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, item.quantity + 1, productData);
                                }}
                                className="w-6 h-6 p-0 rounded border-gray-300"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {canEditPrice && (
                                <button 
                                  onClick={() => handlePriceChange(item)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  Change price
                                </button>
                              )}
                              {canDiscount && (item.maxDiscount || 0) > 0 && (
                                <button 
                                  onClick={() => handleDiscountChange(item)}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  Add discount
                                </button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onUpdateQuantity(item.id, 0)}
                                className="w-6 h-6 p-0 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop Layout */}
                        <div className={`hidden lg:grid grid-cols-6 gap-2 lg:gap-4 px-3 lg:px-6 py-4 border-b border-gray-100 text-sm items-center hover:bg-gray-50 transition-colors ${index % 2 === 1 ? 'bg-gray-25' : 'bg-white'}`}>
                          {/* Column 1: Item Name */}
                          <div className="text-left">
                            <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {canEditPrice && (
                                <button 
                                  onClick={() => handlePriceChange(item)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  Change price
                                </button>
                              )}
                              {canDiscount && (item.maxDiscount || 0) > 0 && (
                                <button 
                                  onClick={() => handleDiscountChange(item)}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  Add discount
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Column 2: Unit Price */}
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">Ksh {(+item.price).toFixed(2)}</p>
                            {item.discount && item.discount > 0 && (
                              <p className="text-xs text-green-600">-Ksh {(+item.discount).toFixed(2)}</p>
                            )}
                          </div>
                          
                          {/* Column 3: Quantity */}
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, Math.max(1, item.quantity - 1), productData);
                                }}
                                className="w-7 h-7 p-0 rounded border-gray-300"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value) || 1;
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, Math.max(1, newQuantity), productData);
                                }}
                                className="w-12 h-7 p-1 text-center text-sm font-semibold border-gray-300"
                                min="1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const productData = allProducts.find(p => p._id === item.id || p.id === item.id);
                                  onUpdateQuantity(item.id, item.quantity + 1, productData);
                                }}
                                className="w-7 h-7 p-0 rounded border-gray-300"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Column 4: Tax */}
                          <div className="text-right">
                            <p className="font-semibold text-orange-600">Ksh {itemTax.toFixed(2)}</p>
                          </div>
                          
                          {/* Column 5: Subtotal */}
                          <div className="text-right">
                            <p className="font-bold text-primary">Ksh {(+item.total).toFixed(2)}</p>
                          </div>
                          
                          {/* Column 6: Remove */}
                          <div className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onUpdateQuantity(item.id, 0)}
                              className="w-7 h-7 p-0 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Grid Mode - Sticky Payment Summary Section */}
          {viewMode === 'grid' && (
            <div className="sticky bottom-0 bg-white mt-6 rounded-t-2xl shadow-lg">
            {/* Summary Section */}
            <div className="bg-gray-50 p-2 lg:p-4">
              <div className="space-y-1 lg:space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs lg:text-sm font-medium text-gray-700">Discount</span>
                  <span className="text-red-500 font-medium text-xs lg:text-sm">- Ksh {totals.discount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs lg:text-sm font-medium text-gray-700">Tax</span>
                  <span className="font-medium text-gray-900 text-xs lg:text-sm">Ksh {totals.tax.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <div className="flex items-center space-x-1 lg:space-x-2">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Coupon</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-4 h-4 lg:w-6 lg:h-6 p-0 rounded border-gray-400 text-gray-600 hover:bg-gray-100"
                    >
                      <Plus className="h-2 w-2 lg:h-3 lg:w-3" />
                    </Button>
                  </div>
                  <span className="font-medium text-gray-900 text-xs lg:text-sm">Ksh 0.00</span>
                </div>
              </div>
              
              {/* Grand Total */}
              <div className="bg-green-600 text-white p-2 lg:p-4 rounded-lg mt-2 lg:mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm lg:text-lg font-semibold">Grand Total:</span>
                  <span className="text-lg lg:text-xl font-bold">Ksh {totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="p-3 lg:p-4 bg-white">
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                <Button 
                  onClick={() => setShowPaymentDialog(true)}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 lg:py-3 text-sm lg:text-base font-semibold rounded-lg"
                  disabled={cartItems.length === 0}
                >
                  Cash-In
                </Button>
                <Button 
                  onClick={onClearCart}
                  variant="outline"
                  className="border-red-400 text-red-600 hover:bg-red-50 py-2 lg:py-3 text-sm lg:text-base font-semibold rounded-lg"
                  disabled={cartItems.length === 0}
                >
                  Clear
                </Button>
                <Button 
                  onClick={handleHoldTransaction}
                  variant="outline"
                  className="border-gray-400 text-gray-700 hover:bg-gray-50 py-2 lg:py-3 text-sm lg:text-base font-semibold rounded-lg"
                  disabled={cartItems.length === 0}
                >
                  Hold
                </Button>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right Panel - Products */}
        {viewMode === 'grid' && (
          <div className="w-full lg:w-1/3 bg-gray-50 p-2 lg:p-6 order-1 lg:order-2 flex flex-col lg:h-full lg:overflow-hidden">
          
          {/* Mobile View Mode */}
          <div className="lg:hidden mb-2">
            {viewMode === 'grid' ? (
              /* Mobile Product Search for Cards Mode */
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 z-10" />
                <Input
                  type="text"
                  placeholder="Search products to add..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-8 h-8 text-sm border-gray-300 bg-white"
                />
                
                {/* Dropdown Results */}
                {searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {isLoading ? (
                      <div className="text-center py-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mx-auto mb-1"></div>
                        <p className="text-xs text-gray-500">Searching...</p>
                      </div>
                    ) : isSearching ? (
                      <div className="text-center py-2 text-gray-500">
                        <p className="text-xs">Searching...</p>
                      </div>
                    ) : products.length === 0 ? (
                      <div className="text-center py-2 text-gray-500">
                        <p className="text-xs">{searchQuery ? "No products found for your search" : "No products found"}</p>
                      </div>
                    ) : (
                      products.map((product: any) => {
                        const price = getPriceForSaleType(product, saleType);
                        const productId = product.id;
                        const productName = product.name || product.title;
                        const quantity = product.quantity || 0;
                        const isVirtual = product.type === 'virtual' || product.type === 'service';
                        const isOutOfStock = !isVirtual && quantity === 0;
                        
                        return (
                          <div
                            key={productId}
                            className={`p-2 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                              isOutOfStock ? "opacity-50" : ""
                            }`}
                            onClick={() => {
                              if (!isOutOfStock) {
                                handleAddToCart(product);
                                onSearchChange(""); // Clear search after adding
                              }
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{productName}</p>
                                <p className="text-xs text-gray-500">Ksh {(+price).toFixed(2)}</p>
                              </div>
                              <div className="ml-1 text-right">
                                {isVirtual ? (
                                  <span className="text-xs bg-blue-100 text-blue-600 px-1 py-0.5 rounded">Service</span>
                                ) : (
                                  <span className={`text-xs font-medium ${
                                    isOutOfStock ? "text-red-600" : "text-green-600"
                                  }`}>
                                    {isOutOfStock ? "Out" : `${quantity}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                      )}
                      {hasMore && !isLoading && (
                        <div ref={loaderRef} style={{ height: "40px" }} />
                      )}
                  </div>
                )}
              </div>
            ) : (
              /* Mobile Scanner Interface for Table Mode */
              <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h4m12 0h2M4 20h4m12 0h2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-2">Scanner Mode</p>
                <p className="text-xs text-gray-500 mb-3">Scan barcode or search product name</p>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-600">{products.length} products available</p>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Product Grid */}
          <div className="hidden lg:flex lg:flex-col bg-white rounded-2xl p-4 shadow-lg h-full">
            {viewMode === 'grid' && (
              /* Desktop Search Bar - Only in Cards Mode */
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            )}
            
            {/* Product Display - Grid or Table View */}
            <div className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-200px)]">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid View - Restaurant Style Cards */
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-4">
                  {products.map((product: any) => {
                    const price = getPriceForSaleType(product, saleType);
                    const productId = product._id || product.id;
                    const productName = product.name || product.title;
                    const quantity = product.quantity || 0;
                    const reorderLevel = product.reorderLevel || product.lowStockThreshold || 0;
                    const isVirtual = product.virtual || product?.productType == "service";
                    const isOutOfStock = !isVirtual && quantity === 0;
                    const isLowStock = !isVirtual && quantity > 0 && quantity <= reorderLevel;
                    
                    return (
                      <div
                        key={productId}
                        className={`p-3 rounded-xl cursor-pointer transition-all duration-300 text-center shadow-sm hover:shadow-lg hover:scale-105 ${
                          isOutOfStock 
                            ? "bg-red-100 hover:bg-red-200" 
                            : isLowStock 
                            ? "bg-amber-100 hover:bg-amber-200" 
                            : "bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => handleAddToCart(product)}
                      >
                        <div className="w-12 h-12 bg-gray-200 rounded mx-auto mb-2"></div>
                        <p className="text-xs font-medium text-gray-800 truncate">{productName}</p>
                        <p className="text-xs text-gray-500">Ksh {(+price).toFixed(2)}</p>
                        <div className="mt-1 flex items-center justify-center space-x-1">
                          {isVirtual ? (
                            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              Service
                            </span>
                          ) : (
                            <>
                              <span className={`text-xs font-medium ${
                                isOutOfStock ? "text-red-600" : isLowStock ? "text-orange-600" : "text-green-600"
                              }`}>
                                Qty: {quantity}
                              </span>
                              {isOutOfStock && (
                                <span className="text-xs text-red-600 font-medium">(Out of Stock)</span>
                              )}
                              {isLowStock && (
                                <span className="text-xs text-orange-600 font-medium">(Low Stock)</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                      {isLoading && <p>Loading...</p>}
                      {hasMore && <div ref={loaderRef} style={{ height: "30px" }} />}
                </div>
              ) : (
                /* Table View - Supermarket Style (Scanner/Search Only) */
                <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg">
                  <div className="text-center space-y-6 max-w-md mx-auto p-8">
                    {/* Scanner Icon */}
                    <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h4m12 0h2M4 20h4m12 0h2" />
                      </svg>
                    </div>
                    
                    {/* Instructions */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-900">Supermarket Mode</h3>
                      <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                          <p>Use search bar above to find products by name</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                          <p>Scan product barcode with scanner device</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                          <p>Items will automatically be added to cart</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-1">Products Available</p>
                        <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                      </div>
                    </div>
                    
                    {/* Switch Suggestion */}
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                      <p>💡 Want to browse products visually? Switch to <strong>Cards View</strong> using the toggle above</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Table Mode - Right Panel for Totals */}
        {viewMode === 'table' && (
          <div className="w-full lg:w-1/3 bg-white p-2 lg:p-6 order-1 lg:order-2 flex flex-col">
            <div className="flex-1 flex flex-col">
              {/* Summary Section */}
              <div className="bg-gray-50 p-4 lg:p-6 rounded-lg">
                <div className="space-y-3 lg:space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm lg:text-base font-medium text-gray-700">Discount</span>
                    <span className="text-red-500 font-medium text-sm lg:text-base">- Ksh {totals.discount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm lg:text-base font-medium text-gray-700">Tax</span>
                    <span className="font-medium text-gray-900 text-sm lg:text-base">Ksh {totals.tax.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm lg:text-base font-medium text-gray-700">Coupon</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-6 h-6 p-0 rounded border-gray-400 text-gray-600 hover:bg-gray-100"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-medium text-gray-900 text-sm lg:text-base">Ksh 0.00</span>
                  </div>
                </div>
                
                {/* Grand Total */}
                <div className="bg-green-600 text-white p-4 lg:p-6 rounded-lg mt-4 lg:mt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg lg:text-xl font-semibold">Grand Total:</span>
                    <span className="text-xl lg:text-2xl font-bold">Ksh {totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-4 lg:mt-6">
                <div className="space-y-3">
                  <Button 
                    onClick={() => setShowPaymentDialog(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 lg:py-4 text-base lg:text-lg font-semibold rounded-lg"
                    disabled={cartItems.length === 0}
                  >
                    Cash-In
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      onClick={onClearCart}
                      variant="outline"
                      className="border-red-400 text-red-600 hover:bg-red-50 py-2 lg:py-3 text-sm lg:text-base font-semibold rounded-lg"
                      disabled={cartItems.length === 0}
                    >
                      Clear
                    </Button>
                    <Button 
                      onClick={handleHoldTransaction}
                      variant="outline"
                      className="border-gray-400 text-gray-700 hover:bg-gray-50 py-2 lg:py-3 text-sm lg:text-base font-semibold rounded-lg"
                      disabled={cartItems.length === 0}
                    >
                      Hold
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={resetPaymentDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary text-center">Payment</DialogTitle>
          </DialogHeader>
          
          {showCardInterface ? (
            /* Card Payment Interface */
            <div className="space-y-8 py-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary mb-2">
                  Ksh {totals.total.toFixed(2)}
                </div>
                <p className="text-gray-600 text-lg">Total Amount Due</p>
              </div>
              
              <div className="flex flex-col items-center space-y-6">
                <div className="w-24 h-24 border-4 border-primary rounded-lg flex items-center justify-center">
                  <CreditCard className="h-12 w-12 text-primary" />
                </div>
                
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Card Payment</h3>
                  {isProcessingCard ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <p className="text-lg text-gray-600">Waiting for card...</p>
                      <p className="text-sm text-gray-500">Please insert, tap, or swipe your card</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg text-green-600 font-semibold">✓ Card detected</p>
                      <p className="text-sm text-gray-500">Ready to process payment</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={resetPaymentDialog}
                  className="flex-1 py-4 text-lg"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCompletePayment}
                  disabled={isProcessingCard || createTransactionMutation.isPending}
                  className="flex-1 py-4 text-lg bg-green-500 hover:bg-green-600 text-white"
                >
                  {createTransactionMutation.isPending ? "Processing..." : "Complete Payment"}
                </Button>
              </div>
            </div>
          ) : (
            /* Payment Method Selection */
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold">Total Amount:</span>
                  <span className="text-2xl font-bold text-green-600">Ksh {totals.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Select Payment Method:</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={selectedPaymentMethod === "cash" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("cash")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <Banknote className="h-5 w-5" />
                    <span className="text-xs">Cash</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "wallet" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("wallet")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <Wallet className="h-5 w-5" />
                    <span className="text-xs">Wallet</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "split" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("split")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <Split className="h-5 w-5" />
                    <span className="text-xs">Split</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "mpesa" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("mpesa")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="text-xs">M-Pesa</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "bank" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("bank")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <Building className="h-5 w-5" />
                    <span className="text-xs">Bank</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "card" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("card")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs">Card</span>
                  </Button>
                  
                  <Button
                    variant={selectedPaymentMethod === "credit" ? "default" : "outline"}
                    onClick={() => handlePaymentMethodSelect("credit")}
                    className="h-14 flex flex-col items-center justify-center space-y-1"
                  >
                    <UserCheck className="h-5 w-5" />
                    <span className="text-xs">Credit</span>
                  </Button>
                </div>
              </div>
              
              {/* Payment-specific input fields */}
              {selectedPaymentMethod === "mpesa" && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">M-Pesa Payment</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Transaction ID <span className="text-gray-400 font-normal">(optional)</span></label>
                    <Input
                      type="text"
                      placeholder="Enter M-Pesa transaction ID"
                      value={mpesaTransactionId}
                      onChange={(e) => setMpesaTransactionId(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">Example: RI704H61SX</p>
                  </div>
                </div>
              )}
              
              {selectedPaymentMethod === "bank" && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Building className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Bank Transfer</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Transaction ID <span className="text-gray-400 font-normal">(optional)</span></label>
                    <Input
                      type="text"
                      placeholder="Enter bank transaction ID"
                      value={bankTransactionId}
                      onChange={(e) => setBankTransactionId(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">Example: TXN123456789</p>
                  </div>
                </div>
              )}
              
              {selectedPaymentMethod === "credit" && (
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <UserCheck className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Credit Sale</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Customer *</label>
                      <select 
                        className="w-full h-10 px-3 border border-orange-200 rounded text-sm focus:border-orange-500"
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                      >
                        <option value="">Select a customer...</option>
                        {customers.map((customer: any) => {
                          const customerId = customer._id || customer.id;
                          return (
                            <option key={customerId} value={customerId}>
                              {customer.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Due Date *</label>
                      <Input
                        type="date"
                        value={creditDueDate}
                        onChange={(e) => setCreditDueDate(e.target.value)}
                        className="w-full border-orange-200 focus:border-orange-500"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    {selectedCustomer && (
                      <div className="bg-white p-3 rounded border border-orange-200">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                          <p className="text-gray-600">
                            Total Outstanding: Ksh {Math.abs(selectedCustomer.totalOutstanding || selectedCustomer.balance || 0).toFixed(2)}
                            {(selectedCustomer.totalOutstanding || selectedCustomer.balance || 0) > 0 ? ' (Owes)' : ' (Clear)'}
                          </p>
                          {selectedCustomer.wallet && (
                            <p className="text-gray-500 text-xs">
                              Wallet Balance: Ksh {parseFloat(selectedCustomer.wallet).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedPaymentMethod === "split" && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Split className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Split Payment</span>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700">Cash</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={splitAmounts.cash || ""}
                          onChange={(e) => setSplitAmounts(prev => ({ 
                            ...prev, 
                            cash: parseFloat(e.target.value) || 0 
                          }))}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">M-Pesa</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={splitAmounts.mpesa || ""}
                          onChange={(e) => setSplitAmounts(prev => ({ 
                            ...prev, 
                            mpesa: parseFloat(e.target.value) || 0 
                          }))}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">Bank</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={splitAmounts.bank || ""}
                          onChange={(e) => setSplitAmounts(prev => ({ 
                            ...prev, 
                            bank: parseFloat(e.target.value) || 0 
                          }))}
                          className="w-full text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Split:</span>
                      <span className="font-medium">
                        Ksh {(splitAmounts.cash + splitAmounts.mpesa + splitAmounts.bank).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Required:</span>
                      <span className="font-medium text-green-600">
                        Ksh {totals.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Manual Date/Time Setting - Only visible with permission */}
              {canSetSaleDate && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-800">Set Custom Date/Time</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="customDateTime"
                        checked={isCustomDateTime}
                        onChange={(e) => setIsCustomDateTime(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="customDateTime" className="text-sm text-purple-700">
                        Override
                      </label>
                    </div>
                  </div>
                  
                  {isCustomDateTime && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Date & Time (ISO Format) *
                      </label>
                      <Input
                        type="datetime-local"
                        value={customDateTime ? new Date(customDateTime).toISOString().slice(0, 16) : ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            // Convert local datetime to ISO string
                            const localDate = new Date(e.target.value);
                            setCustomDateTime(localDate.toISOString());
                          } else {
                            setCustomDateTime("");
                          }
                        }}
                        className="w-full"
                      />
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                          Current: {new Date().toISOString().slice(0, 19)}Z
                        </span>
                      </div>
                      {customDateTime && (
                        <div className="text-xs text-purple-600">
                          Will save as: {customDateTime}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={resetPaymentDialog}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCompletePayment}
                  disabled={!selectedPaymentMethod || createTransactionMutation.isPending ||
                    (selectedPaymentMethod === "credit" && (!selectedCustomerId || !creditDueDate))}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {createTransactionMutation.isPending ? "Processing..." : 
                   selectedPaymentMethod === "credit" ? "Create Credit Sale" : "Complete Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Categories Drawer */}
      <Sheet open={showCategoriesDrawer} onOpenChange={setShowCategoriesDrawer}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>Product Categories</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            <div 
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                activeCategory === "all" ? "bg-red-100 border-red-200 text-red-800" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onClick={() => {
                onCategoryChange("all");
                setShowCategoriesDrawer(false);
              }}
            >
              <div className="font-medium">All Categories</div>
              <div className="text-sm text-gray-500">Show all products</div>
            </div>
            {categories.map((category: any) => {
              const catKey = String(category.id ?? category._id ?? category.name);
              return (
              <div 
                key={catKey}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  activeCategory === catKey
                    ? "bg-red-100 border-red-200 text-red-800" 
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => {
                  onCategoryChange(catKey);
                  setShowCategoriesDrawer(false);
                }}
              >
                <div className="font-medium">{category.name || category.title}</div>
                {category.description && (
                  <div className="text-sm text-gray-500">{category.description}</div>
                )}
              </div>
            );})}
          </div>
        </SheetContent>
      </Sheet>

      {/* Price Change Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={handlePriceDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Price</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedPriceItem && (() => {
              const allSources = [...allProducts, ...searchResults];
              const productData = allSources.find(p => (p as any)._id === selectedPriceItem.id || p.id === selectedPriceItem.id);
              const rawMin = (productData as any)?.minSellingPrice;
              const minSp = rawMin != null ? (parseFloat(String(rawMin)) || 0) : 0;
              const existingDiscount = parseFloat(String(selectedPriceItem.discount || 0)) || 0;
              const typedPrice = parseFloat(newPrice) || 0;
              const effectivePrice = typedPrice > 0 ? typedPrice - existingDiscount : null;
              return (
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold">{selectedPriceItem.name}</p>
                  <p className="text-sm text-gray-500">Current price: Ksh {(+selectedPriceItem.price).toFixed(2)}</p>
                  {existingDiscount > 0 && (
                    <p className="text-sm text-blue-600">Applied discount: Ksh {existingDiscount.toFixed(2)}</p>
                  )}
                  {existingDiscount > 0 && effectivePrice !== null && (
                    <p className="text-sm font-medium text-gray-800">
                      Effective price after discount: Ksh {effectivePrice.toFixed(2)}
                    </p>
                  )}
                  {minSp > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Minimum allowed price: Ksh {minSp.toFixed(2)}</p>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <label htmlFor="newPrice" className="text-sm font-medium">New Price (Ksh)</label>
              <Input
                id="newPrice"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Enter new price"
                className="text-lg"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handlePriceDialogClose}>
              Cancel
            </Button>
            <Button onClick={handlePriceUpdate}>
              Update Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Min Selling Price Warning Dialog */}
      <Dialog open={showMinPriceWarning} onOpenChange={() => setShowMinPriceWarning(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Price Too Low</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-gray-700">
              The entered price of{" "}
              <span className="font-semibold text-red-600">
                Ksh {minPriceWarningData?.attempted.toFixed(2)}
              </span>{" "}
              is below the minimum allowed selling price.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-center">
              <p className="text-xs text-amber-700 mb-1">Minimum selling price</p>
              <p className="text-xl font-bold text-amber-800">
                Ksh {minPriceWarningData?.minimum.toFixed(2)}
              </p>
            </div>
            <p className="text-xs text-gray-500">Please enter a price equal to or above the minimum.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMinPriceWarning(false)}>
              OK, go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={handleDiscountDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedDiscountItem && (() => {
              const allSources = [...allProducts, ...searchResults];
              const pd = allSources.find(p => (p as any)._id === selectedDiscountItem.id || p.id === selectedDiscountItem.id);
              const rawMin = (pd as any)?.minSellingPrice;
              const rawMax = (pd as any)?.maxDiscount ?? selectedDiscountItem.maxDiscount;
              const minSp = rawMin != null ? (parseFloat(String(rawMin)) || 0) : 0;
              const maxDisc = parseFloat(String(rawMax ?? 0)) || 0;
              const maxFromMinPrice = minSp > 0 ? Math.max(0, selectedDiscountItem.price - minSp) : Infinity;
              const effectiveMax = maxDisc > 0 ? Math.min(maxDisc, maxFromMinPrice) : 0;
              return (
                <div>
                  <div className="text-center mb-3">
                    <p className="text-lg font-semibold">{selectedDiscountItem.name}</p>
                    <p className="text-sm text-gray-500">Current price: Ksh {selectedDiscountItem.price.toFixed(2)}</p>
                    {selectedDiscountItem.discount && selectedDiscountItem.discount > 0 && (
                      <p className="text-sm text-green-600">
                        Current discount: Ksh {selectedDiscountItem.discount.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-md px-4 py-2 text-sm text-gray-600 space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span>Max allowed discount:</span>
                      <span className="font-medium">{maxDisc > 0 ? `Ksh ${maxDisc.toFixed(2)}` : "None"}</span>
                    </div>
                    {minSp > 0 && (
                      <div className="flex justify-between">
                        <span>Min selling price:</span>
                        <span className="font-medium">Ksh {minSp.toFixed(2)}</span>
                      </div>
                    )}
                    {effectiveMax < Infinity && (
                      <div className="flex justify-between font-semibold text-gray-800 border-t pt-1">
                        <span>Effective max discount:</span>
                        <span>Ksh {effectiveMax.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="discountAmount" className="text-sm font-medium">Discount Amount (Ksh)</label>
                    <Input
                      id="discountAmount"
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="0"
                      className="text-lg"
                      max={effectiveMax < Infinity ? effectiveMax : undefined}
                      min="0"
                      step="0.01"
                      autoFocus
                    />
                  </div>
                </div>
              );
            })()}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedDiscountItem && selectedDiscountItem.discount && selectedDiscountItem.discount > 0 && (
              <Button
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => {
                  onApplyDiscount(selectedDiscountItem.id, 0);
                  setShowDiscountDialog(false);
                  setSelectedDiscountItem(null);
                  setDiscountAmount("");
                }}
              >
                Remove Discount
              </Button>
            )}
            <Button variant="outline" onClick={handleDiscountDialogClose}>
              Cancel
            </Button>
            <Button onClick={handleDiscountUpdate}>
              Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Transaction - Customer Required Dialog */}
      <Dialog open={showHoldCustomerDialog} onOpenChange={(open) => { if (!open) { setShowHoldCustomerDialog(false); setSelectedCustomerId(""); setHoldCustomerSearch(""); setReadyDate(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-orange-500" />
              <span>Select Customer for Hold</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              A customer must be selected to place this sale on hold.
            </p>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Customer *</label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerDialog(true)}
                  className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add new customer</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or phone..."
                  value={holdCustomerSearch}
                  onChange={(e) => { setHoldCustomerSearch(e.target.value); setSelectedCustomerId(''); }}
                  className="pl-9 text-sm"
                  autoFocus
                />
              </div>

              {/* Selected customer pill */}
              {selectedCustomer && !holdCustomerSearch && (
                <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedCustomer.name}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedCustomerId('')} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Filtered results list */}
              {holdCustomerSearch && (
                <div className="border border-gray-200 rounded-lg max-h-44 overflow-y-auto">
                  {customers
                    .filter((c: any) => {
                      const term = holdCustomerSearch.toLowerCase();
                      return (
                        (c.name || '').toLowerCase().includes(term) ||
                        (c.phone || '').toLowerCase().includes(term) ||
                        (c.phonenumber || '').toLowerCase().includes(term)
                      );
                    })
                    .map((customer: any) => {
                      const customerId = customer._id || customer.id;
                      return (
                        <div
                          key={customerId}
                          onClick={() => { setSelectedCustomerId(String(customerId)); setHoldCustomerSearch(''); }}
                          className="flex items-center justify-between px-3 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                          </div>
                          <User className="h-4 w-4 text-gray-300" />
                        </div>
                      );
                    })}
                  {customers.filter((c: any) => {
                    const term = holdCustomerSearch.toLowerCase();
                    return (c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term) || (c.phonenumber || '').toLowerCase().includes(term);
                  }).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No customers found</p>
                  )}
                </div>
              )}
            </div>

            {/* Ready Date - Laundry shops only */}
            {isLaundryShop && (
              <div className="mt-3">
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                  <span>Ready Date</span>
                </label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="date"
                    value={readyDate ? readyDate.split('T')[0] : ''}
                    onChange={(e) => {
                      const datePart = e.target.value;
                      const timePart = readyDate ? (readyDate.split('T')[1] || '00:00') : '00:00';
                      setReadyDate(datePart ? `${datePart}T${timePart}` : '');
                    }}
                    className="text-sm flex-1"
                    min={new Date().toISOString().slice(0, 10)}
                  />
                  <Input
                    type="time"
                    value={readyDate ? (readyDate.split('T')[1] || '00:00') : ''}
                    onChange={(e) => {
                      const datePart = readyDate ? readyDate.split('T')[0] : new Date().toISOString().slice(0, 10);
                      setReadyDate(`${datePart}T${e.target.value}`);
                    }}
                    className="text-sm w-28"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowHoldCustomerDialog(false); setSelectedCustomerId(""); setHoldCustomerSearch(""); setReadyDate(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmHoldWithCustomer}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!selectedCustomerId || isHoldProcessing}
            >
              {isHoldProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : "Hold Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Hold Ready Date Dialog - shown when customer already selected in laundry shop */}
      <Dialog open={showHoldReadyDateDialog} onOpenChange={(open) => { if (!open) { setShowHoldReadyDateDialog(false); setReadyDate(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <span>Set Ready Date</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              When will this order be ready for pickup?
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center space-x-1">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                <span>Ready Date</span>
              </label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  value={readyDate ? readyDate.split('T')[0] : ''}
                  onChange={(e) => {
                    const datePart = e.target.value;
                    const timePart = readyDate ? (readyDate.split('T')[1] || '00:00') : '00:00';
                    setReadyDate(datePart ? `${datePart}T${timePart}` : '');
                  }}
                  className="text-sm flex-1"
                  min={new Date().toISOString().slice(0, 10)}
                />
                <Input
                  type="time"
                  value={readyDate ? (readyDate.split('T')[1] || '00:00') : ''}
                  onChange={(e) => {
                    const datePart = readyDate ? readyDate.split('T')[0] : new Date().toISOString().slice(0, 10);
                    setReadyDate(`${datePart}T${e.target.value}`);
                  }}
                  className="text-sm w-28"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowHoldReadyDateDialog(false); setReadyDate(""); }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setIsHoldProcessing(true);
                await processTransaction(true);
                setIsHoldProcessing(false);
                setShowHoldReadyDateDialog(false);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isHoldProcessing}
            >
              {isHoldProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : "Hold Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Sale Success Dialog */}
      <Dialog open={showHoldSuccessDialog} onOpenChange={(open) => { if (!open) setShowHoldSuccessDialog(false); }}>
        <DialogContent className="max-w-xs text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sale On Hold</h2>
              <p className="text-sm text-gray-500 mt-1">The transaction has been saved and placed on hold.</p>
            </div>
            <Button
              className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => { setShowHoldSuccessDialog(false); setReadyDate(""); setSelectedCustomerId(""); setHoldCustomerSearch(""); }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Customer Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={(open) => { if (!open) { setShowAddCustomerDialog(false); setNewCustomerForm({ name: '', phone: '', email: '', address: '' }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <User className="h-5 w-5 text-purple-500" />
              <span>Add New Customer</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
              <Input
                placeholder="Customer name"
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
              <Input
                placeholder="Phone number"
                value={newCustomerForm.phone}
                onChange={(e) => setNewCustomerForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <Input
                placeholder="Email address"
                type="email"
                value={newCustomerForm.email}
                onChange={(e) => setNewCustomerForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Address</label>
              <Input
                placeholder="Address"
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCustomerDialog(false); setNewCustomerForm({ name: '', phone: '', email: '', address: '' }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createCustomerMutation.mutate(newCustomerForm)}
              disabled={!newCustomerForm.name.trim() || createCustomerMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell-by-Price Amount Entry Dialog */}
      <Dialog open={!!priceEntryProduct} onOpenChange={(open) => { if (!open) { setPriceEntryProduct(null); setPriceEntryAmount(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {priceEntryProduct && (
              <p className="text-sm text-gray-500">
                How much worth of <span className="font-semibold text-gray-800">{priceEntryProduct.name}</span> does the customer want?
              </p>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                {currency}
              </span>
              <Input
                type="number"
                min="1"
                step="any"
                autoFocus
                placeholder="0.00"
                value={priceEntryAmount}
                onChange={(e) => setPriceEntryAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmPriceEntry()}
                className="pl-14 text-lg font-semibold h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPriceEntryProduct(null); setPriceEntryAmount(""); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmPriceEntry}
              disabled={!priceEntryAmount || parseFloat(priceEntryAmount) <= 0}
            >
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      <Dialog open={showCustomItemDialog} onOpenChange={(open) => { setShowCustomItemDialog(open); if (!open) { setCustomItemName(""); setCustomItemPrice(""); setCustomItemType("service"); setCustomItemBuyingPrice(""); setCustomItemQuantity("1"); setShowCustomItemOptions(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Item Name</label>
              <Input
                placeholder="Type to search or create new..."
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCustomItem()}
                autoFocus
              />
              {/* Live product suggestions */}
              {customItemName.trim().length >= 1 && (() => {
                const term = customItemName.toLowerCase();
                const suggestions = allProducts
                  .filter((p: any) => p.name?.toLowerCase().includes(term))
                  .slice(0, 6);
                if (suggestions.length === 0) return null;
                return (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {suggestions.map((p: any) => {
                      const isService = p.type === 'service' || p.type === 'virtual';
                      const outOfStock = !isService && (p.quantity ?? 0) <= 0;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-purple-50'}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (outOfStock) return;
                            handleAddToCart(p);
                            setShowCustomItemDialog(false);
                            setCustomItemName("");
                            setCustomItemPrice("");
                            setCustomItemType("service");
                            setCustomItemBuyingPrice("");
                            setCustomItemQuantity("1");
                            setShowCustomItemOptions(false);
                            toast({ title: "Added to cart", description: `"${p.name}" added` });
                          }}
                        >
                          <div>
                            <span className="font-medium text-gray-900">{p.name}</span>
                            {isService && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1 rounded">Service</span>}
                            {outOfStock && <span className="ml-2 text-xs text-red-500">Out of stock</span>}
                          </div>
                          <span className="text-green-600 font-semibold ml-3 shrink-0">
                            Ksh {(+getPriceForSaleType(p, saleType)).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Price (Ksh)</label>
              <Input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCustomItem()}
              />
            </div>

            {/* Options toggle */}
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowCustomItemOptions(v => !v)}
            >
              <span className={`transition-transform ${showCustomItemOptions ? 'rotate-90' : ''}`}>▶</span>
              {showCustomItemOptions ? 'Hide options' : 'More options'}
            </button>

            {showCustomItemOptions && (
              <div className="space-y-3 border-t pt-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Product Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={customItemType}
                    onChange={(e) => setCustomItemType(e.target.value)}
                  >
                    <option value="service">Service</option>
                    <option value="product">Product</option>
                  </select>
                </div>

                {customItemType === "product" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Buying Price (Ksh)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={customItemBuyingPrice}
                        onChange={(e) => setCustomItemBuyingPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
                      <Input
                        type="number"
                        placeholder="1"
                        min="1"
                        step="1"
                        value={customItemQuantity}
                        onChange={(e) => setCustomItemQuantity(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCustomItemDialog(false); setCustomItemName(""); setCustomItemPrice(""); setCustomItemType("service"); setCustomItemBuyingPrice(""); setCustomItemQuantity("1"); setShowCustomItemOptions(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomItem}
              disabled={isCreatingCustomItem || !customItemName.trim() || !customItemPrice}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isCreatingCustomItem ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
