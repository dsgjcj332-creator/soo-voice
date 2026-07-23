import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings, Dialect, VoiceTone, BusinessType } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Store, Home, Car, Boxes, Languages, Volume2, Mic, ArrowRight, ArrowLeft, 
  CheckCircle2, Copy, Sparkles, HelpCircle, Code, Loader2
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getSupabase, getSupabaseConfig } from '../../lib/supabase';
import { VoiceWidget } from '../widget/VoiceWidget';

interface SeedItem {
  nameAr: string;
  nameEn: string;
  price: number;
  categoryAr: string;
  categoryEn: string;
  descAr: string;
  descEn: string;
  isAiOnly: boolean;
}

const seedTemplates: Record<BusinessType, SeedItem[]> = {
  restaurant: [
    {
      nameAr: "برجر دبل لحم بالجبن السويسري",
      nameEn: "Double Beef Swiss Burger",
      price: 45,
      categoryAr: "برجر / Burgers",
      categoryEn: "Burgers",
      descAr: "شريحتين من لحم البقر المشوي الفاخر مع الجبن السويسري الذائب والصلصة الخاصة",
      descEn: "Two premium grilled beef patties with melted Swiss cheese and special chef sauce",
      isAiOnly: false
    },
    {
      nameAr: "وجبة دجاج مقرمش عائلية",
      nameEn: "Crispy Chicken Family Meal",
      price: 85,
      categoryAr: "وجبات / Meals",
      categoryEn: "Meals",
      descAr: "8 قطع من الدجاج المقرمش الذهبي تقدم مع البطاطس المقلية العائلية والخبز والثومية والبيبسي",
      descEn: "8 pieces of golden crispy chicken served with family fries, garlic sauce and soft drink",
      isAiOnly: false
    },
    {
      nameAr: "بيتزا مارغريتا إيطالية كلاسيكية",
      nameEn: "Classic Italian Margherita Pizza",
      price: 50,
      categoryAr: "بيتزا / Pizza",
      categoryEn: "Pizza",
      descAr: "عجينة إيطالية رقيقة ومقرمشة مع صلصة الطماطم الغنية بالريحان وجبنة الموزاريلا الفاخرة",
      descEn: "Thin Italian crust topped with rich tomato basil sauce and premium melted mozzarella cheese",
      isAiOnly: false
    },
    {
      nameAr: "برجر الشيف السري الحصري",
      nameEn: "Secret Chef's Burger (Exclusive)",
      price: 65,
      categoryAr: "برجر / Burgers",
      categoryEn: "Burgers",
      descAr: "عرض حصري وخاص بالمساعد الصوتي فقط! برجر فاخر مغطى بجبنة الشيدر السائلة ورقائق لحم بقري مقرمشة ومغطى بحلقات البصل",
      descEn: "Voice assistant exclusive! Premium beef burger smothered in liquid cheddar, crispy beef bacon, and onion rings",
      isAiOnly: true
    }
  ],
  real_estate: [
    {
      nameAr: "شقة سكنية عصرية مفروشة بالكامل",
      nameEn: "Modern Fully Furnished Apartment",
      price: 1500,
      categoryAr: "شقق / Apartments",
      categoryEn: "Apartments",
      descAr: "شقة سكنية حديثة مفروشة بالكامل مكونة من غرفتين وصالة واسعة وإطلالة مميزة في وسط المدينة",
      descEn: "Modern 2-bedroom fully furnished apartment with a spacious living room and views in city center",
      isAiOnly: false
    },
    {
      nameAr: "فيلا عائلية راقية بمسبح خاص",
      nameEn: "Luxurious Family Villa with Pool",
      price: 4500,
      categoryAr: "فلل / Villas",
      categoryEn: "Villas",
      descAr: "فيلا مستقلة راقية تحتوي على 4 غرف نوم، صالة ضيوف فخمة، مسبح خاص، وحديقة أمامية وخلفية واسعة",
      descEn: "Premium detached villa featuring 4 bedrooms, luxury reception hall, private pool, and large gardens",
      isAiOnly: false
    },
    {
      nameAr: "مكتب مجهز للشركات والمشاريع",
      nameEn: "Fully Equipped Corporate Office",
      price: 2800,
      categoryAr: "مكاتب وتجاري / Commercial",
      categoryEn: "Commercial",
      descAr: "مكتب مجهز بالكامل للعمل الفوري في برج تجاري مرموق مع إطلالة بانورامية ومواقف سيارات خاصة وسكرتارية مشتركة",
      descEn: "Turnkey corporate office in a prestigious commercial tower with panoramic views and private parking",
      isAiOnly: false
    },
    {
      nameAr: "فيلا VIP ملكية على شاطئ البحر",
      nameEn: "Royal VIP Seafront Villa",
      price: 9500,
      categoryAr: "فلل / Villas",
      categoryEn: "Villas",
      descAr: "عرض مخفي وحصري متوفر عبر المساعد الصوتي فقط! فيلا مستقلة على البحر مباشرة مع مرسى يخوت خاص وتشطيبات ملكية فاخرة جداً",
      descEn: "Voice exclusive listing! Majestic seafront detached villa with private yacht dock and bespoke royal finishes",
      isAiOnly: true
    }
  ],
  automotive: [
    {
      nameAr: "سيارة سيدان اقتصادية وعائلية حديثة",
      nameEn: "Modern Eco Family Sedan",
      price: 85000,
      categoryAr: "سيارات / Cars",
      categoryEn: "Cars",
      descAr: "سيارة سيدان مريحة موديل السنة، اقتصادية جداً في استهلاك الوقود ومزودة بأحدث أنظمة الأمان والترفيه والتحكم بالمسار",
      descEn: "Modern fuel-efficient family sedan, equipped with lane-keep assist and advanced smart safety systems",
      isAiOnly: false
    },
    {
      nameAr: "سيارة دفع رباعي رياضية وقوية",
      nameEn: "Sports Family SUV (4WD)",
      price: 135000,
      categoryAr: "سيارات / Cars",
      categoryEn: "Cars",
      descAr: "سيارة عائلية رياضية ذات دفع رباعي ومحرك قوي لجميع التضاريس مع سقف بانورامي ومقاعد جلدية فاخرة وأنظمة ذكية للقيادة الوعرة",
      descEn: "Family sports SUV with robust 4WD, powerful all-terrain engine, panoramic sunroof and premium leather seats",
      isAiOnly: false
    },
    {
      nameAr: "باقة الصيانة الشاملة للمحرك والأنظمة",
      nameEn: "Comprehensive Engine Maintenance Package",
      price: 450,
      categoryAr: "خدمات / Services",
      categoryEn: "Services",
      descAr: "باقة فحص وصيانة شاملة للمحرك تشمل تغيير الزيت والفلاتر والتحقق من الكمبيوتر وحالة المكابح والأنظمة الإلكترونية",
      descEn: "Complete engine tune-up package: includes full synthetic oil, filter change, computer diagnostic, and brakes inspection",
      isAiOnly: false
    },
    {
      nameAr: "سيارة رياضية خارقة مستوردة (طلب حصري)",
      nameEn: "Imported V8 Sports Supercar",
      price: 420000,
      categoryAr: "سيارات / Cars",
      categoryEn: "Cars",
      descAr: "إصدار رياضي محدود متوفر فقط للطلب والاستفسار الصوتي الحصري عبر المساعد! محرك V8 ثنائي التيربو بقوة حصانية فائقة",
      descEn: "Limited custom supercar! Twin-turbocharged V8 engine with breathtaking acceleration available only via voice queries",
      isAiOnly: true
    }
  ],
  general: [
    {
      nameAr: "سماعة رأس لاسلكية ذكية مع إلغاء الضوضاء",
      nameEn: "Smart ANC Wireless Headset",
      price: 120,
      categoryAr: "إلكترونيات / Electronics",
      categoryEn: "Electronics",
      descAr: "سماعة رأس لاسلكية مريحة مع ميزة إلغاء الضوضاء النشط الفائق وعمر بطارية طويل جداً يصل لـ 40 ساعة من الاستخدام المتواصل",
      descEn: "Over-ear wireless headphones with active noise cancellation and up to 40 hours of continuous premium audio playback",
      isAiOnly: false
    },
    {
      nameAr: "محفظة رجالية من الجلد الطبيعي الفاخر",
      nameEn: "Premium Handcrafted Leather Wallet",
      price: 45,
      categoryAr: "إكسسوارات / Accessories",
      categoryEn: "Accessories",
      descAr: "محفظة رجالية مصنوعة من الجلد الطبيعي المتين بتصميم كلاسيكي نحيف ومساحة تتسع لجميع البطاقات الشخصية والعملات الورقية",
      descEn: "Slim handcrafted genuine leather wallet featuring dual bill compartments and 8 RFID-protected card slots",
      isAiOnly: false
    },
    {
      nameAr: "شاحن جداري ذكي سريع بقوة 35 واط",
      nameEn: "Dual Port Smart Fast Charger 35W",
      price: 25,
      categoryAr: "إكسسوارات / Accessories",
      categoryEn: "Accessories",
      descAr: "شاحن جداري سريع بقدرة 35 واط متوافق مع كافة الهواتف والأجهزة الذكية مع حماية ذكية من التماس والجهد الزائد",
      descEn: "Compact 35W fast wall charger featuring dual USB-C ports and advanced heat/surge protection logic",
      isAiOnly: false
    },
    {
      nameAr: "ساعة ذكية مطلية بالذهب (إصدار خاص)",
      nameEn: "Limited 24K Gold Smartwatch",
      price: 350,
      categoryAr: "إلكترونيات / Electronics",
      categoryEn: "Electronics",
      descAr: "عرض حصري وخاص بالمساعد الذكي فقط! ساعة يد ذكية مطلية بماء الذهب عيار 24 مع مستشعر متقدم لقياس الصحة والتمارين والنبض",
      descEn: "Exclusive voice-only premium offer! 24K gold plated luxury smartwatch featuring advanced health and sleep tracking sensors",
      isAiOnly: true
    }
  ]
};

