import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield, Lock, Server, CheckCircle } from 'lucide-react';

export function Security() {
  const { language } = useLanguage();

  return (
    <div className="bg-slate-50 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 bg-indigo-100 text-indigo-600 rounded-full mb-6">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            {language === 'ar' ? 'الأمان والامتثال (Security)' : 'Security & Compliance'}
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            {language === 'ar' 
              ? 'نحن نبني أنظمتنا على أساس الثقة. بياناتك وبيانات عملائك محمية بأعلى معايير التشفير العالمية.' 
              : 'We build our systems on trust. Your data and your customers data are protected with enterprise-grade security.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <Lock className="h-6 w-6 text-emerald-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {language === 'ar' ? 'تشفير البيانات (Encryption)' : 'Data Encryption'}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {language === 'ar' 
                ? 'يتم تشفير جميع البيانات أثناء النقل باستخدام بروتوكول TLS 1.3، وتشفير البيانات المستقرة (Data at Rest) باستخدام خوارزميات AES-256 القياسية في الصناعة.' 
                : 'All data is encrypted in transit via TLS 1.3 and at rest using industry-standard AES-256 encryption algorithms.'}
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <Server className="h-6 w-6 text-blue-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {language === 'ar' ? 'بنية تحتية معزولة' : 'Isolated Infrastructure'}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {language === 'ar' 
                ? 'يتم عزل قاعدة المعرفة لكل متجر (Knowledge Base) بشكل كامل عن المتاجر الأخرى. لا يمكن لنموذج الذكاء الاصطناعي تسريب بيانات متجرك لمنافسيك.' 
                : 'Each store Knowledge Base is completely logically isolated. Our AI models cannot leak your proprietary data to competitors.'}
            </p>
          </div>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 md:p-12 text-white">
          <h2 className="text-2xl font-bold mb-6">
            {language === 'ar' ? 'التزام معايير الامتثال' : 'Compliance Commitments'}
          </h2>
          <ul className="space-y-4">
            {[
              language === 'ar' ? 'متوافق مع نظام حماية البيانات الشخصية السعودي (PDPL).' : 'Compliant with Saudi PDPL (Personal Data Protection Law).',
              language === 'ar' ? 'جاهز للامتثال لمعايير اللائحة العامة لحماية البيانات (GDPR).' : 'GDPR compliance ready infrastructure.',
              language === 'ar' ? 'تُعالَج المدخلات الصوتية لحظياً ولا يتم تخزين التسجيلات الصوتية في قواعد بياناتنا.' : 'Voice streams are processed in real-time and audio recordings are never stored.',
              language === 'ar' ? 'نحن نستخدم Google Gemini Enterprise، والبيانات لا تُستخدم في تدريب نماذج Google العامة.' : 'Powered by Google Gemini Enterprise; your data is NOT used to train public models.'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-indigo-100 text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
