import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Code2,
  Copy,
  CheckCircle2,
  Monitor,
  Code,
  Webhook,
  Play,
  Terminal,
  RefreshCw,
  CheckSquare,
  Server,
  Database,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export function Integration() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'iframe' | 'sdk' | 'webhook'>('iframe');

  // Webhook settings states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookStatusMessage, setWebhookStatusMessage] = useState('');

  // Webhook debugger states
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);
  const [testResponseBody, setTestResponseBody] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);

  // Connection status
  const { isConfigured } = getSupabaseConfig();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    }
  }, [searchParams]);

  // Load webhook settings
  useEffect(() => {
    if (!user) return;
    if (user.provider === 'local') return;
    const fetchWebhookSettings = async () => {
      try {
        const supabase = getSupabase();
        const { isConfigured } = getSupabaseConfig();
        if (isConfigured && supabase) {
          const { data, error } = await supabase
            .from('webhook_settings')
            .select('*')
            .eq('ownerId', user.uid)
            .single();
          if (!error && data) {
            if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          }
        }
      } catch (err) {
        console.error('Error fetching webhook settings:', err);
      }
    };
    fetchWebhookSettings();
  }, [user]);

  const origin = window.location.origin;
  const ownerId = user?.uid || 'merchant_abc123';

  const iframeCode = `<!-- SooVoice Floating Widget -->
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
    iframe.id = 'soovoice-widget-iframe';
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
<\/script>`;

  const scriptCode = `<!-- SooVoice SDK -->
<script>
  window.SooVoiceConfig = {
    apiKey: "YOUR_KEY",
    theme: "light",
    position: "bottom-right",
    language: "${language}",
    storeId: "${ownerId}"
  };
<\/script>
<script src="https://cdn.soovoice.app/widget.js" async defer><\/script>`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWebhook = async () => {
    // URL persistence is intentionally disabled until a trusted backend
    // validates destinations against SSRF (private, loopback and link-local
    // address) attacks and owns signed, retryable delivery.
    setWebhookStatusMessage(language === 'ar'
      ? 'حفظ الويب هوك متوقف مؤقتًا. سيتم تفعيله بعد إضافة فحص أمني للرابط وخدمة تسليم موثوقة من الخادم.'
      : 'Webhook URL saving is disabled until server-side destination validation and secure delivery are available.');
  };

  const handleTestWebhook = async () => {
    setShowTerminal(true);
    setTestStatusCode(501);
    setTestResponseBody(language === 'ar'
      ? 'اختبار الويب هوك من المتصفح متوقف لأسباب أمنية. يلزم تنفيذ التسليم والتوقيع من السيرفر.'
      : 'Browser-side webhook testing is disabled for security. A signed server-side outbox endpoint is required.');
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans" id="integrations-page-root">
      {showSuccessToast && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600 animate-bounce" />
          <p className="font-bold text-sm">
            {language === 'ar' ? 'تم التثبيت بنجاح.' : 'Integration completed successfully.'}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'الربط' : 'Connections'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar'
            ? 'ربط المساعد الصوتي بنظام الكاشير الخاص بك عبر الويب هوك، وتضمين الأداة على موقعك أو منصتك.'
            : 'Connect the voice assistant to your POS through webhooks, and embed the widget on your website.'}
        </p>
      </div>

      {/* Connection status */}
      <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {language === 'ar' ? 'حالة الاتصال' : 'Connection status'}
            </p>
            <p className={`text-xs ${isConfigured ? 'text-emerald-600' : 'text-slate-500'}`}>
              {isConfigured
                ? language === 'ar' ? 'متصل بقاعدة البيانات' : 'Connected to database'
                : language === 'ar' ? 'غير مُعدّ — راجع متغيرات البيئة' : 'Not configured — check environment variables'}
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 mb-8">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start">
          <div className="bg-indigo-100 p-3 rounded-xl text-indigo-700 shrink-0">
            <Webhook className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-indigo-900 text-sm md:text-base">
              {language === 'ar' ? 'ربط نظام الكاشير (POS) عبر الويب هوك' : 'Connect your POS via webhooks'}
            </h3>
            <p className="text-xs md:text-sm text-indigo-800/80 leading-relaxed">
              {language === 'ar'
                ? 'إرسال الطلبات إلى أنظمة الكاشير غير مفعّل حاليًا. يلزم تجهيز خدمة تسليم آمنة تتحقق من الرابط وتوقّع الطلبات وتعيد المحاولة عند الفشل.'
                : 'POS order delivery is not enabled yet. A secure delivery service with destination validation, request signing, and retries is required.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-500" />
              {language === 'ar' ? 'معلومات نقطة الويب هوك' : 'Webhook endpoint'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  {language === 'ar' ? 'رابط استقبال الطلبات:' : 'Webhook URL:'}
                </label>
                <input
                  type="url"
                  placeholder="https://my-pos.com/api/v1/orders"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                />
              </div>

              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'مفتاح توقيع الويب هوك يُدار على السيرفر فقط ولا يظهر في المتصفح.'
                  : 'Webhook signing credentials are managed server-side and are never exposed in the browser.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleSaveWebhook}
                disabled={isSavingWebhook}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-3 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-indigo-100 shadow-md"
              >
                {isSavingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                {language === 'ar' ? 'حفظ' : 'Save'}
              </button>

              <button
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !webhookUrl}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 text-indigo-500" />
                {language === 'ar' ? 'تجربة إرسال طلب' : 'Test dispatch'}
              </button>
            </div>

            {webhookStatusMessage && (
              <p className="text-xs font-bold text-indigo-600 animate-pulse">{webhookStatusMessage}</p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              {language === 'ar' ? 'صيغة الحمولة (JSON Payload)' : 'Expected JSON payload'}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {language === 'ar'
                ? 'مثال توضيحي لشكل الحدث بعد تفعيل خدمة التسليم الآمنة:'
                : 'Illustrative event shape only; live dispatch is not enabled:'}
            </p>
            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48 border border-slate-800">
              <code>{`{
  "event": "order.created",
  "timestamp": 1718919020101,
    "data": {
    "id": "order_734291",
    "ownerId": "${user?.uid || 'merchant_uid'}",
    "tableNumber": "5",
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

        {showTerminal && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs border border-slate-800 shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="flex items-center gap-2 text-indigo-400 font-bold">
                <Terminal className="w-4 h-4" />
                {language === 'ar' ? 'سجل الاتصال المباشر' : 'Live webhook tester'}
              </span>
              <button
                onClick={() => setShowTerminal(false)}
                className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <div className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner overflow-x-auto max-h-52">
              <p className="text-slate-500">&gt; Dispatching POST to: <span className="text-slate-300">{webhookUrl}</span></p>
              <p className="text-slate-500">&gt; Headers: Content-Type: application/json | x-soovoice-signature: sha256_...</p>
              {isTestingWebhook ? (
                <p className="text-amber-400 animate-pulse">&gt; WAITING FOR RESPONSE... (8000ms limit)</p>
              ) : (
                <>
                  <p className="text-amber-400">&gt; Dispatch disabled by security policy.</p>
                  <p className={`font-bold ${testStatusCode === 200 || testStatusCode === 201 ? 'text-green-400' : 'text-rose-400'}`}>
                    &gt; RESPONSE STATUS: {testStatusCode} {testStatusCode === 200 || testStatusCode === 201 ? 'OK' : 'ERROR'}
                  </p>
                  <p className="text-indigo-300 font-semibold mt-2">&gt; RESPONSE BODY:</p>
                  <pre className="text-slate-300 whitespace-pre-wrap text-[10px] pl-2 font-mono">{testResponseBody}</pre>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Widget embed section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-600" />
          {language === 'ar' ? 'أكواد تضمين الأداة الصوتية' : 'Widget embed codes'}
        </h3>

        <div className="flex border-b border-slate-100 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('iframe')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'iframe' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Monitor className="w-4 h-4" />
            {language === 'ar' ? 'الأيقونة العائمة (Iframe)' : 'Floating widget'}
          </button>
          <button
            onClick={() => setActiveTab('sdk')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sdk' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Code className="w-4 h-4" />
            {language === 'ar' ? 'سكربت SDK الكامل' : 'Full SDK script'}
          </button>
        </div>

        {activeTab === 'iframe' && (
          <div className="relative group">
            <button
              onClick={() => handleCopy(iframeCode)}
              className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-20 cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? (language === 'ar' ? 'تم النسخ' : 'Copied!') : language === 'ar' ? 'نسخ الكود' : 'Copy code'}
            </button>
            <pre className="bg-slate-900 text-slate-300 p-6 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 max-h-80">
              <code>{iframeCode}</code>
            </pre>
          </div>
        )}

        {activeTab === 'sdk' && (
          <div className="relative group">
            <button
              onClick={() => handleCopy(scriptCode)}
              className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-20 cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? (language === 'ar' ? 'تم النسخ' : 'Copied!') : language === 'ar' ? 'نسخ الكود' : 'Copy code'}
            </button>
            <pre className="bg-slate-900 text-slate-300 p-6 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 max-h-80">
              <code>{scriptCode}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
