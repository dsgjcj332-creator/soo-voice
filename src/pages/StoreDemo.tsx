import React from 'react';
import { Sparkles, Key, Home, Car, MapPin, Navigation, Timer, MicOff, Phone, RefreshCcw, ShieldAlert, ShoppingBag, Plus, Minus, X, Send, Instagram, Facebook, MessageCircle, Download, Clock, ChefHat, CheckCircle2, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { VoiceWidget } from '../components/widget/VoiceWidget';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { normalizeCurrency, formatPrice } from '../lib/currency';
import { useSearchParams } from 'react-router-dom';
import {
  loadLocalCategories,
  fetchCategoriesRemote,
  MenuCategory,
} from '../lib/menuCategories';
import {
  useStoreSettings, haversineKm, ensureSessionStart, resetSession,
  sessionRemainingSeconds, formatCountdown,
} from '../lib/storeSettings';
import { playChime, haptic } from '../lib/chime';


export function StoreDemo() {
  const { language, setLanguage } = useLanguage();
  const { businessType, currency } = useSettings();
  const { user } = useAuth();
  const { items: cartItems, addToCart, setQuantity, removeFromCart, clearCart, total: cartTotal, count: cartCount, orderNote, setOrderNote } = useCart();
  const [dbMenuItems, setDbMenuItems] = React.useState<any[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [checkoutStatus, setCheckoutStatus] = React.useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [lastOrder, setLastOrder] = React.useState<{ id: string; guestToken: string; items: any[]; total: number; tableNumber: string; createdAt: number } | null>(null);
  const orderIdempotencyKeyRef = React.useRef<{ key: string; fingerprint: string } | null>(null);
  const [trackingOrder, setTrackingOrder] = React.useState<string | null>(null); // order id being tracked
  const [trackingStatus, setTrackingStatus] = React.useState<string>('pending');

  // Chime bookkeeping for the order tracking flow.
  //   - prevTrackingStatusRef: the last status we displayed to the guest.
  //     Used to detect real transitions (pending → preparing → completed)
  //     and fire the appropriate chime + haptic.
  //   - trackingInitializedRef: false until the first poll/realtime message
  //     arrives. We DON'T chime on the first poll — if the user re-opens
  //     the tracking modal on an order that's already in 'preparing' or
  //     'completed', we don't want a surprise fanfare on modal open. The
  //     chimes are only for real transitions the guest is actively
  //     watching for.
  const prevTrackingStatusRef = React.useRef<string>('pending');
  const trackingInitializedRef = React.useRef<boolean>(false);

  // Lock the page scroll while any full-screen overlay is open (cart
  // slide-over, invoice screen, tracking modal). Without this, swiping
  // inside the overlay scrolls the menu behind it on mobile — the
  // guest loses their place in the menu after closing the cart.
  React.useEffect(() => {
    const overlayOpen = cartOpen || checkoutStatus === 'success' || !!trackingOrder;
    document.body.style.overflow = overlayOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen, checkoutStatus, trackingOrder]);

  // Search parameters for tableside QR code scanning
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table') || searchParams.get('tableNumber') || '';
  const [selectedTable, setSelectedTable] = React.useState<string>(tableParam || '1');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');

  // Per-table language override — read once on mount, then follow URL changes
  React.useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam === 'ar' || langParam === 'en' || langParam === 'fr' || langParam === 'it') {
      // We currently only support ar/en in the UI fully; fr/it fall back to en.
      setLanguage(langParam === 'fr' || langParam === 'it' ? 'en' : langParam);
    }
  }, [searchParams, setLanguage]);

  const effectiveTable = tableParam || selectedTable || '1';
  const urlOwnerId = searchParams.get('ownerId') || searchParams.get('storeId') || '';
  const resolvedOwnerId = urlOwnerId || user?.uid || 'demo_merchant';

  // ---- Owner menu categories (dynamic per merchant) ----
  const [categories, setCategories] = React.useState<MenuCategory[]>(() =>
    loadLocalCategories(resolvedOwnerId)
  );
  React.useEffect(() => {
    // 1. Instant local paint
    setCategories(loadLocalCategories(resolvedOwnerId));
    // 2. Cloud copy wins when reachable
    fetchCategoriesRemote(resolvedOwnerId).then((remote) => {
      if (remote && remote.length > 0) setCategories(remote);
    });
  }, [resolvedOwnerId]);

  // ---- Owner store settings (identity + voice visibility + access control) ----
  const { settings: storeSettings, loading: storeLoading } = useStoreSettings(resolvedOwnerId);
  // Only an explicit preview link (?preview=1) bypasses the access locks —
  // owners testing the real QR experience see exactly what customers see.
  const previewBypass = searchParams.get('preview') === '1';

  // ---- Geo-fence gate ----
  const [geoRetry, setGeoRetry] = React.useState(0);
  const [geoState, setGeoState] = React.useState<'pending' | 'allowed' | 'denied' | 'error' | 'unsupported'>('pending');
  React.useEffect(() => {
    if (storeLoading) return;
    if (!storeSettings.geoEnabled || storeSettings.geoLat == null || storeSettings.geoLng == null || previewBypass) {
      setGeoState('allowed');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGeoState('unsupported');
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const dist = haversineKm(
          pos.coords.latitude,
          pos.coords.longitude,
          storeSettings.geoLat as number,
          storeSettings.geoLng as number
        );
        setGeoState(dist <= storeSettings.geoRadiusKm ? 'allowed' : 'denied');
      },
      () => {
        if (!cancelled) setGeoState('error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
    return () => {
      cancelled = true;
    };
  }, [storeSettings.geoEnabled, storeSettings.geoLat, storeSettings.geoLng, storeSettings.geoRadiusKm, storeLoading, previewBypass, geoRetry]);

  // ---- Time-limited session countdown ----
  const [sessionRemaining, setSessionRemaining] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (storeLoading) return;
    if (!storeSettings.sessionMinutes || previewBypass) {
      setSessionRemaining(null);
      return;
    }
    const start = ensureSessionStart(resolvedOwnerId);
    const tick = () => {
      setSessionRemaining(sessionRemainingSeconds(start, storeSettings.sessionMinutes));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [storeSettings.sessionMinutes, storeLoading, previewBypass, resolvedOwnerId]);

  const sessionExpired = sessionRemaining !== null && sessionRemaining <= 0;
  const geoLocked = geoState === 'denied' || geoState === 'error' || geoState === 'unsupported';
  const accessBlocked = !storeLoading && (geoLocked || sessionExpired);
  // While the geo verdict is pending we hold the menu back (no flash of content)
  const geoPending = !storeLoading && !previewBypass
    && storeSettings.geoEnabled && storeSettings.geoLat != null && storeSettings.geoLng != null
    && geoState === 'pending';

  React.useEffect(() => {
    if (tableParam) {
      setSelectedTable(tableParam);
    }
  }, [tableParam]);

  // Page title reflects the restaurant name
  React.useEffect(() => {
    const name = storeSettings.restaurantName || storeSettings.restaurantNameEn;
    if (name) document.title = `${name} — SooVoice`;
  }, [storeSettings.restaurantName, storeSettings.restaurantNameEn]);

  // Design customizer state loaded dynamically
  const [menuPrimaryColor, setMenuPrimaryColor] = React.useState<string>("indigo");
  const [menuBgStyle, setMenuBgStyle] = React.useState<string>("light-clean");
  const [menuLogoEmoji, setMenuLogoEmoji] = React.useState<string>("🍽️");
  const [menuBorderRadius, setMenuBorderRadius] = React.useState<string>("rounded-2xl");
  const [menuParticles, setMenuParticles] = React.useState<string>("none");
  const [menuCurrency, setMenuCurrency] = React.useState<string>(normalizeCurrency(currency));
  React.useEffect(() => { setMenuCurrency(normalizeCurrency(currency)); }, [currency]);
  const [menuLayout, setMenuLayout] = React.useState<string>("grid");
  const [customAccentColor, setCustomAccentColor] = React.useState<string>("");
  const [customCardColor, setCustomCardColor] = React.useState<string>("");
  const [customButtonColor, setCustomButtonColor] = React.useState<string>("");

  // Load design customizations on mount and when owner ID changes
  React.useEffect(() => {
    // 1. Initial quick load from local cache for instant visual feedback
    const localUserKey = `menu_design_config_${resolvedOwnerId}`;
    const saved = localStorage.getItem(localUserKey) || localStorage.getItem('menu_design_config_global');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.primaryColor) setMenuPrimaryColor(config.primaryColor);
        if (config.bgStyle) setMenuBgStyle(config.bgStyle);
        if (config.logoEmoji) setMenuLogoEmoji(config.logoEmoji);
        if (config.borderRadius) setMenuBorderRadius(config.borderRadius);
        if (config.particles) setMenuParticles(config.particles);
        if (config.layout) setMenuLayout(config.layout);
        if (config.customAccentColor) setCustomAccentColor(config.customAccentColor);
        if (config.customCardColor) setCustomCardColor(config.customCardColor);
        if (config.customButtonColor) setCustomButtonColor(config.customButtonColor);
      } catch (e) {
        console.error("Error reading cached store design:", e);
      }
    }

    // 2. Fetch live config from Supabase
    const fetchLiveDesign = async () => {
      try {
        const supabase = getSupabase();
        const { isConfigured } = getSupabaseConfig();

        if (isConfigured && supabase) {
          const { data, error } = await supabase
            .from('menu_customizer')
            .select('*')
            .eq('ownerId', resolvedOwnerId)
            .single();

          if (!error && data) {
            if (data.primaryColor) setMenuPrimaryColor(data.primaryColor);
            if (data.bgStyle) setMenuBgStyle(data.bgStyle);
            if (data.logoEmoji) setMenuLogoEmoji(data.logoEmoji);
            if (data.borderRadius) setMenuBorderRadius(data.borderRadius);
            if (data.particles) setMenuParticles(data.particles);
            if (data.layout) setMenuLayout(data.layout);
            if (data.customAccentColor) setCustomAccentColor(data.customAccentColor);
            if (data.customCardColor) setCustomCardColor(data.customCardColor);
            if (data.customButtonColor) setCustomButtonColor(data.customButtonColor);
            
            // Sync back to local storage
            localStorage.setItem(`menu_design_config_${resolvedOwnerId}`, JSON.stringify(data));
            localStorage.setItem('menu_design_config_global', JSON.stringify(data));
          }

          // Currency source of truth is merchant_settings — the design config
          // only mirrors it at save time. Fetch it so the store always shows
          // the currency the merchant picked in Settings (e.g. EGP not $).
          try {
            const { data: settingsData } = await supabase
              .from('merchant_settings')
              .select('currency')
              .eq('ownerId', resolvedOwnerId)
              .single();
            if (settingsData?.currency) {
              setMenuCurrency(normalizeCurrency(settingsData.currency));
            }
          } catch (curErr) {
            console.warn("No merchant_settings currency found for owner:", curErr);
          }
        }
      } catch (err) {
        console.error("Error loading live store design:", err);
      }
    };

    fetchLiveDesign();
  }, [resolvedOwnerId]);

  React.useEffect(() => {
    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();

    if (isConfigured && supabase) {
      console.log("[StoreDemo] Fetching catalog items from Supabase for owner:", resolvedOwnerId);
      
      const fetchSupabaseItems = async () => {
        try {
          let queryBuilder = supabase.from('menu_items').select('*');
          queryBuilder = queryBuilder.eq('ownerId', resolvedOwnerId);
          
          const { data, error } = await queryBuilder;
          if (error) throw error;
          
          setDbMenuItems(data ?? []);
        } catch (err) {
          console.error("Failed to query menu_items in Supabase:", err);
          setDbMenuItems([]);
        }
      };

      fetchSupabaseItems();

      const channel = supabase
        .channel('store-demo-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'menu_items' },
          () => {
            fetchSupabaseItems();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // Local/demo mode: show the merchant's OWN locally saved catalog so the
      // dine-in preview reflects exactly what was entered in Digital Menu
      // (real merchant data — not mock content).
      try {
        const localItems = JSON.parse(localStorage.getItem(`local_menu_items_${resolvedOwnerId}`) || '[]');
        setDbMenuItems(Array.isArray(localItems) ? localItems : []);
      } catch {
        setDbMenuItems([]);
      }
    }
  }, [resolvedOwnerId]);

  // Use database items when available, else fallback. Filter out the hidden AI-only products from public rendering.
  const visibleMenuItems = dbMenuItems.filter(item => !item.isAiOnly);
  const filteredMenuItems = visibleMenuItems.filter(item => {
    if (activeCategory === 'all') return true;
    const cat = (item.category || '').toLowerCase();
    const filter = activeCategory.toLowerCase();
    return cat.includes(filter) || filter.includes(cat);
  });

  const getRestaurantName = () =>
    storeSettings.restaurantName || storeSettings.restaurantNameEn || getSectorTitle();

  const getSectorTitle = () => {
    return language === "ar" ? "قائمة الطعام للطاولات" : "Dine-In Menu";
  };

  const getSectorDescription = () => {
    return language === "ar"
      ? "تحدث مع المساعد الصوتي بالأسفل للاستفسار عن المكونات واقتراحات الشيف ووصف الأطباق."
      : "Speak with the voice assistant below for ingredients, chef recommendations, and dish details.";
  };

  // Guest checkout sends identifiers and quantities only. The trusted API
  // reloads catalog prices and commits the order + outbox in one transaction.
  const [submitErrorKind, setSubmitErrorKind] = React.useState<'rls' | 'network' | 'schema' | 'generic' | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = React.useState('');
  const handleSubmitOrder = async (): Promise<boolean> => {
    if (cartItems.length === 0 || checkoutStatus === 'sending') return false;
    setCheckoutStatus('sending');
    setSubmitErrorKind(null);
    setSubmitErrorMessage('');
    try {
      const normalizeDigits = (value: string) =>
        value
          .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
          .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0));
      const tableNumber = normalizeDigits(String(effectiveTable || '1'))
        .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .trim()
        .slice(0, 24) || '1';

      const orderItems = cartItems.map(item => ({
        id: String(item.id),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 0)),
      }));
      const normalizedOrderNote = String(orderNote || '').trim().slice(0, 1000);
      const requestFingerprint = JSON.stringify({
        ownerId: resolvedOwnerId,
        tableNumber,
        items: [...orderItems].sort((a, b) => a.id.localeCompare(b.id)),
        notes: normalizedOrderNote,
      });
      if (!orderIdempotencyKeyRef.current || orderIdempotencyKeyRef.current.fingerprint !== requestFingerprint) {
        orderIdempotencyKeyRef.current = {
          key: crypto.randomUUID(),
          fingerprint: requestFingerprint,
        };
      }
      const response = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: resolvedOwnerId,
          tableNumber,
          idempotencyKey: orderIdempotencyKeyRef.current.key,
          items: orderItems,
          notes: normalizedOrderNote,
        }),
      });
      const result = await response.json().catch(() => null) as any;
      if (!response.ok || !result?.orderId || !result?.guestToken || !Array.isArray(result.items)) {
        setSubmitErrorKind(response.status === 503 ? 'schema' : 'generic');
        const detail = typeof result?.detail === 'string' ? result.detail : '';
        throw new Error([result?.error || 'The secure order service rejected the request', detail].filter(Boolean).join(': '));
      }

      // Prices and line names in the invoice come exclusively from the server.
      const placedOrder = {
        id: result.orderId,
        guestToken: result.guestToken,
        items: result.items,
        total: Number(result.total),
        tableNumber: String(result.tableNumber),
        createdAt: Number(result.createdAt),
        notes: normalizedOrderNote,
      };
      orderIdempotencyKeyRef.current = null;

      // Keep the two-phase overlay transition to avoid overlapping unmounts.
      setCartOpen(false);
      requestAnimationFrame(() => {
        setLastOrder(placedOrder);
        setCheckoutStatus('success');
        setTimeout(() => clearCart(), 120);
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Secure order submit error:', message);
      setSubmitErrorMessage(message);
      setCheckoutStatus('error');
      setTimeout(() => setCheckoutStatus('idle'), 7000);
      return false;
    }
  };

  // Guest tracking uses a per-order capability token. The token is never
  // placed in a URL and the browser never receives broad orders-table access.
  React.useEffect(() => {
    const orderId = lastOrder?.id || trackingOrder;
    const guestToken = lastOrder?.guestToken;
    if (!orderId || !guestToken) {
      setTrackingStatus('pending');
      prevTrackingStatusRef.current = 'pending';
      trackingInitializedRef.current = false;
      return;
    }

    prevTrackingStatusRef.current = 'pending';
    trackingInitializedRef.current = false;
    let cancelled = false;

    const applyTrackingStatus = (next: string) => {
      if (!next || cancelled) return;
      if (!trackingInitializedRef.current) {
        prevTrackingStatusRef.current = next;
        setTrackingStatus(next);
        trackingInitializedRef.current = true;
        return;
      }
      if (next === prevTrackingStatusRef.current) return;
      const prev = prevTrackingStatusRef.current;
      if (prev === 'pending' && next === 'preparing') {
        playChime('preparing');
        haptic([20, 40, 20]);
      } else if (next === 'completed' && prev !== 'completed') {
        playChime('served');
        haptic([30, 30, 30, 60]);
      }
      prevTrackingStatusRef.current = next;
      setTrackingStatus(next);
    };

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/store/orders/${encodeURIComponent(orderId)}`, {
          headers: { 'x-order-token': guestToken },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.status) applyTrackingStatus(String(data.status));
      } catch {
        // A transient network failure must not erase the last known status.
      }
    };

    void pollStatus();
    const pollInterval = setInterval(() => { void pollStatus(); }, 3000);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [lastOrder?.id, lastOrder?.guestToken, trackingOrder]);

  // Download invoice as an image (canvas) — works offline, no server needed.
  // Includes the restaurant logo if available.
  const handleDownloadInvoice = async () => {
    if (!lastOrder) return;
    const canvas = document.createElement('canvas');
    const W = 400;
    const H = 580 + lastOrder.items.length * 32;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = invoiceAccentHex;
    ctx.fillRect(0, 0, W, 6);

    let logoImg: HTMLImageElement | null = null;
    if (storeSettings.logoUrl) {
      try {
        logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('logo load failed'));
          img.src = storeSettings.logoUrl;
        });
      } catch { logoImg = null; }
    }

    // Logo or fallback emoji
    if (logoImg) {
      const logoSize = 50;
      ctx.drawImage(logoImg, (W - logoSize) / 2, 30, logoSize, logoSize);
    } else {
      ctx.font = '32px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🍽️', W / 2, 65);
    }

    // Restaurant name
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    const name = storeSettings.restaurantName || storeSettings.restaurantNameEn || 'SooVoice';
    ctx.fillText(name, W / 2, 110);

    // Subtitle
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('soovoice', W / 2, 128);

    // Divider
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(40, 145, W - 80, 1);

    // Order info row
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(`№ ${lastOrder.id.replace('order_', '')}`, 40, 168);

    ctx.textAlign = 'right';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${language === 'ar' ? 'طاولة' : 'Table'} ${lastOrder.tableNumber}`, W - 40, 168);

    // Date
    ctx.textAlign = 'left';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    const date = new Date(lastOrder.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US');
    ctx.fillText(date, 40, 185);

    // Divider
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(40, 200, W - 80, 1);

    // Items header
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(language === 'ar' ? 'الصنف' : 'ITEM', 40, 220);
    ctx.textAlign = 'right';
    ctx.fillText(language === 'ar' ? 'السعر' : 'PRICE', W - 40, 220);

    // Items
    let y = 245;
    ctx.font = '12px Inter, sans-serif';
    lastOrder.items.forEach((item) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(`${item.quantity}×`, 40, y);
      ctx.font = '12px Inter, sans-serif';
      const nameText = item.name.length > 28 ? item.name.substring(0, 28) + '…' : item.name;
      ctx.fillText(nameText, 65, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(formatPrice(item.price * item.quantity, menuCurrency), W - 40, y);
      y += 32;
    });

    // Divider
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(40, y, W - 80, 1);
    y += 25;

    // Total
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.fillText(language === 'ar' ? 'الإجمالي' : 'TOTAL', 40, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4f46e5';
    ctx.fillText(formatPrice(lastOrder.total, menuCurrency), W - 40, y);
    y += 20;

    // Order number for tracking
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(
      language === 'ar'
        ? `احتفظ برقم الطلب لتتبعه: ${lastOrder.id.replace('order_', '')}`
        : `Keep your order number to track: ${lastOrder.id.replace('order_', '')}`,
      W / 2, y + 10
    );

    // Share or download. On mobile (iOS Safari, Android Chrome) the Web
    // Share API with files opens the native share sheet — the guest can
    // save the invoice to Photos/Files or send it to the waiter. That is
    // the mobile-native way to "download"; a plain a.click() download is
    // the fallback for desktop browsers.
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setSubmitErrorKind('generic');
        console.error('[Invoice] Browser could not create the invoice image.');
        return;
      }
      const fileName = `invoice-${lastOrder.id.replace('order_', '')}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.setAttribute('aria-label', language === 'ar' ? 'تنزيل الفاتورة' : 'Download invoice');
      a.style.position = 'fixed';
      a.style.left = '-9999px';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Safari/iOS may resolve the download after the click handler returns.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, 'image/png');
  };

  const primaryColorStyles = {
    indigo: {
      bg: "bg-indigo-600 hover:bg-indigo-700",
      text: "text-indigo-600",
      border: "border-indigo-600",
      bgLight: "bg-indigo-50",
      textLight: "text-indigo-600",
      buttonBg: "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
    },
    rose: {
      bg: "bg-rose-600 hover:bg-rose-700",
      text: "text-rose-600",
      border: "border-rose-600",
      bgLight: "bg-rose-50",
      textLight: "text-rose-600",
      buttonBg: "bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white"
    },
    emerald: {
      bg: "bg-emerald-600 hover:bg-emerald-700",
      text: "text-emerald-600",
      border: "border-emerald-600",
      bgLight: "bg-emerald-50",
      textLight: "text-emerald-600",
      buttonBg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
    },
    amber: {
      bg: "bg-amber-500 hover:bg-amber-600",
      text: "text-amber-500",
      border: "border-amber-500",
      bgLight: "bg-amber-50",
      textLight: "text-amber-500",
      buttonBg: "bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white"
    },
    violet: {
      bg: "bg-violet-600 hover:bg-violet-700",
      text: "text-violet-600",
      border: "border-violet-600",
      bgLight: "bg-violet-50",
      textLight: "text-violet-600",
      buttonBg: "bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white"
    },
    gold: {
      bg: "bg-yellow-700 hover:bg-yellow-800",
      text: "text-yellow-700",
      border: "border-yellow-700",
      bgLight: "bg-yellow-50",
      textLight: "text-yellow-700",
      buttonBg: "bg-yellow-50 text-yellow-700 hover:bg-yellow-700 hover:text-white"
    }
  };

  const bgThemeStyles = {
    "light-clean": {
      mainBg: "bg-slate-50 text-slate-800",
      cardBg: "bg-white border-slate-100 text-slate-800",
      titleText: "text-slate-800",
      descText: "text-slate-500",
      accentCardBg: "bg-slate-50/20",
      isDark: false
    },
    "sunset-glow": {
      mainBg: "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 text-slate-800",
      cardBg: "bg-white/80 backdrop-blur-md border-orange-100/50 text-slate-800",
      titleText: "text-slate-800",
      descText: "text-slate-600",
      accentCardBg: "bg-amber-50/30",
      isDark: false
    },
    "midnight-dark": {
      mainBg: "bg-slate-950 text-slate-100",
      cardBg: "bg-slate-900 border-slate-850 text-slate-100",
      titleText: "text-white",
      descText: "text-slate-400",
      accentCardBg: "bg-slate-950/40",
      isDark: true
    },
    "forest-green": {
      mainBg: "bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100 text-emerald-950",
      cardBg: "bg-white/90 border-emerald-100 text-emerald-950",
      titleText: "text-emerald-950",
      descText: "text-emerald-800/70",
      accentCardBg: "bg-emerald-50/40",
      isDark: false
    },
    "cosmic-purple": {
      mainBg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-purple-200",
      cardBg: "bg-slate-900/90 border-purple-900/40 text-purple-100",
      titleText: "text-purple-100",
      descText: "text-purple-300/80",
      accentCardBg: "bg-purple-950/30",
      isDark: true
    },
    "modern-retro": {
      mainBg: "bg-[#f4f1ea] text-[#2c2a29]",
      cardBg: "bg-[#fbfbf9] border-[#2c2a29] text-[#2c2a29] shadow-[4px_4px_0px_0px_rgba(44,42,41,1)]",
      titleText: "text-[#2c2a29]",
      descText: "text-[#2c2a29]/80",
      accentCardBg: "bg-[#f4f1ea]/30",
      isDark: false
    }
  };

  const currentPrimary = primaryColorStyles[menuPrimaryColor as keyof typeof primaryColorStyles] || primaryColorStyles.indigo;
  const primaryColorHex: Record<string, string> = {
    indigo: "#4f46e5", rose: "#e11d48", emerald: "#059669",
    amber: "#f59e0b", violet: "#7c3aed", gold: "#a16207",
  };
  const invoiceAccentHex = customAccentColor || primaryColorHex[menuPrimaryColor] || "#4f46e5";
  const currentBgTheme = bgThemeStyles[menuBgStyle as keyof typeof bgThemeStyles] || bgThemeStyles["light-clean"];

  // ---- Full-screen Access Gate (geo-fence verdict pending / denied / expired session) ----
  if (geoPending || accessBlocked) {
    const radiusLabel = storeSettings.geoRadiusKm < 1
      ? `${Math.round(storeSettings.geoRadiusKm * 1000)} ${language === 'ar' ? 'متر' : 'm'}`
      : `${storeSettings.geoRadiusKm} ${language === 'ar' ? 'كم' : 'km'}`;
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 font-sans ${currentBgTheme.mainBg}`}>
        <div className={`${currentBgTheme.cardBg} max-w-md w-full p-8 rounded-3xl text-center shadow-xl border`}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
            {sessionExpired ? <Timer className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
          </div>

          {sessionExpired ? (
            <>
              <h1 className={`text-xl font-extrabold ${currentBgTheme.titleText}`}>
                {language === 'ar' ? 'انتهت جلسة الطاولة' : 'Table session expired'}
              </h1>
              <p className={`mt-3 text-sm leading-relaxed ${currentBgTheme.descText}`}>
                {language === 'ar'
                  ? `مدة استخدام المنيو انتهت (${storeSettings.sessionMinutes} دقائق). امسح كود الـ QR الموجود على طاولتك من جديد لبدء جلسة جديدة.`
                  : `Your ${storeSettings.sessionMinutes}-minute menu session has ended. Scan the QR code on your table again to start a new session.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  resetSession(resolvedOwnerId);
                  window.location.reload();
                }}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <RefreshCcw className="w-4 h-4" />
                {language === 'ar' ? 'ابدأ جلسة جديدة' : 'Start a new session'}
              </button>
            </>
          ) : geoState === 'pending' ? (
            <>
              <h1 className={`text-xl font-extrabold ${currentBgTheme.titleText}`}>
                {language === 'ar' ? 'جاري التحقق من موقعك...' : 'Checking your location...'}
              </h1>
              <p className={`mt-3 text-sm leading-relaxed ${currentBgTheme.descText}`}>
                {language === 'ar'
                  ? 'اسمح بصلاحية الموقع في المتصفح حتى نتأكد أنك داخل نطاق المطعم.'
                  : 'Allow the browser location permission so we can confirm you are inside the restaurant area.'}
              </p>
              <div className="mt-6">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            </>
          ) : (
            <>
              <h1 className={`text-xl font-extrabold ${currentBgTheme.titleText}`}>
                {geoState === 'denied'
                  ? (language === 'ar' ? 'المنيو متاح داخل المطعم فقط' : 'This menu works inside the restaurant only')
                  : (language === 'ar' ? 'لم نتمكن من تأكيد موقعك' : 'We could not confirm your location')}
              </h1>
              <p className={`mt-3 text-sm leading-relaxed ${currentBgTheme.descText}`}>
                {geoState === 'denied'
                  ? (language === 'ar'
                    ? `هذا الكود مربوط بموقع المطعم ويفتح فقط داخل نطاق ${radiusLabel} حوله. لو أنت جوه المطعم، اسمح بصلاحية الموقع وحاول تاني.`
                    : `This code is tied to the restaurant location and opens only within a ${radiusLabel} radius. If you are on-site, allow the location permission and try again.`)
                  : (language === 'ar'
                    ? 'اسمح بصلاحية الموقع للمتصفح ثم حاول مرة أخرى. (المنيو يفتح فقط داخل نطاق المطعم)'
                    : 'Allow the browser location permission, then try again. (The menu opens only inside the restaurant area.)')}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (geoState === 'error') {
                    setGeoState('pending');
                    setGeoRetry((n) => n + 1);
                  } else {
                    window.location.reload();
                  }
                }}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <Navigation className="w-4 h-4" />
                {language === 'ar' ? 'إعادة المحاولة' : 'Try again'}
              </button>
            </>
          )}

          {(storeSettings.restaurantName || storeSettings.restaurantNameEn || storeSettings.phone) && (
            <div className={`mt-6 pt-4 border-t text-xs ${currentBgTheme.isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
              {storeSettings.restaurantName && <p className="font-bold">{storeSettings.restaurantName}</p>}
              {storeSettings.address && <p className="mt-1">{storeSettings.address}</p>}
              {storeSettings.phone && <p className="mt-1" dir="ltr">{storeSettings.phone}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-500 p-4 pt-24 pb-28 md:p-12 font-sans flex justify-center ${currentBgTheme.mainBg} relative overflow-hidden`}>
      {/* CSS Keyframes for magical elements */}
      <style>{`
        @keyframes storeFloatUp {
          0% { transform: translateY(110vh) scale(0.6) rotate(0deg); opacity: 0; }
          10% { opacity: 0.35; }
          90% { opacity: 0.35; }
          100% { transform: translateY(-10vh) scale(1.2) rotate(360deg); opacity: 0; }
        }
        .store-particle {
          position: absolute;
          bottom: 0;
          animation: storeFloatUp var(--pd, 12s) linear infinite;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>

      {/* Floating Particles Core */}
      {menuParticles !== "none" && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {[
            { id: 1, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍔", left: "8%", delay: "0s", duration: "16s" },
            { id: 2, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍕", left: "28%", delay: "4s", duration: "12s" },
            { id: 3, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍰", left: "50%", delay: "2s", duration: "18s" },
            { id: 4, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "☕", left: "72%", delay: "6s", duration: "14s" },
            { id: 5, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍦", left: "88%", delay: "3s", duration: "15s" }
          ].map(p => (
            <span
              key={p.id}
              className="store-particle text-2xl"
              style={{
                left: p.left,
                animationDelay: p.delay,
                "--pd": p.duration
              } as React.CSSProperties}
            >
              {p.char}
            </span>
          ))}
        </div>
      )}

      <div className="max-w-6xl w-full relative z-10">
        
        {/* Menu Section */}
        <div>
          <div className={`${currentBgTheme.cardBg} p-4 md:p-8 rounded-3xl transition-all duration-300`}>
            {tableParam ? (
              <div className="mb-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-md animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <MapPin className="w-5 h-5 text-white animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">
                      {language === 'ar' ? `📍 طاولة رقم ${tableParam}` : `📍 Table No. ${tableParam}`}
                    </h3>
                    <p className="text-[11px] text-white/80">
                      {language === 'ar' ? 'المساعد الصوتي والطلبات مربوطة مباشرة بالسستم الأصلي' : 'Orders & Voice Assistant sync directly with the original system'}
                    </p>
                  </div>
                </div>
                <span className="bg-white/20 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                  {language === 'ar' ? 'خدمة فورية' : 'Live Service'}
                </span>
              </div>
            ) : (
              <div className="mb-6 bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs">
                      {language === 'ar' ? `📍 رقم الطاولة النشط: طاولة ${effectiveTable}` : `📍 Active Table: Table ${effectiveTable}`}
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      {language === 'ar' ? 'اختر رقم طاولتك لتوجيه الطلبات تلقائياً للمطبخ:' : 'Select your table to direct orders to the kitchen:'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['1', '2', '3', '4', '5', 'VIP 1'].map((tbl) => (
                    <button
                      key={tbl}
                      type="button"
                      onClick={() => setSelectedTable(tbl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        effectiveTable === tbl 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-white/10 hover:bg-white/20 text-slate-300'
                      }`}
                    >
                      {tbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-start flex-wrap gap-3 md:gap-4 mb-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {storeSettings.logoUrl ? (
                  <img src={storeSettings.logoUrl} alt={getRestaurantName()} className="h-12 w-12 md:h-14 md:w-14 rounded-2xl object-contain bg-white/80 p-1 shrink-0" />
                ) : (
                  <span className="text-3xl md:text-4xl filter drop-shadow-md select-none shrink-0" aria-hidden="true">
                    {menuLogoEmoji || '🍽️'}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className={`text-xl md:text-3xl font-extrabold tracking-tight ${currentBgTheme.titleText} leading-tight`}>
                    {getRestaurantName()}
                  </h1>
                  <p className={`mt-1 md:mt-2 text-xs md:text-sm leading-relaxed ${currentBgTheme.descText} line-clamp-2 md:line-clamp-none`}>
                    {getSectorDescription()}
                  </p>
                  {(storeSettings.address || storeSettings.phone) && (
                    <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${currentBgTheme.descText}`}>
                      {storeSettings.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{storeSettings.address}</span>
                        </span>
                      )}
                      {storeSettings.phone && (
                        <a href={`tel:${storeSettings.phone}`} className="inline-flex items-center gap-1 font-semibold hover:underline" dir="ltr">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          {storeSettings.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${
                  currentBgTheme.isDark ? "bg-white/10 text-emerald-400" : "bg-emerald-50/80 text-emerald-600 border border-emerald-100"
                }`}>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  {storeSettings.showVoiceWidget
                    ? (language === 'ar' ? 'مساعد نشط' : 'Live')
                    : (language === 'ar' ? 'منيو يدوي' : 'Manual')}
                </span>
                {sessionRemaining !== null && (
                  <span className="font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 bg-amber-50/80 text-amber-600 border border-amber-100" dir="ltr">
                    <Timer className="w-3.5 h-3.5" />
                    {formatCountdown(sessionRemaining)}
                  </span>
                )}
              </div>
            </div>

            {/* Category Filter Pills — built from the merchant's own categories.
                Scrollable horizontally on mobile, with comfortable tap targets. */}
            <div className="flex gap-2 overflow-x-auto pb-2 mt-4 md:mt-6 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              <button
                key="all"
                type="button"
                style={activeCategory === 'all' && customButtonColor ? { backgroundColor: customButtonColor } : undefined}
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] transition-all ${
                  activeCategory === 'all'
                    ? `${currentPrimary.bg} text-white shadow-xs`
                    : currentBgTheme.isDark
                      ? 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? '🍽️ كل القائمة' : '🍽️ All Menu'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  style={activeCategory === cat.id && customButtonColor ? { backgroundColor: customButtonColor } : undefined}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] transition-all ${
                    activeCategory === cat.id
                      ? `${currentPrimary.bg} text-white shadow-xs`
                      : currentBgTheme.isDark
                        ? 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.emoji ? `${cat.emoji} ` : ''}
                  {language === 'ar' ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>
            
            <div className={`grid gap-4 md:gap-6 mt-6 md:mt-8 ${menuLayout === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
              {filteredMenuItems.map((item) => {
                // Existing quantity in cart (for showing +1 / + buttons instead of just Add)
                const inCart = cartItems.find((c) => c.id === item.id);
                return (
                <div key={item.id} style={customCardColor ? { backgroundColor: customCardColor } : undefined} className={`${currentBgTheme.cardBg} ${menuBorderRadius} p-4 md:p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between border ${currentBgTheme.accentCardBg}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className={`font-extrabold text-sm md:text-base line-clamp-2 ${currentBgTheme.titleText}`}>{item.name}</h3>
                      <span className={`font-extrabold text-base md:text-lg whitespace-nowrap ${currentPrimary.text}`} style={customAccentColor ? { color: customAccentColor } : undefined} dir="ltr">
                        {formatPrice(item.price, menuCurrency)}
                      </span>
                    </div>
                    <p className={`text-[11px] md:text-xs mb-3 md:mb-4 line-clamp-2 md:line-clamp-3 ${currentBgTheme.descText}`}>{item.description || (language === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.')}</p>
                  </div>

                  {/* Add to order — shows qty controls if already in cart.
                      Tap targets are min 44px (Apple HIG) for comfortable
                      mobile tapping. */}
                  {!inCart ? (
                    <button
                      onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                      style={customButtonColor ? { backgroundColor: customButtonColor, color: "#ffffff" } : undefined}
                      className={`w-full flex items-center justify-center gap-2 transition-all py-3 rounded-xl font-bold text-sm shadow-xs min-h-[44px] ${currentPrimary.buttonBg}`}
                    >
                      <Plus className="w-4 h-4" />
                      {language === 'ar' ? 'إضافة للطلب' : 'Add to order'}
                    </button>
                  ) : (
                    <div className={`flex items-center justify-between rounded-xl overflow-hidden ${currentPrimary.bg} text-white`}>
                      <button
                        onClick={() => setQuantity(item.id, inCart.quantity - 1)}
                        className="w-12 h-12 flex items-center justify-center hover:bg-black/10 transition-colors"
                        title={language === 'ar' ? 'إنقاص' : 'Decrease'}
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="font-extrabold text-sm">
                        {inCart.quantity} {language === 'ar' ? 'في الطلب' : 'in cart'}
                      </span>
                      <button
                        onClick={() => setQuantity(item.id, inCart.quantity + 1)}
                        className="w-12 h-12 flex items-center justify-center hover:bg-black/10 transition-colors"
                        title={language === 'ar' ? 'زيادة' : 'Increase'}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              );})}
            </div>
          </div>
        </div>

      </div>

      {/* ============ Social / contact footer (optional, only if any are set) ============ */}
      {(storeSettings.instagram || storeSettings.facebook || storeSettings.whatsapp) && (
        <div className={`max-w-6xl w-full mt-12 py-6 flex flex-wrap items-center justify-center gap-4 ${currentBgTheme.isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {storeSettings.instagram && (
            <a href={storeSettings.instagram} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-bold hover:text-indigo-500 transition-colors`}>
              <Instagram className="w-4 h-4" /> {language === 'ar' ? 'إنستجرام' : 'Instagram'}
            </a>
          )}
          {storeSettings.facebook && (
            <a href={storeSettings.facebook} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-bold hover:text-indigo-500 transition-colors`}>
              <Facebook className="w-4 h-4" /> {language === 'ar' ? 'فيسبوك' : 'Facebook'}
            </a>
          )}
          {storeSettings.whatsapp && (
            <a href={`https://wa.me/${storeSettings.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-bold hover:text-emerald-500 transition-colors`} dir="ltr">
              <MessageCircle className="w-4 h-4" /> {storeSettings.whatsapp}
            </a>
          )}
        </div>
      )}

      {/* Working hours (optional, only if set) */}
      {storeSettings.workingHours && (
        <div className={`max-w-6xl w-full mt-2 mb-4 flex items-center justify-center gap-1.5 text-xs ${currentBgTheme.isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Timer className="w-3.5 h-3.5" />
          {storeSettings.workingHours}
        </div>
      )}

      {/* ============ Floating language toggle ============ */}
      {/* Always visible top-corner so a guest can flip Arabic ↔ English even
          if their browser auto-selected one or the QR code didn't carry a
          ?lang= param. Uses logical positioning so it sits opposite the
          cart button (cart on the trailing side, language on the leading
          side, both 80px below the very top so they never cover the
          restaurant name). */}
      <button
        type="button"
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className={`fixed top-4 ${language === 'ar' ? 'right-4' : 'left-4'} z-[15000] flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 text-slate-700 px-3 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all min-h-[40px]`}
        title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        aria-label={language === 'ar' ? 'Switch to English' : 'Switch to Arabic'}
      >
        <Languages className="w-4 h-4" />
        <span className="text-xs font-extrabold tracking-wide">
          {language === 'ar' ? 'EN' : 'ع'}
        </span>
      </button>

      {/* ============ Floating cart button ============ */}
      {/* Same top row as the language toggle but on the OPPOSITE side, so
          both buttons sit in one clean row above the page content (the
          content container reserves pt-24 for them on mobile). */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className={`fixed top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-[15000] flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform animate-fade-in min-h-[44px]`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="font-extrabold text-sm">{cartCount}</span>
          <span className="text-xs opacity-90 font-bold" dir="ltr">{formatPrice(cartTotal, menuCurrency)}</span>
        </button>
      )}

      {/* ============ Cart slide-over panel ============ */}
      {/* justify-end gives the mirrored behaviour for free: the panel
          slides from the trailing side — right in English (LTR), left in
          Arabic (RTL) — matching where the cart button sits. */}
      {cartOpen && (
        <div className="fixed inset-0 z-[16000] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-fade-in">
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="min-w-0 flex-1">
                <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="truncate">{language === 'ar' ? 'طلب الطاولة' : 'Table order'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ar' ? `طاولة ${effectiveTable}` : `Table ${effectiveTable}`}
                </p>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="font-bold text-slate-500 text-sm">
                    {language === 'ar' ? 'قائمتك فارغة' : 'Your order is empty'}
                  </p>
                  <p className="text-xs mt-1">
                    {language === 'ar' ? 'اضغط "إضافة للطلب" على أي طبق.' : 'Press "Add to order" on any dish.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cartItems.map((ci) => (
                    <li key={ci.id} className="flex items-center gap-2 p-3 rounded-2xl border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm leading-snug truncate">{ci.name}</p>
                        <p className="text-xs text-slate-400" dir="ltr">
                          {formatPrice(ci.price, menuCurrency)}
                          {' '}{language === 'ar' ? 'للقطعة' : 'each'}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg shrink-0">
                        <button
                          onClick={() => setQuantity(ci.id, ci.quantity - 1)}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                          aria-label={language === 'ar' ? 'إنقاص' : 'Decrease'}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-bold text-sm text-slate-800">{ci.quantity}</span>
                        <button
                          onClick={() => setQuantity(ci.id, ci.quantity + 1)}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                          aria-label={language === 'ar' ? 'زيادة' : 'Increase'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-extrabold text-sm text-slate-800 w-14 sm:w-16 text-end shrink-0" dir="ltr">
                        {formatPrice(ci.price * ci.quantity, menuCurrency)}
                      </span>
                      <button
                        onClick={() => removeFromCart(ci.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 -m-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-rose-50"
                        aria-label={language === 'ar' ? 'حذف' : 'Remove'}
                        title={language === 'ar' ? 'حذف' : 'Remove'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label htmlFor="guest-order-note" className="mb-2 block text-xs font-bold text-slate-600">
                  {language === 'ar' ? 'ملاحظات وتعليمات الطلب (اختياري)' : 'Order instructions (optional)'}
                </label>
                <textarea
                  id="guest-order-note"
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder={language === 'ar' ? 'مثال: بدون بصل، الصوص على جنب...' : 'e.g. No onions, sauce on the side...'}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
                />
                <p className="mt-1 text-[11px] text-slate-400">{language === 'ar' ? 'سيتم إرسال الملاحظات مع الطلب للمطعم.' : 'These instructions will be sent to the restaurant with your order.'}</p>
              </div>
            </div>

            {/* Footer: total + send order — pb clears the iPhone home
                indicator so the small "clear order" action below the send
                button is never half-hidden behind it. */}
            {cartItems.length > 0 && (
              <div className="border-t border-slate-100 sticky bottom-0 bg-white">
                <div className="p-4 md:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {language === 'ar' ? 'الإجمالي' : 'Total'}
                    </span>
                    <span className="text-2xl font-extrabold text-slate-900" dir="ltr">
                      {formatPrice(cartTotal, menuCurrency)}
                    </span>
                  </div>
                <button
                  onClick={handleSubmitOrder}
                  disabled={checkoutStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-3.5 rounded-xl text-sm font-extrabold transition-colors cursor-pointer disabled:cursor-wait min-h-[48px]"
                >
                  {checkoutStatus === 'sending' ? (
                    <>{language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}</>
                  ) : checkoutStatus === 'success' ? (
                    <>{language === 'ar' ? '✓ تم إرسال الطلب للمطبخ' : '✓ Sent to kitchen'}</>
                  ) : checkoutStatus === 'error' ? (
                    <>
                      {submitErrorKind === 'schema'
                        ? (language === 'ar'
                            ? 'الطلب متوقف مؤقتًا لحماية بياناتك — يجري تجهيز إرسال آمن من الخادم.'
                            : 'Checkout is temporarily unavailable while secure server-side order validation is being implemented.')
                        : (language === 'ar' ? 'تعذّر الإرسال — حاول مرة أخرى' : 'Failed — try again')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {language === 'ar' ? 'إرسال الطلب للمطبخ' : 'Send to kitchen'}
                    </>
                  )}
                </button>
                {checkoutStatus === 'error' && submitErrorMessage && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-700 break-words">
                    {language === 'ar' ? 'تفاصيل المشكلة: ' : 'Error details: '}{submitErrorMessage}
                  </p>
                )}
                <button
                  onClick={() => { if (confirm(language === 'ar' ? 'تفريغ الطلب؟' : 'Clear order?')) clearCart(); }}
                  className="w-full text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors min-h-[44px]"
                >
                  {language === 'ar' ? 'تفريغ الطلب' : 'Clear order'}
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ Invoice screen (after successful order) ============ */}
      {checkoutStatus === 'success' && lastOrder && (
        <div className="fixed inset-0 z-[17000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto">
            {/* Accent bar + logo */}
            <div className={`h-2 ${currentPrimary.bg}`} style={customAccentColor ? { backgroundColor: customAccentColor } : undefined} />
            <div className="p-6 text-center">
              {/* Logo */}
              <div className="flex justify-center mb-3">
                {storeSettings.logoUrl ? (
                  <img
                    src={storeSettings.logoUrl}
                    alt="Restaurant logo"
                    className="w-14 h-14 rounded-2xl object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {language === 'ar' ? 'تم إرسال طلبك' : 'Order sent'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {language === 'ar'
                  ? 'وصل طلبك إلى المطبخ. يمكنك تتبع حالته.'
                  : 'Your order has reached the kitchen. You can track its status.'}
              </p>
            </div>

            {/* Receipt body */}
            <div className="p-6">
              {/* Order number — prominent, boxed, so guest remembers it */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {language === 'ar' ? 'رقم الطلب' : 'ORDER NUMBER'}
                </p>
                <p className="font-mono text-lg font-extrabold text-slate-900 tracking-wider">
                  {lastOrder.id.replace('order_', '')}
                </p>
              </div>

              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-slate-400">
                  {language === 'ar' ? 'الطاولة' : 'Table'}
                </span>
                <span className="font-bold text-slate-700">
                  {lastOrder.tableNumber}
                </span>
              </div>

              {lastOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      <span className="font-bold text-slate-900">{item.quantity}×</span>
                      <span className="ms-1.5">{item.name}</span>
                    </span>
                    <span className="font-mono text-slate-500" dir="ltr">
                      {formatPrice(item.price * item.quantity, menuCurrency)}
                    </span>
                  </div>
                ))}
              {lastOrder.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{lastOrder.notes}</p>}

              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </span>
                <span className="text-2xl font-extrabold text-slate-900" dir="ltr">
                  {formatPrice(lastOrder.total, menuCurrency)}
                </span>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => { setTrackingOrder(lastOrder.id); }}
                  style={customButtonColor ? { backgroundColor: customButtonColor } : undefined}
                  className={`w-full flex items-center justify-center gap-2 text-white px-4 py-3.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${currentPrimary.bg}`}
                >
                  <Clock className="w-4 h-4" />
                  {language === 'ar' ? 'تتبع الطلب' : 'Track order'}
                </button>
                <button
                  onClick={handleDownloadInvoice}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {language === 'ar' ? 'تنزيل الفاتورة' : 'Download invoice'}
                </button>
                <button
                  onClick={() => {
                    setCheckoutStatus('idle');
                    // Keep lastOrder so the tracking button stays visible.
                    // Don't setLastOrder(null) — that would hide the
                    // floating tracking button the guest needs.
                  }}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 font-bold transition-colors py-2"
                >
                  {language === 'ar' ? 'إغلاق ومتابعة التصفّح' : 'Close and continue browsing'}
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-4 leading-relaxed">
                {language === 'ar'
                  ? 'زر التتبع سيظل ظاهرًا في أسفل الشاشة لتتابع طلبك حتى يُقدّم.'
                  : 'A tracking button stays on-screen to follow your order until it is served.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============ Order tracking modal ============ */}
      {trackingOrder && (
        <div className="fixed inset-0 z-[18000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          {/* relative anchors the X close button to THIS card, not the
              full-screen overlay (the old absolute positioning let the X
              float at the screen corner, far from the modal). */}
          <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto">
            <button
              onClick={() => setTrackingOrder(null)}
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              className="absolute top-3 end-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 text-center">
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                {language === 'ar' ? 'تتبع الطلب' : 'Order tracking'}
              </h2>
              <p className="text-xs text-slate-400 font-mono mb-6">
                № {trackingOrder.replace('order_', '')}
              </p>

              {/* Status timeline */}
              <div className="space-y-1">
                {/* Step 1: pending */}
                <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  trackingStatus === 'pending' ? 'bg-amber-50 border border-amber-200' :
                  ['preparing', 'completed'].includes(trackingStatus) ? 'bg-emerald-50' : 'opacity-40'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    trackingStatus === 'pending' ? 'bg-amber-500 text-white' :
                    ['preparing', 'completed'].includes(trackingStatus) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {['preparing', 'completed'].includes(trackingStatus) ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-bold text-sm text-slate-800">
                      {language === 'ar' ? 'تم استلام الطلب' : 'Order received'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ar' ? 'الطلب بانتظار المطبخ' : 'Waiting for the kitchen'}
                    </p>
                  </div>
                </div>

                {/* Step 2: preparing */}
                <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  trackingStatus === 'preparing' ? 'bg-indigo-50 border border-indigo-200' :
                  trackingStatus === 'completed' ? 'bg-emerald-50' : 'opacity-40'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    trackingStatus === 'preparing' ? 'bg-indigo-500 text-white animate-pulse' :
                    trackingStatus === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {trackingStatus === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-bold text-sm text-slate-800">
                      {language === 'ar' ? 'قيد التحضير' : 'In preparation'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {trackingStatus === 'preparing'
                        ? (language === 'ar' ? 'المطبخ يحضّر طلبك الآن' : 'The kitchen is preparing your order')
                        : (language === 'ar' ? 'المطبخ بدأ التحضير' : 'Kitchen started preparation')}
                    </p>
                  </div>
                </div>

                {/* Step 3: served */}
                <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  trackingStatus === 'completed' ? 'bg-emerald-50 border border-emerald-200' : 'opacity-40'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    trackingStatus === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-bold text-sm text-slate-800">
                      {language === 'ar' ? 'تم التقديم' : 'Served'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {trackingStatus === 'completed'
                        ? (language === 'ar' ? 'طلبك جاهز! بالهنا والشفا' : 'Your order is ready!')
                        : (language === 'ar' ? 'بانتظار تقديم الطلب' : 'Awaiting service')}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-6 flex items-center justify-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse`} />
                {language === 'ar' ? 'هذه الشاشة تتحدث تلقائيًا' : 'This screen updates automatically'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============ Persistent tracking button — always rendered, just
           visually hidden when there's no active order. This avoids the
           Safari "removeChild on Node" error caused by conditional
           mount/unmount of fixed-position elements.

           On mobile we lift it above the VoiceWidget (which sits at
           bottom-6 end-6) by using bottom-28 — that gives the mic button
           enough breathing room and the tracking button stays tappable. */}
      <div
        onClick={() => { if (lastOrder) setTrackingOrder(lastOrder.id); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && lastOrder) setTrackingOrder(lastOrder.id); }}
        aria-label={language === 'ar' ? `تتبع الطلب رقم ${lastOrder?.id.replace('order_', '') || ''}` : `Track order ${lastOrder?.id.replace('order_', '') || ''}`}
        className={`fixed bottom-28 mb-safe ${language === 'ar' ? 'left-4' : 'right-4'} z-[14000] flex items-center gap-2 bg-slate-900 text-white ps-3 pe-4 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 cursor-pointer min-h-[44px] ${
          lastOrder && checkoutStatus !== 'success' && trackingStatus !== 'completed'
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          trackingStatus === 'pending' ? 'bg-amber-500/30' :
          trackingStatus === 'preparing' ? 'bg-indigo-500/30' :
          'bg-slate-700'
        }`}>
          <Clock className={`w-4 h-4 ${
            trackingStatus === 'pending' ? 'text-amber-300' :
            trackingStatus === 'preparing' ? 'text-indigo-300' :
            'text-slate-300'
          }`} />
        </span>
        {lastOrder && (
          <>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {language === 'ar' ? 'تتبع' : 'Track'}
              </span>
              <span className="font-bold text-xs">№ {lastOrder.id.replace('order_', '')}</span>
            </div>
            <span className={`w-2 h-2 rounded-full shrink-0 ms-1 ${
              trackingStatus === 'pending' ? 'bg-amber-400 animate-pulse' :
              trackingStatus === 'preparing' ? 'bg-indigo-400 animate-pulse' :
              'bg-slate-500'
            }`} />
          </>
        )}
      </div>

      {/* Voice waiter — hidden when the merchant disables it in Settings */}
      {storeSettings.showVoiceWidget && <VoiceWidget onPlaceOrder={handleSubmitOrder} />}
    </div>
  );
}
