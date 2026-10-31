import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings, Dialect, VoiceTone, BusinessType, Currency } from '../contexts/SettingsContext';
import { Mic, Globe, Settings2, Sparkles, Star, Home, Car, Utensils, Briefcase, Building, Database, Check, Copy, RotateCcw, Key, AlertCircle, DollarSign } from 'lucide-react';
import { subscribeToGlobalVoices, GlobalVoice } from '../services/globalVoices';
import { getSupabaseConfig, resetSupabaseClient } from '../lib/supabase';


export function Settings() {
  const { language } = useLanguage();
  const { dialect, setDialect, voiceTone, setVoiceTone, currency, setCurrency } = useSettings();
  const [globalVoices, setGlobalVoices] = useState<GlobalVoice[]>([]);
  
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const config = getSupabaseConfig();
    setSbUrl(config.url);
    setSbKey(config.anonKey);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalVoices((voices) => setGlobalVoices(voices));
    return () => unsubscribe();
  }, []);

  const standardVoices = [
    { value: 'Zephyr', label: language === 'ar' ? 'زيفير (صوت أنثوي ناعم)' : 'Zephyr (Female, Soft)' },
    { value: 'Charon', label: language === 'ar' ? 'كارون (صوت رجولي دافئ)' : 'Charon (Male, Warm)' },
    { value: 'Fenrir', label: language === 'ar' ? 'فنرير (صوت رجولي قوي)' : 'Fenrir (Male, Deep)' },
    { value: 'Kore', label: language === 'ar' ? 'كوري (صوت أنثوي حاد)' : 'Kore (Female, Clear)' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'إعدادات المساعد الصوتي' : 'Voice Agent Settings'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' 
            ? 'قم بتخصيص لهجة وصوت المساعد ليناسب هوية متجرك وعملائك.' 
            : 'Customize your agent\'s dialect and voice to match your brand.'}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {language === 'ar' ? 'اللغة واللهجة (AI Persona)' : 'Language & Dialect'}
            </h2>
            <p className="text-sm text-slate-500">
              {language === 'ar' ? 'كيف سيتحدث الذكاء الاصطناعي مع عملائك؟' : 'How the AI will converse with your customers'}
            </p>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {language === 'ar' ? 'لهجة المساعد' : 'Agent Dialect'}
            </label>
            <div className="space-y-3">
              {[
                { value: 'standard', label: language === 'ar' ? 'العربية الفصحى' : 'Standard Arabic' },
                { value: 'egyptian', label: language === 'ar' ? 'المصرية العامية' : 'Egyptian' },
                { value: 'gulf', label: language === 'ar' ? 'الخليجية' : 'Gulf' },
                { value: 'levantine', label: language === 'ar' ? 'الشامية' : 'Levantine' },
              ].map((opt) => (
                <label key={opt.value} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${dialect === opt.value ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <input
                    type="radio"
                    name="dialect"
                    value={opt.value}
                    checked={dialect === opt.value}
                    onChange={(e) => setDialect(e.target.value as Dialect)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <span className="ms-3 font-semibold text-slate-800 text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              {language === 'ar' ? 'نبرة الصوت المتاحة (Voice Profiles)' : 'Voice Profiles'}
              <Sparkles className="w-4 h-4 text-amber-500" />
            </label>
            <div className="space-y-3">
              {standardVoices.map((opt) => (
                <label key={opt.value} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${voiceTone === opt.value ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <input
                    type="radio"
                    name="voiceTone"
                    value={opt.value}
                    checked={voiceTone === opt.value}
                    onChange={(e) => setVoiceTone(e.target.value as any)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <span className="ms-3 font-semibold text-slate-800 text-sm">{opt.label}</span>
                </label>
              ))}
              
              {globalVoices.length > 0 && <hr className="my-4 border-slate-100" />}
              
              {globalVoices.map((voice) => (
                <label key={voice.id} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${voiceTone === voice.name ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <input
                    type="radio"
                    name="voiceTone"
                    value={voice.name}
                    checked={voiceTone === voice.name}
                    onChange={(e) => setVoiceTone(e.target.value as any)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <span className="flex-1 ms-3 font-semibold text-slate-800 text-sm flex items-center justify-between">
                     {voice.name}
                     {voice.celebrity && (
                        <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                           <Star className="w-3 h-3 fill-amber-500" /> 
                           {language === 'ar' ? 'مشهور' : 'Celebrity'}
                        </div>
                     )}
                  </span>
                </label>
              ))}
            </div>
            
            <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3 text-sm text-slate-600">
              <Settings2 className="w-5 h-5 shrink-0 text-slate-400" />
              <p>
                {language === 'ar' 
                  ? 'يقوم نموذج جيميناي (Gemini) بتبني نبرة الصوت المحددة، بينما يتكفل الـ Prompt الديناميكي بتوجيه الذكاء الاصطناعي للتحدث باللهجة الصحيحة دون الحاجة لبناء نموذج جديد!'
                  : 'Gemini adopts the selected voice tone output, while the dynamic prompt ensures the AI speaks exactly in your requested regional dialect!'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Currency Selection Card */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {language === 'ar' ? 'العملة الافتراضية' : 'Default Currency'}
            </h2>
            <p className="text-sm text-slate-500">
              {language === 'ar' ? 'اختر العملة التي ستظهر في الفواتير والمنيو' : 'Select the currency used across billing, invoices, and menu pricing'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { value: 'EGP', labelAr: 'جنيه مصري (EGP)', labelEn: 'Egyptian Pound (EGP)', symbol: 'E£' },
              { value: 'SAR', labelAr: 'ريال سعودي (SAR)', labelEn: 'Saudi Riyal (SAR)', symbol: '﷼' },
              { value: 'USD', labelAr: 'دولار أمريكي (USD)', labelEn: 'US Dollar (USD)', symbol: '$' },
              { value: 'AED', labelAr: 'درهم إماراتي (AED)', labelEn: 'UAE Dirham (AED)', symbol: 'د.إ' },
              { value: 'KWD', labelAr: 'دينار كويتي (KWD)', labelEn: 'Kuwaiti Dinar (KWD)', symbol: 'د.ك' },
              { value: 'QAR', labelAr: 'ريال قطري (QAR)', labelEn: 'Qatari Riyal (QAR)', symbol: '﷼' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                  currency === opt.value ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm block">
                    {language === 'ar' ? opt.labelAr : opt.labelEn}
                  </span>
                  <span className="text-[11px] text-slate-400">{opt.symbol}</span>
                </div>
                <input
                  type="radio"
                  name="currency"
                  value={opt.value}
                  checked={currency === opt.value}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-4 h-4 text-amber-600 border-slate-300 focus:ring-amber-500"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Restaurant Concept & Dine-in Experience Card */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {language === 'ar' ? 'طابع المطعم والضيافة الصوتية (Restaurant Concept)' : 'Restaurant Concept & Hospitality'}
            </h2>
            <p className="text-sm text-slate-500">
              {language === 'ar' ? 'تخصيص سلوك النادل الصوتي الذكي ونوع الضيافة وخدمة الطاولات' : 'Configure smart voice waiter persona, cuisine type, and table service'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'fast_food',
                titleAr: 'وجبات سريعة وبرجر (Fast Casual & Burgers)',
                titleEn: 'Fast Casual & Burgers',
                descAr: 'اقتراح الوجبات، الكومبو، البطاطس، الصوصات الإضافية والمشروبات بسرعة فائقة وسلاسة.',
                descEn: 'Ultra-fast ordering with combos, extra sauces, fries, and beverage upsells.',
                icon: '🍔'
              },
              {
                id: 'cafe_bakery',
                titleAr: 'كافيه ومخبوزات وحلويات (Café & Specialty Coffee)',
                titleEn: 'Café & Specialty Coffee',
                descAr: 'تفاصيل درجات تحميص البن، أنواع الحليب (شوفان/لوز)، اقتراح الحلويات المرافقة للقهوة.',
                descEn: 'Roast profiles, milk options, and pairing desserts with hot & iced specialty drinks.',
                icon: '☕'
              },
              {
                id: 'oriental_grill',
                titleAr: 'مشاوي ومأكولات شرقية (Grill & Traditional Dining)',
                titleEn: 'Grill & Traditional Dining',
                descAr: 'ضيافة عربية دافئة، اقتراح المقبلات الباردة والساخنة، السلطات، وطواجن اللحوم والمشاوي.',
                descEn: 'Warm traditional hospitality, hot/cold mezze, premium meats, and family platters.',
                icon: '🥩'
              },
              {
                id: 'italian_pizza',
                titleAr: 'بيتزا وباستا إيطالية (Pizzeria & Italian Trattoria)',
                titleEn: 'Pizzeria & Italian Trattoria',
                descAr: 'شرح المكونات الطازجة، أنواع الأجبان، الإضافات المخصصة، والمقبلات الإيطالية الأصيلة.',
                descEn: 'Fresh doughs, cheese types, pasta sauces, and classic Italian appetizers.',
                icon: '🍕'
              }
            ].map((cuisine) => {
              const [selectedCuisine, setSelectedCuisine] = useState(() => localStorage.getItem('restaurant_cuisine') || 'fast_food');
              const isSelected = selectedCuisine === cuisine.id;
              return (
                <div
                  key={cuisine.id}
                  onClick={() => {
                    localStorage.setItem('restaurant_cuisine', cuisine.id);
                    setSelectedCuisine(cuisine.id);
                  }}
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-3 relative ${
                    isSelected ? 'border-emerald-600 bg-white ring-2 ring-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cuisine.icon}</span>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {language === 'ar' ? cuisine.titleAr : cuisine.titleEn}
                      </h3>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-emerald-600 text-white px-2.5 py-1 rounded-full font-bold">
                        {language === 'ar' ? 'طابع نشط' : 'Active Concept'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {language === 'ar' ? cuisine.descAr : cuisine.descEn}
                  </p>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-emerald-900">
                {language === 'ar' ? 'تكامل الطاولات والمنيو الذكي' : 'Integrated Restaurant Dine-in Architecture'}
              </h4>
              <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                {language === 'ar' 
                  ? 'تم تخصيص هذا التطبيق بالكامل كمنيو مطاعم وكافيهات صوتي. يقوم الزبون بالجلوس على الطاولة، مسح كود الـ QR، والتحدث مباشرة مع النادل الذكي لاختيار وجبته وإرسال الطلب فوراً إلى طابعة المطبخ أو نظام الكاشير (POS).'
                  : 'This application is exclusively architected for restaurant QR table ordering and digital voice menus. Guests scan the QR on their table, speak directly to the AI waiter, and submit orders straight to your kitchen/POS.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Database Integration Card */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {language === 'ar' ? 'ربط قاعدة بيانات Supabase (سوبابيز)' : 'Supabase Cloud Database Integration'}
              </h2>
              <p className="text-sm text-slate-500">
                {language === 'ar' ? 'قم بترحيل بياناتك وربط المنيو والذكاء الاصطناعي بـ Supabase مباشرة' : 'Migrate and connect your catalog data and AI logs with Supabase'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getSupabaseConfig().isConfigured ? (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {language === 'ar' ? 'نشط (سوبابيز)' : 'Supabase Active'}
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {language === 'ar' ? 'قيد العمل (الوضع المحلي)' : 'Running in Local Mode'}
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-relaxed">
              <p className="font-bold mb-1">
                {language === 'ar' ? 'ملاحظة التطوير والترحيل الثنائي:' : 'Co-existence & Migration note:'}
              </p>
              <p>
                {language === 'ar'
                  ? 'يدعم التطبيق العمل على كلا النظامين بمرونة بالغة. عند إدخال بيانات الربط أدناه، سيتحول النظام لقراءة وكتابة المنتجات ومستندات الذكاء الاصطناعي من قاعدة سوبابيز الخاصة بك تلقائياً، مع دعم الحفظ الاحتياطي التلقائي!'
                  : 'The application supports both backend engines seamlessly. When you input your Supabase connection parameters below, the system will instantly shift to read/write products, menu items, and AI indexes from your own Supabase instance with offline fallbacks.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Supabase URL */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-slate-400" />
                {language === 'ar' ? 'رابط المشروع (Supabase URL)' : 'Supabase Project URL'}
              </label>
              <input
                type="text"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm transition-all font-mono"
              />
            </div>

            {/* Supabase Anon Key */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-slate-400" />
                {language === 'ar' ? 'المفتاح العام (Supabase Anon Key)' : 'Supabase Anon Key (Public API Key)'}
              </label>
              <input
                type="password"
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm transition-all font-mono"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (!sbUrl || !sbKey) {
                  alert(language === 'ar' ? 'يرجى إدخال الرابط والمفتاح معاً.' : 'Please enter both URL and Anon Key.');
                  return;
                }
                localStorage.setItem('supabase_url', sbUrl.trim());
                localStorage.setItem('supabase_anon_key', sbKey.trim());
                resetSupabaseClient();
                setSaveSuccess(true);
                setTimeout(() => {
                  setSaveSuccess(false);
                  window.location.reload(); // Reload to re-initialize contexts
                }, 1000);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {saveSuccess 
                ? (language === 'ar' ? 'تم الحفظ وتحديث الاتصال!' : 'Saved & Connected!') 
                : (language === 'ar' ? 'حفظ إعدادات الربط والتحويل' : 'Save & Migrate Database')}
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('supabase_url');
                localStorage.removeItem('supabase_anon_key');
                resetSupabaseClient();
                setSbUrl('');
                setSbKey('');
                setResetSuccess(true);
                setTimeout(() => {
                  setResetSuccess(false);
                  window.location.reload(); // Reload to re-initialize contexts
                }, 1000);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              {resetSuccess 
                ? (language === 'ar' ? 'تمت العودة للوضع الافتراضي!' : 'Restored!') 
                : (language === 'ar' ? 'استعادة ضبط الإعدادات الافتراضية' : 'Reset to Default Settings')}
            </button>
          </div>

          {/* Database Setup Helper (SQL Migration Script Generator) */}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  {language === 'ar' ? 'بروتوكول تهيئة الجداول في سوبابيز (SQL Schema Script)' : 'Supabase SQL Setup Script'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ar' ? 'انسخ هذا الكود والصقه في محرّر SQL في Supabase لإنشاء جداول قاعدة البيانات بضغطة واحدة:' : 'Copy this code into your Supabase SQL Editor to initialize required tables:'}
                </p>
              </div>
              
              <button
                onClick={() => {
                  const sqlText = `-- 1. Create table for Knowledge Base
create table if not exists knowledge_documents (
  id text primary key,
  "merchantId" text,
  "ownerId" text,
  name text,
  type text,
  content text,
  status text,
  date text,
  "createdAt" bigint
);

-- 2. Create table for Menu Items Catalog
create table if not exists menu_items (
  id text primary key,
  "ownerId" text,
  name text,
  price numeric,
  description text,
  category text,
  "isAiOnly" boolean default false,
  "createdAt" bigint
);

-- 3. Enable realtime for both tables
alter publication supabase_realtime add table knowledge_documents;
alter publication supabase_realtime add table menu_items;`;
                  
                  navigator.clipboard.writeText(sqlText);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">{language === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>{language === 'ar' ? 'نسخ كود SQL' : 'Copy SQL Schema'}</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-300 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`-- 1. Create table for Knowledge Base
create table if not exists knowledge_documents (
  id text primary key,
  "merchantId" text,
  "ownerId" text,
  name text,
  type text,
  content text,
  status text,
  date text,
  "createdAt" bigint
);

-- 2. Create table for Menu Items Catalog
create table if not exists menu_items (
  id text primary key,
  "ownerId" text,
  name text,
  price numeric,
  description text,
  category text,
  "isAiOnly" boolean default false,
  "createdAt" bigint
);

-- 3. Enable realtime for both tables
alter publication supabase_realtime add table knowledge_documents;
alter publication supabase_realtime add table menu_items;`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

