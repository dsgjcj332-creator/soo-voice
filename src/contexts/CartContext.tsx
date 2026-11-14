import React, { createContext, useContext, useState, useCallback } from 'react';
import { playChime, haptic } from '../lib/chime';

/**
 * Cart for the guest-facing menu (/store).
 *
 * The provider renders nothing visible — the floating button is in the
 * consumer (StoreDemo) so it can be positioned relative to its own layout.
 * The provider just exposes useCart().
 *
 * The audible "added to cart" chime + haptic now live in `lib/chime.ts`
 * so they can be shared with the order-tracking flow, which fires its
 * own chimes when the kitchen changes the order's status.
 */

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  setQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number; // total quantity, not distinct items
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === newItem.id);
      if (existing) {
        return prev.map((item) =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...newItem, quantity }];
    });
    // The 'cart' chime is a short ascending 2-note (A5 → E6) — discreet,
    // hospitality-appropriate. The shared chime lib also fires a small
    // haptic on supported devices.
    playChime('cart');
    haptic(15);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setQuantity = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((item) => item.id !== id);
      return prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item));
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, setQuantity, clearCart, total, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
