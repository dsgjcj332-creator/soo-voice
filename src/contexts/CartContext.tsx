import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Cart for the guest-facing menu (/store).
 *
 * The earlier version stored items as in-memory state inside CartProvider.
 * This version keeps the same shape but adds:
 *   - An audible chime whenever an item is added (generated from a short
 *     sine burst — no external audio file needed, works offline)
 *   - A small haptic on supported devices (navigator.vibrate)
 *   - A counter for the floating cart button
 *
 * The provider renders nothing visible — the floating button is in the
 * consumer (StoreDemo) so it can be positioned relative to its own layout.
 * The provider just exposes useCart().
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

/* ---------- Audio chime ---------- */
let audioCtx: AudioContext | null = null;

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    // Two quick ascending notes — a subtle, hospitality-appropriate ding.
    const now = audioCtx.currentTime;
    const notes = [
      { freq: 880, start: 0,    duration: 0.09 },
      { freq: 1320, start: 0.07, duration: 0.16 },
    ];
    for (const n of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      // Attack-decay envelope so the chime feels discrete, not buzzy
      gain.gain.setValueAtTime(0, now + n.start);
      gain.gain.linearRampToValueAtTime(0.18, now + n.start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.duration + 0.02);
    }
  } catch (err) {
    // AudioContext can fail before any user gesture; ignore silently.
  }
}

function haptic(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}

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
    playChime();
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
