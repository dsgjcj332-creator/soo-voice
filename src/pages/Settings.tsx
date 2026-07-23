import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings, Dialect, VoiceTone, BusinessType } from '../contexts/SettingsContext';
import { Mic, Globe, Settings2, Sparkles, Star, Home, Car, Utensils, Briefcase, Building, Database, Check, Copy, RotateCcw, Key, AlertCircle } from 'lucide-react';
import { subscribeToGlobalVoices, GlobalVoice } from '../services/globalVoices';
import { getSupabaseConfig, resetSupabaseClient } from '../lib/supabase';


export function Settings() {
  const { language } = useLanguage();
  const { dialect, setDialect, voiceTone, setVoiceTone, businessType, setBusinessType } = useSettings();
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto font-sans">
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

      {/* Business Sector / Vertical Selector Card */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {language === 'ar' ? 'نوع النشاط التجاري (Business Sector)' : 'Business Sector & Vertical'}
            </h2>
            <p className="text-sm text-slate-500">
              {language === 'ar' ? 'تخصيص كامل للنظام والذكاء الاصطناعي ليناسب قطاع عملك' : 'Customize the system & AI catalog to match your business model'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                value: 'restaurant',
                icon: <Utensils className="w-5 h-5 text-emerald-600" />,
                titleAr: 'المطاعم والكافيهات',
                titleEn: 'Restaurants & Cafes',
                descAr: 'رقمنة الوجبات والمشروبات وسلة التسوق مع مساعدة الذكاء الاصطناعي لاقتراح الأطباق وتلقي الطلبات.',
                descEn: 'Digitalize meals, drinks & cart checkout with AI food recommendations and seamless ordering.',
                bgColor: 'bg-emerald-50/60',
                borderColor: 'border-emerald-100',
                activeColor: 'border-emerald-600 ring-2 ring-emerald-100'
              },
              {
                value: 'real_estate',
                icon: <Home className="w-5 h-5 text-blue-600" />,
                titleAr: 'العقارات والخدمات العقارية',
                titleEn: 'Real Estate & Properties',
                descAr: 'عرض الشقق، الفيلات، الأراضي والمكاتب. يتيح للعملاء حجز مواعيد معاينة والاستفسار عن الأسعار والمساحات مع السمسار الذكي.',
                descEn: 'List apartments, villas, lands & offices. Allows clients to book viewings and query sizes/budgets with our AI broker.',
                bgColor: 'bg-blue-50/60',
                borderColor: 'border-blue-100',
                activeColor: 'border-blue-600 ring-2 ring-blue-100'
              },
              {
                value: 'automotive',
                icon: <Car className="w-5 h-5 text-amber-600" />,
                titleAr: 'السيارات وقطع الغيار والصيانة',
                titleEn: 'Automotive & Spare Parts',
                descAr: 'عرض ومقارنة السيارات، قطع الغيار، والإكسسوارات. مساعدة العملاء في البحث الذكي وجدولة تجربة قيادة أو حجز صيانة.',
                descEn: 'List cars, parts & accessories. Helps clients with parts search, quote queries, and scheduling a test drive.',
                bgColor: 'bg-amber-50/60',
                borderColor: 'border-amber-100',
                activeColor: 'border-amber-600 ring-2 ring-amber-100'
              },
              {
                value: 'general',
                icon: <Briefcase className="w-5 h-5 text-purple-600" />,
                titleAr: 'التجارة والخدمات العامة',
                titleEn: 'General Retail & Services',
                descAr: 'مبيعات المنتجات المتنوعة، الخدمات المنزلية، الإلكترونيات والملابس. سلة تسوق مرنة ومستشار مبيعات صوتي متكامل.',
                descEn: 'Sell retail products, household services, electronics or fashion. Features dynamic checkout and shopping AI.',
                bgColor: 'bg-purple-50/60',
                borderColor: 'border-purple-100',
                activeColor: 'border-purple-600 ring-2 ring-purple-100'
              }
            ].map((sect) => {
              const isSelected = businessType === sect.value;
              return (
                <div
                  key={sect.value}
                  onClick={() => setBusinessType(sect.value as BusinessType)}
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-3 relative ${
                    isSelected ? sect.activeColor + ' bg-white' : sect.bgColor + ' ' + sect.borderColor + ' opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                        {sect.icon}
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {language === 'ar' ? sect.titleAr : sect.titleEn}
                      </h3>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-full font-bold">
                        {language === 'ar' ? 'نشط الآن' : 'Active'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {language === 'ar' ? sect.descAr : sect.descEn}
                  </p>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-indigo-900">
                {language === 'ar' ? 'سحر الرقمنة التلقائية' : 'Automated Sector Synchronization'}
              </h4>
              <p className="text-[11px] text-indigo-700 mt-1 leading-relaxed">
                {language === 'ar' 
                  ? 'بمجرد تبديل النشاط، سيتغير شكل لوحة المنتجات، المنيو الرقمي للزوار، وصانع الباركود، والوكيل الصوتي ليفهم المصطلحات الفنية ويقترح المنتجات المناسبة لنفس النشاط تلقائياً!'
                  : 'Once you switch the sector, the product manager, customer digital catalog, QR stand, and Voice Agent will instantly synchronize to understand industry jargon, specific listings, and custom actions automatically!'}
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
                {language === 'ar' ? 'قيد العمل (فايربيز الافتراضي)' : 'Running on Firebase'}
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
                : (language === 'ar' ? 'استعادة ضبط Firebase الافتراضي' : 'Reset to Default Firebase')}
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

