import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings, Dialect, VoiceTone, BusinessType } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Store, Home, Car, Boxes, Languages, Volume2, Mic, ArrowRight, ArrowLeft, 
  CheckCircle2, Copy, Sparkles, HelpCircle, Code, Loader2
} from 'lucide-react';
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
      nameAr: "برجر دبل بيف تشيز فاخر",
      nameEn: "Double Beef Cheese Burger",
      price: 38,
      categoryAr: "برجر ووجبات / Burgers",
      categoryEn: "Burgers",
      descAr: "شريحتين لحم بقري أنجوس مشوي على اللهب مع جبن شيدر ذائب وصوص سموكي خاص في خبز بريوش طازج",
      descEn: "Two flame-grilled Angus beef patties with melted cheddar cheese and smoky chef sauce in a brioche bun",
      isAiOnly: false
    },
    {
      nameAr: "وجبة كرسبي تشيكن ستريبس مقرمش",
      nameEn: "Crispy Chicken Tenders Meal",
      price: 34,
      categoryAr: "وجبات / Meals",
      categoryEn: "Meals",
      descAr: "أصابع دجاج مقرمشة بتتبيلة خاصة تقدم مع بطاطس مقلية ذهبية وخبز وصوص باربكيو وثومية",
      descEn: "Crispy seasoned chicken tenders served with golden french fries, garlic dip, and BBQ sauce",
      isAiOnly: false
    },
    {
      nameAr: "بيتزا تروفل وموزاريلا إيطالية",
      nameEn: "Italian Truffle Mozzarella Pizza",
      price: 48,
      categoryAr: "بيتزا / Pizza",
      categoryEn: "Pizza",
      descAr: "عجينة نابولية مخمرة بحرارة الحطب مع صلصة التروفل البيضاء وجبنة موزاريلا طازجة وفطر بري",
      descEn: "Wood-fired Neapolitan crust with rich white truffle crema, fresh mozzarella, and wild mushrooms",
      isAiOnly: false
    },
    {
      nameAr: "سبانش لاتيه بارد ومثلج",
      nameEn: "Iced Spanish Latte",
      price: 18,
      categoryAr: "مشروبات وقهوة / Coffee",
      categoryEn: "Coffee & Drinks",
      descAr: "إسبريسو غني مستخلص من حبوب بن مختصة مع الحليب المكثف المحلى ومكعبات الثلج المنعشة",
      descEn: "Rich specialty espresso pulled over sweetened condensed milk and crisp crushed ice",
      isAiOnly: false
    },
    {
      nameAr: "كيكة تشيز كيك بالسان سباستيان",
      nameEn: "San Sebastian Basque Cheesecake",
      price: 24,
      categoryAr: "حلويات / Desserts",
      categoryEn: "Desserts",
      descAr: "تشيز كيك كريمي محروق من الأطراف يذوب في الفم مع صوص الشوكولاتة البلجيكية الدافئة",
      descEn: "Creamy crustless caramelized cheesecake served with warm Belgian chocolate ganache",
      isAiOnly: false
    },
    {
      nameAr: "وجبة الشيف السرية الحصرية (أوف منيو)",
      nameEn: "Chef's Secret Off-Menu Special",
      price: 55,
      categoryAr: "أطباق سرية / Secret Menu",
      categoryEn: "Secret Menu",
      descAr: "طلب حصري لا يظهر بالمنيو البصري بل يعرفه المساعد الصوتي فقط! برجر واغيو مدخن بخلطة الشيف السرية ورقائق البطاطا المقرمشة",
      descEn: "Exclusive off-menu item known only to your Voice AI Waiter! Smoked Wagyu burger with secret glaze and truffle fries",
      isAiOnly: true
    }
  ],
  real_estate: [],
  automotive: [],
  general: []
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
  const [selectedConcept, setSelectedConcept] = useState(() => localStorage.getItem('restaurant_concept') || 'burgers_fast_casual');

  // Restaurant Concepts definitions
  const businessTypesList = [
    {
      id: 'restaurant' as BusinessType,
      conceptId: 'burgers_fast_casual',
      titleAr: 'وجبات سريعة وبرجر',
      titleEn: 'Fast Casual & Burgers',
      descAr: 'للطلب السريع، الكومبو، البطاطس المقلية، الصوصات الإضافية، وإرسال الطلب للمطبخ فوراً.',
      descEn: 'For fast ordering, combo meals, french fries, dips, and instant kitchen ticket dispatch.',
      icon: Store,
      color: 'from-orange-500 to-amber-500',
      bgLight: 'bg-orange-50/50'
    },
    {
      id: 'restaurant' as BusinessType,
      conceptId: 'specialty_coffee_desserts',
      titleAr: 'كافيه ومشروبات ومخبوزات',
      titleEn: 'Specialty Café & Bakery',
      descAr: 'لمشروبات القهوة الساخنة والباردة، أنواع الحليب، المخبوزات الطازجة والحلويات الفاخرة.',
      descEn: 'For hot & iced specialty coffee, artisan pastries, desserts, and custom milk choices.',
      icon: Store,
      color: 'from-amber-600 to-yellow-500',
      bgLight: 'bg-amber-50/50'
    },
    {
      id: 'restaurant' as BusinessType,
      conceptId: 'oriental_grills',
      titleAr: 'مشاوي ومأكولات شرقية',
      titleEn: 'Oriental Grill & Dining',
      descAr: 'للمقبلات الباردة والساخنة، المشاوي العائلية، الطواجن، والمشروبات التقليدية المنعشة.',
      descEn: 'For cold & hot mezze, mixed grill platters, casseroles, and authentic dining.',
      icon: Store,
      color: 'from-rose-500 to-red-600',
      bgLight: 'bg-rose-50/50'
    },
    {
      id: 'restaurant' as BusinessType,
      conceptId: 'italian_pizzeria',
      titleAr: 'بيتزا وباستا إيطالية',
      titleEn: 'Pizza & Italian Cuisine',
      descAr: 'للبيتزا النابولية، الباستا، أطباق الريزوتو، والمقبلات والأجبان الإيطالية الأصيلة.',
      descEn: 'For artisan wood-fired pizza, handmade pasta, risotto, and authentic appetizers.',
      icon: Store,
      color: 'from-emerald-500 to-teal-600',
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
                  {language === 'ar' ? 'ما هو طابع وقائمة مطعمك أو مقهاك؟' : 'What is your restaurant or café concept?'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar' 
                    ? 'سنقوم بتدريب النادل الصوتي الذكي وتجهيز قائمة طعام افتراضية مطابقة فوراً لدخولك.'
                    : 'We will configure your AI Voice Waiter and initialize ready-to-order menu items for your restaurant.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {businessTypesList.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedConcept === item.conceptId;
                    return (
                      <div
                        key={item.conceptId}
                        onClick={() => {
                          setBusinessType('restaurant');
                          localStorage.setItem('restaurant_concept', item.conceptId);
                          setSelectedConcept(item.conceptId);
                        }}
                        className={`border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md flex flex-col gap-3 relative overflow-hidden group ${
                          isSelected 
                            ? 'border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500' 
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 text-emerald-600 bg-emerald-50 p-0.5 rounded-full">
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
