import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  dir: 'ltr' | 'rtl';
}

export const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.overview': 'Overview',
    'nav.group.workspace': 'Operations',
    'nav.group.setup': 'Setup',
    'nav.conversations': 'Conversations',
    'nav.kitchen': 'Kitchen',
    'nav.kb': 'Restaurant Profile',
    'nav.settings': 'Settings',
    'nav.demo': 'Widget Demo',
    'nav.system': 'Account',
    'nav.integration': 'Connections',
    'nav.billing': 'Billing',
    'nav.profile.view': 'View profile',
    'header.search': 'Search conversations and knowledge base...',
    'dash.title': 'Overview',
    'dash.subtitle': 'Service performance and conversation insights for your venue.',
    'dash.stat.total': 'Total Conversations',
    'dash.stat.avg': 'Avg Response Time',
    'dash.stat.conv': 'Service Rate',
    'dash.stat.active': 'Active Guests',
    'dash.chart.vol': 'Conversations Volume',
    'dash.chart.trend': 'Service Trend',
    'dash.stream.title': 'Live Activity',
    'conv.title': 'Conversations',
    'conv.subtitle': 'Review voice interactions, transcripts, and outcomes.',
    'conv.filter.all': 'All Conversations',
    'conv.filter.resolved': 'Resolved',
    'conv.filter.transfer': 'Escalated to Staff',
    'conv.filter.converted': 'Completed',
    'conv.btn.export': 'Export CSV',
    'kb.title': 'Restaurant Profile',
    'kb.subtitle': 'The information your voice assistant relies on to answer guests accurately — menu details, hours, policies, and frequently asked questions.',
    'settings.title': 'Settings',
    'settings.subtitle': 'Restaurant profile, menu experience, and access controls.',
    'widget.idle': 'How may I assist you?',
    'widget.listening': 'Listening...',
    'widget.thinking': 'One moment...',
    'widget.speaking': 'Speaking...',
    'widget.tap': 'Tap to speak',
    'widget.agent': 'Assistant',
    'landing.title': 'A refined voice service for discerning venues',
    'landing.subtitle': 'A discreet voice assistant that welcomes guests, answers questions about your menu, and recommends dishes — at the table, on demand.',
    'landing.cta': 'Access Dashboard',
    'landing.features.title': 'Built for hospitality',
    'landing.feat1.title': 'Discreet integration',
    'landing.feat1.desc': 'Add a single script and the assistant is live at your tables in minutes.',
    'landing.feat2.title': 'Guests order with ease',
    'landing.feat2.desc': 'Diners ask naturally and receive accurate, course-by-course guidance.',
    'landing.feat3.title': 'Always composed',
    'landing.feat3.desc': 'A measured, on-brand voice responds instantly — never rushed, never off-script.',
    'landing.how.title': 'How to integrate with your website',
    'landing.how.subtitle': 'Paste this snippet just before the closing </body> tag of your website.',
  },
  ar: {
    'nav.overview': 'نظرة عامة',
    'nav.group.workspace': 'التشغيل',
    'nav.group.setup': 'الإعداد',
    'nav.conversations': 'المحادثات',
    'nav.kitchen': 'المطبخ',
    'nav.kb': 'معلومات المطعم',
    'nav.settings': 'الإعدادات',
    'nav.demo': 'تجربة الودجت',
    'nav.system': 'الحساب',
    'nav.integration': 'الربط',
    'nav.billing': 'الفواتير',
    'nav.profile.view': 'عرض الملف الشخصي',
    'header.search': 'ابحث في المحادثات وقاعدة المعرفة...',
    'dash.title': 'نظرة عامة',
    'dash.subtitle': 'أداء الخدمة ومؤشرات المحادثات في منشأتك.',
    'dash.stat.total': 'إجمالي المحادثات',
    'dash.stat.avg': 'متوسط زمن الاستجابة',
    'dash.stat.conv': 'معدل الخدمة',
    'dash.stat.active': 'الضيوف النشطون',
    'dash.chart.vol': 'حجم المحادثات',
    'dash.chart.trend': 'اتجاه الخدمة',
    'dash.stream.title': 'النشاط المباشر',
    'conv.title': 'المحادثات',
    'conv.subtitle': 'راجع تفاعلات الضيوف الصوتية والنصوص والنتائج.',
    'conv.filter.all': 'كل المحادثات',
    'conv.filter.resolved': 'تمت الإجابة',
    'conv.filter.transfer': 'حوّلها للموظفين',
    'conv.filter.converted': 'مكتملة',
    'conv.btn.export': 'تصدير CSV',
    'kb.title': 'معلومات المطعم',
    'kb.subtitle': 'البيانات التي يعتمد عليها المساعد الصوتي للإجابة بدقة عن قائمتك ومواعيدك وسياساتك والأسئلة المتكررة.',
    'settings.title': 'الإعدادات',
    'settings.subtitle': 'بيانات المطعم، تجربة المنيو، وتحكم الوصول.',
    'widget.idle': 'كيف أقدر أساعدك؟',
    'widget.listening': 'أستمع...',
    'widget.thinking': 'لحظة...',
    'widget.speaking': 'أتحدث...',
    'widget.tap': 'اضغط للتحدث',
    'widget.agent': 'المساعد',
    'landing.title': 'خدمة صوتية راقية للمطاعم المتميزة',
    'landing.subtitle': 'مساعد صوتي متقن يستقبل ضيوفك ويجيب عن المنيو ويرشّح الأطباق — على الطاولة، عند الطلب.',
    'landing.cta': 'الدخول إلى لوحة التحكم',
    'landing.features.title': 'مصمّم لضيافة المطاعم',
    'landing.feat1.title': 'ربط متقن',
    'landing.feat1.desc': 'أضف كودًا واحدًا ويعمل المساعد على طاولاتك خلال دقائق.',
    'landing.feat2.title': 'تجربة ضيوف أسلس',
    'landing.feat2.desc': 'الضيف يسأل بطبيعته ويسمع إجابة دقيقة عن كل طبق.',
    'landing.feat3.title': 'هدوء واحتراف',
    'landing.feat3.desc': 'صوت متّزن يستجيب فورًا — بلا استعجال ولا خروج عن النص.',
    'landing.how.title': 'كيف تربط النظام بموقعك',
    'landing.how.subtitle': 'انسخ هذا الكود وضعه قبل إغلاق وسم </body> في موقعك.',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('appLang') as Language) || 'ar';
  });
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    localStorage.setItem('appLang', language);
  }, [dir, language]);

  const t = (key: string, fallback?: string) => {
    return translations[language]?.[key] || translations['en'][key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
