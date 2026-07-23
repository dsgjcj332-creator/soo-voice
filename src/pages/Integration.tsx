import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Code2, 
  ShoppingBag, 
  Store, 
  Boxes, 
  Copy, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle2, 
  Monitor, 
  Code, 
  Wifi, 
  Webhook, 
  Play, 
  Terminal, 
  HelpCircle, 
  RefreshCw, 
  AlertCircle, 
  Trash, 
  Server, 
  CheckSquare, 
  Bell,
  BookOpen,
  Globe,
  Plug,
  FileCode,
  Zap
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Integration() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'iframe' | 'sdk' | 'webhook' | 'docs'>('iframe');

  // Webhook settings states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookStatusMessage, setWebhookStatusMessage] = useState('');
  
  // Realtime live orders states
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Webhook debugger states
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);
  const [testResponseBody, setTestResponseBody] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    }
  }, [searchParams]);

  // Load webhook settings
  useEffect(() => {
    if (!user) return;
    const fetchWebhookSettings = async () => {
      try {
        const docRef = doc(db, 'webhook_settings', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          if (data.webhookSecret) setWebhookSecret(data.webhookSecret);
        } else {
          // Generate a default random secret token
          const randSecret = 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          setWebhookSecret(randSecret);
        }
      } catch (err) {
        console.error('Error fetching webhook settings:', err);
      }
    };
    fetchWebhookSettings();
  }, [user]);

  // Listen to live orders from table QR codes in real-time
  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);

    const q = query(
      collection(db, 'orders'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(docs);
      setLoadingOrders(false);

      // Play sound notification if a new pending order arrives
      const hasNewOrder = snapshot.docChanges().some(change => change.type === 'added');
      if (hasNewOrder && snapshot.docChanges().length > 0) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          console.log('Audio notification bypass:', e);
        }
      }
    }, (error) => {
      console.error('Error listening to live orders:', error);
      setLoadingOrders(false);
    });

    return () => unsubscribe();
  }, [user]);

  const origin = window.location.origin;
  const ownerId = user?.uid || 'merchant_abc123';

  // Resizing iframe loader script (Dynamic floating widget)
  const iframeCode = `<!-- VoiceAI Dynamic Floating Widget Embed -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = "${origin}/widget-standalone?ownerId=${ownerId}";
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

    // Dynamic iframe resizing on widget open/close events
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

  // Traditional Custom Script
  const scriptCode = `<!-- VoiceAI Full SDK Integration Code -->
<script>
  window.VoiceAIConfig = {
    apiKey: "YOUR_PUBLIC_KEY",
    theme: "light",
    position: "bottom-right",
    language: "${language}",
    storeId: "${ownerId}"
  };
