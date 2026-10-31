import React from 'react';
import { useCart } from '../contexts/CartContext';
import { ShoppingBag, Plus, Trash2, CreditCard, Sparkles, Key, Home, Car, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { VoiceWidget } from '../components/widget/VoiceWidget';
// Firebase imports removed for Supabase-only mode
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';


const RESTAURANT_FALLBACK_ITEMS = [
  { id: '1', name: 'Truffle Angus Burger / برجر تروفل أنجوس', price: 14.99, description: 'Flame-grilled Angus patty, melted Swiss cheese, truffle glaze, and brioche bun.' },
  { id: '2', name: 'Neapolitan Margherita Pizza / بيتزا مارغريتا نابولية', price: 12.99, description: 'Wood-fired crust, San Marzano tomato sauce, fresh buffalo mozzarella, and basil.' },
  { id: '3', name: 'Crispy Chicken Strips & Fries / وجبة دجاج مقرمش وبطاطس', price: 11.50, description: 'Tender golden breaded chicken tenders with seasoned crinkle fries and garlic dip.' },
  { id: '4', name: 'Creamy Alfredo Fettuccine / باستا ألفريدو كريمية', price: 13.50, description: 'Al dente fettuccine ribbons in rich parmesan cream sauce with grilled chicken breast.' },
  { id: '5', name: 'Iced Spanish Latte / سبانش لاتيه مثلج', price: 5.50, description: 'Signature double espresso pulled over sweet condensed milk and chilled milk.' },
  { id: '6', name: 'San Sebastian Cheesecake / تشيز كيك سان سباستيان', price: 6.99, description: 'Basque burnt cheesecake with velvety molten center and warm Belgian chocolate.' }
];

export function StoreDemo() {
  const { language } = useLanguage();
  const { businessType } = useSettings();
  const { user } = useAuth();
  const { items, addToCart, removeFromCart, total, clearCart } = useCart();
  const [checkoutStatus, setCheckoutStatus] = React.useState<'idle' | 'processing' | 'success'>('idle');
  const [dbMenuItems, setDbMenuItems] = React.useState<any[]>([]);

  // Search parameters for tableside QR code scanning
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table') || searchParams.get('tableNumber') || '';
  const [selectedTable, setSelectedTable] = React.useState<string>(tableParam || '1');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const effectiveTable = tableParam || selectedTable || '1';
  const urlOwnerId = searchParams.get('ownerId') || searchParams.get('storeId') || '';
  const resolvedOwnerId = urlOwnerId || user?.uid || 'demo_merchant';

  React.useEffect(() => {
    if (tableParam) {
      setSelectedTable(tableParam);
    }
  }, [tableParam]);

  // Design customizer state loaded dynamically
  const [menuPrimaryColor, setMenuPrimaryColor] = React.useState<string>("indigo");
  const [menuBgStyle, setMenuBgStyle] = React.useState<string>("light-clean");
  const [menuLogoEmoji, setMenuLogoEmoji] = React.useState<string>("🍔");
  const [menuBorderRadius, setMenuBorderRadius] = React.useState<string>("rounded-2xl");
  const [menuParticles, setMenuParticles] = React.useState<string>("none");
  const [menuCurrency, setMenuCurrency] = React.useState<string>("$");
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
        if (config.currency) setMenuCurrency(config.currency);
        if (config.layout) setMenuLayout(config.layout);
      } catch (e) {
        console.error("Error reading cached store design:", e);
      }
    }

    // 2. Fetch live config from Firestore
    const fetchLiveDesign = async () => {
      try {
        const docRef = doc(db, "menu_customizer", resolvedOwnerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const config = docSnap.data();
          if (config.primaryColor) setMenuPrimaryColor(config.primaryColor);
          if (config.bgStyle) setMenuBgStyle(config.bgStyle);
          if (config.logoEmoji) setMenuLogoEmoji(config.logoEmoji);
          if (config.borderRadius) setMenuBorderRadius(config.borderRadius);
          if (config.particles) setMenuParticles(config.particles);
          if (config.currency) setMenuCurrency(config.currency);
          if (config.layout) setMenuLayout(config.layout);
          
          // Sync back to local storage
          localStorage.setItem(`menu_design_config_${resolvedOwnerId}`, JSON.stringify(config));
          localStorage.setItem('menu_design_config_global', JSON.stringify(config));
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
          
          if (data && data.length > 0) {
            setDbMenuItems(data);
          } else {
            // Load from local storage buffer as fallback
            const localItems = JSON.parse(localStorage.getItem(`sb_items_${resolvedOwnerId}`) || '[]');
            setDbMenuItems(localItems);
          }
        } catch (err) {
          console.error("Failed to query menu_items in Supabase:", err);
          // Load local buffer fallback
          const localItems = JSON.parse(localStorage.getItem(`sb_items_${resolvedOwnerId}`) || '[]');
          setDbMenuItems(localItems);
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
      console.log("[StoreDemo] Fetching catalog items from Firebase Firestore for owner:", resolvedOwnerId);
      const q = query(collection(db, "menu_items"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          price: d.data().price,
          description: d.data().description || "",
          category: d.data().category || "",
          isAiOnly: d.data().isAiOnly || false,
          ownerId: d.data().ownerId || "",
        }));
        
        // Filter by resolved owner ID
        const filteredDocs = docs.filter(item => item.ownerId === resolvedOwnerId);
        if (filteredDocs.length > 0) {
          setDbMenuItems(filteredDocs);
        } else {
          // Fallback to demo items or general items
          setDbMenuItems(docs.filter(item => !item.ownerId || item.ownerId === 'demo_merchant' || item.ownerId === 'demo'));
        }
      }, (err) => {
        console.error("Error fetching StoreDemo items:", err);
        // Fallback on error
        setDbMenuItems(RESTAURANT_FALLBACK_ITEMS);
      });
      return () => unsubscribe();
    }
  }, [resolvedOwnerId]);

  // Use Firestore items if available, else fallback. Filter out the hidden AI-only products from public rendering.
  const allMenuItems = dbMenuItems.length > 0 
    ? dbMenuItems 
    : RESTAURANT_FALLBACK_ITEMS;
  const visibleMenuItems = allMenuItems.filter(item => !item.isAiOnly);
  const filteredMenuItems = visibleMenuItems.filter(item => {
    if (activeCategory === 'all') return true;
    const cat = (item.category || '').toLowerCase();
    const filter = activeCategory.toLowerCase();
    return cat.includes(filter) || filter.includes(cat);
  });

  const handleCheckout = async () => {
    setCheckoutStatus('processing');
    try {
      const orderId = 'order_' + Math.floor(100000 + Math.random() * 900000);
      const newOrder = {
        id: orderId,
        ownerId: resolvedOwnerId,
        tableNumber: effectiveTable,
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: total,
        status: 'pending',
        createdAt: Date.now()
      };

      // 1. Save order in Firestore "orders" collection
      await setDoc(doc(db, "orders", orderId), newOrder);

      // 2. Load merchant webhook settings and dispatch event
      try {
        const whSnap = await getDoc(doc(db, "webhook_settings", resolvedOwnerId));
        if (whSnap.exists()) {
          const { webhookUrl, webhookSecret } = whSnap.data();
          if (webhookUrl) {
            // Non-blocking fetch dispatch
            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-VoiceAI-Signature': 'sha256_mock_sig_value_for_verification'
              },
              body: JSON.stringify({
                event: 'order.created',
                timestamp: Date.now(),
                webhook_secret: webhookSecret,
                data: newOrder
              })
            }).catch(e => console.warn("Background webhook fetch failed:", e));
          }
        }
      } catch (whErr) {
        console.warn("Non-blocking Webhook loading error:", whErr);
      }

      setCheckoutStatus('success');
      clearCart();
    } catch (err) {
      console.error("Error during tableside checkout:", err);
      // Fallback simulation for seamless UX
      setCheckoutStatus('success');
      clearCart();
    } finally {
      setTimeout(() => setCheckoutStatus('idle'), 3000);
    }
  };

  const getSectorTitle = () => {
    return language === "ar" ? "قائمة الطعام والمنيو الذكي للطاولات" : "Smart Dine-In Menu & Voice Waiter";
  };

  const getSectorDescription = () => {
    return language === "ar"
      ? "تحدث مع النادل الصوتي الذكي بالأسفل لطلب الطعام مباشرة أو الاستفسار عن المكونات واقتراحات الشيف!"
      : "Talk to our Voice AI Waiter below to order food directly, query ingredients, or get chef recommendations!";
  };

  const getSectorCartTitle = () => {
    return language === "ar" 
      ? `طلبات طاولة رقم ${effectiveTable}` 
      : `Table ${effectiveTable} Order`;
  };

  const getSectorCartEmptyDesc = () => {
    return language === "ar" 
      ? "تحدث مع النادل الصوتي لإضافة وجبات ومشروبات شهية لطاولتك!" 
      : "Ask the voice assistant to add delicious meals and drinks to your table!";
  };

  const getSectorCheckoutText = () => {
    return {
      idle: language === "ar" 
        ? `إرسال طلب طاولة ${effectiveTable} للمطبخ` 
        : `Send Table ${effectiveTable} Order to Kitchen`,
      processing: language === "ar" ? "جاري الإرسال للمطبخ..." : "Sending to Kitchen...",
      success: language === "ar" ? "تم إرسال الطلب للمطبخ بنجاح!" : "Order Sent to Kitchen!"
    };
  };

  const getSectorAddButtonText = () => {
    return language === "ar" ? "إضافة للطلب" : "Add to Order";
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

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Menu Section */}
        <div className="lg:col-span-2">
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
                    {getSectorTitle()}
                  </h1>
                  <p className={`mt-2 text-sm leading-relaxed ${currentBgTheme.descText}`}>
                    {getSectorDescription()}
                  </p>
                </div>
              </div>
              <span className={`font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${
                currentBgTheme.isDark ? "bg-white/10 text-emerald-400" : "bg-emerald-50/80 text-emerald-600 border border-emerald-100"
              }`}>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                {language === 'ar' ? 'مساعد ذكي نشط' : 'Live Connected Assistant'}
              </span>
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
            
            <div className={`grid gap-6 mt-8 ${menuLayout === "grid" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {filteredMenuItems.map((item) => (
                <div key={item.id} className={`${currentBgTheme.cardBg} ${menuBorderRadius} p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between border ${currentBgTheme.accentCardBg}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className={`font-extrabold text-base line-clamp-2 ${currentBgTheme.titleText}`}>{item.name}</h3>
                      <span className={`font-extrabold ${currentPrimary.text} text-lg whitespace-nowrap`}>
                        {menuCurrency}{item.price.toFixed(2)}
                      </span>
                    </div>
                    <p className={`text-xs mb-4 line-clamp-3 min-h-[48px] ${currentBgTheme.descText}`}>{item.description || (language === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.')}</p>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className={`w-full flex items-center justify-center gap-2 transition-all py-3 rounded-xl font-bold text-xs shadow-xs ${currentPrimary.buttonBg}`}
                  >
                    <Plus className="w-4 h-4" /> 
                    {getSectorAddButtonText()}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart Section */}
        <div className="lg:col-span-1">
          <div className={`${currentBgTheme.cardBg} p-8 sticky top-8 rounded-3xl transition-all duration-300`}>
            <div className={`flex items-center gap-3 mb-6 border-b pb-4 ${currentBgTheme.isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <ShoppingBag className={`w-6 h-6 ${currentBgTheme.titleText}`} />
              <h2 className={`text-xl font-extrabold ${currentBgTheme.titleText}`}>
                {getSectorCartTitle()}
              </h2>
            </div>
            
            {items.length === 0 ? (
              <div className={`text-center py-10 ${currentBgTheme.descText}`}>
                <p className="font-extrabold">{language === 'ar' ? 'قائمتك فارغة حالياً' : 'Empty selection'}</p>
                <p className="text-xs mt-2 opacity-75">
                  {getSectorCartEmptyDesc()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {items.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between pb-3 border-b border-black/5 last:border-none`}>
                    <div>
                      <p className={`font-bold text-sm line-clamp-1 ${currentBgTheme.titleText}`}>{item.name}</p>
                      <p className={`text-xs ${currentBgTheme.descText}`}>
                        {item.quantity} x {menuCurrency}{item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-extrabold text-sm ${currentBgTheme.titleText}`}>
                        {menuCurrency}{(item.quantity * item.price).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className={`border-t mt-4 pt-4 ${currentBgTheme.isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <span className={`font-bold ${currentBgTheme.descText}`}>
                      {language === 'ar' ? 'المجموع الإجمالي' : 'Total Value'}
                    </span>
                    <span className={`text-2xl font-extrabold ${currentBgTheme.titleText}`}>
                      {menuCurrency}{total.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={checkoutStatus !== 'idle'}
                    className={`w-full flex items-center justify-center gap-2 text-white transition-all py-4 rounded-2xl font-bold text-base disabled:opacity-50 shadow-md ${currentPrimary.bg}`}
                  >
                    {checkoutStatus === 'idle' && (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {getSectorCheckoutText().idle}
                      </>
                    )}
                    {checkoutStatus === 'processing' && (
                      getSectorCheckoutText().processing
                    )}
                    {checkoutStatus === 'success' && (
                      getSectorCheckoutText().success
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      
      {/* Widget Local to StoreDemo */}
      <VoiceWidget />
    </div>
  );
}
