import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings, Dialect, VoiceTone } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  ConciergeBell, Sparkles, Languages, Volume2, ArrowRight, ArrowLeft,
  CheckCircle2, Copy, Code, Utensils, Wine, Building2, Trees,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '../brand/Logo';
import { VoiceWidget } from '../widget/VoiceWidget';

/**
 * Premium onboarding for luxury restaurants and cafés.
 *
 * The flow opens with a cinematic welcome that establishes the tone before
 * the merchant is asked to enter anything — the way a host would greet a
 * guest at the door before showing them to the table. Then four measured
 * steps:
 *
 *   0 — welcome (cinematic intro)
 *   1 — restaurant identity (name + character)
 *   2 — dialect
 *   3 — voice tone
 *   4 — embed snippet + closing line
 *
 * Character is a new field: fine-dining / heritage / modern-luxury / casual-
 * bistro. It is stored in localStorage and read by the assistant builder
 * later. The first impression is the most important second of the entire
 * sale — this wizard is built to earn it.
 */

type Character = 'fine_dining' | 'heritage' | 'modern_luxury' | 'casual_bistro';

interface CharacterOption {
  id: Character;
  icon: React.ComponentType<{ className?: string }>;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

const CHARACTER_OPTIONS: CharacterOption[] = [
  {
    id: 'fine_dining',
    icon: Wine,
    titleAr: 'مطعم فاخر راقٍ',
    titleEn: 'Fine dining',
    descAr: 'ت tasting menu، خدمة متعددة الأطباق، سلوك رسمي هادئ، واهتمام بالتفاصيل.',
    descEn: 'Tasting menus, multi-course service, a measured formal tone, attention to detail.',
  },
  {
    id: 'heritage',
    icon: Building2,
    titleAr: 'مطعم عريق بإرث',
    titleEn: 'Heritage restaurant',
    descAr: 'مطعم له قصة — عائلي من جيل، أو يحمل اسماً معروفاً، أو يقدّم مأكولات أصيلة.',
    descEn: 'A restaurant with a story — family-run for generations, a known name, or authentic cuisine.',
  },
  {
    id: 'modern_luxury',
    icon: Sparkles,
    titleAr: 'كافيه أو مطعم عصري فاخر',
    titleEn: 'Modern luxury café',
    descAr: 'تقديم راقٍ لكن غير رسمي، تجربة بصرية أنيقة، ولغة خدمة معاصرة.',
    descEn: 'Refined yet relaxed service, elegant visual identity, contemporary language.',
  },
  {
    id: 'casual_bistro',
    icon: Trees,
    titleAr: 'بسترو أو كافيه كاجوال',
    titleEn: 'Casual bistro',
    descAr: 'خدمة سريعة، جو مريح ودافئ، لغة قريبة من الضيف دون رسمية مفرطة.',
    descEn: 'Quick service, warm atmosphere, language close to the guest without formality.',
  },
];

const DIALECTS = [
  { id: 'standard' as Dialect, nameAr: 'العربية الفصحى', nameEn: 'Standard Arabic', sampleAr: 'أهلاً بك، كيف يمكنني مساعدتك اليوم؟', sampleEn: 'Welcome, how may I assist you today?' },
  { id: 'egyptian' as Dialect, nameAr: 'اللهجة المصرية', nameEn: 'Egyptian', sampleAr: 'أهلاً بيك يا فندم، إزاي أقدر أساعدك النهاردة؟', sampleEn: 'Welcome, how may I assist you today?' },
  { id: 'gulf' as Dialect, nameAr: 'اللهجة الخليجية', nameEn: 'Gulf', sampleAr: 'يا هلا ومسهلا، طال عمرك وشلون أقدر أخدمك اليوم؟', sampleEn: 'Welcome, how may I be of service today?' },
  { id: 'levantine' as Dialect, nameAr: 'اللهجة الشامية', nameEn: 'Levantine', sampleAr: 'يا مية أهلاً، كيف فيني أساعدك اليوم؟', sampleEn: 'A warm welcome, how may I help you today?' },
];

const VOICES = [
  { id: 'Zephyr' as VoiceTone, genderAr: 'رجالي — هادئ ودافئ', genderEn: 'Male — calm & warm' },
  { id: 'Charon' as VoiceTone, genderAr: 'رجالي — فخم وعميق', genderEn: 'Male — deep & formal' },
  { id: 'Fenrir' as VoiceTone, genderAr: 'رجالي — قوي وواضح', genderEn: 'Male — confident & clear' },
  { id: 'Kore' as VoiceTone, genderAr: 'نسائي — لطيف ومحبب', genderEn: 'Female — friendly & kind' },
  { id: 'Puck' as VoiceTone, genderAr: 'نسائي — سريع ونشيط', genderEn: 'Female — vibrant & quick' },
  { id: 'Aoede' as VoiceTone, genderAr: 'نسائي — احترافي ودافئ', genderEn: 'Female — professional & warm' },
];

const TOTAL_STEPS = 5; // welcome counts as 0, then 4 numbered steps

export function OnboardingWizard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const {
    dialect, setDialect,
    voiceTone, setVoiceTone,
    setHasCompletedOnboarding,
  } = useSettings();

