import React, { useEffect, useState } from "react";
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
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { currencySymbol, formatPrice, type CurrencyCode } from "../lib/currency";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";

export function Billing() {
  const { language } = useLanguage();
  const { currency } = useSettings();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState("");
  const [currentSubscription, setCurrentSubscription] = useState<{
    status: string;
    billing_interval: string | null;
    currency: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Array<{
    id: string;
    invoice_number: string;
    status: string;
    currency: string;
    total_minor: number;
    issued_at: string;
    due_at: string | null;
    paid_at: string | null;
  }>>([]);


  useEffect(() => {
    if (!user || user.provider === "local") {
      setBillingLoading(false);
      return;
    }
    const { isConfigured } = getSupabaseConfig();
    const supabase = getSupabase();
    if (!isConfigured || !supabase) {
      setBillingError(language === "ar" ? "قاعدة البيانات غير مُعدة." : "Billing database is not configured.");
      setBillingLoading(false);
      return;
    }

    let cancelled = false;
    const loadBillingRecords = async () => {
      setBillingLoading(true);
      const [subscriptionResult, invoicesResult] = await Promise.all([
        supabase
          .from("merchant_subscriptions")
          .select("status,billing_interval,currency,trial_ends_at,current_period_end,cancel_at_period_end")
          .eq("owner_id", user.uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("billing_invoices")
          .select("id,invoice_number,status,currency,total_minor,issued_at,due_at,paid_at")
          .eq("owner_id", user.uid)
          .order("issued_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled) return;
      const error = subscriptionResult.error || invoicesResult.error;
      if (error) {
        setBillingError(error.message);
      } else {
        setBillingError("");
        setCurrentSubscription(subscriptionResult.data || null);
        setRecentInvoices((invoicesResult.data || []) as typeof recentInvoices);
      }
      setBillingLoading(false);
    };
    void loadBillingRecords();
    return () => { cancelled = true; };
  }, [user, language]);

  // ROI Calculator states
  const [monthlyVisitors, setMonthlyVisitors] = useState(10000);
  const [averageOrderValue, setAverageOrderValue] = useState(50);

  // Live subscription actions (Stripe checkout + cancel) through the billing API
  const [availablePlans, setAvailablePlans] = useState<Array<{
    plan_key: string;
    display_name: string;
    prices: Array<{ currency: string; billing_interval: string; amount_minor: number }>;
  }>>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [checkoutInProgress, setCheckoutInProgress] = useState<string | null>(null);
  const [cancelInProgress, setCancelInProgress] = useState(false);
  const [billingActionError, setBillingActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      if (!user || user.provider === "local") { setPlansLoading(false); return; }
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) { setPlansLoading(false); return; }
        const response = await fetch("/api/billing/plans", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`plans_${response.status}`);
        const rows = await response.json();
        if (!cancelled && Array.isArray(rows)) setAvailablePlans(rows as typeof availablePlans);
      } catch {
        if (!cancelled) setAvailablePlans([]);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };
    void loadPlans();
    return () => { cancelled = true; };
  }, [user]);

  const authBearerToken = async (): Promise<string | null> => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  };

  const handleSubscribe = async (planKey: string, billingInterval: "monthly" | "yearly", planCurrency: string) => {
    setBillingActionError("");
    setCheckoutInProgress(`${planKey}:${billingInterval}`);
    try {
      const token = await authBearerToken();
      if (!token) throw new Error("auth");
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, billingInterval, currency: planCurrency }),
      });
      const body = await response.json().catch(() => null) as { checkoutUrl?: string } | null;
      if (!response.ok || !body?.checkoutUrl) throw new Error(`checkout_${response.status}`);
      window.location.href = body.checkoutUrl;
    } catch {
      setBillingActionError(language === "ar"
        ? "تعذر بدء عملية الدفع. تأكد من تهيئة بوابة الدفع على الخادم ثم أعد المحاولة."
        : "Could not start checkout. Make sure the payment gateway is configured on the server, then retry.");
    } finally {
      setCheckoutInProgress(null);
    }
  };

  const handleCancelSubscription = async (resume: boolean) => {
    setBillingActionError("");
    setCancelInProgress(true);
    try {
      const token = await authBearerToken();
      if (!token) throw new Error("auth");
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      if (!response.ok) throw new Error(`cancel_${response.status}`);
      window.location.reload();
    } catch {
      setBillingActionError(language === "ar"
        ? "تعذر تحديث الاشتراك. أعد المحاولة بعد قليل."
        : "Could not update the subscription. Please retry shortly.");
    } finally {
      setCancelInProgress(false);
    }
  };

  // Single shared currency map (src/lib/currency.ts)
  const symbol = currencySymbol(currency);

  // Calculate simulated ROI
  const adoptionRate = 0.08; // 8% of visitors use the AI Voice assistant
  const conversionRateOfAI = 0.15; // 15% of assistant users convert to buyers
  const extraOrders = Math.round(monthlyVisitors * adoptionRate * conversionRateOfAI);
  const extraRevenue = extraOrders * averageOrderValue;

  const handleCopyCode = () => {
    const merchantId = user?.uid || 'YOUR_MERCHANT_ID';
    const embedCode = `<!-- SooVoice Widget Embed -->\n<script src="https://cdn.soovoice.app/widget.js"\n  data-merchant-id="${merchantId}"\n  data-language="${language}"\n  async>\n</script>`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      price: null,
      descriptionAr: "للمتاجر والمطاعم المتوسطة الباحثة عن تفعيل المنيو الرقمي وطلب الطاولات.",
      descriptionEn: "Perfect for restaurants and mid-sized stores needing QR ordering.",
      featuresAr: [
        "حتى 1,000 منتج نشط",
        "محادثات غير محدودة للذكاء",
        "أصوات مخصصة احترافية",
        "ستاندات طاولة QR غير محدودة",
        "ربط تلقائي عبر الويب هوك"
      ],
      featuresEn: [
        "Up to 1,000 active products",
        "Unlimited AI conversations",
        "Custom premium voice selection",
        "Unlimited QR stand generation",
        "Webhook & embed sync"
      ],
      popular: true
    },
    {
      id: "enterprise",
      nameAr: "الباقة البرمجية المفتوحة (Enterprise)",
      nameEn: "Scale Enterprise",
      price: null,
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-indigo-600" />
          {language === "ar" ? "إعدادات الاشتراك ونشر الخدمة (SaaS)" : "Billing, Subscriptions & Widgets"}
        </h1>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
          {language === "ar" 
            ? "انسخ كود الربط لتشغيل مساعد الصوت في موقعك الخاص، أو اشترك لتفعيل الباقات المتقدمة وحدود أعلى للمنتجات." 
            : "Copy the embed script to go live on any store, or subscribe to unlock advanced limits and higher product caps."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: SaaS Subscriptions (2 Columns) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Subscription Tiers */}
          {!plansLoading && availablePlans.length === 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {language === "ar"
                ? "تنبيه: بوابة الدفع غير مهيأة على الخادم بعد، لذلك لا يمكن إنشاء اشتراك مدفوع من هذه الصفحة حاليًا."
                : "Notice: the payment gateway is not configured on the server yet, so paid subscriptions cannot be started from this page."}
            </div>
          )}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {language === "ar" ? "اشتراك المتجر الحالي" : "Merchant Subscription Plan"}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentSubscription ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {billingLoading
                  ? (language === "ar" ? "جاري تحميل الاشتراك..." : "Loading subscription...")
                  : currentSubscription
                    ? (language === "ar" ? `حالة الاشتراك: ${currentSubscription.status}` : `Subscription: ${currentSubscription.status}`)
                    : (language === "ar" ? "لا يوجد اشتراك مسجل" : "No subscription record")}
              </span>
            </div>


            {billingError && (
              <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {language === "ar" ? "تعذر تحميل سجلات اشتراكك. قد تحتاج قاعدة البيانات إلى تطبيق ترحيل الفوترة." : "Could not load your billing records. The billing migration may need to be applied."}
              </p>
            )}
            {currentSubscription && (
              <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">{language === "ar" ? "دورة الفوترة" : "Billing interval"}</p>
                  <p className="mt-1 font-bold text-slate-800">{currentSubscription.billing_interval || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{language === "ar" ? "نهاية الفترة التجريبية" : "Trial ends"}</p>
                  <p className="mt-1 font-bold text-slate-800">{currentSubscription.trial_ends_at ? new Date(currentSubscription.trial_ends_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{language === "ar" ? "نهاية الفترة الحالية" : "Current period ends"}</p>
                  <p className="mt-1 font-bold text-slate-800">{currentSubscription.current_period_end ? new Date(currentSubscription.current_period_end).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US") : "—"}</p>
                </div>
              </div>
            )}
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-100">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-800">{language === "ar" ? "آخر الفواتير" : "Recent invoices"}</h3>
              </div>
              {billingLoading ? (
                <p className="p-4 text-xs text-slate-500">{language === "ar" ? "جاري تحميل الفواتير..." : "Loading invoices..."}</p>
              ) : recentInvoices.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">{language === "ar" ? "لا توجد فواتير مسجلة حتى الآن." : "No invoices have been recorded yet."}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{invoice.invoice_number}</p>
                        <p className="mt-1 text-slate-500">{new Date(invoice.issued_at).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US")}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-bold text-slate-800">{formatPrice(Number(invoice.total_minor) / 100, invoice.currency as CurrencyCode)}</p>
                        <p className="mt-1 text-slate-500">{invoice.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {currentSubscription && ["active", "trialing", "past_due"].includes(currentSubscription.status) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {currentSubscription.cancel_at_period_end
                    ? (language === "ar" ? "الاشتراك مجدول للإلغاء في نهاية الفترة الحالية." : "Your subscription is scheduled to cancel at the end of the current period.")
                    : (language === "ar" ? "الاشتراك نشط ويجدد تلقائيًا." : "Your subscription is active and renews automatically.")}
                </p>
                <button
                  type="button"
                  onClick={() => handleCancelSubscription(currentSubscription.cancel_at_period_end)}
                  disabled={cancelInProgress}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {cancelInProgress
                    ? (language === "ar" ? "جارٍ التنفيذ..." : "Working...")
                    : currentSubscription.cancel_at_period_end
                      ? (language === "ar" ? "استئناف التجديد التلقائي" : "Resume auto-renewal")
                      : (language === "ar" ? "إلغاء الاشتراك" : "Cancel subscription")}
                </button>
              </div>
            )}
            {billingActionError && (
              <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {billingActionError}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingPlans.map((plan) => {
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
                        <span className="text-2xl font-extrabold text-slate-800" dir="auto">{plan.price === null ? (language === "ar" ? "يحدد لاحقًا" : "To be confirmed") : formatPrice(plan.price, currency)}</span>
                        {plan.price !== null && <span className="text-slate-400 text-xs font-semibold"> / {language === "ar" ? "شهرياً" : "mo"}</span>}
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
                      {(() => {
                        const realPlan = availablePlans.find((row) => row.plan_key === plan.id);
                        const monthlyPrice = realPlan?.prices.find((row) => row.currency === currency && row.billing_interval === "monthly");
                        const yearlyPrice = realPlan?.prices.find((row) => row.currency === currency && row.billing_interval === "yearly");
                        if (!realPlan || (!monthlyPrice && !yearlyPrice)) {
                          return (
                            <button
                              type="button"
                              disabled
                              title={language === "ar" ? "لا يتوفر سعر نشط لهذه الباقة بعملتك حاليًا" : "No active price for this plan in your currency yet"}
                              className="w-full cursor-not-allowed rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500"
                            >
                              {language === "ar" ? "الاشتراك غير متاح حاليًا" : "Subscriptions unavailable"}
                            </button>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            {monthlyPrice && (
                              <button
                                type="button"
                                onClick={() => handleSubscribe(realPlan.plan_key, "monthly", monthlyPrice.currency)}
                                disabled={checkoutInProgress !== null}
                                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                              >
                                {checkoutInProgress === `${realPlan.plan_key}:monthly`
                                  ? (language === "ar" ? "جارٍ التحويل للدفع..." : "Redirecting to checkout...")
                                  : `${language === "ar" ? "اشترك شهريًا" : "Subscribe monthly"} · ${formatPrice(monthlyPrice.amount_minor / 100, monthlyPrice.currency as CurrencyCode)}`}
                              </button>
                            )}
                            {yearlyPrice && (
                              <button
                                type="button"
                                onClick={() => handleSubscribe(realPlan.plan_key, "yearly", yearlyPrice.currency)}
                                disabled={checkoutInProgress !== null}
                                className="w-full rounded-xl border border-indigo-600 bg-white py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                              >
                                {checkoutInProgress === `${realPlan.plan_key}:yearly`
                                  ? (language === "ar" ? "جارٍ التحويل للدفع..." : "Redirecting to checkout...")
                                  : `${language === "ar" ? "اشترك سنويًا" : "Subscribe yearly"} · ${formatPrice(yearlyPrice.amount_minor / 100, yearlyPrice.currency as CurrencyCode)}`}
                              </button>
                            )}
                          </div>
                        );
                      })()}
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
                {`<!-- SooVoice Widget Embed -->\n`}
                <span className="text-white">{`<script `}</span>
                <span className="text-yellow-400">{`src`}</span>
                <span className="text-emerald-400">{`="https://cdn.soovoice.app/widget.js"`}</span>
                {`\n  `}
                <span className="text-yellow-400">{`data-merchant-id`}</span>
                <span className="text-emerald-400">="${user?.uid || "YOUR_MERCHANT_ID"}"</span>
                {`\n  `}
                <span className="text-yellow-400">{`data-language`}</span>
                <span className="text-emerald-400">{`="${language}"`}</span>
                {`\n  `}
                <span className="text-yellow-400">{`async`}</span>
                <span className="text-white">{`>\n</script>`}</span>
              </pre>
            </div>

            {/* Platform Guides */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                {language === "ar" ? "دليل التضمين على أي موقع" : "Embed on your website"}
              </h3>

              <div className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 rounded-2xl p-4">
                <ol className="list-decimal list-inside space-y-2">
                  <li>{language === "ar" ? "افتح ملف index.html أو قالب التصميم الرئيسي لموقعك." : "Open your HTML template file (index.html, App.js, etc.)."}</li>
                  <li>{language === "ar" ? "الصق وسم <script> المنسوخ قبل وسم </body> مباشرة." : "Paste the <script> embed tag right before the </body> tag."}</li>
                  <li>{language === "ar" ? "احفظ وارفع التحديث للسيرفر، وسيظهر المساعد الصوتي فورًا." : "Save and deploy — the assistant appears on your site instantly."}</li>
                </ol>
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
                  <span className="text-slate-300">{language === "ar" ? `متوسط قيمة الطلب (${symbol})` : `Average Order Value (${symbol})`}</span>
                  <span className="text-indigo-300 font-mono" dir="ltr">{formatPrice(averageOrderValue, currency)}</span>
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
                  <span className="text-lg font-black font-mono text-emerald-400" dir="ltr">+{formatPrice(extraRevenue, currency)}</span>
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

        </div>

      </div>
    </div>
  );
}
