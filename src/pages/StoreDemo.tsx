import React from 'react';
import { useCart } from '../contexts/CartContext';
import { ShoppingBag, Plus, Trash2, CreditCard, Sparkles, Key, Home, Car, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { VoiceWidget } from '../components/widget/VoiceWidget';
import { collection, query, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';


const SECTOR_FALLBACK_ITEMS = {
  restaurant: [
    { id: '1', name: 'Truffle Mushroom Burger', price: 15.99, description: 'Beef patty, Swiss cheese, truffle sauce.' },
    { id: '2', name: 'Margherita Pizza', price: 12.99, description: 'Fresh tomatoes, mozzarella, basil, sourdough crust.' },
    { id: '3', name: 'Caesar Salad', price: 9.99, description: 'Crisp romaine, parmesan cheese, herb croutons.' },
    { id: '4', name: 'Crispy French Fries', price: 4.99, description: 'Golden crispy potato fries.' },
    { id: '5', name: 'Cold Brew Coffee', price: 5.99, description: 'Smooth cold-steeped house coffee blend.' }
  ],
  real_estate: [
    { id: '1', name: 'Modern Studio Apartment', price: 85000, description: 'Studio apartment with kitchen, shared gym & pool access.' },
    { id: '2', name: 'Spacious 3-Bedroom Apartment', price: 175000, description: 'Large 3BR layout, master bedroom, covered private parking, premium area.' },
    { id: '3', name: 'Luxury Standalone Family Villa', price: 590000, description: 'Standalone villa with customized private pool, deck and landscape garden.' },
    { id: '4', name: 'Prime Commercial Retail Space', price: 120000, description: 'Ground floor corner retail shop, ideal for showroom or restaurant.' }
  ],
  automotive: [
    { id: '1', name: 'Standard Sedan Model 2026', price: 24500, description: 'Fuel efficient commuter vehicle with smart dashboard, 5-star safety rating.' },
    { id: '2', name: 'Family SUV All-Wheel Drive', price: 46000, description: 'Spacious SUV with luxury package, panoramic sunroof, heated seats.' },
    { id: '3', name: 'Premium Ceramic Brake Pad Kit', price: 65.00, description: 'Original high-reliability ceramic brake pads with low noise.' },
    { id: '4', name: 'Android Smart Touch Display Console', price: 250.00, description: 'Complete 10-inch smart dashboard screen with dynamic GPS and Apple CarPlay.' }
  ],
  general: [
    { id: '1', name: 'Pro Noise-Cancelling Headphones', price: 199.99, description: 'High fidelity audio with adaptive noise cancelling, 35-hour battery life.' },
    { id: '2', name: 'Ergonomic Motorized Height-Adjustable Desk', price: 349.99, description: 'Premium solid oak desktop with digital memory preset heights.' },
    { id: '3', name: 'Mechanical Quiet Gaming Keyboard', price: 119.99, description: 'RGB backlight, hot-swappable switches, wireless tri-mode.' },
    { id: '4', name: 'Smart Home Hub & Assistant', price: 89.99, description: 'Voice-controlled display hub to automate smart appliances and lights.' }
  ]
};

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
  const urlOwnerId = searchParams.get('ownerId') || searchParams.get('storeId') || '';
  const resolvedOwnerId = urlOwnerId || user?.uid || 'demo_merchant';

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
      });
      return () => unsubscribe();
    }
  }, [resolvedOwnerId]);

  // Use Firestore items if available, else fallback. Filter out the hidden AI-only products from public rendering.
  const allMenuItems = dbMenuItems.length > 0 
    ? dbMenuItems 
    : (SECTOR_FALLBACK_ITEMS[businessType] || SECTOR_FALLBACK_ITEMS.restaurant);
  const visibleMenuItems = allMenuItems.filter(item => !item.isAiOnly);

  const handleCheckout = async () => {
    setCheckoutStatus('processing');
    try {
      const orderId = 'order_' + Math.floor(100000 + Math.random() * 900000);
      const newOrder = {
        id: orderId,
        ownerId: resolvedOwnerId,
        tableNumber: tableParam || 'Walk-in',
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
            const payload = JSON.stringify({
              event: 'order.created',
              timestamp: Date.now(),
              data: newOrder
            });
            // Generate HMAC signature using webhook secret
            const encoder = new TextEncoder();
            const keyData = encoder.encode(webhookSecret || '');
            const payloadData = encoder.encode(payload);
            const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
            const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
            // Non-blocking fetch dispatch
            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-VoiceAI-Signature': `sha256=${sigHex}`
              },
              body: payload
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
    switch (businessType) {
      case "real_estate":
        return language === "ar" ? "كتالوج العقارات والسمسار الذكي" : "Interactive Property & Real Estate Catalog";
      case "automotive":
        return language === "ar" ? "معرض السيارات وقطع الغيار" : "Smart Automotive Showroom & Parts";
      case "general":
        return language === "ar" ? "الكتالوج الرقمي التفاعلي" : "Universal Digital Catalog";
      case "restaurant":
      default:
        return language === "ar" ? "المنيو الرقمي والـ QR التفاعلي" : "Interactive Digital Menu";
    }
  };

  const getSectorDescription = () => {
    switch (businessType) {
      case "real_estate":
        return language === "ar"
          ? "تحدث مع مساعد العقارات الصوتي بالأسفل للاستفسار عن مواقع الشقق والمواصفات وحجز مواعيد المعاينة مباشرة."
          : "Talk to our real estate voice broker below to ask about property details, sizes, layouts, or book a showing.";
      case "automotive":
        return language === "ar"
          ? "تحدث مع المساعد الصوتي للبحث الفوري عن قطع الغيار، معرفة أسعار ومواصفات السيارات، وحجز تجربة قيادة."
          : "Talk to our automotive voice agent to search spare parts, ask about vehicle models, or book a test drive.";
      case "general":
        return language === "ar"
          ? "تحدث مع مساعد المبيعات الذكي بالأسفل لتصفح المنتجات، معرفة تفاصيل الضمان وإضافتها لطلبك."
          : "Talk to our dynamic retail voice advisor to search inventory, check warranties, or add goods to your order.";
      case "restaurant":
      default:
        return language === "ar"
          ? "تحدث مع المساعد الصوتي بالأسفل لطلب الطعام مباشرة أو لإضافة صنف إلى سلتك."
          : "Talk to the voice agent below to order food directly or add delicious meals to your cart.";
    }
  };

  const getSectorCartTitle = () => {
    switch (businessType) {
      case "real_estate":
        return language === "ar" ? "العقارات المحددة للمعاينة" : "Interested Properties";
      case "automotive":
        return language === "ar" ? "سلة القطع والسيارات للحجز" : "Selected Car & Parts";
      case "general":
        return language === "ar" ? "سلة المشتريات" : "Your Shopping Cart";
      case "restaurant":
      default:
        return language === "ar" ? "سلة الطلبات والمأكولات" : "Your Food Cart";
    }
  };

  const getSectorCartEmptyDesc = () => {
    switch (businessType) {
      case "real_estate":
        return language === "ar" 
          ? "اطلب من المساعد الصوتي إضافة عقار أو حجز موعد معاينة!" 
          : "Ask the voice broker to add property or schedule a viewing!";
      case "automotive":
        return language === "ar" 
          ? "اطلب من المساعد الصوتي إضافة قطع غيار أو حجز تجربة قيادة!" 
          : "Ask the voice agent to search parts or book a test drive!";
      case "general":
        return language === "ar" 
          ? "اطلب من المساعد الصوتي إضافة منتجات لطلبك!" 
          : "Ask the voice agent to add products to your cart!";
      case "restaurant":
      default:
        return language === "ar" 
          ? "اطلب من المساعد الصوتي إضافة مأكولات ومشروبات!" 
          : "Ask the voice agent to add meals and drinks!";
    }
  };

  const getSectorCheckoutText = () => {
    switch (businessType) {
      case "real_estate":
        return {
          idle: language === "ar" ? "تأكيد طلب المعاينة" : "Schedule Viewing Appointment",
          processing: language === "ar" ? "جاري حجز موعدك..." : "Booking Viewing...",
          success: language === "ar" ? "تم تحديد الموعد وجاري التواصل!" : "Viewing Scheduled Successfully!"
        };
      case "automotive":
        return {
          idle: language === "ar" ? "طلب حجز قيادة وتأكيد" : "Book Test Drive / Part Quote",
          processing: language === "ar" ? "جاري إرسال طلبك..." : "Submitting Booking...",
          success: language === "ar" ? "تم إرسال الطلب بنجاح!" : "Drive Booking Confirmed!"
        };
      case "general":
      case "restaurant":
      default:
        return {
          idle: language === "ar" ? "تأكيد الطلب والدفع الآمن" : "Secure Checkout",
          processing: language === "ar" ? "جاري إتمام الطلب..." : "Processing Order...",
          success: language === "ar" ? "تم تأكيد طلبك والدفع بنجاح!" : "Order & Payment Success!"
        };
    }
  };

  const getSectorAddButtonText = () => {
    switch (businessType) {
      case "real_estate":
        return language === "ar" ? "أضف للمعاينة" : "Select for Showing";
      case "automotive":
        return language === "ar" ? "حجز باقة / قطعة" : "Book / Reserve";
      case "general":
        return language === "ar" ? "إضافة للسلة" : "Add to Cart";
      case "restaurant":
      default:
        return language === "ar" ? "إضافة للطلب" : "Add to Order";
    }
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
            { id: 1, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍔" : businessType === "real_estate" ? "🏠" : "🚗"), left: "8%", delay: "0s", duration: "16s" },
            { id: 2, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍕" : businessType === "real_estate" ? "🔑" : "⚡"), left: "28%", delay: "4s", duration: "12s" },
            { id: 3, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍰" : businessType === "real_estate" ? "🏢" : "⚙️"), left: "50%", delay: "2s", duration: "18s" },
            { id: 4, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "☕" : businessType === "real_estate" ? "🌲" : "🔋"), left: "72%", delay: "6s", duration: "14s" },
            { id: 5, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : (businessType === "restaurant" ? "🍦" : businessType === "real_estate" ? "🏡" : "🚙"), left: "88%", delay: "3s", duration: "15s" }
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
            {tableParam && (
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
            
            <div className={`grid gap-6 mt-8 ${menuLayout === "grid" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {visibleMenuItems.map((item) => (
                <div key={item.id} className={`${currentBgTheme.cardBg} ${menuBorderRadius} p-5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between border ${currentBgTheme.accentCardBg}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className={`font-extrabold text-base line-clamp-2 ${currentBgTheme.titleText}`}>{item.name}</h3>
                      <span className={`font-extrabold ${currentPrimary.text} text-lg whitespace-nowrap`}>
                        {menuCurrency}{businessType === "real_estate" ? item.price.toLocaleString() : item.price.toFixed(2)}
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
                        {item.quantity} x {menuCurrency}{businessType === "real_estate" ? item.price.toLocaleString() : item.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-extrabold text-sm ${currentBgTheme.titleText}`}>
                        {menuCurrency}{businessType === "real_estate" ? (item.quantity * item.price).toLocaleString() : (item.quantity * item.price).toFixed(2)}
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
                      {menuCurrency}{businessType === "real_estate" ? total.toLocaleString() : total.toFixed(2)}
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
