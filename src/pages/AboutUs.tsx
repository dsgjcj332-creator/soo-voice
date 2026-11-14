import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Mic, Globe, ConciergeBell } from 'lucide-react';

export function AboutUs() {
  const { language } = useLanguage();

  return (
    <div className="bg-white py-20 px-6 font-sans flex-1">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            {language === 'ar' ? 'من نحن — SooVoice' : 'About SooVoice'}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            {language === 'ar'
              ? 'SooVoice مساعد صوتي مخصّص للمطاعم والفنادق والمقاهي الراقية. يستقبل ضيوفك عند الطاولة، يجيب عن المنيو بدقة، ويرشّح الأطباق المناسبة — بصوت متّزن يحافظ على شخصية منشأتك.'
              : 'SooVoice is a voice assistant built for restaurants, hotels and cafés of note. It greets guests at the table, answers menu questions precisely, and recommends dishes — in a composed voice that respects the character of your venue.'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 mb-20">
          <div className="text-center">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Mic className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'صوت طبيعي بلهجاتك' : 'Natural voice, your dialects'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar'
                ? 'نماذج صوت حديثة تدعم اللهجات المحلية بدقة — فصحى، مصرية، خليجية، شامية.'
                : 'Modern voice models trained for local dialects — Modern Standard, Egyptian, Gulf, Levantine.'}
            </p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ConciergeBell className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'تجربة ضيافة راقية' : 'A measured hospitality'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar'
                ? 'مساعد ملتزم بسياساتك وساعاتك وقائمتك — لا يخرج عن النص ولا يَعِد بما لا تقدّمه.'
                : 'An assistant bound by your policies, hours and menu — never improvises, never overpromises.'}
            </p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Globe className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'متعدد اللغات' : 'Multilingual by design'}
            </h3>
            <p className="text-slate-500">
              {language === 'ar'
                ? 'يتحدّث مع ضيوفك بالعربية والإنجليزية على حد سواء، ويبدّل اللغة حسب طلب الضيف.'
                : 'Converses with guests in both Arabic and English, switching language at the guest\u2019s request.'}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl p-10 md:p-14 text-center border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            {language === 'ar' ? 'نهجنا' : 'Our approach'}
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {language === 'ar'
              ? 'نبني أدوات تخدم صاحب المنشأة أولًا، وتحترم الضيف دائمًا. كل ميزة تُختبر على أرض الواقع قبل أن تصل إلى طاولتك، وكل تحديث يهدف إلى رفع مستوى الخدمة لا إلى إبهار العميل.'
              : 'We build tools that serve the operator first and respect the guest always. Every feature is field-tested before it reaches your tables, and every update is meant to raise the standard of service — not to impress for its own sake.'}
          </p>
        </div>
      </div>
    </div>
  );
}
