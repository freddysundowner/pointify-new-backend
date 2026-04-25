import { Trash2, Minus, Plus, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartItem } from "@shared/schema";

interface ShoppingCartProps {
  items: CartItem[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  onUpdateQuantity: (id: number, quantity: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  taxRate: number;
}

export default function ShoppingCart({
  items,
  totals,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
}: ShoppingCartProps) {
  const transactionId = `POS-${Date.now().toString().slice(-6)}`;

  return (
    <div className="w-full sm:w-[420px] bg-white/90 backdrop-blur-md shadow-2xl border-l border-gray-200 flex flex-col">
      {/* Cart Header */}
      <div className="p-3 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">Shopping Cart</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Transaction #{transactionId}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCart}
            className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">🛒</div>
            <div className="text-gray-600 font-medium mb-2">Your cart is empty</div>
            <div className="text-gray-400 text-sm">Start adding items from the catalog</div>
          </div>
        ) : (
          <div className="p-3 sm:p-6 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-sm sm:text-lg">{item.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-500">Ksh {item.price.toFixed(2)} each</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-bold text-primary">
                      Ksh {item.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 rounded-xl border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <span className="w-10 sm:w-12 text-center font-bold text-base sm:text-lg bg-gray-50 py-2 px-2 sm:px-3 rounded-xl">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 sm:w-10 sm:h-10 p-0 rounded-xl border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-600"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Cart Totals */}
      {items.length > 0 && (
        <div className="p-3 sm:p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div className="flex justify-between text-sm sm:text-base">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">Ksh {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm sm:text-base">
              <span className="text-gray-600">Tax:</span>
              <span className="font-semibold">Ksh {totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl sm:text-2xl font-bold pt-3 sm:pt-4 border-t border-gray-200">
              <span>Total:</span>
              <span className="total-display">Ksh {totals.total.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Checkout Buttons */}
          <div className="space-y-3">
            <Button
              onClick={onCheckout}
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 font-bold text-base sm:text-lg h-12 sm:h-14 rounded-2xl shadow-lg"
              size="lg"
            >
              Proceed to Checkout
            </Button>
            <Button
              variant="outline"
              className="w-full font-medium h-10 sm:h-12 rounded-2xl border-gray-200 hover:bg-gray-50"
              size="lg"
            >
              <Pause className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Hold Transaction
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
