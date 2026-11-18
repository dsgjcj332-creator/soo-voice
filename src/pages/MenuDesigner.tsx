import React, { useState, useEffect } from "react";
import { ExternalLink, Sparkles, Palette, Save, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";
import { formatPrice } from "../lib/currency";
import { useStoreSettings } from "../lib/storeSettings";

/**
 * Menu Designer — the restaurant's visual identity for the digital menu.
 *
 * Extracted from the DigitalMenu page so that the merchant's catalog and
 * the visual identity are two separate concerns. The catalog page is now
 * about what is on the menu; this page is about how the menu looks.
 *
 * State + persistence are identical to the old embedded designer: a
 * `menu_customizer` row in Supabase keyed by ownerId, with a localStorage
 * cache for instant paint and demo-mode support.
 */

const COLOR_VARIANTS: Record<string, { bg: string; text: string; border: string; bgLight: string; ring: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-600", bgLight: "bg-indigo-50", ring: "ring-indigo-500" },
  rose: { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-600", bgLight: "bg-rose-50", ring: "ring-rose-500" },
  emerald: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-600", bgLight: "bg-emerald-50", ring: "ring-emerald-500" },
  amber: { bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500", bgLight: "bg-amber-50", ring: "ring-amber-500" },
  violet: { bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-600", bgLight: "bg-violet-50", ring: "ring-violet-500" },
  gold: { bg: "bg-yellow-700", text: "text-yellow-700", border: "border-yellow-700", bgLight: "bg-yellow-50", ring: "ring-yellow-500" },
};

const BG_PRESETS = [
  { key: "light-clean", titleAr: "أبيض بسيط هادئ", titleEn: "Minimalist Light", preview: "bg-slate-50 border-slate-200 text-slate-800" },
  { key: "sunset-glow", titleAr: "غروب الذهب الدافئ", titleEn: "Golden Sunset", preview: "bg-gradient-to-br from-amber-50 to-rose-100 border-orange-200 text-slate-800" },
  { key: "midnight-dark", titleAr: "الوضع الليلي الأنيق", titleEn: "Midnight Dark", preview: "bg-slate-950 border-slate-800 text-slate-200" },
  { key: "forest-green", titleAr: "النباتي الطبيعي الأخضر", titleEn: "Forest Botanic", preview: "bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 text-emerald-950" },
  { key: "cosmic-purple", titleAr: "الفضاء البنفسجي", titleEn: "Cosmic Purple", preview: "bg-gradient-to-br from-indigo-950 to-purple-950 border-purple-900 text-purple-200" },
  { key: "modern-retro", titleAr: "كريم كلاسيكي عتيق", titleEn: "Classic Retro Cream", preview: "bg-[#f4f1ea] border-[#2c2a29] text-[#2c2a29]" },
];

const EMOJI_PRESETS = ["🍔", "🍕", "☕", "🍦", "🍰", "🏠", "🔑", "🚗", "🛍️", "💇", "🏋️", "✨", "🌸", "🎨", "📱", "💼"];

const CATEGORIES_PREVIEW = [
  { value: "Main Course", labelAr: "أطباق رئيسية وسندوتشات", labelEn: "Main Course & Sandwiches" },
  { value: "Appetizers", labelAr: "مقبلات وبطاطس وصوصات", labelEn: "Appetizers & Sides" },
  { value: "Drinks", labelAr: "مشروبات وقهوة وعصائر", labelEn: "Drinks & Specialty Coffee" },
];

export function MenuDesigner() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { currency } = useSettings();
  const { settings: storeSettings } = useStoreSettings(user?.uid, user?.provider !== "local");

  // Designer state
  const [menuPrimaryColor, setMenuPrimaryColor] = useState("indigo");
  const [menuBgStyle, setMenuBgStyle] = useState("light-clean");
  const [menuLogoEmoji, setMenuLogoEmoji] = useState("✨");
  const [menuBorderRadius, setMenuBorderRadius] = useState("rounded-2xl");
  const [menuParticles, setMenuParticles] = useState("none");
  const [menuLayout, setMenuLayout] = useState("grid");
  const [customAccentColor, setCustomAccentColor] = useState("#4f46e5");
  const [customCardColor, setCustomCardColor] = useState("#ffffff");
  const [customButtonColor, setCustomButtonColor] = useState("#4f46e5");
  const [designSaveStatus, setDesignSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  const activePrimary = COLOR_VARIANTS[menuPrimaryColor] || COLOR_VARIANTS.indigo;

  // Load saved design (localStorage cache first, then Supabase)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const applyConfig = (config: any) => {
      if (cancelled || !config) return;
      if (config.primaryColor) setMenuPrimaryColor(config.primaryColor);
      if (config.bgStyle) setMenuBgStyle(config.bgStyle);
      if (config.logoEmoji) setMenuLogoEmoji(config.logoEmoji);
      if (config.borderRadius) setMenuBorderRadius(config.borderRadius);
      if (config.particles) setMenuParticles(config.particles);
      if (config.layout) setMenuLayout(config.layout);
      if (config.customAccentColor) setCustomAccentColor(config.customAccentColor);
      if (config.customCardColor) setCustomCardColor(config.customCardColor);
      if (config.customButtonColor) setCustomButtonColor(config.customButtonColor);
    };
    const localKey = `menu_design_config_${user.uid}`;
    const saved = localStorage.getItem(localKey);
    if (saved) {
      try { applyConfig(JSON.parse(saved)); } catch {}
    }
    if (user.provider !== "local") {
      const supabase = getSupabase();
      const { isConfigured } = getSupabaseConfig();
      if (isConfigured && supabase) {
        (async () => {
          try {
            const { data, error } = await supabase.from("menu_customizer").select("*").eq("ownerId", user.uid).single();
            if (!error && data) {
              applyConfig(data);
              localStorage.setItem(localKey, JSON.stringify(data));
            }
          } catch (err) { console.error("Error loading design:", err); }
        })();
      }
    }
    return () => { cancelled = true; };
  }, [user]);

  const handleSaveDesign = async () => {
    if (!user) return;
    const config = {
      primaryColor: menuPrimaryColor,
      bgStyle: menuBgStyle,
      logoEmoji: menuLogoEmoji,
      borderRadius: menuBorderRadius,
      particles: menuParticles,
      layout: menuLayout,
      customAccentColor,
      customCardColor,
      customButtonColor,
      updatedAt: Date.now(),
    };
    setDesignSaveStatus("saving");
    try {
      if (user.provider === "local") {
        localStorage.setItem(`menu_design_config_${user.uid}`, JSON.stringify(config));
      } else {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase is not configured");
        const { error } = await supabase.from("menu_customizer").upsert(
          { ownerId: user.uid, ...config },
          { onConflict: "ownerId" }
        );
        if (error) throw error;
      }
      setDesignSaveStatus("success");
    } catch (err) {
      console.error("Failed to save design:", err);
      setDesignSaveStatus("idle");
    }
    setTimeout(() => setDesignSaveStatus("idle"), 2500);
  };

  const ownerId = user?.uid || "demo_user";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Palette className="w-7 h-7 text-indigo-600" />
            {isAr ? "مظهر المنيو" : "Menu appearance"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
            {isAr
              ? "اختر الألوان والخلفيات وأيقونة الشعار. كل تغيير ينعكس فورًا على معاينة هاتف الضيف بجانبك."
              : "Choose your colors, background, and logo. Every change reflects instantly on the guest preview to your right."}
          </p>
        </div>
        <button
          onClick={handleSaveDesign}
          disabled={designSaveStatus === "saving"}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 cursor-pointer transition-colors"
        >
          {designSaveStatus === "saving" ? (
            isAr ? "جاري الحفظ..." : "Saving..."
          ) : designSaveStatus === "success" ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              {isAr ? "تم الحفظ" : "Saved"}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isAr ? "حفظ المظهر" : "Save appearance"}
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ============ Customizer (left, 2 cols) ============ */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="space-y-6">
              {/* 1. Primary color */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3">
                  {isAr ? "1. اللون الأساسي" : "1. Primary accent color"}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    { key: "indigo", nameAr: "نيلي", nameEn: "Indigo", color: "bg-indigo-600" },
                    { key: "rose", nameAr: "وردي", nameEn: "Rose", color: "bg-rose-600" },
                    { key: "emerald", nameAr: "زمردي", nameEn: "Emerald", color: "bg-emerald-600" },
                    { key: "amber", nameAr: "برتقالي", nameEn: "Amber", color: "bg-amber-500" },
                    { key: "violet", nameAr: "بنفسجي", nameEn: "Violet", color: "bg-violet-600" },
                    { key: "gold", nameAr: "ذهبي فاخر", nameEn: "Luxury gold", color: "bg-yellow-700" },
                  ].map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setMenuPrimaryColor(c.key)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer ${
                        menuPrimaryColor === c.key ? "border-slate-800 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full ${c.color} flex items-center justify-center text-white shadow-inner`}>
                        {menuPrimaryColor === c.key && "✓"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600">{isAr ? c.nameAr : c.nameEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Background theme */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3">
                  {isAr ? "2. مظهر المنيو" : "2. Background theme"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BG_PRESETS.map((bg) => (
                    <button
                      key={bg.key}
                      onClick={() => setMenuBgStyle(bg.key)}
                      className={`p-4 rounded-2xl border-2 text-right flex justify-between items-center transition-all cursor-pointer ${
                        menuBgStyle === bg.key ? "border-slate-800 ring-2 ring-slate-800/10 shadow-md" : "border-slate-100 hover:border-slate-200"
                      } ${bg.preview}`}
                    >
                      <div className="text-left font-semibold">
                        <p className="text-xs font-extrabold">{isAr ? bg.titleAr : bg.titleEn}</p>
                        <p className="text-[10px] opacity-70 mt-1">{isAr ? "نص تجريبي" : "Preview text"}</p>
                      </div>
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${menuBgStyle === bg.key ? "bg-slate-800 text-white border-slate-800" : "border-slate-300"}`}>
                        {menuBgStyle === bg.key && "✓"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">{isAr ? "تخصيص ألوان التفاصيل" : "Fine-tune menu colors"}</h3>
                  <p className="mt-1 text-xs text-slate-500">{isAr ? "اختار لون التمييز والبطاقات والأزرار بشكل مستقل." : "Choose independent colors for accents, product cards and buttons."}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: isAr ? "لون التمييز" : "Accent color", value: customAccentColor, set: setCustomAccentColor },
                    { label: isAr ? "خلفية خلايا المنتجات" : "Product card color", value: customCardColor, set: setCustomCardColor },
                    { label: isAr ? "لون الأزرار" : "Button color", value: customButtonColor, set: setCustomButtonColor },
                  ].map((field) => (
                    <label key={field.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 min-w-0">
                      <input type="color" value={field.value} onChange={(e) => field.set(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-700">{field.label}</span>
                        <span className="block text-[10px] text-slate-400 font-mono" dir="ltr">{field.value}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 3. Logo emoji */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {isAr ? "3. أيقونة الشعار" : "3. Logo icon"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={3}
                      value={menuLogoEmoji}
                      onChange={(e) => setMenuLogoEmoji(e.target.value)}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-center text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="flex flex-wrap gap-1 bg-slate-50 border border-slate-200 p-1.5 rounded-xl flex-1 overflow-y-auto max-h-[46px] items-center">
                      {EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setMenuLogoEmoji(emoji)}
                          className="hover:scale-125 transition-transform text-base p-0.5 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Currency is managed centrally in Settings and shared by menu, voice and invoices. */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <p className="text-xs font-bold text-indigo-900">{isAr ? "عملة المنيو" : "Menu currency"}</p>
                  <p className="mt-1 text-xs text-indigo-700">{isAr ? "تُدار من الإعدادات وتُطبّق تلقائيًا على المنيو والمساعد الصوتي والفاتورة." : "Managed in Settings and applied automatically to the menu, voice assistant and invoice."}</p>
                  <p className="mt-2 text-sm font-extrabold text-indigo-900" dir="ltr">{currency}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 5. Curviness */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {isAr ? "5. استدارة حواف البطاقات" : "5. Card curviness"}
                  </label>
                  <div className="flex gap-2">
                    {[
                      { key: "rounded-none", nameAr: "حادة كلاسيك", nameEn: "Sharp" },
                      { key: "rounded-2xl", nameAr: "دائرية ناعمة", nameEn: "Rounded" },
                      { key: "rounded-[2rem]", nameAr: "منحنية مبهجة", nameEn: "Pillowy" },
                    ].map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setMenuBorderRadius(r.key)}
                        className={`flex-1 py-2.5 px-2 rounded-xl border-2 text-[10px] font-bold transition-all cursor-pointer ${
                          menuBorderRadius === r.key ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-100 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        {isAr ? r.nameAr : r.nameEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Layout */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                    {isAr ? "6. تخطيط القائمة" : "6. Layout"}
                  </label>
                  <div className="flex gap-2">
                    {[
                      { key: "grid", nameAr: "شبكة (2 عمود)", nameEn: "Grid" },
                      { key: "list", nameAr: "قائمة (1 عمود)", nameEn: "List" },
                    ].map((l) => (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => setMenuLayout(l.key)}
                        className={`flex-1 py-2.5 px-2 rounded-xl border-2 text-[10px] font-bold transition-all cursor-pointer ${
                          menuLayout === l.key ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-100 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        {isAr ? l.nameAr : l.nameEn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7. Particles */}
              <div className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-100 rounded-3xl p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-2xl shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold uppercase text-indigo-950 tracking-wider">
                      {isAr ? "عناصر طافية في الخلفية" : "Ambient background elements"}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {isAr
                        ? "عناصر نصف شفافة تتحرك بلطف في خلفية المنيو — لمسة عصرية خفية."
                        : "Semi-transparent elements drifting gently in the menu background — a quiet modern touch."}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      {[
                        { key: "none", labelAr: "بدون", labelEn: "None" },
                        { key: "sparkles", labelAr: "نجوم ذهبية ✨", labelEn: "Sparks ✨" },
                        { key: "items", labelAr: "أيقونات 🍕", labelEn: "Items 🍕" },
                        { key: "dust", labelAr: "غبار كوني ⭐", labelEn: "Dust ⭐" },
                      ].map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setMenuParticles(p.key)}
                          className={`py-2 px-3 rounded-xl border transition-all text-[11px] font-bold cursor-pointer ${
                            menuParticles === p.key
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                          }`}
                        >
                          {isAr ? p.labelAr : p.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ Phone preview (right, 1 col) ============ */}
        <div className="lg:col-span-1 space-y-4">
          <div className="sticky top-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">
              {isAr ? "معاينة هاتف الضيف" : "Guest phone preview"}
            </p>

            <div className="mx-auto w-[min(290px,calc(100vw-3rem))] h-[580px] max-w-full bg-slate-900 rounded-[2.8rem] p-3 shadow-2xl border-4 border-slate-800 relative overflow-hidden flex flex-col">
              {/* Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-slate-950 rounded-full z-30 flex items-center justify-center gap-1.5 px-3">
                <div className="w-10 h-1 bg-slate-800 rounded-full" />
                <div className="w-2 h-2 bg-slate-900 rounded-full" />
              </div>

              <div className={`flex-1 rounded-[2.2rem] overflow-hidden relative flex flex-col text-xs transition-all duration-500 ${
                menuBgStyle === "light-clean" ? "bg-slate-50 text-slate-800" :
                menuBgStyle === "sunset-glow" ? "bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 text-slate-800" :
                menuBgStyle === "midnight-dark" ? "bg-slate-950 text-slate-200" :
                menuBgStyle === "forest-green" ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100 text-emerald-950" :
                menuBgStyle === "cosmic-purple" ? "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-purple-200" :
                "bg-[#f4f1ea] text-[#2c2a29]"
              }`}>
                <style>{`
                  @keyframes previewFloatUp {
                    0% { transform: translateY(500px) scale(0.6); opacity: 0; }
                    10% { opacity: 0.4; }
                    90% { opacity: 0.4; }
                    100% { transform: translateY(-50px) translateX(var(--px, 15px)) scale(1.1); opacity: 0; }
                  }
                  .preview-particle {
                    position: absolute; bottom: 0;
                    animation: previewFloatUp var(--pd, 6s) linear infinite;
                    pointer-events: none; z-index: 5; font-size: 14px;
                  }
                `}</style>

                {menuParticles !== "none" && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                    {[
                      { id: 1, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍔", left: "10%", delay: "0s", duration: "7s", px: "20px" },
                      { id: 2, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍕", left: "30%", delay: "2s", duration: "5s", px: "-15px" },
                      { id: 3, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "🍰", left: "60%", delay: "1s", duration: "8s", px: "30px" },
                      { id: 4, char: menuParticles === "sparkles" ? "✨" : menuParticles === "dust" ? "⭐" : "☕", left: "80%", delay: "3s", duration: "6s", px: "-25px" },
                    ].map((p) => (
                      <span
                        key={p.id}
                        className="preview-particle"
                        style={{ left: p.left, animationDelay: p.delay, "--pd": p.duration, "--px": p.px } as React.CSSProperties}
                      >
                        {p.char}
                      </span>
                    ))}
                  </div>
                )}

                {/* Header */}
                <div className="pt-8 px-4 pb-3 border-b border-black/5 flex items-center justify-between bg-black/5 backdrop-blur-xs relative z-20">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {storeSettings.logoUrl ? (
                      <img src={storeSettings.logoUrl} alt="" className="h-7 w-7 rounded-lg object-contain bg-white p-0.5 shrink-0" />
                    ) : (
                      <span className="text-base animate-bounce shrink-0">{menuLogoEmoji || "🍽️"}</span>
                    )}
                    <span className="font-extrabold tracking-tight text-[11px] truncate w-24">
                      {storeSettings.restaurantName || user?.displayName || (isAr ? "مطعم الأصالة" : "Asala Restaurant")}
                    </span>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                    Live
                  </span>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none relative z-10">
                  <div className="text-center py-2">
                    <h4 className="font-extrabold text-xs">
                      {isAr ? "منيو المأكولات والمشروبات" : "Fresh Digital Dining Menu"}
                    </h4>
                    <p className="text-[9px] opacity-70 mt-0.5">
                      {isAr ? "تصفّح واسأل المساعد الصوتي عن الأطباق." : "Browse and ask the voice assistant about dishes."}
                    </p>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {CATEGORIES_PREVIEW.slice(0, 3).map((cat, i) => (
                      <span
                        key={cat.value}
                        className={`px-2 py-1 rounded-full text-[8px] font-bold whitespace-nowrap shrink-0 ${
                          i === 0 ? `${activePrimary.bg} text-white` : "bg-black/5"
                        }`}
                      >
                        {isAr ? cat.labelAr : cat.labelEn}
                      </span>
                    ))}
                  </div>

                  <div className={`grid gap-3 ${menuLayout === "grid" ? "grid-cols-2" : "grid-cols-1"}`}>
                    {[
                      { name: isAr ? "برجر اللحم الكلاسيكي" : "Angus Classic Burger", price: 14.99, desc: isAr ? "جبنة تشيدر، خبز بريوش طازج" : "Cheddar, brioche bun" },
                      { name: isAr ? "كعكة الشوكولاتة الذائبة" : "Molten Chocolate Lava", price: 7.50, desc: isAr ? "شوكولاتة بلجيكية فاخرة" : "Belgian chocolate" },
                    ].map((card, idx) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: customCardColor }}
                        className={`p-3 flex flex-col justify-between transition-all hover:-translate-y-0.5 ${menuBorderRadius} ${
                          menuBgStyle === "light-clean" ? "bg-white border border-slate-100 shadow-xs" :
                          menuBgStyle === "sunset-glow" ? "bg-white/80 border border-orange-100/50 shadow-xs" :
                          menuBgStyle === "midnight-dark" ? "bg-slate-900 border border-slate-800 shadow-sm" :
                          menuBgStyle === "forest-green" ? "bg-white/90 border border-emerald-100 shadow-xs" :
                          menuBgStyle === "cosmic-purple" ? "bg-slate-900/90 border border-purple-800/40 shadow-sm" :
                          "bg-[#fbfbf9] border border-[#2c2a29] shadow-[2px_2px_0px_0px_rgba(44,42,41,1)]"
                        }`}
                      >
                        <div>
                          <h5 className="font-extrabold text-[9px] line-clamp-1">{card.name}</h5>
                          <p className="text-[7px] opacity-60 leading-tight line-clamp-2 mb-2">{card.desc}</p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-bold text-[9px]" style={{ color: customAccentColor }} dir="ltr">
                            {formatPrice(card.price, currency)}
                          </span>
                          <button style={{ backgroundColor: customButtonColor }} className="w-3.5 h-3.5 rounded-full text-white font-bold text-[8px] flex items-center justify-center">
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voice assistant bar */}
                <div className="p-3 bg-black/10 border-t border-black/5 flex items-center justify-between gap-2 relative z-20">
                  <div className="flex items-center gap-1.5 flex-1 bg-black/10 px-2 py-1 rounded-full text-[8px] opacity-70">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                    <span>{isAr ? "اسأل المساعد الصوتي..." : "Talk to voice assistant..."}</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full ${activePrimary.bg} flex items-center justify-center text-white text-[10px] animate-pulse`}>
                    🎙️
                  </div>
                </div>
              </div>

              <div className="w-24 h-1 bg-slate-800 rounded-full mx-auto mt-2.5 mb-1" />
            </div>

            <div className="flex justify-center mt-3">
              <a
                href={`/store?ownerId=${ownerId}&table=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 px-4 py-2.5 rounded-xl shadow-xs transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                {isAr ? "معاينة المنيو حيّة" : "Open live menu"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
