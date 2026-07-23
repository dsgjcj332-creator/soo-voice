import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export function PrivacyPolicy() {
  const { language } = useLanguage();

  return (
    <div className="bg-slate-50 py-16 px-6 flex-1">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-10 md:p-14">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">
          {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </h1>
        <p className="text-slate-500 mb-8 text-sm">
          {language === 'ar' ? 'آخر تحديث: أبريل 2026' : 'Last updated: April 2026'}
        </p>

        <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
          {language === 'ar' ? (
            <>
              <p>مرحباً بك في تطبيق VoiceAI SaaS. نحن نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية.</p>
              
              <h3 className="text-xl font-bold text-slate-800">1. البيانات التي نجمعها</h3>
              <p>عند استخدامك لتطبيقنا وتثبيته عبر منصات مثل شوبيفاي أو سلة، نقوم بجمع:</p>
              <ul className="list-disc ms-5">
                <li>معلومات المتجر الأساسية (الاسم، البريد الإلكتروني).</li>
                <li>قائمة المنتجات والأسعار (لغرض تدريب المساعد الصوتي فقط).</li>
                <li>سجلات المحادثات الصوتية (يتم تفريغها نصياً لتحسين جودة النموذج، ولا يتم حفظ الصوت).</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-800">2. كيف نستخدم بياناتك؟</h3>
              <p>نستخدم البيانات المدخلة حصراً لتوفير خدمة المساعد الصوتي لمتجرك، ولتحسين دقة استجابة الذكاء الاصطناعي بناءً على محتوى متجرك المرفوع إلى قاعدة المعرفة.</p>

              <h3 className="text-xl font-bold text-slate-800">3. مشاركة البيانات</h3>
              <p>لا نقوم ببيع بياناتك لأي طرف ثالث. تتم معالجة الأوامر الصوتية والنصية عبر نماذج Google Gemini ضمن بيئة آمنة تخضع لسياسات Google الصارمة في الخصوصية.</p>

              <h3 className="text-xl font-bold text-slate-800">4. حقوقك كتاجر</h3>
              <p>بموجب القوانين ذات الصلة، يمكنك في أي وقت المطالبة بمسح كامل بياناتك وقوائمك من خوادمنا بمجرد إزالة تثبيت التطبيق (App Uninstall Webhook) من متجرك.</p>
            </>
          ) : (
            <>
              <p>Welcome to VoiceAI SaaS. We respect your privacy and are committed to protecting your personal data.</p>
              
              <h3 className="text-xl font-bold text-slate-800">1. Data We Collect</h3>
              <p>When you install our app via platforms like Shopify or Salla, we collect:</p>
              <ul className="list-disc ms-5">
                <li>Basic store info (Name, Email).</li>
                <li>Product catalog and pricing (for the purpose of training the AI agent).</li>
                <li>Voice interaction transcripts (audio is not stored, only transcripts for accuracy improvements).</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-800">2. How We Use Data</h3>
              <p>Data is strictly used to provide the voice agent service and enhance the AI's response accuracy based on your Knowledge Base.</p>

              <h3 className="text-xl font-bold text-slate-800">3. Data Sharing</h3>
              <p>We do not sell your data. Voice processing relies on Google Gemini within a secure environment governed by Google's strict privacy rules.</p>
              
              <h3 className="text-xl font-bold text-slate-800">4. Merchant Rights</h3>
              <p>You can request complete deletion of your data. Uninstalling the app via your platform automatically triggers a webhook to erase your configurations.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