  const isAr = language === 'ar';
  const [step, setStep] = useState(0); // 0 = welcome; 1..4 = setup
  const [restaurantName, setRestaurantName] = useState('');
  const [character, setCharacter] = useState<Character | null>(
    () => (localStorage.getItem('restaurant_character') as Character | null) || null
  );
  const [copied, setCopied] = useState(false);
  const [testActive, setTestActive] = useState(false);

  const handleNext = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  const handleFinish = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setHasCompletedOnboarding(true);
  };

  const origin = window.location.origin;
  const merchantOwnerId = user?.uid || 'demo_user_onboarding';

  const embedCode = `<!-- SooVoice Floating Widget -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = "${origin}/widget-standalone?ownerId=${merchantOwnerId}";
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
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepLabels = [
    isAr ? 'الترحيب' : 'Welcome',
    isAr ? 'هوية المطعم' : 'Restaurant identity',
    isAr ? 'اللهجة' : 'Dialect',
    isAr ? 'نبرة الصوت' : 'Voice tone',
    isAr ? 'الكود والختام' : 'Embed code',
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[10000] flex items-center justify-center p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white rounded-[36px] w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">

        <AnimatePresence mode="wait">
          {/* ============ Step 0: Welcome ============ */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 text-white flex-1 flex flex-col items-center justify-center p-12 md:p-20 overflow-hidden"
            >
              {/* Subtle ambient orbs */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

              <div className="relative z-10 text-center max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="inline-flex items-center gap-2 mb-8"
                >
                  <Logo size={48} className="rounded-2xl shadow-2xl" />
                  <span className="font-bold text-2xl tracking-tight">SooVoice</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-6"
                >
                  {isAr
                    ? 'مساعد صوتي راقٍ لضيوفك على الطاولة'
                    : 'A refined voice assistant for your guests at the table'}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="text-base md:text-lg text-slate-300 leading-relaxed mb-12 max-w-xl mx-auto"
                >
                  {isAr
                    ? 'نحن لا نُسرّع الإعداد. خطوات قليلة، مدروسة، تُهيّئ مساعدك ليكون صوت مطعمك — لا صوت تطبيق.'
                    : 'We do not rush the setup. A few measured steps prepare your assistant to be the voice of your restaurant — not the voice of an app.'}
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  onClick={handleNext}
                  className="group inline-flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl text-sm font-bold tracking-wide shadow-2xl hover:bg-slate-100 transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  {isAr ? 'ابدأ الإعداد' : 'Begin setup'}
                  <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${isAr ? 'rotate-180' : ''}`} />
                </motion.button>

                <p className="text-xs text-slate-400 mt-12">
                  {isAr ? 'تستغرق الخطوات حوالي دقيقتين' : 'Approximately two minutes'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ============ Steps 1..4 ============ */}
          {step >= 1 && step <= 4 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col md:flex-row flex-1 overflow-hidden"
            >
              {/* Left rail: progress */}
              <div className="bg-slate-900 text-white p-8 md:w-72 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-8">
                    <Logo size={32} className="rounded-xl" />
                    <span className="font-bold text-lg tracking-tight">SooVoice</span>
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {isAr ? 'خطوات الإعداد' : 'Setup'}
                  </p>

                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((s) => (
                      <div key={s} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all ${
                          step === s
                            ? 'bg-white text-slate-900 border-white shadow-md'
                            : step > s
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-600 text-slate-400'
                        }`}>
                          {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                        </div>
                        <div className="text-xs font-medium text-slate-200">{stepLabels[s]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-mono mt-8 relative z-10">
                  SooVoice
                </div>
              </div>

              {/* Right: step content */}
              <div className="flex-1 p-8 md:p-10 flex flex-col justify-between overflow-y-auto bg-slate-50/30">
                <div className="mb-6">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full">
                    {isAr ? `الخطوة ${step} من 4` : `Step ${step} of 4`}
                  </span>

                  {/* ============ Step 1: Identity ============ */}
                  {step === 1 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <ConciergeBell className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-800">
                          {isAr ? 'أخبرنا عن مطعمك' : 'Tell us about your restaurant'}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                        {isAr
                          ? 'الاسم الذي تكتبه هنا يظهر لضيوفك على المنيو والـ QR. اختر ما يُعبّر عن مطعمك كما تُحب أن يُذكر.'
                          : 'The name you write here appears to your guests on the menu and QR stand. Choose what expresses your restaurant as you wish it to be remembered.'}
                      </p>

                      <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-600 mb-2">
                          {isAr ? 'اسم المطعم' : 'Restaurant name'}
                        </label>
                        <input
                          type="text"
                          value={restaurantName}
                          onChange={(e) => setRestaurantName(e.target.value)}
                          placeholder={isAr ? 'مثال: مطعم الأصالة' : 'e.g. Asala'}
                          className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-base font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-3">
                          {isAr ? 'شخصية المطعم' : 'Restaurant character'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {CHARACTER_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = character === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setCharacter(opt.id);
                                  localStorage.setItem('restaurant_character', opt.id);
                                }}
                                className={`text-start p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                                  isSelected
                                    ? 'border-indigo-600 bg-white shadow-md ring-1 ring-indigo-600'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <Icon className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-slate-800 text-sm">
                                    {isAr ? opt.titleAr : opt.titleEn}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                    {isAr ? opt.descAr : opt.descEn}
                                  </p>
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============ Step 2: Dialect ============ */}
                  {step === 2 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <Languages className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-800">
                          {isAr ? 'بأي لهجة يتحدث مساعدك؟' : 'In which dialect will your assistant speak?'}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                        {isAr
                          ? 'اختر اللهجة التي يسمعها ضيوفك كل يوم. تستطيع تغييرها لاحقًا.'
                          : 'Choose the dialect your guests hear every day. You can change it later.'}
                      </p>

                      <div className="space-y-3">
                        {DIALECTS.map((item) => {
                          const isSelected = dialect === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setDialect(item.id)}
                              className={`w-full text-start border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between bg-white ${
                                isSelected
                                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <Languages className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm">
                                    {isAr ? item.nameAr : item.nameEn}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-serif italic mt-0.5">
                                    {isAr ? `"${item.sampleAr}"` : `"${item.sampleEn}"`}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="radio"
                                name="dialect"
                                checked={isSelected}
                                onChange={() => setDialect(item.id)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ============ Step 3: Voice tone ============ */}
                  {step === 3 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <Volume2 className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-800">
                          {isAr ? 'اختر نبرة الصوت' : 'Choose the voice tone'}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                        {isAr
                          ? 'الصوت الذي يسمعه ضيوفك. يمكن تغييره لاحقًا من الإعدادات.'
                          : 'The voice your guests will hear. You can change it later in Settings.'}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VOICES.map((item) => {
                          const isSelected = voiceTone === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setVoiceTone(item.id)}
                              className={`text-start border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between bg-white ${
                                isSelected
                                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                  isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <Volume2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{item.id}</h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {isAr ? item.genderAr : item.genderEn}
                                  </p>
                                </div>
                              </div>
                              <input
                                type="radio"
                                name="voiceTone"
                                checked={isSelected}
                                onChange={() => setVoiceTone(item.id)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ============ Step 4: Embed + Finish ============ */}
                  {step === 4 && (
                    <div className="mt-6 max-h-[50vh] overflow-y-auto pe-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-800">
                          {isAr ? 'مطعمك جاهز' : 'Your restaurant is ready'}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
                        {isAr
                          ? 'انسخ الكود التالي وضعه على موقعك. هذا هو الجسر بين الطاولة ومساعدك الصوتي.'
                          : 'Copy the snippet below and paste it on your website. This is the bridge between the table and your voice assistant.'}
                      </p>

                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Code className="w-4 h-4 text-slate-500" />
                            {isAr ? 'كود التضمين' : 'Embed snippet'}
                          </label>
                          <button
                            onClick={handleCopy}
                            className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors cursor-pointer"
                          >
                            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? (isAr ? 'تم النسخ' : 'Copied!') : (isAr ? 'نسخ الكود' : 'Copy code')}
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-300 p-4 rounded-2xl text-[10px] font-mono overflow-x-auto border border-slate-800 max-h-32">
                          <code>{embedCode}</code>
                        </pre>
                      </div>

                      <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">
                              {isAr ? 'جرّب المساعد قبل الحفظ؟' : 'Test the assistant before saving?'}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {isAr ? 'افتح الأداة وتحدث معها للتأكد من اللهجة والصوت.' : 'Open the widget and speak to it to confirm the dialect and voice.'}
                            </p>
                          </div>
                          <button
                            onClick={() => setTestActive(!testActive)}
                            className={`text-xs font-bold px-4 py-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                              testActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5" />
                            {testActive
                              ? (isAr ? 'إخفاء' : 'Hide')
                              : (isAr ? 'تجربة' : 'Test')}
                          </button>
                        </div>

                        {testActive && (
                          <div className="mt-4 p-4 border border-indigo-100 bg-indigo-50/30 rounded-2xl text-center flex flex-col items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-xs font-semibold text-indigo-900">
                              {isAr
                                ? 'الأداة نشطة. اضغط الميكروفون بالأسفل لبدء الحديث.'
                                : 'Active preview. Click the microphone below to start.'}
                            </span>
                            <div className="fixed bottom-6 right-6 z-[20000]">
                              <VoiceWidget />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer controls */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-4">
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border transition-all border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {isAr ? 'السابق' : 'Previous'}
                  </button>

                  {step < 4 ? (
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 cursor-pointer"
                    >
                      {isAr ? 'التالي' : 'Next'}
                      <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinish}
                      className="flex items-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-200 cursor-pointer"
                    >
                      {isAr ? 'حفظ والانتقال للوحة' : 'Save & go to dashboard'}
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
