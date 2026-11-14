import React from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Zap, Code, ArrowRight, ConciergeBell } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  const { t, language } = useLanguage();

  return (
    <>
      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-32 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl pointer-events-none -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            {language === 'ar' ? 'متاح للمطاعم والفنادق المختارة' : 'Available for select venues'}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            {language === 'ar' ? (
              <>خدمة <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">صوتية</span> على الطاولة</>
            ) : (
              <>A <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">voice</span> service at the table</>
            )}
          </h1>

          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-base font-bold shadow-indigo-200 shadow-xl transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              {language === 'ar' ? 'ابدأ الآن' : 'Get started'} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/store"
              className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-8 py-4 rounded-xl text-base font-bold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <ConciergeBell className="w-5 h-5 text-slate-400" />
              {language === 'ar' ? 'شاهد العرض' : 'See it in action'}
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Trust signal — venues only, no platform logos */}
      <section className="pb-16 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 text-center">
           <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">
             {language === 'ar' ? 'مصمّم للمطاعم والفنادق المتميزة' : 'Designed for discerning restaurants and hotels'}
           </p>
           <p className="text-sm text-slate-500">
             {language === 'ar'
               ? 'منيو رقمي على الطاولة، مساعد صوتي ملتزم بسياستك، وتحكّم كامل من لوحة واحدة.'
               : 'A digital menu at the table, a voice assistant bound by your policies, and full control from a single dashboard.'}
           </p>
        </div>
      </section>

      {/* Features section */}
      <section id="features" className="py-24 bg-slate-50 flex-1">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            {t('landing.features.title')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-lg">
              <div className="h-14 w-14 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-2xl mb-6">
                <Code className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t('landing.feat1.title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('landing.feat1.desc')}</p>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-lg">
              <div className="h-14 w-14 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-2xl mb-6">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t('landing.feat2.title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('landing.feat2.desc')}</p>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-lg">
              <div className="h-14 w-14 bg-amber-50 text-amber-600 flex items-center justify-center rounded-2xl mb-6">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t('landing.feat3.title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('landing.feat3.desc')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
