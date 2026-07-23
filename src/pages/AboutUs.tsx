import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Mic, Globe, Users } from 'lucide-react';

export function AboutUs() {
  const { language } = useLanguage();

  return (
    <div className="bg-white py-20 px-6 font-sans flex-1">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            {language === 'ar' ? 'من نحن (About Us)' : 'About VoiceAI'}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            {language === 'ar' 
              ? 'نحن في مهمة لإعادة صياغة مستقبل التجارة الإلكترونية. لا مزيد من الكتابة، ولا مزيد من البحث الطويل في المتاجر. نحن نمكن كل تاجر من توظيف مساعد ذكي صوتي يعمل على مدار الساعة.' 
              : 'We are on a mission to reshape the future of e-commerce. No more typing, no more tedious store search. We empower every merchant to hire a 24/7 intelligent voice agent.'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 mb-20">
          <div className="text-center">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mic className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'صوت حقيقي وطبيعي' : 'Natural Voice Realism'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar' ? 'نستخدم أحدث نماذج التعلم العميق لتوليد أصوات بلهجات محلية (مثل السعودية والمصرية).' : 'Leveraging the latest deep learning models to generate natural voices in local dialects.'}
            </p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Globe className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'عالمية التجارة' : 'Global Commerce'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar' ? 'سواء كان متجرك في السعودية، الإمارات، أو أمريكا؛ أنظمتنا جاهزة للاندماج الفوري وتخطي حاجز اللغة.' : 'Whether in MENA or global markets, our systems instantly integrate to break language barriers.'}
            </p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'فريق من الخبراء' : 'Expert Team'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar' ? 'فريقنا مهووس بالذكاء الاصطناعي التوليدي ومستقبل الواجهات الخالية من الشاشات (Screenless UI).' : 'Our team is obsessed with Generative AI and the future of Screenless User Interfaces.'}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl p-10 md:p-14 text-center border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            {language === 'ar' ? 'رؤيتنا للمستقبل' : 'Our Vision'}
          </h2>
          <p className="text-slate-600 italic max-w-2xl mx-auto">
            {language === 'ar' 
              ? '"نحن نؤمن بأن خلال الـ 5 سنوات القادمة، سيكون 70٪ من عمليات التسوق عبر الإنترنت معتمدة على الحديث الصوتي (Voice Commerce). نحن نبني البنية التحتية لهذا المستقبل اليوم." '
              : '"We believe that within 5 years, 70% of online shopping will be voice-driven. We are building the infrastructure for that future today."'}
          </p>
        </div>
      </div>
    </div>
  );
}
