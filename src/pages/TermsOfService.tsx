import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export function TermsOfService() {
  const { language } = useLanguage();

  return (
    <div className="bg-slate-50 py-16 px-6 font-sans flex-1">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-10 md:p-14">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          {language === 'ar' ? 'شروط الخدمة (Terms of Service)' : 'Terms of Service'}
        </h1>
        <p className="text-slate-500 mb-8 text-sm">
          {language === 'ar' ? 'آخر تحديث: 23 أبريل 2026' : 'Last updated: April 23, 2026'}
        </p>

        <div className="prose prose-slate max-w-none text-slate-600 space-y-6 text-sm leading-relaxed">
          {language === 'ar' ? (
            <>
              <h3 className="text-xl font-bold text-slate-800">1. قبول الشروط</h3>
              <p>باستخدام منصة VoiceAI SaaS وتثبيت إضافاتنا على متجرك (سواء عبر شوبيفاي، سلة، أو الربط المباشر)، فإنك توافق على الالتزام بهذه الشروط.</p>
              
              <h3 className="text-xl font-bold text-slate-800">2. ترخيص الاستخدام</h3>
              <p>نمنحك ترخيصًا محدودًا وغير حصري وقابل للإلغاء لاستخدام الـ Widget الصوتي الخاص بنا ودمجه في متجرك لخدمة عملائك، طالما أن اشتراكك فعال.</p>

              <h3 className="text-xl font-bold text-slate-800">3. المسؤولية عن المخرجات</h3>
              <p>الذكاء الاصطناعي الخاص بنا (المدعوم بـ Google Gemini) مُدرب على تقديم إجابات دقيقة بناءً على قاعدة المعرفة (Knowledge Base) التي تقدمها أنت. ومع ذلك، لا نتحمل المسؤولية القانونية عن أي "أخطاء هلوسة AI" (الهلوسة) قد تؤدي لخلافات بينك وبين المشتري بشأن الأسعار أو العروض؛ يجب الرجوع لأسعار السلة النهائية دائمًا.</p>

              <h3 className="text-xl font-bold text-slate-800">4. الاستخدام العادل (Fair Use)</h3>
              <p>يخضع النظام لسياسة الاستخدام العادل. في حال اكتشاف محاولات لهندسة عكسية (Reverse Engineering) للاستعلامات أو استهلاك هائل ومفتعل (DDoS) بغرض استنفاد أوامر الذكاء الاصطناعي، يحق لنا إيقاف الخدمة مؤقتًا لحمايتك وحماية مواردنا.</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-slate-800">1. Acceptance of Terms</h3>
              <p>By installing and using VoiceAI SaaS on your store (via Shopify, Salla, or custom snippet), you agree to be bound by these Terms of Service.</p>
              
              <h3 className="text-xl font-bold text-slate-800">2. License to Use</h3>
              <p>We grant you a limited, non-exclusive, revocable license to use our Voice Widget and integrate it into your storefront to serve your customers, provided your subscription remains active.</p>

              <h3 className="text-xl font-bold text-slate-800">3. Liability Regarding Outputs</h3>
              <p>Our AI (powered by Google Gemini) is designed to be highly accurate based on the Knowledge Base you provide. However, we are not legally liable for any "AI hallucinations" that may cause discrepancies between the AI's stated price and the actual cart price. The final cart checkout determines the legally binding price.</p>

              <h3 className="text-xl font-bold text-slate-800">4. Fair Use Policy</h3>
              <p>The system is subject to a fair use policy. In the event of detected reverse-engineering attempts or artificial consumption spikes (DDoS) intended to exhaust AI quotas, we reserve the right to temporarily suspend the widget connection to protect resources.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
