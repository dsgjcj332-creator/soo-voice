import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Code2, ShoppingBag, Store, Boxes, Copy, CheckCircle2,
  Webhook, Terminal, Zap, Globe, Plug, FileCode, ChevronDown,
  ChevronRight, BookOpen, Rocket
} from 'lucide-react';

export function DeveloperDocs() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('quick-start');

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const ownerId = user?.uid || 'YOUR_MERCHANT_ID';
  const origin = window.location.origin;

  const sections = [
    { id: 'quick-start', icon: Rocket, title: language === 'ar' ? 'البداية السريعة' : 'Quick Start' },
    { id: 'iframe', icon: Globe, title: language === 'ar' ? 'تضمين الـ Widget (Iframe)' : 'Embed Widget (Iframe)' },
    { id: 'sdk', icon: Code2, title: language === 'ar' ? 'الربط البرمجي (SDK)' : 'SDK Integration' },
    { id: 'shopify', icon: ShoppingBag, title: 'Shopify' },
    { id: 'salla', icon: Store, title: language === 'ar' ? 'سلة (Salla)' : 'Salla' },
    { id: 'wordpress', icon: FileCode, title: 'WordPress / WooCommerce' },
    { id: 'webhook', icon: Webhook, title: language === 'ar' ? 'Webhook API' : 'Webhook API' },
    { id: 'api', icon: Terminal, title: language === 'ar' ? 'REST API' : 'REST API' },
  ];

  const iframeCode = `<!-- VoiceAI Floating Widget -->
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
    iframe.setAttribute('allow', 'microphone');
    document.body.appendChild(iframe);

    window.addEventListener('message', function(e) {
      if (e.data === 'open_voice_widget') {
        iframe.style.width = '350px';
        iframe.style.height = '620px';
      } else if (e.data === 'close_voice_widget') {
        iframe.style.width = '80px';
        iframe.style.height = '80px';
      }
    });
  })();
</script>`;

  const sdkCode = `<!-- VoiceAI SDK -->
<script>
  window.VoiceAIConfig = {
    apiKey: "YOUR_PUBLIC_KEY",
    theme: "light",
    position: "bottom-right",
    language: "ar",
    storeId: "${ownerId}"
  };
</script>
<script src="${origin}/widget.js" async defer></script>`;

  const shopifyCode = `<!-- Add to theme.liquid before </body> -->
{{ 'https://your-voiceai-domain.com/widget.js' | script_tag }}
<script>
  window.VoiceAIConfig = {
    apiKey: "{{ shop.metafields.voiceai.public_key }}",
    storeId: "${ownerId}",
    position: "bottom-right"
  };
</script>`;

  const sallaCode = `<!-- Add to Salla theme footer -->
<script>
  window.VoiceAIConfig = {
    apiKey: "YOUR_SALLA_APP_KEY",
    storeId: "${ownerId}",
    position: "bottom-right"
  };
</script>
<script src="${origin}/widget.js" async defer></script>`;

  const wordpressCode = `<!-- Add to functions.php or use "Custom HTML" widget -->
<script>
  window.VoiceAIConfig = {
    apiKey: "YOUR_PUBLIC_KEY",
    storeId: "${ownerId}",
    position: "bottom-right"
  };
</script>
<script src="${origin}/widget.js" async defer></script>`;

  const webhookPayload = `{
  "event": "order.created",
  "timestamp": 1718919020101,
  "data": {
    "id": "order_734291",
    "ownerId": "${ownerId}",
    "tableNumber": "1",
    "items": [
      { "id": "1", "name": "Classic Burger", "price": 12.99, "quantity": 2 }
    ],
    "total": 25.98,
    "status": "pending",
    "createdAt": 1718919020101
  }
}`;

  const apiExample = `// JavaScript - Create a voice session
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
console.log(session.sessionId);`;

  const CodeBlock = ({ id, code, lang }: { id: string; code: string; lang?: string }) => (
    <div className="relative group">
      <button
        onClick={() => handleCopy(id, code)}
        className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs rounded-lg transition-colors flex items-center gap-2 font-medium z-10 cursor-pointer"
      >
        {copied === id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        {copied === id ? (language === 'ar' ? 'تم' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
      </button>
      <pre className="bg-slate-900 text-slate-300 p-5 pt-14 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-indigo-100 p-2.5 rounded-xl">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              {language === 'ar' ? 'دليل المطورين وكيفية الربط' : 'Developer Docs & Integration Guide'}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {language === 'ar' 
                ? 'كل ما تحتاجه لربط المساعد الصوتي بمتجرك أو موقعك أو نظام الـ POS الخاص بك' 
                : 'Everything you need to connect VoiceAI to your store, website, or POS system'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="w-5 h-5" />
          <h2 className="font-bold text-lg">
            {language === 'ar' ? 'أسرع طريقة للربط (في دقيقة واحدة)' : 'Fastest Integration (1 minute)'}
          </h2>
        </div>
        <p className="text-indigo-100 text-sm mb-4">
          {language === 'ar' 
            ? 'انسخ الكود التالي والصقه قبل إغلاق وسم </body> في أي موقع أو متجر.' 
            : 'Copy the code below and paste it before the </body> tag on any website or store.'}
        </p>
        <CodeBlock id="quick-iframe" code={iframeCode} />
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Iframe Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'iframe' ? '' : 'iframe')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'تضمين الأيقونة العائمة (Iframe) - لأي موقع' : 'Floating Widget Embed (Iframe) - Any Site'}
              </span>
            </div>
            {openSection === 'iframe' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'iframe' && (
            <div className="p-5 pt-0 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {language === 'ar' 
                  ? 'هذه أسهل طريقة. الكود ده بيضيف زر عائم في الركن السفلي لأي موقع (HTML، PHP، ASP، أي حاجة). المساعد بيتحمل تلقائياً بإعدادات متجرك من قاعدة البيانات.'
                  : 'Easiest method. Adds a floating button to any site. The assistant auto-loads your store settings from the database.'}
              </p>
              <CodeBlock id="iframe-full" code={iframeCode} />
            </div>
          )}
        </div>

        {/* SDK Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'sdk' ? '' : 'sdk')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Code2 className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'الربط البرمجي الكامل (SDK)' : 'Full SDK Integration'}
              </span>
            </div>
            {openSection === 'sdk' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'sdk' && (
            <div className="p-5 pt-0 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {language === 'ar' 
                  ? 'لو عاوز تحكم كامل في السلة والأحداث برمجياً، استخدم الـ SDK. مناسب للتطبيقات المخصصة والمواقع المبرمجة بالكامل.'
                  : 'For full programmatic control over cart and events, use the SDK. Best for custom apps and fully programmed sites.'}
              </p>
              <CodeBlock id="sdk-full" code={sdkCode} />
            </div>
          )}
        </div>

        {/* Shopify Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'shopify' ? '' : 'shopify')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-green-600" />
              <span className="font-bold text-slate-800 text-sm">Shopify</span>
            </div>
            {openSection === 'shopify' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'shopify' && (
            <div className="p-5 pt-0 space-y-4">
              <div className="flex gap-3 text-sm">
                <Plug className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-slate-600">
                  <p><strong>{language === 'ar' ? 'الطريقة الأولى (1-Click):' : 'Method 1 (1-Click):'}</strong> {language === 'ar' ? 'استخدم زر "تثبيت التطبيق" من صفحة الـ Integration. بيعمل OAuth تلقائياً.' : 'Use the "Install App" button from the Integration page. It does OAuth automatically.'}</p>
                  <p><strong>{language === 'ar' ? 'الطريقة الثانية (يدوي):' : 'Method 2 (Manual):'}</strong> {language === 'ar' ? 'أضف الكود في ملف theme.liquid' : 'Add code to your theme.liquid file'}</p>
                </div>
              </div>
              <CodeBlock id="shopify-code" code={shopifyCode} />
            </div>
          )}
        </div>

        {/* Salla Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'salla' ? '' : 'salla')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-teal-600" />
              <span className="font-bold text-slate-800 text-sm">{language === 'ar' ? 'سلة (Salla)' : 'Salla'}</span>
            </div>
            {openSection === 'salla' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'salla' && (
            <div className="p-5 pt-0 space-y-4">
              <div className="flex gap-3 text-sm">
                <Plug className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-slate-600">
                  <p><strong>{language === 'ar' ? 'الطريقة الأولى (1-Click):' : 'Method 1 (1-Click):'}</strong> {language === 'ar' ? 'استخدم زر "تثبيت التطبيق" من صفحة الـ Integration.' : 'Use the "Install App" button from the Integration page.'}</p>
                  <p><strong>{language === 'ar' ? 'الطريقة الثانية (يدوي):' : 'Method 2 (Manual):'}</strong> {language === 'ar' ? 'أضف الكود في الـ footer من لوحة تحكم سلة' : 'Add code to the footer from your Salla dashboard'}</p>
                </div>
              </div>
              <CodeBlock id="salla-code" code={sallaCode} />
            </div>
          )}
        </div>

        {/* WordPress Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'wordpress' ? '' : 'wordpress')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-slate-800 text-sm">WordPress / WooCommerce</span>
            </div>
            {openSection === 'wordpress' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'wordpress' && (
            <div className="p-5 pt-0 space-y-4">
              <div className="flex gap-3 text-sm">
                <Plug className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-slate-600">
                  <p><strong>{language === 'ar' ? 'الطريقة الأولى:' : 'Method 1:'}</strong> {language === 'ar' ? 'استخدم إضافة "Custom HTML" widget من Appearance > Widgets' : 'Use a "Custom HTML" widget from Appearance > Widgets'}</p>
                  <p><strong>{language === 'ar' ? 'الطريقة الثانية:' : 'Method 2:'}</strong> {language === 'ar' ? 'أضف الكود في functions.php' : 'Add code to your theme functions.php'}</p>
                </div>
              </div>
              <CodeBlock id="wp-code" code={wordpressCode} />
            </div>
          )}
        </div>

        {/* Webhook Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'webhook' ? '' : 'webhook')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Webhook className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'ربط الـ POS / الكاشير (Webhook)' : 'POS / Kitchen Integration (Webhook)'}
              </span>
            </div>
            {openSection === 'webhook' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'webhook' && (
            <div className="p-5 pt-0 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {language === 'ar' 
                  ? 'لما عميل يطلب من المنيو الرقمي أو بالصوت، السستم بيبعت POST request فوراً للرابط اللي تحدده. استخدم ده لربط نظام الكاشير أو المطبخ.'
                  : 'When a customer orders via the digital menu or voice, the system sends a POST request to your URL. Use this to connect your POS or kitchen display.'}
              </p>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-900 mb-2">
                  {language === 'ar' ? 'صيغة البيانات المرسلة (JSON Payload):' : 'Payload structure:'}
                </p>
                <CodeBlock id="webhook-payload" code={webhookPayload} />
              </div>
              <p className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'إعداد الـ Webhook: اذهب لصفحة Integration > تبويب Webhook > أدخل رابط السستم بتاعك.'
                  : 'Setup: Go to Integration page > Webhook tab > enter your system URL.'}
              </p>
            </div>
          )}
        </div>

        {/* REST API Section */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setOpenSection(openSection === 'api' ? '' : 'api')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-slate-700" />
              <span className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'REST API (للمطورين المتقدمين)' : 'REST API (Advanced)'}
              </span>
            </div>
            {openSection === 'api' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {openSection === 'api' && (
            <div className="p-5 pt-0 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                {language === 'ar' 
                  ? 'لو عاوز تبني تطبيق مخصص أو تكامل عميق، استخدم الـ REST API. تحتاج API key من صفحة الإعدادات.'
                  : 'For custom apps or deep integrations, use the REST API. You need an API key from the Settings page.'}
              </p>
              <CodeBlock id="api-code" code={apiExample} />
            </div>
          )}
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
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
  );
}
