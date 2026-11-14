import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { ConciergeBell, ArrowRight, Mic, QrCode, Sparkles, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * The landing page is the first impression — a fine-dining restaurant owner
 * should feel, in the first 5 seconds, that this product was built for them.
 *
 * Structure:
 *   1. Hero — a single strong line, a slow fade, two CTAs (no button-color
 *      clutter, no "available now" badges).
 *   2. Trust signal — a quiet line about the venues we serve (no platform
 *      logos, no testimonials carousel).
 *   3. The "what it is" — three measured cards: voice assistant, digital
 *      menu, QR stands. Each one sentence, not a paragraph.
 *   4. The "how it feels" — a stylized phone mockup showing a guest's view
 *      of the menu, with a quiet annotation that the assistant is one tap
 *      away.
 *   5. Closing line — invites the owner to begin setup, with a measured
 *      promise (two minutes, no commitment).
 *
 * No pricing. No logos of integrations. No "trusted by 1000 restaurants"
 * fake stats. The page is composed, not crowded.
 */

export function LandingPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ============ Hero ============ */}
      <section className="relative px-6 pt-24 md:pt-36 pb-20 md:pb-32 overflow-hidden">
        {/* Ambient background — subtle, not loud */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-br from-indigo-100/40 via-violet-100/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-amber-50/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-slate-500 mb-6">
              {isAr ? 'مطاعم وكافيهات متميزة' : 'For restaurants and cafés of note'}
            </p>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-8 text-slate-900">
              {isAr ? (
                <>صوتٌ راقٍ على<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-600"> كل طاولة</span>
                </>
              ) : (
                <>A measured voice at<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-600"> every table</span>
                </>
              )}
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              {isAr
                ? 'مساعد صوتي يستقبل ضيوفك عند الطاولة، يجيب عن المنيو بدقة، ويرشّح الأطباق المناسبة — بصوت متّزن يحافظ على شخصية مطعمك.'
                : 'A voice assistant that greets your guests at the table, answers questions about the menu precisely, and recommends the dishes that suit them — in a composed voice that respects the character of your restaurant.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-base font-bold shadow-xl transition-all hover:-translate-y-0.5"
              >
                {isAr ? 'ابدأ الإعداد' : 'Begin setup'}
                <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isAr ? 'rotate-180' : ''}`} />
              </Link>
              <Link
                to="/store"
                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-8 py-4 rounded-2xl text-base font-bold shadow-sm transition-all"
              >
                <ConciergeBell className="w-5 h-5 text-slate-400" />
                {isAr ? 'شاهد تجربة الضيف' : 'See the guest view'}
              </Link>
            </div>

            <p className="text-xs text-slate-400 mt-8">
              {isAr ? 'خطوتان للإعداد. لا التزام مسبق.' : 'Two steps to set up. No commitment.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============ Quiet trust line ============ */}
      <section className="px-6 pb-20 border-b border-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-slate-500 leading-relaxed italic">
            {isAr
              ? '«لا يهمّنا كم مطعم يفتح حسابًا. يهمّنا أن كل مطعم يفتح، يجد أداة تستحق اسمه.»'
              : '"We are not concerned with how many restaurants sign up. We are concerned that every restaurant that does, finds a tool worthy of its name."'}
          </p>
        </div>
      </section>

      {/* ============ Three measured cards ============ */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-indigo-600 mb-3 text-center">
            {isAr ? 'ثلاثة أجزاء، تجربة واحدة' : 'Three parts, one experience'}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-16 max-w-2xl mx-auto leading-tight">
            {isAr
              ? 'ما الذي يصل لطاولاتك في النهاية'
              : 'What ultimately reaches your tables'}
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Mic,
                titleAr: 'مساعد صوتي',
                titleEn: 'Voice assistant',
                descAr: 'يجيب عن الأطباق والمكونات والأسعار، ويرشّح ما يناسب ذوق الضيف — بأدب ودون استعجال.',
                descEn: 'Answers about dishes, ingredients, and prices, and recommends what suits the guest — courteously, without rushing.',
              },
              {
                icon: ConciergeBell,
                titleAr: 'منيو رقمي',
                titleEn: 'Digital menu',
                descAr: 'قائمة أنيقة تُفتح بمسح الكود، تعمل بعملتك وألوانك، وتحترم الورقي لمن يفضّله.',
                descEn: 'An elegant menu opened by a scan, in your currency and colors, that respects the printed version for those who prefer it.',
              },
              {
                icon: QrCode,
                titleAr: 'ستاند QR قابل للطباعة',
                titleEn: 'Printable QR stands',
                descAr: 'ستاند جاهز للطباعة لكل طاولة — اسم المطعم، اللوجو، الكود — في ثوانٍ.',
                descEn: 'A printable stand for every table — restaurant name, logo, code — in seconds.',
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-slate-50/50 border border-slate-200/80 rounded-3xl p-8 hover:border-indigo-300 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {isAr ? card.titleAr : card.titleEn}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {isAr ? card.descAr : card.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ The guest's view ============ */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-indigo-600 mb-3">
                {isAr ? 'ما يراه ضيفك' : 'What your guest sees'}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
                {isAr
                  ? 'منيو على هاتفه، لا يضيع منه شيء'
                  : 'A menu on their phone — they miss nothing'}
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mb-8">
                {isAr
                  ? 'يفتح الضيف الكاميرا على الكود الموجود على الطاولة، فيرى قائمة مرتبة بأسعار اليوم، صور الأطباق، ووصف مختصر. وإن رغب، يضغط زرًا واحدًا ليسأل المساعد الصوتي عن أي طبق — دون أن ينادي نادلًا.'
                  : 'The guest opens the camera on the code on the table, and sees a tidy menu with today’s prices, dish images, and a short description. If they wish, one button opens the voice assistant to ask about any dish — without calling a waiter.'}
              </p>

              <div className="space-y-3">
                {[
                  {
                    icon: Clock,
                    textAr: 'يفتح في ثانيتين',
                    textEn: 'Opens in two seconds',
                  },
                  {
                    icon: Sparkles,
                    textAr: 'باللهجة والصوت اللذين اخترتهما',
                    textEn: 'In the dialect and voice you chose',
                  },
                  {
                    icon: ConciergeBell,
                    textAr: 'يحترم ساعاتك وسياساتك',
                    textEn: 'Respects your hours and policies',
                  },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm text-slate-700">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      {isAr ? item.textAr : item.textEn}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex justify-center">
              <PhoneMockup isAr={isAr} />
            </div>
          </div>
        </div>
      </section>

      {/* ============ Closing ============ */}
      <section className="py-24 px-6 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
            {isAr
              ? 'خطوتان تفصلان طاولاتك عن هذا'
              : 'Two steps separate your tables from this'}
          </h2>
          <p className="text-base text-slate-400 mb-12 max-w-xl mx-auto leading-relaxed">
            {isAr
              ? 'الإعداد مدروس ومقصود. نختمه في دقيقتين، ونتركك تحكم في كل تفصيلة بعدها.'
              : 'The setup is measured and intentional. We finish it in two minutes, and leave every detail to you after that.'}
          </p>

          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-2xl text-base font-bold shadow-2xl hover:bg-slate-100 transition-all hover:-translate-y-0.5"
          >
            {isAr ? 'ابدأ الآن' : 'Begin'}
            <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isAr ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ============ Phone mockup ============ */

function PhoneMockup({ isAr }: { isAr: boolean }) {
  const dishes = isAr
    ? [
        { name: 'انغوس دبل تشيز', price: '320 ج.م', tag: 'الأكثر طلبًا' },
        { name: 'كافيار ترافل', price: '480 ج.م', tag: 'طبق الشيف' },
        { name: 'تشيز كيك سان سبستيان', price: '180 ج.م', tag: 'تحلية' },
      ]
    : [
        { name: 'Double Angus', price: 'EGP 320', tag: 'Most ordered' },
        { name: 'Truffle caviar', price: 'EGP 480', tag: 'Chef special' },
        { name: 'San Sebastian', price: 'EGP 180', tag: 'Dessert' },
      ];

  return (
    <div className="relative">
      <div className="w-72 h-[560px] bg-slate-900 rounded-[48px] p-3 shadow-2xl">
        <div className="w-full h-full bg-white rounded-[36px] overflow-hidden relative">
          {/* Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-full z-10" />

          {/* Status bar */}
          <div className="pt-8 pb-2 px-5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>9:41</span>
            <span>● ● ●</span>
          </div>

          {/* Menu content */}
          <div className="px-5 pt-3 pb-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">SooVoice</p>
            <h3 className="font-extrabold text-slate-900 text-base mt-0.5">
              {isAr ? 'قائمة الطاولات' : 'Dine-in menu'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isAr ? 'اطلب بمسح الكود أو اسأل المساعد' : 'Order by scanning the code, or ask the assistant'}
            </p>
          </div>

          {/* Dishes */}
          <div className="p-3 space-y-2">
            {dishes.map((dish, i) => (
              <div key={i} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-xs text-slate-800">{dish.name}</p>
                    <span className="inline-block text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mt-1 font-bold">
                      {dish.tag}
                    </span>
                  </div>
                  <p className="font-extrabold text-xs text-indigo-600" dir="ltr">{dish.price}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Voice CTA pinned to bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-lg">
            <Mic className="w-3.5 h-3.5" />
            {isAr ? 'اسأل المساعد' : 'Ask the assistant'}
          </div>
        </div>
      </div>
    </div>
  );
}
