import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSelector } from "react-redux";
import { ArrowLeft } from "lucide-react";

import ProductGrid from "./product-grid";
import ReceiptModal from "./receipt-modal";
import CalculatorModal from "./calculator-modal";

import { useAuth } from "@/features/auth/useAuth";
import { useAttendantAuth } from "@/contexts/AttendantAuthContext";
import { useProducts } from "@/contexts/ProductsContext";
import { usePrimaryShop } from "@/hooks/usePrimaryShop";
import { useCart } from "@/hooks/useCart";

import type { RootState } from "@/store";
import { Button } from "@/components/ui/button";

export default function POS() {
  const [, setLocation] = useLocation();
  const { admin } = useAuth();
  const { attendant } = useAttendantAuth();
  const { products, refreshProducts } = useProducts();
  const { shopData: primaryShopData } = usePrimaryShop();
  const { selectedShopId } = useSelector((state: RootState) => state.shop);

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [saleType, setSaleType] = useState<"Retail" | "Wholesale" | "Dealer">("Retail");

  const taxRate = primaryShopData?.tax || 0;
  const effectiveShopId =
    selectedShopId || (typeof attendant?.shopId === "object" ? attendant.shopId._id : attendant?.shopId);

  const canSetSaleDate = attendant?.permissions?.some(p => p.key === "pos" && p.value.includes("set_sale_date")) ?? false;
  const canSell = attendant?.permissions?.some(p => p.key === "pos" && p.value.includes("can_sell")) ?? false;
  const canSellToDealer = attendant?.permissions?.some(p => p.key === "pos" && p.value.includes("can_sell_to_dealer_&_wholesaler")) ?? false;
  const canDiscount = attendant?.permissions?.some(p => p.key === "pos" && p.value.includes("discount")) ?? false;
  const canEditPrice = attendant?.permissions?.some(p => p.key === "pos" && p.value.includes("edit_price")) ?? false;

  const {
    cartItems,
    addToCart,
    applyDiscount,
    updateQuantity,
    updatePrice,
    clearCart,
    getTotals,
    updateCartPricesForSaleType,
    completeCheckout,
    lastTransaction,orderId,setShowReceipt,showReceipt
  } = useCart(products, taxRate, saleType);
  useEffect(() => {
    if (products.length === 0) {
      refreshProducts();
    }
  }, []);

  useEffect(() => {
    if (cartItems.length > 0) {
      updateCartPricesForSaleType(saleType);
    }
  }, [saleType, products]);

  const handleSaleTypeChange = (newSaleType: typeof saleType) => {
    setSaleType(newSaleType);
    updateCartPricesForSaleType(newSaleType);
  };

  const handleBackToDashboard = () => {
    setLocation(attendant ? "/attendant/dashboard" : "/dashboard");
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="absolute top-3 left-4 z-50">
        <Button
          onClick={handleBackToDashboard}
          variant="outline"
          size="sm"
          className="bg-white/90 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-gray-300 shadow-lg"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ProductGrid
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          onCategoryChange={setActiveCategory}
          onSearchChange={setSearchQuery}
          onAddToCart={addToCart}
          onOpenCalculator={() => setShowCalculator(true)}
          cartItems={cartItems}
          totals={getTotals()}
          orderId={ orderId}
          onUpdateQuantity={updateQuantity}
          onUpdatePrice={updatePrice}
          onApplyDiscount={applyDiscount}
          onClearCart={clearCart}
          onCheckout={completeCheckout}
          taxRate={taxRate}
          shopId={effectiveShopId}
          adminId={attendant?.adminId || admin?._id}
          saleType={saleType}
          onSaleTypeChange={handleSaleTypeChange}
          getPriceForSaleType={(product, type) => {
            const { sellingPrice = 0, wholesalePrice = 0, dealerPrice = 0, price = 0 } = product;
            switch (type) {
              case "Wholesale":
                return wholesalePrice > 0 ? wholesalePrice : sellingPrice || price;
              case "Dealer":
                return dealerPrice > 0 ? dealerPrice : sellingPrice || price;
              default:
                return sellingPrice || price;
            }
          }}
          canSetSaleDate={canSetSaleDate}
          canSell={canSell}
          canSellToDealer={canSellToDealer}
          canDiscount={canDiscount}
          canEditPrice={canEditPrice}
        />
      </div>

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        transaction={lastTransaction}
        onNewTransaction={() => setShowReceipt(false)}
      />

      <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}
