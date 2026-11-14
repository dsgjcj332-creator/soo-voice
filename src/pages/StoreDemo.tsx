import React from 'react';
import { Sparkles, Key, Home, Car, MapPin, Navigation, Timer, MicOff, Phone, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { VoiceWidget } from '../components/widget/VoiceWidget';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { normalizeCurrency, formatPrice } from '../lib/currency';
import { useSearchParams } from 'react-router-dom';
import {
  useStoreSettings, haversineKm, ensureSessionStart, resetSession,
  sessionRemainingSeconds, formatCountdown,
} from '../lib/storeSettings';


export function StoreDemo() {
  const { language } = useLanguage();
  const { businessType } = useSettings();
  const { user } = useAuth();
  const [dbMenuItems, setDbMenuItems] = React.useState<any[]>([]);

  // Search parameters for tableside QR code scanning
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table') || searchParams.get('tableNumber') || '';
  const [selectedTable, setSelectedTable] = React.useState<string>(tableParam || '1');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const effectiveTable = tableParam || selectedTable || '1';
  const urlOwnerId = searchParams.get('ownerId') || searchParams.get('storeId') || '';
  const resolvedOwnerId = urlOwnerId || user?.uid || 'demo_merchant';

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
  const [menuLogoEmoji, setMenuLogoEmoji] = React.useState<string>("🍔");
  const [menuBorderRadius, setMenuBorderRadius] = React.useState<string>("rounded-2xl");
  const [menuParticles, setMenuParticles] = React.useState<string>("none");
  const [menuCurrency, setMenuCurrency] = React.useState<string>(normalizeCurrency(null));
  const [menuLayout, setMenuLayout] = React.useState<string>("grid");

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
        if (config.currency) setMenuCurrency(normalizeCurrency(config.currency));
        if (config.layout) setMenuLayout(config.layout);
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
            if (data.currency) setMenuCurrency(normalizeCurrency(data.currency));
            if (data.layout) setMenuLayout(data.layout);
            
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
    <div className={`min-h-screen transition-all duration-500 p-6 md:p-12 font-sans flex justify-center ${currentBgTheme.mainBg} relative overflow-hidden`}>
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
          <div className={`${currentBgTheme.cardBg} p-8 rounded-3xl transition-all duration-300`}>
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

            <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
              <div className="flex items-start gap-3">
                {menuLogoEmoji && (
                  <span className="text-4xl filter drop-shadow-md animate-bounce select-none">
                    {menuLogoEmoji}
                  </span>
                )}
                <div>
                  <h1 className={`text-3xl font-extrabold tracking-tight ${currentBgTheme.titleText}`}>
                    {getRestaurantName()}
                  </h1>
                  <p className={`mt-2 text-sm leading-relaxed ${currentBgTheme.descText}`}>
                    {getSectorDescription()}
                  </p>
                  {(storeSettings.address || storeSettings.phone) && (
                    <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${currentBgTheme.descText}`}>
                      {storeSettings.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {storeSettings.address}
                        </span>
                      )}
                      {storeSettings.phone && (
                        <a href={`tel:${storeSettings.phone}`} className="inline-flex items-center gap-1 font-semibold hover:underline" dir="ltr">
                          <Phone className="w-3.5 h-3.5" />
                          {storeSettings.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${
                  currentBgTheme.isDark ? "bg-white/10 text-emerald-400" : "bg-emerald-50/80 text-emerald-600 border border-emerald-100"
                }`}>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  {storeSettings.showVoiceWidget
                    ? (language === 'ar' ? 'مساعد ذكي نشط' : 'Live Connected Assistant')
                    : (language === 'ar' ? 'منيو يدوي' : 'Manual menu')}
                </span>
                {sessionRemaining !== null && (
                  <span className="font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 bg-amber-50/80 text-amber-600 border border-amber-100" dir="ltr">
                    <Timer className="w-3.5 h-3.5" />
                    {formatCountdown(sessionRemaining)}
                  </span>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mt-6 scrollbar-none">
              {[
                { id: 'all', labelAr: '🍽️ كل القائمة', labelEn: '🍽️ All Menu' },
                { id: 'Main Course', labelAr: '🍔 أطباق رئيسية', labelEn: '🍔 Main Course' },
                { id: 'Appetizers', labelAr: '🍟 مقبلات وجوانب', labelEn: '🍟 Appetizers' },
                { id: 'Drinks', labelAr: '☕ مشروبات وقهوة', labelEn: '☕ Drinks' },
                { id: 'Desserts', labelAr: '🍰 حلويات', labelEn: '🍰 Desserts' },
                { id: 'Secret Menu', labelAr: '✨ أطباق سرية للشيف', labelEn: '✨ Chef Specials' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? `${currentPrimary.bg} text-white shadow-xs`
                      : currentBgTheme.isDark
                        ? 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {language === 'ar' ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>
            
            <div className={`grid gap-6 mt-8 ${menuLayout === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
              {filteredMenuItems.map((item) => (
                <div key={item.id} className={`${currentBgTheme.cardBg} ${menuBorderRadius} p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between border ${currentBgTheme.accentCardBg}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className={`font-extrabold text-base line-clamp-2 ${currentBgTheme.titleText}`}>{item.name}</h3>
                      <span className={`font-extrabold ${currentPrimary.text} text-lg whitespace-nowrap`} dir="ltr">
                        {formatPrice(item.price, menuCurrency)}
                      </span>
                    </div>
                    <p className={`text-xs mb-4 line-clamp-3 min-h-[48px] ${currentBgTheme.descText}`}>{item.description || (language === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
      
      {/* Voice waiter — hidden when the merchant disables it in Settings */}
      {storeSettings.showVoiceWidget && <VoiceWidget />}
    </div>
  );
}
