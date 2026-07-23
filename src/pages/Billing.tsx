import React, { useState } from "react";
import { 
  CreditCard, 
  Code, 
  Check, 
  HelpCircle, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  Copy, 
  CheckCircle,
  TrendingUp,
  DollarSign,
  Users
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export function Billing() {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribedPlan, setSubscribedPlan] = useState("free");

  // ROI Calculator states
  const [monthlyVisitors, setMonthlyVisitors] = useState(10000);
  const [averageOrderValue, setAverageOrderValue] = useState(50);
  const [integrationTab, setIntegrationTab] = useState("shopify");

  // Calculate simulated ROI
  const adoptionRate = 0.08; // 8% of visitors use the AI Voice assistant
  const conversionRateOfAI = 0.15; // 15% of assistant users convert to buyers
  const extraOrders = Math.round(monthlyVisitors * adoptionRate * conversionRateOfAI);
  const extraRevenue = extraOrders * averageOrderValue;

  const handleCopyCode = () => {
    const embedCode = `<!-- Min Makanak VoiceAI Widget Embed -->\n<script src="https://cdn.minmakanak.com/voice-widget.js"\n  data-merchant-id="merchant_demo_94c8"\n  data-language="${language}"\n  async>\n</script>`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubscribe = (planId: string) => {
    setIsSubscribing(true);
    setTimeout(() => {
      setSubscribedPlan(planId);
      setIsSubscribing(false);
    }, 1500);
  };

  const pricingPlans = [
    {
      id: "free",
      nameAr: "الباقة المجانية",
      nameEn: "Starter Free",
      price: 0,
      descriptionAr: "لتجربة الخدمة واختبار مساعد الصوت لمشروعك الصغير.",
      descriptionEn: "Experience the basic voice widget for small-scale testing.",
      featuresAr: [
        "حتى 10 منتجات بالمنيو",
        "100 محادثة ذكية شهرياً",
        "صوت افتراضي واحد",
        "دعم عبر البريد الإلكتروني"
      ],
      featuresEn: [
        "Up to 10 menu products",
        "100 AI conversations / mo",
        "Standard default voice",
        "Email support"
      ]
    },
    {
      id: "pro",
      nameAr: "الباقة الاحترافية (Pro)",
      nameEn: "Growth Pro",
      price: 49,
      descriptionAr: "للمتاجر والمطاعم المتوسطة الباحثة عن تفعيل المنيو الرقمي وطلب الطاولات.",
      descriptionEn: "Perfect for restaurants and mid-sized stores needing QR ordering.",
      featuresAr: [
        "حتى 1,000 منتج نشط",
        "محادثات غير محدودة للذكاء",
        "أصوات مخصصة احترافية",
        "ستاندات طاولة QR غير محدودة",
        "ربط تلقائي مع سلة وشوبيفاي"
      ],
      featuresEn: [
        "Up to 1,000 active products",
        "Unlimited AI conversations",
        "Custom premium voice selection",
        "Unlimited QR stand generation",
        "Shopify & Salla deep sync"
      ],
      popular: true
    },
    {
      id: "enterprise",
      nameAr: "الباقة البرمجية المفتوحة (Enterprise)",
      nameEn: "Scale Enterprise",
      price: 149,
      descriptionAr: "للشركات ومتاجر قطع الغيار الكبرى التي تمتلك كتالوج يبلغ 2000+ منتج مخفي للذكاء الاصطناعي.",
      descriptionEn: "For large operations and spare-parts dealers with massive hidden catalogs.",
      featuresAr: [
        "منتجات غير محدودة (2000+ منتج)",
        "كتالوج الذكاء الاصطناعي المخفي بالكامل",
        "دعم فني مخصص عبر الواتساب على مدار الساعة",
        "ربط مخصص عبر الـ API وقواعد البيانات",
        "تقارير مبيعات وتحليلات متقدمة"
      ],
      featuresEn: [
        "Unlimited items (2,000+ products)",
        "Complete Hidden AI-Only catalog indexing",
        "24/7 dedicated Whatsapp & call support",
        "Custom database & API routing",
        "Advanced conversational sales analytics"
      ]
    }
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-indigo-600" />
          {language === "ar" ? "إعدادات الاشتراك ونشر الخدمة (SaaS)" : "Billing, Subscriptions & Widgets"}
        </h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
          {language === "ar" 
            ? "انسخ كود الربط لتشغيل مساعد الصوت في موقعك الخاص، أو اشترك لتفعيل الباقات المتقدمة ومزايا الـ 2000 منتج." 
            : "Copy the embed script to go live on any store, or subscribe to unlock advanced limits and unlisted AI catalogs."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: SaaS Subscriptions (2 Columns) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Subscription Tiers */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {language === "ar" ? "اشتراك المتجر الحالي" : "Merchant Subscription Plan"}
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 uppercase">
                {language === "ar" ? `الخطة الحالية: ${subscribedPlan.toUpperCase()}` : `Current: ${subscribedPlan.toUpperCase()}`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingPlans.map((plan) => {
                const isActive = subscribedPlan === plan.id;
                return (
                  <div 
                    key={plan.id}
                    className={`border rounded-2xl p-5 flex flex-col justify-between relative transition-all ${
                      plan.popular ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/10" : "border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {language === "ar" ? "الأكثر طلباً" : "Most Popular"}
                      </span>
                    )}

                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        {language === "ar" ? plan.nameAr : plan.nameEn}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 h-12 leading-relaxed">
                        {language === "ar" ? plan.descriptionAr : plan.descriptionEn}
                      </p>
                      
                      <div className="my-4">
                        <span className="text-3xl font-extrabold text-slate-800">${plan.price}</span>
                        <span className="text-slate-400 text-xs font-semibold"> / {language === "ar" ? "شهرياً" : "mo"}</span>
                      </div>

                      <ul className="space-y-2 border-t pt-4">
                        {(language === "ar" ? plan.featuresAr : plan.featuresEn).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs font-semibold text-slate-600 leading-tight">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={isActive || isSubscribing}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isActive 
                            ? "bg-slate-100 text-slate-400 cursor-default" 
                            : plan.popular
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 shadow-md"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            {language === "ar" ? "نشط حالياً" : "Active Now"}
                          </>
                        ) : isSubscribing ? (
                          language === "ar" ? "جاري الاشتراك..." : "Subscribing..."
                        ) : (
                          language === "ar" ? "اشترك الآن" : "Subscribe"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Copy Paste Code Integration */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Code className="w-5 h-5 text-slate-400" />
              {language === "ar" ? "تضمين كود الودجت في موقعك" : "Embed Voice AI Widget"}
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {language === "ar"
                ? "انسخ هذا الرمز البرمجي وضعه في متجرك الخاص ليظهر مساعد الذكاء الاصطناعي الصوتي لزبائنك فوراً."
                : "Copy and paste this script tag into your website's header or footer to enable the voice widget for all users."}
            </p>

            {/* Code Box */}
            <div className="bg-slate-900 rounded-2xl p-4 text-slate-300 font-mono text-xs relative overflow-hidden border border-slate-800">
              <button
                onClick={handleCopyCode}
                className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 transition-all p-2 rounded-lg text-white"
                title="Copy Code"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <pre className="overflow-x-auto pr-10 leading-relaxed text-indigo-200">
                {`<!-- Min Makanak VoiceAI Widget Embed -->\n`}
                <span className="text-white">{`<script `}</span>
                <span className="text-yellow-400">{`src`}</span>
                <span className="text-emerald-400">{`="https://cdn.minmakanak.com/voice-widget.js"`}</span>
                {`\n  `}
                <span className="text-yellow-400">{`data-merchant-id`}</span>
                <span className="text-emerald-400">{`="merchant_demo_94c"`}</span>
                {`\n  `}
                <span className="text-yellow-400">{`data-language`}</span>
                <span className="text-emerald-400">{`="${language}"`}</span>
                {`\n  `}
                <span className="text-yellow-400">{`async`}</span>
                <span className="text-white">{`>\n</script>`}</span>
              </pre>
            </div>

            {/* Platform Guides Tabs */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                {language === "ar" ? "دليل الربط السريع حسب المنصة" : "Quick Integration Guide by Platform"}
              </h3>
              
              <div className="flex border-b border-slate-100 mb-4 flex-wrap gap-2">
                {["shopify", "salla", "woocommerce", "custom"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setIntegrationTab(tab)}
                    className={`px-4 py-2 text-xs font-bold transition-all border-b-2 capitalize ${
                      integrationTab === tab 
                        ? "border-indigo-600 text-indigo-600" 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Instructions content */}
              <div className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 rounded-2xl p-4">
                {integrationTab === "shopify" && (
                  <ol className="list-decimal list-inside space-y-2">
                    <li>{language === "ar" ? "ادخل للوحة تحكم شوبيفاي ثم اختر 'Themes'." : "Log into Shopify Admin and go to Themes."}</li>
                    <li>{language === "ar" ? "اضغط على النقاط الثلاث واختر 'Edit Code'." : "Click the three dots next to your theme and choose 'Edit Code'."}</li>
                    <li>{language === "ar" ? "افتح ملف theme.liquid وضَع الكود المنسوخ قبل وسم </body> مباشرة." : "Open theme.liquid and paste the embed script right before the </body> tag."}</li>
                    <li>{language === "ar" ? "احفظ التغييرات وسيظهر المساعد الصوتي فوراً!" : "Save changes and watch the Voice AI float live on your storefront!"}</li>
                  </ol>
                )}

                {integrationTab === "salla" && (
                  <ol className="list-decimal list-inside space-y-2">
                    <li>{language === "ar" ? "ادخل للوحة تحكم سلة وتوجه إلى 'متجر التطبيقات'." : "Go to your Salla Merchant Dashboard and open the App Store."}</li>
                    <li>{language === "ar" ? "اختر 'ربط مخصص للموقع / Custom Code'." : "Find and select 'Custom Script / Custom Tag' integration."}</li>
                    <li>{language === "ar" ? "الصق كود الـ script في خانة الهيدر والفوتر واضغط حفظ." : "Paste the script snippet in the header script box and click Activate."}</li>
                    <li>{language === "ar" ? "سيتم تفعيل الودجت لعملائك لطلب المنتجات مباشرة." : "The widget will run on Salla to allow customers to order directly by speaking."}</li>
                  </ol>
                )}

                {integrationTab === "woocommerce" && (
                  <ol className="list-decimal list-inside space-y-2">
                    <li>{language === "ar" ? "ادخل للوحة تحكم ووردبريس، ثم اختر 'Plugins' ثم 'Add New'." : "Log into WordPress Admin, go to Plugins -> Add New."}</li>
                    <li>{language === "ar" ? "ابحث عن إضافة 'Insert Headers and Footers' وقم بتثبيتها." : "Search and install the 'Insert Headers and Footers' plugin."}</li>
                    <li>{language === "ar" ? "توجّه للإعدادات والصق الكود في المربع الخاص بـ 'Scripts in Footer'." : "Go to Settings -> Insert Headers and Footers and paste code into scripts footer."}</li>
                    <li>{language === "ar" ? "اضغط حفظ لتفعيل المساعد الذكي." : "Click Save to activate your AI store assistant."}</li>
                  </ol>
                )}

                {integrationTab === "custom" && (
                  <ol className="list-decimal list-inside space-y-2">
                    <li>{language === "ar" ? "افتح ملف index.html أو قالب التصميم الرئيسي لموقعك." : "Open your HTML template file (index.html, App.js, etc.)."}</li>
                    <li>{language === "ar" ? "الصق وسم <script> المنسوخ في نهاية الكود." : "Paste the <script> embed tag at the bottom of your root HTML body."}</li>
                    <li>{language === "ar" ? "احفظ وارفع التحديث للسرفر." : "Deploy and push changes to your production container."}</li>
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: ROI financial Calculator & SaaS value (1 Column) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* ROI Calculator */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            
            <h2 className="text-base font-extrabold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              {language === "ar" ? "حاسبة الأرباح والعوائد للمتاجر" : "eCommerce Sales ROI Lift"}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {language === "ar"
                ? "احسب كيف سيساهم المساعد الصوتي في استرجاع السلات المتروكة وزيادة مبيعات محلك بمجرد إتاحته لعملائك."
                : "Estimate the projected monthly sales increase by enabling the instant Voice AI checkout."}
            </p>

            <div className="space-y-5">
              {/* Sliders */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-300">{language === "ar" ? "الزوار شهرياً للمتجر" : "Monthly Store Visitors"}</span>
                  <span className="text-indigo-300 font-mono">{monthlyVisitors.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={monthlyVisitors}
                  onChange={(e) => setMonthlyVisitors(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-300">{language === "ar" ? "متوسط قيمة الطلب" : "Average Order Value ($)"}</span>
                  <span className="text-indigo-300 font-mono">${averageOrderValue}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={averageOrderValue}
                  onChange={(e) => setAverageOrderValue(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Financial Lift Results */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300">{language === "ar" ? "طلبات إضافية من المساعد" : "AI Assisted Orders"}</span>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-emerald-400">+{extraOrders}</span>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">{language === "ar" ? "زيادة الأرباح الشهرية المتوقعة" : "Extra Monthly Revenue"}</span>
                  </div>
                  <span className="text-lg font-black font-mono text-emerald-400">+${extraRevenue.toLocaleString()}</span>
                </div>
              </div>

              {/* Pitch to Merchants */}
              <div className="text-[10px] text-slate-400 font-semibold leading-relaxed border-l-2 border-indigo-500 pl-3">
                {language === "ar"
                  ? "مساعد الصوت يقلل خطوات الطلب لخطوة واحدة: 'اطلب لي فرامل تيوتا 2018'، مما يحول 15% من الاستفسارات لمبيعات فعلية!"
                  : "By cutting down checkout steps to a simple spoken request, the AI assistant converts up to 15% of casual store inquiries into sales!"}
              </div>
            </div>
          </div>

          {/* Expert Suggestion for SaaS Business */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
            <h3 className="font-extrabold text-indigo-900 text-sm flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {language === "ar" ? "توصية أعمال الذكاء الاصطناعي" : "SaaS Launch Advisory"}
            </h3>
            <p className="text-xs text-indigo-800/90 leading-relaxed space-y-2">
              {language === "ar" ? (
                <>
                  <span><strong>القرار الصائب:</strong> قم بنشره كموديل اشتراكات للجميع (SaaS) وليس لمتجرك فقط!</span>
                  <br />
                  <span>أصحاب المتاجر والمطاعم في سلة وشوبيفاي ومن مكانك مستعدون لدفع 49$ شهرياً للحصول على منيو رقمي ذكي مع مساعد صوتي، لتوفر مبيعات متجرهم على مدار الساعة وبدون عمولات للموظفين. يمكنك تحقيق دخل متكرر (MRR) مذهل!</span>
                </>
              ) : (
                <>
                  <span><strong>The Verdict:</strong> Build and scale this as a public SaaS product!</span>
                  <br />
                  <span>Merchants on Shopify, Salla, and independent websites are eager to pay $49/month to add interactive voice shopping widgets and tableside QR ordering to save on human order processing and increase their conversion rates.</span>
                </>
              )}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