</script>
<script src="https://cdn.voiceaisaas.com/widget.js" async defer></script>`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateAppStore = (platform: string) => {
    navigate(`/oauth/authorize?platform=${platform}&shop=demo-${platform.toLowerCase()}.com`);
  };

  const handleSaveWebhook = async () => {
    if (!user) return;
    setIsSavingWebhook(true);
    setWebhookStatusMessage('');
    try {
      await setDoc(doc(db, 'webhook_settings', user.uid), {
        ownerId: user.uid,
        webhookUrl,
        webhookSecret,
        updatedAt: Date.now()
      });
      setWebhookStatusMessage(language === 'ar' ? '✅ تم حفظ إعدادات الويب هوك بنجاح!' : '✅ Webhook settings saved successfully!');
    } catch (err) {
      console.error(err);
      setWebhookStatusMessage(language === 'ar' ? '❌ خطأ في حفظ الإعدادات' : '❌ Error saving settings');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      alert(language === 'ar' ? 'الرجاء إدخال رابط ويب هوك أولاً' : 'Please enter a webhook URL first');
      return;
    }
    setIsTestingWebhook(true);
    setShowTerminal(true);
    setTestStatusCode(null);
    setTestResponseBody('');

    const testPayload = {
      event: 'order.created',
      timestamp: Date.now(),
      data: {
        id: 'order_test_9999',
        ownerId: user?.uid || 'test_owner',
        tableNumber: '3',
        items: [
          { id: '1', name: 'Delicious Beef Burger (Test)', price: 12.99, quantity: 2 },
          { id: '3', name: 'Fresh Crispy Fries (Test)', price: 4.99, quantity: 1 }
        ],
        total: 30.97,
        status: 'pending',
        createdAt: Date.now()
      }
    };

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VoiceAI-Signature': 'sha256_mock_sig_value_for_verification',
          'User-Agent': 'VoiceAI-Webhook-Bot/1.0'
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });
      clearTimeout(id);

      setTestStatusCode(response.status);
      const text = await response.text();
      setTestResponseBody(text || 'Empty response body from external server.');
    } catch (error: any) {
      console.error(error);
      setTestStatusCode(500);
      setTestResponseBody(`Failed to dispatch webhook. Error: ${error?.message || 'CORS Restriction or Connection Timeout. Legacy local networks might block browser requests.'}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this order?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      console.error('Error deleting order:', err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto font-sans" id="integrations-page-root">
      {showSuccessToast && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600 animate-bounce" />
          <p className="font-bold text-sm">
            {language === 'ar' ? 'تم التثبيت والربط بنجاح عبر نظام الـ OAuth الأوتوماتيكي!' : 'Integration completed successfully via secure OAuth App Store!'}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'منصات الربط والـ Webhooks وتكامل الأنظمة' : 'Integrations & POS Webhooks'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' 
            ? 'قم بربط مساعدك الصوتي بمتجرك، أو بتشغيل الربط المباشر مع نظام الكاشير الأصلي (POS) الخاص بك عبر الـ Webhooks لتلقي طلبات الطاولات لحظياً.' 
            : 'Connect your voice agent securely via 1-click apps, or trigger instant legacy system integrations using real-time POS webhooks.'}
        </p>
      </div>

      {/* 1. Native Connectors (App Stores) */}
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Boxes className="w-5 h-5 text-indigo-600" />
        {language === 'ar' ? 'التثبيت التلقائي السريع (1-Click Install)' : 'Native 1-Click Integrations'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {/* MNMKNK */}
        <div 
          onClick={() => handleSimulateAppStore('MNMKNK')}
          className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:border-indigo-400 hover:shadow-lg transition-all flex flex-col items-center group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="h-14 w-14 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-4 relative z-10 shadow-sm">
            <span className="font-bold text-lg">M</span>
          </div>
          <h3 className="font-bold text-slate-800 relative z-10">منهمنك (MNMKNK)</h3>
          <p className="text-xs text-slate-500 mt-2 mb-4 relative z-10 font-medium">
            {language === 'ar' ? 'الشريك الرسمي الأول. تزامن تلقائي.' : 'First official partner. Auto-sync.'}
          </p>
          <button className="mt-auto flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50/80 px-4 py-2.5 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors relative z-10 w-full justify-center border border-indigo-200 group-hover:border-indigo-600">
            {language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Shopify */}
        <div 
          onClick={() => handleSimulateAppStore('Shopify')}
          className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:border-indigo-400 hover:shadow-lg transition-all flex flex-col items-center group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="h-14 w-14 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center mb-4 relative z-10">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-slate-800 relative z-10">Shopify</h3>
          <p className="text-xs text-slate-500 mt-2 mb-4 relative z-10 font-medium">
            {language === 'ar' ? 'تزامن كامل للمنتجات وإضافة للسلة.' : 'Auto-sync products & seamless cart.'}
          </p>
          <button className="mt-auto flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50/80 px-4 py-2.5 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors relative z-10 w-full justify-center border border-green-200 group-hover:border-green-600">
            {language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Salla */}
        <div 
          onClick={() => handleSimulateAppStore('Salla')}
          className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:border-indigo-400 hover:shadow-lg transition-all flex flex-col items-center group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="h-14 w-14 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mb-4 relative z-10">
            <Store className="h-7 w-7" />
          </div>
          <h3 className="font-bold text-slate-800 relative z-10">سلة (Salla)</h3>
          <p className="text-xs text-slate-500 mt-2 mb-4 relative z-10 font-medium">
            {language === 'ar' ? 'تطبيق معتمد ومزود بخدمة الـ Webhooks.' : 'Official Webhook-enabled Salla App.'}
          </p>
          <button className="mt-auto flex items-center gap-2 text-sm font-bold text-teal-700 bg-teal-50/80 px-4 py-2.5 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition-colors relative z-10 w-full justify-center border border-teal-200 group-hover:border-teal-600">
            {language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zid */}
        <div className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center opacity-60">
          <div className="h-14 w-14 bg-violet-100 text-violet-700 rounded-2xl flex items-center justify-center mb-4">
            <div className="font-bold text-xl">Z</div>
          </div>
          <h3 className="font-bold text-slate-800">زد (Zid)</h3>
          <p className="text-xs text-slate-500 mt-2 mb-4 font-medium">
            {language === 'ar' ? 'جاري الاعتماد في متجر زد' : 'Pending Zid App Store Approval'}
          </p>
          <button className="mt-auto flex items-center gap-2 text-sm font-bold text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl w-full justify-center border border-slate-200 cursor-not-allowed" disabled>
            {language === 'ar' ? 'قريباً' : 'Coming soon'}
          </button>
        </div>
      </div>

      {/* 2. Manual Custom Script & Webhook with Tabs */}
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Code2 className="w-5 h-5 text-indigo-600" />
        {language === 'ar' ? 'الربط المطور وتكامل الأنظمة الخارجية' : 'Developer Integrations & Webhook Setup'}
      </h2>
      
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden mb-12">
        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 mb-6 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('iframe')}
            className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'iframe' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Monitor className="w-4 h-4" />
            {language === 'ar' ? 'تضمين الأيقونة العائمة فقط (Iframe)' : 'Floating Widget Embed'}
          </button>

          <button
            onClick={() => setActiveTab('sdk')}
            className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sdk' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Code className="w-4 h-4" />
            {language === 'ar' ? 'الربط البرمجي الكامل (Store SDK)' : 'Full SDK Script'}
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'webhook' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Webhook className="w-4 h-4 text-indigo-500 animate-pulse" />
            {language === 'ar' ? 'ربط السستم الأصلي والويب هوك (POS Integration)' : 'POS Webhook API (New!)'}
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'docs' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {language === 'ar' ? 'دليل المطورين' : 'Developer Docs'}
          </button>
        </div>

        {activeTab === 'iframe' && (
          <div>
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex gap-3 text-xs text-indigo-900 leading-relaxed mb-6">
              <span className="text-lg">✨</span>
              <div>
                <p className="font-bold">
                  {language === 'ar' ? 'ميزة تضمين الأيقونة فقط (Dynamic Widget Mode):' : 'Dynamic Floating Widget Mode:'}
                </p>
                <p className="mt-1">
                  {language === 'ar'
                    ? 'هذا الكود يضيف زر المساعد الصوتي العائم فقط في الركن السفلي لأي موقع خارجي (وردبريس، شوبيفاي، ويكس، أو صفحة HTML مخصصة). سيقوم المساعد تلقائياً بقراءة معلومات متجرك، والأسئلة والأجوبة، واللهجة المطلوبة بناءً على ما أدخلته في لوحة التحكم، دون الحاجة لعرض المنيو الرقمي!'
                    : 'This script places only the floating assistant button in the corner of any external website (WordPress, Shopify, Webflow, or custom page). The assistant automatically loads your store FAQs, dialect, custom files, and active business sector dynamically from the database, without showing any digital menus!'}
                </p>
              </div>
            </div>

            <div className="relative group">
              <button
                onClick={() => handleCopy(iframeCode)}
                className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-20 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? (language === 'ar' ? 'تم النسخ' : 'Copied!') : (language === 'ar' ? 'نسخ الكود' : 'Copy Code')}
              </button>
              <pre className="bg-slate-900 text-slate-300 p-6 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 shadow-inner max-h-96">
                <code>{iframeCode}</code>
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'sdk' && (
          <div>
            <p className="text-sm text-slate-500 font-medium mb-4">
              {language === 'ar' 
                ? 'إذا كنت تبني تطبيقاً متكاملاً أو متجراً مبرمجاً بالكامل وتريد التحكم في السلة وتلقي الأحداث، انسخ هذا الكود البرمجي وضعه قبل إغلاق <body/>.' 
                : 'If you are building a custom programmed application and want deep programmatic control over cart updates, paste this SDK configuration snippet before </body/>.'}
            </p>

            <div className="relative group">
              <button
                onClick={() => handleCopy(scriptCode)}
                className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-20 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? (language === 'ar' ? 'تم النسخ' : 'Copied!') : (language === 'ar' ? 'نسخ الكود' : 'Copy Code')}
              </button>
              <pre className="bg-slate-900 text-slate-300 p-6 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 shadow-inner">
                <code>{scriptCode}</code>
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'webhook' && (
          <div className="space-y-6" id="webhook-pos-tab-view">
            {/* Explanatory Banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-700 shrink-0">
                <Webhook className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-indigo-900 text-sm md:text-base">
                  {language === 'ar' 
                    ? 'كيف يربط هذا السستم بالـ POS أو الكاشير الأصلي الخاص بك؟' 
                    : 'How does tableside QR connect with your original POS/legacy system?'}
                </h3>
                <p className="text-xs md:text-sm text-indigo-800/80 leading-relaxed">
                  {language === 'ar'
                    ? 'كل ستاند QR طاولة تولده في صفحة المنيو الرقمي يحتوي على رابط مميز للطاولة (مثل table=1). عندما يطلب العميل عبر صوته أو المنيو، نقوم تلقائياً وبأقل من ثانية بإرسال طلب HTTP POST مباشر (ويب هوك) يحتوي على أرقام الطاولة والمنتجات لربطه مع السستم الأصلي الخاص بك. كما يمكنك متابعة واستقبال الطلبات لحظياً بالأسفل.'
                    : 'Each table QR stand you print holds a unique parameter (e.g. table=1). When customers place an order tableside via Voice AI, we dispatch an instantaneous HTTP POST webhook containing the precise table number and items directly to your POS system endpoint.'}
                </p>
              </div>
            </div>

            {/* Form Setup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-500" />
                  {language === 'ar' ? 'رابط الـ Webhook الخاص بالسستم الأصلي' : 'Legacy System Webhook Target'}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      {language === 'ar' ? 'رابط الويب هوك لاستقبال الطلبات (Webhook URL):' : 'Order Receiver Webhook URL:'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://my-restaurant-pos.com/api/v1/orders"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      {language === 'ar' ? 'رمز الأمان والمصادقة للويب هوك (Secret Token):' : 'Webhook Validation Token / Secret:'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={webhookSecret}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-sm font-mono text-slate-600"
                      />
                      <button 
                        onClick={() => handleCopy(webhookSecret)}
                        className="absolute right-2 top-2 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {language === 'ar' ? 'نسخ' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-3 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-indigo-100 shadow-md"
                  >
                    {isSavingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                    {language === 'ar' ? 'حفظ إعدادات الرابط' : 'Save Webhook Endpoint'}
                  </button>

                  <button
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook || !webhookUrl}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-indigo-500" />
                    {language === 'ar' ? 'تجربة إرسال طلب محاكي' : 'Test Dispatch Payload'}
                  </button>
                </div>

                {webhookStatusMessage && (
                  <p className="text-xs font-bold text-indigo-600 animate-pulse">{webhookStatusMessage}</p>
                )}
              </div>

              {/* Developer Payload Reference */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-500" />
                  {language === 'ar' ? 'صيغة طلب الطلب (JSON Payload Structure)' : 'Expected JSON Payload Shape'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'ar' 
                    ? 'هذا هو الـ Payload الذي يرسله السستم مباشرة فور انتهاء العميل من سلة الطلبات. برمج مبرمج نظامك الأصلي لاستقبال هذه البيانات:'
                    : 'Below is the exact JSON structure dispatched synchronously on checkout containing items, table Number, and owner reference:'}
                </p>
                <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48 border border-slate-800">
                  <code>{`{
  "event": "order.created",
  "timestamp": 1718919020101,
  "data": {
    "id": "order_734291",
    "ownerId": "${user?.uid || 'merchant_uid'}",
    "tableNumber": "1",
    "items": [
      { "id": "1", "name": "Classic Burger", "price": 12.99, "quantity": 2 }
    ],
    "total": 25.98,
    "status": "pending",
    "createdAt": 1718919020101
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* Simulated Debugging Terminal */}
            {showTerminal && (
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs border border-slate-800 shadow-lg space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <span className="flex items-center gap-2 text-indigo-400 font-bold">
                    <Terminal className="w-4 h-4" />
                    {language === 'ar' ? 'محاكي فحص الاتصال بالويب هوك (Live Debugger)' : 'Live Webhook Tester Logs'}
                  </span>
                  <button 
                    onClick={() => setShowTerminal(false)} 
                    className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold"
                  >
                    {language === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
                <div className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner overflow-x-auto max-h-52">
                  <p className="text-slate-500">&gt; Initializing mock tableside checkout webhook trigger...</p>
                  <p className="text-slate-500">&gt; Dispatching POST to: <span className="text-slate-300">{webhookUrl}</span></p>
                  <p className="text-slate-500">&gt; Headers: Content-Type: application/json | X-VoiceAI-Signature: sha256_sig_...</p>
                  {isTestingWebhook ? (
                    <p className="text-amber-400 animate-pulse">&gt; WAITING FOR EXTERNAL POS SERVER RESPONSE... (8000ms limit)</p>
                  ) : (
                    <>
                      <p className="text-slate-500">&gt; Transaction complete.</p>
                      <p className={`font-bold ${testStatusCode === 200 || testStatusCode === 201 ? 'text-green-400' : 'text-rose-400'}`}>
                        &gt; RESPONSE STATUS: {testStatusCode} {testStatusCode === 200 || testStatusCode === 201 ? 'OK' : 'SERVER RESPONSE OR CORS LIMIT'}
                      </p>
                      <p className="text-indigo-300 font-semibold mt-2">&gt; POS SYSTEM OUTPUT BODY:</p>
                      <pre className="text-slate-300 whitespace-pre-wrap text-[10px] pl-2 font-mono">{testResponseBody}</pre>
                    </>
                  )}
                </div>
                <div className="bg-amber-950/40 border border-amber-900/50 p-3 rounded-xl flex gap-2 text-[11px] text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <p>
                    {language === 'ar'
                      ? 'ملاحظة للمطور: إذا حصلت على خطأ أو حالة فشل، قد يكون ذلك بسبب قيود حماية CORS على متصفحك أو حظر الشبكات المحلية. عند الطلب الحقيقي من العميل، يتم الإرسال من خوادم السحابة لتلافي هذا الأمر تماماً.'
                      : 'Developer Note: If you receive a connection error or failed code, it might be due to client-side CORS browser safety policies or local network firewalls. During real tableside scanned checkouts, our cloud servers proxy this dispatch to completely bypass browser restrictions.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tableside Simulator Link Generator */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base">
                    {language === 'ar' ? 'محاكاة تدفق العميل والطلب من الطاولة' : 'Simulate Customer Tableside Order Flow'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar' 
                      ? 'انقر على أحد الروابط أدناه لفتح المنيو الرقمي طاولة معينة، ضع طلباً وشاهده يظهر تلقائياً بالأسفل.' 
                      : 'Click any link below to open the customer menu preset with that specific Table No., then place an order.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((tbl) => {
                  const demoUrl = `/store?ownerId=${ownerId}&table=${tbl}`;
                  return (
                    <div key={tbl} className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-indigo-50 text-indigo-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {language === 'ar' ? `طاولة رقم ${tbl}` : `Table No. ${tbl}`}
                          </span>
                          <Wifi className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 select-all truncate mb-3">
                          {window.location.origin}{demoUrl}
                        </p>
                      </div>
                      <a 
                        href={demoUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 text-xs font-bold text-center py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        {language === 'ar' ? 'محاكاة الطلب' : 'Simulate Order'}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* REAL-TIME POS KITCHEN DISPLAY MONITOR */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-500 text-white p-2 rounded-xl relative">
                    <Bell className="w-5 h-5 animate-swing" />
                    {orders.filter(o => o.status === 'pending').length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">
                        {orders.filter(o => o.status === 'pending').length}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      {language === 'ar' ? 'شاشة المطبخ واستقبال الطلبات اللحظية' : 'Real-time Kitchen Display System (KDS)'}
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                        {language === 'ar' ? 'متصل لحظياً' : 'Live Connected'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {language === 'ar' 
                        ? 'هذه الشاشة تمثل نظام الكاشير أو شاشة الطاهي بالمطبخ. تظهر بها كافة طلبات طاولات الـ QR وتصدر صوتاً فوراً.' 
                        : 'This view models the legacy kitchen monitor. All scanned tableside QR orders trigger a ring here immediately.'}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-400">
                  {language === 'ar' ? `إجمالي الطلبات: ${orders.length}` : `Total Orders: ${orders.length}`}
                </div>
              </div>

              {loadingOrders ? (
                <div className="bg-slate-50 rounded-2xl p-12 text-center text-slate-400 font-medium">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-slate-400" />
                  {language === 'ar' ? 'جاري الاتصال بقاعدة البيانات...' : 'Connecting to live database feed...'}
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700">{language === 'ar' ? 'لا توجد طاولات تطلب حالياً' : 'No tables ordering right now'}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    {language === 'ar' 
                      ? 'قم بمحاكاة طلب عميل من الطاولات بالروابط أعلاه أو بالمسح لكي تشاهد كيف يتدفق الطلب لحظياً ويسجل على لوحتك.' 
                      : 'Simulate a customer order above or scan a table QR to witness how orders populate here and trigger your POS webhooks.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orders.map((order) => {
                    const statusColors: Record<string, string> = {
                      pending: 'bg-amber-50 text-amber-700 border-amber-200/80',
                      preparing: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                      completed: 'bg-green-50 text-green-700 border-green-200/80',
                      cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80'
                    };

                    return (
                      <div 
                        key={order.id} 
                        className={`bg-white border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                          order.status === 'pending' ? 'border-amber-400 ring-2 ring-amber-400/10' : 'border-slate-100'
                        }`}
                      >
                        <div>
                          {/* Order Header */}
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                            <span className="font-extrabold text-slate-800 text-sm">
                              #{order.id.replace('order_', '')}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusColors[order.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {order.status === 'pending' && (language === 'ar' ? 'قيد الانتظار 🔔' : 'Pending 🔔')}
                              {order.status === 'preparing' && (language === 'ar' ? 'يجري التجهيز 👨‍🍳' : 'Preparing 👨‍🍳')}
                              {order.status === 'completed' && (language === 'ar' ? 'تم التقديم ✅' : 'Served ✅')}
                              {order.status === 'cancelled' && (language === 'ar' ? 'ملغي ❌' : 'Cancelled ❌')}
                            </span>
                          </div>

                          {/* Table Info Badge */}
                          <div className="mb-4 flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                            <span className="text-xs font-bold text-slate-500">
                              {language === 'ar' ? 'طاولة التقديم:' : 'Target Location:'}
                            </span>
                            <span className="bg-indigo-600 text-white font-extrabold text-xs px-3 py-1 rounded-lg">
                              {language === 'ar' ? `طاولة رقم ${order.tableNumber}` : `Table ${order.tableNumber}`}
                            </span>
                          </div>

                          {/* Items Ordered List */}
                          <div className="space-y-2 mb-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'ar' ? 'المنتجات المطلوبة' : 'Items Ordered'}</p>
                            <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                              {order.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-xs font-medium text-slate-700">
                                  <span>{item.name} <span className="text-indigo-600 font-extrabold ml-1">x{item.quantity}</span></span>
                                  <span className="font-mono text-slate-500">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Order Footer & Actions */}
                        <div className="border-t border-slate-100 pt-3 mt-3">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-slate-500">{language === 'ar' ? 'الحساب الإجمالي:' : 'Grand Total:'}</span>
                            <span className="text-base font-extrabold text-indigo-600 font-mono">${order.total?.toFixed(2)}</span>
                          </div>

                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                {language === 'ar' ? 'تجهيز الطلب' : 'Start Prep'}
                              </button>
                            )}
                            {order.status === 'preparing' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                {language === 'ar' ? 'تم التقديم للعميل' : 'Serve Order'}
                              </button>
                            )}
                            {order.status !== 'completed' && order.status !== 'cancelled' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                                className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                                title={language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer border border-slate-200/50"
                              title={language === 'ar' ? 'حذف من السجلات' : 'Archive Order'}
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-6">
            {/* Quick Start */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-5 h-5" />
                <h3 className="font-bold text-lg">
                  {language === 'ar' ? 'أسرع طريقة للربط (في دقيقة واحدة)' : 'Fastest Integration (1 minute)'}
                </h3>
              </div>
              <p className="text-indigo-100 text-sm mb-4">
                {language === 'ar' 
                  ? 'انسخ الكود التالي والصقه قبل إغلاق وسم </body> في أي موقع أو متجر.' 
                  : 'Copy the code below and paste it before the </body> tag on any website or store.'}
              </p>
              <div className="relative">
                <button
                  onClick={() => handleCopy(iframeCode)}
                  className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-10 cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? (language === 'ar' ? 'تم' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
                </button>
                <pre className="bg-slate-900 text-slate-300 p-5 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
                  <code>{iframeCode}</code>
                </pre>
              </div>
            </div>

            {/* Platform-specific guides */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shopify */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-green-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Shopify</h4>
                </div>
                <div className="flex gap-2 text-xs text-slate-600">
                  <Plug className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p><strong>{language === 'ar' ? '1-Click:' : '1-Click:'}</strong> {language === 'ar' ? 'استخدم زر "تثبيت التطبيق" بالأعلى' : 'Use the "Install App" button above'}</p>
                    <p><strong>{language === 'ar' ? 'يدوي:' : 'Manual:'}</strong> {language === 'ar' ? 'أضف الكود في theme.liquid قبل </body>' : 'Add code to theme.liquid before </body>'}</p>
                  </div>
                </div>
              </div>

              {/* Salla */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-teal-600" />
                  <h4 className="font-bold text-slate-800 text-sm">{language === 'ar' ? 'سلة (Salla)' : 'Salla'}</h4>
                </div>
                <div className="flex gap-2 text-xs text-slate-600">
                  <Plug className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p><strong>{language === 'ar' ? '1-Click:' : '1-Click:'}</strong> {language === 'ar' ? 'استخدم زر "تثبيت التطبيق" بالأعلى' : 'Use the "Install App" button above'}</p>
                    <p><strong>{language === 'ar' ? 'يدوي:' : 'Manual:'}</strong> {language === 'ar' ? 'أضف الكود في الـ footer من لوحة تحكم سلة' : 'Add code to footer from Salla dashboard'}</p>
                  </div>
                </div>
              </div>

              {/* WordPress */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-blue-600" />
                  <h4 className="font-bold text-slate-800 text-sm">WordPress / WooCommerce</h4>
                </div>
                <div className="flex gap-2 text-xs text-slate-600">
                  <Plug className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p><strong>{language === 'ar' ? 'طريقة 1:' : 'Method 1:'}</strong> {language === 'ar' ? 'استخدم "Custom HTML" widget من Appearance > Widgets' : 'Use "Custom HTML" widget from Appearance > Widgets'}</p>
                    <p><strong>{language === 'ar' ? 'طريقة 2:' : 'Method 2:'}</strong> {language === 'ar' ? 'أضف الكود في functions.php' : 'Add code to functions.php'}</p>
                  </div>
                </div>
              </div>

              {/* Any Website */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">{language === 'ar' ? 'أي موقع HTML' : 'Any HTML Site'}</h4>
                </div>
                <div className="flex gap-2 text-xs text-slate-600">
                  <Plug className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>{language === 'ar' ? 'انسخ كود الـ Iframe من تبويب "Floating Widget" بالأعلى والصقه قبل </body> في أي صفحة HTML' : 'Copy the Iframe code from the "Floating Widget" tab above and paste before </body> on any HTML page'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* API Reference */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500" />
                {language === 'ar' ? 'REST API (للمطورين المتقدمين)' : 'REST API (Advanced)'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ar' 
                  ? 'لو عاوز تبني تطبيق مخصص أو تكامل عميق، استخدم الـ REST API. تحتاج API key من صفحة الإعدادات.'
                  : 'For custom apps or deep integrations, use the REST API. You need an API key from the Settings page.'}
              </p>
              <div className="relative">
                <button
                  onClick={() => handleCopy(`// JavaScript - Create a voice session
const response = await fetch('${origin}/api/voice/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    storeId: '${ownerId}',
    language: 'ar',
    context: 'product_inquiry'
  })
});

const session = await response.json();
console.log(session.sessionId);`)}
                  className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-10 cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? (language === 'ar' ? 'تم' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
                </button>
                <pre className="bg-slate-900 text-slate-300 p-5 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
                  <code>{`// JavaScript - Create a voice session
const response = await fetch('${origin}/api/voice/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    storeId: '${ownerId}',
    language: 'ar',
    context: 'product_inquiry'
  })
});

const session = await response.json();
console.log(session.sessionId);`}</code>
                </pre>
              </div>
            </div>

            {/* Help Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
              <Boxes className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  {language === 'ar' ? 'محتاج مساعدة؟' : 'Need help?'}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {language === 'ar' 
                    ? 'كل الأكواد جاهزة للنسخ المباشر. غير YOUR_PUBLIC_KEY بمفتاحك من صفحة الإعدادات. الـ Merchant ID بتاعك هو: '
                    : 'All code snippets are copy-paste ready. Replace YOUR_PUBLIC_KEY with your key from Settings. Your Merchant ID is: '}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-900">{ownerId}</code>
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline fallback for simple close icon
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
