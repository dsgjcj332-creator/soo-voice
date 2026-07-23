import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Zap, Code, ArrowRight, Store, CheckCircle2, Globe, ShieldCheck, Mail, Phone, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  const { t, language } = useLanguage();

  const faqs = [
    {
      q: language === 'ar' ? 'هل يعمل النظام على كافة المنصات؟' : 'Does it work on all platforms?',
      a: language === 'ar' 
        ? 'نعم، يمكنك ربط المساعد الصوتي بأي موقع إلكتروني بمجرد إضافة كود جافا سكريبت بسيط.' 
        : 'Yes, you can integrate the Voice AI into any website just by adding a simple JavaScript snippet.'
    },
    {
      q: language === 'ar' ? 'هل المساعد يدعم اللهجة العامية؟' : 'Does it support dialects?',
      a: language === 'ar'
        ? 'بالطبع، يدعم المساعد اللغة العربية الفصحى ومعظم اللهجات العربية (المصرية، الخليجية، وغيرها) بدقة عالية.'
        : 'Yes, it supports Standard Arabic and most Arabic dialects (Egyptian, Gulf, etc.) with high precision.'
    },
    {
      q: language === 'ar' ? 'كيف يتم تدريب المساعد على منتجاتي؟' : 'How is the AI trained on my products?',
      a: language === 'ar'
        ? 'يمكنك رفع ملفات PDF، Excel، أو حتى روابط لموقعك، وسيقوم النظام بتحليلها فوراً وفهم كافة التفاصيل.'
        : 'You can upload PDF, Excel files, or even links to your site, and the system will instantly analyze and understand all details.'
    }
  ];

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative px-6 py-28 md:py-40 flex flex-col items-center text-center">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-50/50 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold tracking-wide uppercase mb-8 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            {language === 'ar' ? 'الجيل القادم من التجارة الإلكترونية' : 'Next-Gen eCommerce is Here'}
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[1.05] text-slate-900">
            {language === 'ar' ? (
              <>التسوق بـ <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">صوتك</span><br/>أسهل وأسرع</>
            ) : (
              <>Shop with your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Voice</span><br/>Simplified</>
            )}
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-500 mb-12 max-w-3xl mx-auto font-medium leading-relaxed">
            {t('landing.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              to="/auth"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-2xl text-lg font-bold shadow-indigo-200 shadow-2xl transition-all hover:-translate-y-1.5 flex items-center justify-center gap-3"
            >
              {language === 'ar' ? 'ابدأ تجربتك المجانية' : 'Start Your Free Trial'} <ArrowRight className="w-6 h-6" />
            </Link>
            <Link
              to="/store"
              className="w-full sm:w-auto bg-white border-2 border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200 px-10 py-5 rounded-2xl text-lg font-bold shadow-sm transition-all flex items-center justify-center gap-3"
            >
              <Store className="w-6 h-6 text-indigo-500" />
              {language === 'ar' ? 'المتجر التجريبي' : 'Live Demo'}
            </Link>
          </div>
        </motion.div>

        {/* Floating elements animation */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="mt-20 relative w-full max-w-5xl px-4"
        >
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl overflow-hidden">
             <div className="flex items-center gap-2 mb-4 px-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <div className="ms-4 h-6 w-1/3 bg-slate-100 rounded-lg"></div>
             </div>
             <div className="aspect-[16/9] bg-slate-50 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent"></div>
                <div className="relative flex flex-col items-center gap-6">
                   <div className="h-20 w-20 bg-white rounded-3xl shadow-lg flex items-center justify-center animate-bounce">
                      <MessageSquare className="h-10 w-10 text-indigo-600" />
                   </div>
                   <div className="flex flex-col gap-3 items-center">
                      <div className="h-4 w-48 bg-slate-200 rounded-full"></div>
                      <div className="h-4 w-32 bg-slate-100 rounded-full"></div>
                   </div>
                </div>
             </div>
          </div>
        </motion.div>
      </section>

      {/* Integration Logos */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
           <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-12">
             {language === 'ar' ? 'المنصات المدعومة' : 'TRUSTED BY VENDORS ON'}
           </p>
           <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
              <div className="text-2xl font-black text-slate-900">Shopify</div>
              <div className="text-2xl font-black text-slate-900">Salla</div>
              <div className="text-2xl font-black text-slate-900">WooCommerce</div>
              <div className="text-2xl font-black text-slate-900">Zid</div>
              <div className="text-2xl font-black text-slate-900">Custom Web</div>
           </div>
        </div>
      </section>

      {/* Features section */}
      <section id="features" className="py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-slate-900">
              {t('landing.features.title')}
            </h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              {language === 'ar' ? 'حلول ذكية مصممة لرفع كفاءة متجرك وزيادة رضا عملائك' : 'Smart solutions designed to boost your store efficiency and customer satisfaction'}
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Code, color: 'indigo', key: 'landing.feat1' },
              { icon: Zap, color: 'emerald', key: 'landing.feat2' },
              { icon: MessageSquare, color: 'amber', key: 'landing.feat3' }
            ].map((feat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-2 transition-all duration-500"
              >
                <div className={`h-20 w-20 bg-${feat.color}-50 text-${feat.color}-600 flex items-center justify-center rounded-[24px] mb-10 group-hover:scale-110 transition-transform`}>
                  <feat.icon className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold mb-5 text-slate-900">{t(`${feat.key}.title`)}</h3>
                <p className="text-lg text-slate-500 leading-relaxed font-medium">{t(`${feat.key}.desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <motion.div 
              initial={{ opacity: 0, x: language === 'ar' ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:w-1/2"
            >
              <div className="inline-block px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold mb-6">
                 {language === 'ar' ? 'من نحن' : 'About Us'}
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-8 text-slate-900 leading-[1.2]">
                 {language === 'ar' 
                   ? 'نحن نعيد تعريف مفهوم التسوق الإلكتروني' 
                   : 'Redefining the Future of Online Shopping'}
              </h2>
              <p className="text-lg text-slate-500 mb-10 leading-relaxed font-medium">
                 {language === 'ar'
                   ? 'فريقنا يعمل على دمج أحدث تقنيات الذكاء الاصطناعي الصوتي لجعل تجربة المستخدم أكثر إنسانية وسهولة. نحن نؤمن أن الصوت هو أسرع وسيلة للتواصل، ولذلك جلبناه إلى متجرك.'
                   : 'Our team is working on integrating the latest Voice AI technologies to make the user experience more human and effortless. We believe voice is the fastest way to communicate, so we brought it to your store.'}
              </p>
              
              <div className="space-y-6">
                 {[
                   { icon: Globe, text: language === 'ar' ? 'دعم عالمي لكافة اللغات واللهجات' : 'Global support for all languages' },
                   { icon: ShieldCheck, text: language === 'ar' ? 'أمان عالي وخصوصية لبيانات العملاء' : 'High security and customer privacy' },
                   { icon: CheckCircle2, text: language === 'ar' ? 'تحديثات مستمرة لأداء الذكاء الاصطناعي' : 'Continuous AI performance updates' }
                 ].map((item, i) => (
                   <div key={i} className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                         <item.icon className="h-6 h-6" />
                      </div>
                      <span className="text-lg font-bold text-slate-700">{item.text}</span>
                   </div>
                 ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="lg:w-1/2 relative"
            >
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-100/50 rounded-full blur-[100px] -z-10"></div>
               <div className="bg-slate-50 border-8 border-white shadow-2xl rounded-[50px] aspect-square flex items-center justify-center p-12">
                  <div className="text-center">
                     <div className="h-24 w-24 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-6">
                        <Zap className="h-12 w-12 text-amber-500" />
                     </div>
                     <div className="text-6xl font-black text-slate-900 mb-2">+99%</div>
                     <div className="text-xl font-bold text-slate-500 uppercase tracking-widest">Accuracy Rate</div>
                  </div>
               </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-28 bg-slate-50/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-slate-900">
               {language === 'ar' ? 'الأسئلة الشائعة' : 'F.A.Q'}
            </h2>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-xl font-bold text-slate-900">{faq.q}</h3>
                  <ChevronDown className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-lg text-slate-500 leading-relaxed font-medium">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 px-6">
         <div className="max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[60px] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(79,70,229,0.3)]"
            >
               <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
               <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl -ml-48 -mb-48"></div>
               
               <div className="relative z-10">
                  <h2 className="text-4xl md:text-6xl font-black mb-10 leading-tight">
                     {language === 'ar' 
                       ? 'هل أنت مستعد لمستقبل التجارة؟' 
                       : 'Ready for the Future of Commerce?'}
                  </h2>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link
                      to="/auth"
                      className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-indigo-50 px-12 py-5 rounded-2xl text-xl font-black shadow-2xl transition-all hover:-translate-y-1.5"
                    >
                      {language === 'ar' ? 'ابدأ الآن مجاناً' : 'Get Started Now'}
                    </Link>
                    <div className="flex items-center gap-3">
                       <ShieldCheck className="w-6 h-6 text-indigo-200" />
                       <span className="text-indigo-100 font-bold">{language === 'ar' ? 'لا حاجة لبطاقة ائتمان' : 'No credit card required'}</span>
                    </div>
                  </div>
               </div>
            </motion.div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-12 mb-20">
               <div className="col-span-2">
                  <div className="text-2xl font-black text-indigo-600 mb-6 tracking-tighter">SooVoice</div>
                  <p className="text-lg text-slate-500 font-medium max-w-sm leading-relaxed mb-8">
                     {language === 'ar' 
                       ? 'نحن نساعد المتاجر على النمو من خلال تقنيات الذكاء الاصطناعي الصوتي المتطورة.' 
                       : 'Helping stores grow through cutting-edge Voice AI technology.'}
                  </p>
                  <div className="flex items-center gap-4">
                     <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"><Mail /></div>
                     <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"><Phone /></div>
                  </div>
               </div>
               <div>
                  <h4 className="font-black text-slate-900 mb-8 uppercase tracking-widest text-sm">{language === 'ar' ? 'الروابط' : 'Links'}</h4>
                  <ul className="space-y-4 text-slate-500 font-bold">
                     <li><a href="#features" className="hover:text-indigo-600 transition-colors">{language === 'ar' ? 'المميزات' : 'Features'}</a></li>
                     <li><Link to="/store" className="hover:text-indigo-600 transition-colors">{language === 'ar' ? 'المتجر' : 'Demo Store'}</Link></li>
                     <li><Link to="/auth" className="hover:text-indigo-600 transition-colors">{language === 'ar' ? 'تسجيل الدخول' : 'Login'}</Link></li>
                  </ul>
               </div>
               <div>
                  <h4 className="font-black text-slate-900 mb-8 uppercase tracking-widest text-sm">{language === 'ar' ? 'قانوني' : 'Legal'}</h4>
                  <ul className="space-y-4 text-slate-500 font-bold">
                     <li><Link to="/privacy" className="hover:text-indigo-600 transition-colors">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy'}</Link></li>
                     <li><Link to="/terms" className="hover:text-indigo-600 transition-colors">{language === 'ar' ? 'الشروط والأحكام' : 'Terms'}</Link></li>
                  </ul>
               </div>
            </div>
            <div className="pt-12 border-t border-slate-100 text-center">
               <p className="text-slate-400 font-bold">© 2026 SooVoice AI. All rights reserved.</p>
            </div>
         </div>
      </footer>
    </div>
  );
}

