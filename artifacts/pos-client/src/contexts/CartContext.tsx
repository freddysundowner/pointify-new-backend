// src/contexts/CartContext.tsx
import { createContext, useContext, useState } from "react";
import type { CartItem } from "@shared/schema";

interface CartContextType {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
  orderId: string | null;
  setOrderId: React.Dispatch<React.SetStateAction<string | null>>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider value={{ cartItems, setCartItems, clearCart, orderId, setOrderId }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartContext must be used within CartProvider");
  return ctx;
};