export function OnboardingWizard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { 
    dialect, setDialect, 
    voiceTone, setVoiceTone, 
    businessType, setBusinessType,
    setHasCompletedOnboarding 
  } = useSettings();

  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [testActive, setTestActive] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Business Types definitions
  const businessTypesList = [
    {
      id: 'restaurant' as BusinessType,
      titleAr: 'مطعم ومقهى',
      titleEn: 'Restaurant & Café',
      descAr: 'للطلب الإلكتروني، حجز الطاولات، واستعراض الوجبات والأطباق اليومية.',
      descEn: 'For online food ordering, table bookings, and daily dish details.',
      icon: Store,
      color: 'from-orange-500 to-amber-500',
      bgLight: 'bg-orange-50/50'
    },
    {
      id: 'real_estate' as BusinessType,
      titleAr: 'عقارات وشقق',
      titleEn: 'Real Estate & Properties',
      descAr: 'لمعاينة الفلل، الشقق، حجز المواعيد واستعراض تفاصيل الاستثمار العقاري.',
      descEn: 'For viewing villas, apartments, booking viewings, and property specs.',
      icon: Home,
      color: 'from-blue-500 to-indigo-500',
      bgLight: 'bg-blue-50/50'
    },
    {
      id: 'automotive' as BusinessType,
      titleAr: 'سيارات وصيانة',
      titleEn: 'Automotive & Parts',
      descAr: 'لطلب قطع الغيار، حجز مواعيد الصيانة، واستعراض السيارات المعروضة للبيع.',
      descEn: 'For ordering parts, booking maintenance slots, and car inventory.',
      icon: Car,
      color: 'from-red-500 to-rose-500',
      bgLight: 'bg-red-50/50'
    },
    {
      id: 'general' as BusinessType,
      titleAr: 'متجر وتجارة عامة',
      titleEn: 'General Retail & Services',
      descAr: 'لخدمة عملاء المتاجر الإلكترونية، تتبع الشحنات، والرد على الاستفسارات المتنوعة.',
      descEn: 'For general e-commerce customer support, shipping, and service queries.',
      icon: Boxes,
      color: 'from-emerald-500 to-teal-500',
      bgLight: 'bg-emerald-50/50'
    }
  ];

  // Dialects definitions
  const dialectsList = [
    { id: 'standard' as Dialect, nameAr: 'الفصحى المبسطة', nameEn: 'Standard Arabic', sampleAr: 'أهلاً بك، كيف يمكنني مساعدتك اليوم؟', sampleEn: 'Welcome, how can I help you today?' },
    { id: 'egyptian' as Dialect, nameAr: 'اللهجة المصرية', nameEn: 'Egyptian Dialect', sampleAr: 'أهلاً بيك يا فندم، إزاي أقدر أساعدك النهاردة؟', sampleEn: 'Hello, how can I assist you today?' },
    { id: 'gulf' as Dialect, nameAr: 'اللهجة الخليجية', nameEn: 'Gulf Dialect', sampleAr: 'يا هلا ومسهلا بك، طال عمرك وشلون أقدر أخدمك اليوم؟', sampleEn: 'Welcome, how can I be of service to you today?' },
    { id: 'levantine' as Dialect, nameAr: 'اللهجة الشامية', nameEn: 'Levantine Dialect', sampleAr: 'يا مية أهلاً وسهلاً، كيف فيني أساعدك اليوم يا غالي؟', sampleEn: 'A warm welcome, how can I help you today?' }
  ];

  // Voice Tones definitions
  const voicesList = [
    { id: 'Zephyr' as VoiceTone, genderAr: 'رجالي - هادئ ومريح', genderEn: 'Male - Calm & Warm' },
    { id: 'Charon' as VoiceTone, genderAr: 'رجالي - فخم وعميق', genderEn: 'Male - Professional & Deep' },
    { id: 'Fenrir' as VoiceTone, genderAr: 'رجالي - قوي وواضح', genderEn: 'Male - Confident & Clear' },
    { id: 'Kore' as VoiceTone, genderAr: 'نسائي - لطيف ومحبب', genderEn: 'Female - Friendly & Kind' },
    { id: 'Puck' as VoiceTone, genderAr: 'نسائي - سريع ونشيط', genderEn: 'Female - Vibrant & Quick' },
    { id: 'Aoede' as VoiceTone, genderAr: 'نسائي - احترافي وودود', genderEn: 'Female - Professional & Warm' }
  ];

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const seedDatabaseCatalog = async (merchantId: string, sector: BusinessType) => {
    const templates = seedTemplates[sector] || [];
    const itemsToInsert = templates.map((tmpl, index) => {
      const itemId = `seed_${sector}_${index}_${Math.floor(Math.random() * 100000)}`;
      return {
        id: itemId,
        ownerId: merchantId,
        name: language === 'ar' ? tmpl.nameAr : tmpl.nameEn,
        price: tmpl.price,
        category: language === 'ar' ? tmpl.categoryAr : tmpl.categoryEn,
        description: language === 'ar' ? tmpl.descAr : tmpl.descEn,
        isAiOnly: tmpl.isAiOnly,
        createdAt: Date.now() - (index * 1000)
      };
    });

    const { isConfigured, source } = getSupabaseConfig();
    const supabase = getSupabase();

    if (isConfigured && supabase) {
      try {
        console.log("[Seeder] Inserting seeded products to Supabase...");
        const { error } = await supabase.from('menu_items').insert(itemsToInsert);
        if (error) throw error;
      } catch (err) {
        console.error("Supabase seed error:", err);
      }
    } else {
      try {
        console.log("[Seeder] Inserting seeded products to Firebase Firestore...");
        for (const item of itemsToInsert) {
          await setDoc(doc(db, "menu_items", item.id), item);
        }
      } catch (err) {
        console.error("Firestore seed error:", err);
      }
    }
  };

  const handleFinish = async () => {
    if (!user) {
      setHasCompletedOnboarding(true);
      return;
    }

    try {
      setSeeding(true);
      // Wait slightly for settings to sink
      await new Promise(resolve => setTimeout(resolve, 500));
      // Seed appropriate list of catalog items directly based on selected activity
      await seedDatabaseCatalog(user.uid, businessType);
      // Complete onboarding state
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error during onboarding completion & seeding:", error);
      setHasCompletedOnboarding(true); // fall-through anyway to keep user flow healthy
    } finally {
      setSeeding(false);
    }
  };

  const origin = window.location.origin;
  const merchantOwnerId = user?.uid || 'demo_user_onboarding';

  const embedCode = `<!-- VoiceAI Widget Embed Snippet -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = "${origin}/widget-standalone?ownerId=${merchantOwnerId}";
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '80px';
    iframe.style.height = '80px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.background = 'transparent';
    iframe.style.transition = 'all 0.3s ease-in-out';
    iframe.id = 'voice-ai-widget-iframe';
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('allow', 'microphone');
    document.body.appendChild(iframe);

    window.addEventListener('message', function(event) {
      if (event.data === 'open_voice_widget') {
        iframe.style.width = '350px';
        iframe.style.height = '620px';
      } else if (event.data === 'close_voice_widget') {
        iframe.style.width = '80px';
        iframe.style.height = '80px';
      }
    });
  })();
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[10000] flex items-center justify-center p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Side: Dynamic Progress Banner */}
        <div className="bg-gradient-to-b from-indigo-700 to-indigo-900 text-white p-8 md:w-80 flex flex-col justify-between relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="p-2 bg-white/10 rounded-xl">
                <Mic className="w-6 h-6 text-indigo-200 animate-pulse" />
              </div>
              <span className="font-bold text-lg tracking-tight">VoiceAI</span>
            </div>

            <h3 className="text-xl font-bold mb-4 leading-snug">
              {language === 'ar' 
                ? 'تهيئة المساعد الصوتي لمتجرك في 4 خطوات' 
                : 'Set up your Voice AI Agent in 4 steps'}
            </h3>
            <p className="text-xs text-indigo-200 leading-relaxed">
              {language === 'ar'
                ? 'سنقوم ببناء سيناريو ذكاء اصطناعي مخصص يناسب قطاع عملك ولهجتك الفريدة فوراً.'
                : 'We will design a custom AI conversation schema customized to your business and language dialect.'}
            </p>
          </div>

          {/* Stepper indicators */}
          <div className="mt-8 space-y-4 relative z-10">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                  step === s 
                    ? 'bg-white text-indigo-900 border-white shadow-md shadow-white/10' 
                    : step > s 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-white/20 text-indigo-300'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <div className="text-xs font-medium">
                  {s === 1 && (language === 'ar' ? 'نوع النشاط' : 'Business Sector')}
                  {s === 2 && (language === 'ar' ? 'لهجة المساعد' : 'Voice Dialect')}
                  {s === 3 && (language === 'ar' ? 'نبرة الصوت' : 'Voice Tone')}
                  {s === 4 && (language === 'ar' ? 'كود التضمين والإنهاء' : 'Embed Code & Finish')}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-indigo-400 font-mono mt-8">
            VoiceAI SaaS Engine v2.4
          </div>
        </div>

        {/* Right Side: Step Content Area */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-between overflow-y-auto bg-slate-50/50">
          
          <div className="mb-6">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full">
              {language === 'ar' ? `الخطوة ${step} من 4` : `Step ${step} of 4`}
            </span>

            {step === 1 && (
              <div className="mt-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {language === 'ar' ? 'ما هو مجال عملك أو نشاطك التجاري؟' : 'What is your business sector?'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar' 
                    ? 'سنقوم بتدريب الذكاء الاصطناعي وتجهيز قائمة منتجات مطابقة فوراً عند دخولك.'
                    : 'We will initialize pre-configured menu schemas and standard responses for your sector.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {businessTypesList.map((item) => {
                    const Icon = item.icon;
                    const isSelected = businessType === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setBusinessType(item.id)}
                        className={`border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md flex flex-col gap-3 relative overflow-hidden group ${
                          isSelected 
                            ? 'border-indigo-500 bg-white shadow-sm ring-1 ring-indigo-500' 
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 text-indigo-600 bg-indigo-50 p-0.5 rounded-full">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-sm`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {language === 'ar' ? item.titleAr : item.titleEn}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {language === 'ar' ? item.descAr : item.descEn}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mt-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {language === 'ar' ? 'اختر اللهجة المفضلة للمساعد الصوتي' : 'Select voice assistant dialect'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar'
                    ? 'يتحدث المساعد بلهجات عربية محلية للتفاعل بذكاء وقرب من عملائك.'
                    : 'Select localized Arabic dialects to fit your customer audience perfectly.'}
                </p>

                <div className="space-y-3 mt-6">
                  {dialectsList.map((item) => {
                    const isSelected = dialect === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setDialect(item.id)}
                        className={`border rounded-2xl p-4 cursor-pointer transition-all hover:bg-slate-50 flex items-center justify-between bg-white ${
                          isSelected 
                            ? 'border-indigo-500 ring-1 ring-indigo-500' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            <Languages className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">
                              {language === 'ar' ? item.nameAr : item.nameEn}
                            </h4>
                            <p className="text-xs text-slate-400 font-serif italic mt-0.5">
                              "{language === 'ar' ? item.sampleAr : item.sampleEn}"
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <input 
                            type="radio" 
                            name="dialect" 
                            checked={isSelected}
                            onChange={() => setDialect(item.id)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {language === 'ar' ? 'اختر نبرة الصوت الملاءمة' : 'Select your favorite voice tone'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar'
                    ? 'يمكنك تغيير الصوت في أي وقت لاحقاً من الإعدادات.'
                    : 'Choose a premium vocal style for the AI text-to-speech voice.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                  {voicesList.map((item) => {
                    const isSelected = voiceTone === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setVoiceTone(item.id)}
                        className={`border rounded-2xl p-4 cursor-pointer transition-all hover:bg-slate-50 flex items-center justify-between bg-white ${
                          isSelected 
                            ? 'border-indigo-500 ring-1 ring-indigo-500' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                            <Volume2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">
                              {item.id}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {language === 'ar' ? item.genderAr : item.genderEn}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <input 
                            type="radio" 
                            name="voiceTone" 
                            checked={isSelected}
                            onChange={() => setVoiceTone(item.id)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="mt-4 max-h-[50vh] overflow-y-auto pr-2">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  {language === 'ar' ? 'مساعدك الصوتي جاهز للانطلاق!' : 'Your Voice AI Agent is Ready!'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar'
                    ? 'كيف يعمل نظام التكامل والودجت؟'
                    : 'How does the SaaS widget integration work?'}
                </p>

                {/* Conceptual SaaS integration explanation */}
                <div className="mt-4 bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-950 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-indigo-900">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    {language === 'ar' ? 'فكرة الـ SaaS والودجت العائم:' : 'The concept of SaaS widgets:'}
                  </div>
                  <p>
                    {language === 'ar'
                      ? 'جميع إعدادات المساعد الصوتي والذكاء الاصطناعي وقائمة منتجاتك مرفوعة بشكل آمن على السيرفر المركزي هنا. عندما تضيف هذا الودجت العائم إلى أي موقع خارجي آخر (مثل ووردبريس أو سلة أو شوبيفاي)، سيقوم الكود باستدعاء لوحة التحكم لدينا ديناميكياً لخدمة زوار موقعك والرد بالصوت واللهجة والمنتجات التي اخترتها فوراً دون الحاجة لبرمجة أي خادم آخر!'
                      : 'All your AI agent settings, documents, and product catalogs are securely hosted centrally on our server dashboard. When you paste the widget script onto any third-party external website, the script dynamically pulls these configurations from our central portal to instantly run the floating voice widget for your site visitors!'}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-slate-500" />
                      {language === 'ar' ? 'كود التضمين الفوري (Copy-Paste Snippet)' : 'Immediate Embed Script'}
                    </label>
                    <button 
                      onClick={handleCopy}
                      className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ الكود' : 'Copy Code')}
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-[10px] font-mono overflow-x-auto border border-slate-800 shadow-inner max-h-32">
                    <code>{embedCode}</code>
                  </pre>
                </div>

                {/* Interactive preview toggle */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        {language === 'ar' ? 'تجربة سريعة للمساعد قبل الحفظ؟' : 'Test your AI agent live now?'}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {language === 'ar' ? 'افتح الودجت وتحدث معه للتأكد من اللهجة والصوت.' : 'Open the floating widget here to test voice response.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setTestActive(!testActive)}
                      className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors cursor-pointer ${
                        testActive 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {testActive ? (language === 'ar' ? 'إخفاء الودجت' : 'Hide Widget') : (language === 'ar' ? 'عرض وتجربة الودجت' : 'Test Voice Widget')}
                    </button>
                  </div>

                  {testActive && (
                    <div className="mt-4 p-4 border border-indigo-100 bg-indigo-50/30 rounded-2xl text-center flex flex-col items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                      <span className="text-xs font-semibold text-indigo-900">
                        {language === 'ar' ? 'تفاعل عائم نشط! اضغط على أيقونة الميكروفون بالأسفل لبدء الحديث.' : 'Active preview float! Click the microphone button below to start.'}
                      </span>
                      {/* Standalone VoiceWidget instance with onboarding configuration */}
                      <div className="fixed bottom-6 right-6 z-[20000]">
                        <VoiceWidget />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wizard Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-4">
            <button
              onClick={handlePrev}
              disabled={step === 1 || seeding}
              className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border transition-all ${
                step === 1 || seeding
                  ? 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'ar' ? 'السابق' : 'Previous'}
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 cursor-pointer"
              >
                {language === 'ar' ? 'التالي' : 'Next'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={seeding}
                className={`flex items-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-200 cursor-pointer ${
                  seeding ? 'opacity-80 cursor-not-allowed' : ''
                }`}
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {language === 'ar' ? 'جاري تجهيز منتجاتك...' : 'Seeding catalog...'}
                  </>
                ) : (
                  <>
                    {language === 'ar' ? 'حفظ والذهاب للوحة التحكم' : 'Save & Go to Dashboard'}
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
