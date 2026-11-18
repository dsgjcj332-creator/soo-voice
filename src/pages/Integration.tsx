import React, { useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { getSupabaseConfig } from '../lib/supabase';
import { PosConnectionsPanel } from '../components/PosConnectionsPanel';

export function Integration() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'iframe' | 'sdk' | 'webhook'>('iframe');

  // Connection status
  const { isConfigured } = getSupabaseConfig();

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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto font-sans" id="integrations-page-root">
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

      <PosConnectionsPanel language={language} />

      {/* POS delivery configuration */}
      <section className="mb-8 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
            <Database className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-extrabold text-indigo-950">
              {language === 'ar' ? 'إعدادات توصيل الطلبات للكاشير' : 'POS order delivery'}
            </h2>
            <p className="text-sm leading-7 text-indigo-900/80">
              {language === 'ar'
                ? 'إدارة اتصالات الكاشير والفروع وتفعيل استقبال تحديثات الحالة وإرسال الطلبات موجودة في قسم اتصالات POS أعلاه. فعّل كل اتجاه بشكل مستقل بعد تجهيز الطرف المقابل.'
                : 'Manage POS connections, branches, inbound status updates, and outbound order delivery in the POS Connections panel above. Enable each direction separately after its endpoint is configured.'}
            </p>
            <p className="text-xs leading-6 text-indigo-800/80">
              {language === 'ar'
                ? 'مهم: موصل الويب هوك العام يتيح الربط مع الأنظمة التي توفر نقطة HTTPS لاستقبال الطلبات. هذا لا يعني أن كل شركة كاشير لديها تكامل API أصلي أو OAuth جاهز؛ الموصل الأصلي لكل مزود يحتاج تنفيذه واختباره بشكل مستقل.'
                : 'Important: the generic webhook bridge works with systems that expose an HTTPS order endpoint. It does not mean every POS vendor already has a native API or OAuth integration; each native provider adapter must be implemented and tested separately.'}
            </p>
          </div>
        </div>
      </section>

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
