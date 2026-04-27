import { useState, useEffect } from "react";
import type { CartItem, Product, Transaction } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useCartContext } from "@/contexts/CartContext";
import { usePrimaryShop } from "./usePrimaryShop";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

type SaleType = "Retail" | "Wholesale" | "Dealer";

export const useCart = (products: Product[], taxRate: number, saleType: SaleType) => {
  const { toast } = useToast();
  const { attendant } = useAttendantAuth();
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const primaryShopData = usePrimaryShop();
  const { shopData } = useSelector((state: RootState) => state.attendant);

  const { cartItems, setCartItems, orderId, setOrderId } = useCartContext();
  const [showReceipt, setShowReceipt] = useState(false);
  const hasAttendantPermission = (permission: string) => {
    if (!attendant) return true; // admin session — all permissions granted
    return attendant.permissions.some(perm => perm.value?.includes(permission));
  };

  const getPriceForSaleType = (product: Product, saleType: SaleType): number => {
    const sellingPrice = parseFloat(String(product.sellingPrice || product.price || 0)) || 0;
    const wholesalePrice = parseFloat(String(product.wholesalePrice || 0)) || 0;
    const dealerPrice = parseFloat(String(product.dealerPrice || 0)) || 0;

    switch (saleType) {
      case "Wholesale":
        return wholesalePrice > 0 ? wholesalePrice : sellingPrice;
      case "Dealer":
        return dealerPrice > 0 ? dealerPrice : sellingPrice;
      default:
        return sellingPrice;
    }
  };

  const updateCartPricesForSaleType = (newSaleType: SaleType) => {
    setCartItems(prev =>
      prev.map(item => {
        const product = products.find((p: any) => (p._id || p.id) === item.id);
        if (!product) return item;
        const newPrice = getPriceForSaleType(product, newSaleType);
        return {
          ...item,
          price: newPrice,
          total: item.quantity * newPrice
        };
      })
    );
  };

  const addToCart = (product: Product, passedOrderId?: string) => {
    const quantity = product.quantity || 0;
    setOrderId(passedOrderId || null);

    // manageByPrice products have no fixed quantity — skip stock check entirely
    const isByPrice = (product as any).manageByPrice;
    if (!isByPrice && product.productType === "product" && quantity <= 0 && shopData?.allownegativeselling == false) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is out of stock.`,
        variant: "destructive",
      });
      return;
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product._id || item.id === product.id);

      if (existingItem) {
        if (isByPrice) {
          // Replace price with the newly entered amount; keep qty at 1
          const newPrice = parseFloat(String((product as any).sellingPrice || (product as any).price || 0)) || 0;
          const bpExist = parseFloat(String((product as any).buyingPrice || 0)) || 0;
          const refSpExist = parseFloat(String((product as any)._refSellingPrice || 0)) || 0;
          const derivedCost = (bpExist > 0 && refSpExist > 0) ? newPrice * (bpExist / refSpExist) : 0;
          return prev.map(item =>
            (item.id === product._id || item.id === product.id)
              ? { ...item, price: newPrice, total: newPrice, quantity: 1, costPrice: derivedCost }
              : item
          );
        }

        if (!product.virtual && existingItem.quantity + 1 > quantity) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${quantity} ${product.name} available.`,
            variant: "destructive",
          });
          return prev;
        }

        return prev.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.price - (item.discount || 0)) * (item.quantity + 1)
              }
            : item
        );
      }

      const price = isByPrice
        ? (parseFloat(String((product as any).sellingPrice || (product as any).price || 0)) || 0)
        : getPriceForSaleType(product, saleType);

      // For sell-by-price products, derive the cost of this transaction so
      // profit reports are meaningful.
      // costPrice = saleAmount × (buyingPrice / refSellingPrice)
      // e.g. "fill for 400" at 160/L buying 140/L → cost = 400 × (140/160) = 350 → profit = 50
      let costPrice = 0;
      if (isByPrice) {
        const buyingPrice = parseFloat(String((product as any).buyingPrice || 0)) || 0;
        const refSellingPrice = parseFloat(String((product as any)._refSellingPrice || 0)) || 0;
        if (buyingPrice > 0 && refSellingPrice > 0) {
          costPrice = price * (buyingPrice / refSellingPrice);
        }
      }

      return [
        ...prev,
        {
          id: product._id || product.id,
          name: product.name,
          price,
          quantity: 1,
          discount: 0,
          total: price,
          originalPrice: price,
          maxDiscount: product.maxDiscount || 0,
          serialnumber: product?.serialnumber,
          orderId: passedOrderId || orderId,
          ...(isByPrice ? { costPrice } : {}),
        }
      ];
    });
  };

  const applyDiscount = (id: string | number, discountAmount: number) => {
    if (!hasAttendantPermission('discount')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to apply discounts",
        variant: "destructive",
      });
      return;
    }

    setCartItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const validDiscount = Math.min(discountAmount, parseFloat(String(item.maxDiscount || 0)) || 0);
        return {
          ...item,
          discount: validDiscount,
          total: (item.price - validDiscount) * item.quantity
        };
      })
    );
  };

  const updateQuantity = (id: string | number, quantity: number, productData?: Product) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== id));
      return;
    }

    if (productData && !productData.virtual && quantity > (productData.quantity || 0)) {
      toast({
        title: "Stock Limit",
        description: `Only ${productData.quantity} in stock.`,
        variant: "destructive"
      });
      return;
    }

    setCartItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, quantity, total: (item.price - (item.discount || 0)) * quantity }
          : item
      )
    );
  };

  const updatePrice = (id: string | number, newPrice: number) => {
    if (!hasAttendantPermission('edit_price')) {
      toast({
        title: "Access Denied",
        description: "You can't edit prices",
        variant: "destructive"
      });
      return;
    }

    if (newPrice <= 0) {
      toast({
        title: "Invalid Price",
        description: "Price must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    setCartItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, price: newPrice, total: item.quantity * (newPrice - (parseFloat(String(item.discount || 0)) || 0)) }
          : item
      )
    );
  };

  const clearCart = () => setCartItems([]);

  const getTotals = () => {
    const subtotal = cartItems.reduce((acc, item) => acc + item.total, 0);
    const discount = cartItems.reduce((acc, item) => acc + (item.discount || 0) * item.quantity, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, discount, tax, total };
  };

  const completeCheckout = (transaction: Transaction) => {
    setLastTransaction(transaction);
      clearCart();
      setShowReceipt(true)
  };

  return {
    cartItems,
    addToCart,
    applyDiscount,
    updateQuantity,
    updatePrice,
    clearCart,
    getTotals,
    updateCartPricesForSaleType,
    completeCheckout,
    lastTransaction,
    setLastTransaction,orderId,
    showReceipt, setShowReceipt,setOrderId
  };
};
