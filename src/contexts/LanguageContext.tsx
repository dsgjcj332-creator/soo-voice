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
    'nav.conversations': 'Conversations',
    'nav.kb': 'AI Brain & Profile',
    'nav.settings': 'Settings',
    'nav.demo': 'Widget Demo',
    'nav.system': 'System',
    'nav.integration': 'Integration',
    'nav.billing': 'Billing',
    'nav.profile.view': 'View profile',
    'header.search': 'Search conversations, knowledge base...',
    'dash.title': 'Dashboard Overview',
    'dash.subtitle': 'Monitor your Voice AI performance and conversation metrics.',
    'dash.stat.total': 'Total Conversations',
    'dash.stat.avg': 'Avg Resolution Time',
    'dash.stat.conv': 'Conversion Rate',
    'dash.stat.active': 'Active Users',
    'dash.chart.vol': 'Conversations Volume',
    'dash.chart.trend': 'Conversion Trend',
    'dash.stream.title': 'Live Activity Stream',
    'conv.title': 'Conversations',
    'conv.subtitle': 'Review past voice interactions, listen to recordings, and analyze transcripts.',
    'conv.filter.all': 'All Conversations',
    'conv.filter.resolved': 'Resolved',
    'conv.filter.transfer': 'Transferred to Human',
    'conv.filter.converted': 'Converted',
    'conv.btn.export': 'Export CSV',
    'kb.title': 'AI Brain & Profile',
    'kb.subtitle': 'Structure your business details, custom FAQs, and knowledge base files so your AI Voice assistant is fully informed and highly precise.',
    'settings.title': 'Widget Settings',
    'settings.subtitle': 'Customize how the Voice AI widget appears and sounds on your website.',
    'widget.idle': 'How can I help you today?',
    'widget.listening': 'Listening...',
    'widget.thinking': 'Thinking...',
    'widget.speaking': 'Speaking...',
    'widget.tap': 'Tap mic to reply',
    'widget.agent': 'Voice Agent',
    'landing.title': 'Transform Your eCommerce with Voice AI',
    'landing.subtitle': 'Let your customers shop, add to cart, and checkout simply by speaking. Integrate our Voice AI widget into your website in minutes.',
    'landing.cta': 'Go to Dashboard',
    'landing.features.title': 'Why choose our Voice AI?',
    'landing.feat1.title': 'Seamless Integration',
    'landing.feat1.desc': 'Add a simple script tag to your site and go live instantly.',
    'landing.feat2.title': 'Higher Conversion',
    'landing.feat2.desc': 'Reduce friction. Customers buy faster by just asking.',
    'landing.feat3.title': 'Live AI Agent',
    'landing.feat3.desc': 'Powered by Gemini for ultra-low latency contextual answers.',
    'landing.how.title': 'How to integrate in your website',
    'landing.how.subtitle': 'Paste this snippet just before the closing </body> tag of your website.',
  },
  ar: {
    'nav.overview': 'نظرة عامة',
    'nav.conversations': 'المحادثات',
    'nav.kb': 'ملف ومعلومات الشركة',
    'nav.settings': 'الإعدادات',
    'nav.demo': 'تجربة الودجت',
    'nav.system': 'النظام',
    'nav.integration': 'الربط البرمجي',
    'nav.billing': 'الفواتير',
    'nav.profile.view': 'عرض الملف الشخصي',
    'header.search': 'ابحث في المحادثات وقاعدة المعرفة...',
    'dash.title': 'نظرة عامة',
    'dash.subtitle': 'راقب أداء مساعد الذكاء الاصطناعي وإحصائيات المحادثات.',
    'dash.stat.total': 'إجمالي المحادثات',
    'dash.stat.avg': 'متوسط وقت الاستجابة',
    'dash.stat.conv': 'معدل التحويل',
    'dash.stat.active': 'المستخدمين النشطين',
    'dash.chart.vol': 'حجم المحادثات',
    'dash.chart.trend': 'اتجاه التحويل',
    'dash.stream.title': 'سجل النشاطات المباشر',
    'conv.title': 'المحادثات',
    'conv.subtitle': 'راجع المحادثات الصوتية السابقة واستمع إلى التسجيلات.',
    'conv.filter.all': 'كل المحادثات',
    'conv.filter.resolved': 'تم حلها',
    'conv.filter.transfer': 'محولة للموظفين',
    'conv.filter.converted': 'مبيعات',
    'conv.btn.export': 'تصدير CSV',
    'kb.title': 'ملف ومعلومات الشركة الذكي',
    'kb.subtitle': 'قم بصياغة ملف شركتك، الأسئلة الشائعة والأجوبة الدقيقة، وملفات المعرفة لتجعل مساعدك الصوتي شديد الدقة والإحاطة ولا يخرج عن الحدود.',
    'settings.title': 'إعدادات الودجت',
    'settings.subtitle': 'قم بتخصيص مظهر وشخصية وصوت المساعد الذكي.',
    'widget.idle': 'أهلاً بك، كيف يمكنني مساعدتك؟',
    'widget.listening': 'أستمع إليك...',
    'widget.thinking': 'أفكر...',
    'widget.speaking': 'أتحدث...',
    'widget.tap': 'اضغط للتحدث',
    'widget.agent': 'المساعد الصوتي',
    'landing.title': 'حوّل متجرك الإلكتروني باستخدام الذكاء الاصطناعي الصوتي',
    'landing.subtitle': 'اسمح لعملائك بالتسوق وإضافة المنتجات للسلة وإتمام الدفع بمجرد التحدث. اربط ودجت الصوت بموقعك في دقائق.',
    'landing.cta': 'الذهاب للوحة التحكم',
    'landing.features.title': 'لماذا المساعد الصوتي؟',
    'landing.feat1.title': 'ربط سلس وسريع',
    'landing.feat1.desc': 'أضف كود من سطر واحد لموقعك وابدأ فوراً.',
    'landing.feat2.title': 'مبيعات أكثر بجهد أقل',
    'landing.feat2.desc': 'العميل يشتري أسرع عندما يطلب ما يريد بصوته مباشرة.',
    'landing.feat3.title': 'مساعد ذكي مباشر',
    'landing.feat3.desc': 'مدعوم بمحرك Gemini للإجابة السريعة وفهم نية العميل بدقة.',
    'landing.how.title': 'كيف تربط النظام بموقعك',
    'landing.how.subtitle': 'انسخ هذا الكود وضعه قبل إغلاق وسم </body> في موقعك.',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('appLang') as Language) || 'en';
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
