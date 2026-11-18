import React, { createContext, useContext, useState, useCallback } from 'react';
import { playChime, haptic } from '../lib/chime';

export interface CartSelectedModifierGroup {
  groupId: string;
  groupName: string;
  options: Array<{
    id: string;
    name: string;
    priceDelta: number;
  }>;
}

export interface CartItem {
  id: string;
  cartLineId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: CartSelectedModifierGroup[];
}

type NewCartItem = Omit<CartItem, 'quantity' | 'cartLineId' | 'modifiers'> & {
  modifiers?: CartSelectedModifierGroup[];
};

export function getCartLineId(item: Pick<CartItem, 'id' | 'modifiers'> | NewCartItem): string {
  const normalized = [...(item.modifiers || [])]
    .map(group => ({
      groupId: group.groupId,
      optionIds: group.options.map(option => option.id).sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
  return `${item.id}:${JSON.stringify(normalized)}`;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: NewCartItem, quantity?: number) => void;
  removeFromCart: (cartLineId: string) => void;
  setQuantity: (cartLineId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number; // total quantity, not distinct items
  orderNote: string;
  setOrderNote: (note: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderNote, setOrderNoteState] = useState('');
  const setOrderNote = useCallback((note: string) => setOrderNoteState(note.slice(0, 1000)), []);

  const addToCart = useCallback((newItem: NewCartItem, quantity: number = 1) => {
    const modifiers = newItem.modifiers || [];
    const cartLineId = getCartLineId({ ...newItem, modifiers });
    const normalizedItem: CartItem = { ...newItem, modifiers, cartLineId, quantity: 1 };

    setItems(prev => {
      const existing = prev.find(item => item.cartLineId === cartLineId);
      if (existing) {
        return prev.map(item =>
          item.cartLineId === cartLineId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...normalizedItem, quantity }];
    });
    playChime('cart');
    haptic(15);
  }, []);

  const removeFromCart = useCallback((cartLineId: string) => {
    setItems(prev => prev.filter(item => item.cartLineId !== cartLineId));
  }, []);

  const setQuantity = useCallback((cartLineId: string, qty: number) => {
    setItems(prev => {
      if (qty <= 0) return prev.filter(item => item.cartLineId !== cartLineId);
      return prev.map(item => item.cartLineId === cartLineId ? { ...item, quantity: qty } : item);
    });
  }, []);

  const clearCart = useCallback(() => { setItems([]); setOrderNoteState(''); }, []);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, setQuantity, clearCart, total, count, orderNote, setOrderNote }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
