import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Mic, Github } from 'lucide-react';

export function PublicLayout() {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [clickCount, setClickCount] = React.useState(0);

  React.useEffect(() => {
    if (clickCount > 0) {
      const timer = setTimeout(() => setClickCount(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 5) {
      setClickCount(0);
      navigate('/admin-auth');
    } else if (newCount === 1 && location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleScrollToFeatures = (e: React.MouseEvent) => {
    if (location.pathname !== '/') {
       // If not on the home page, act as a normal link to take user home first
       return;
    }
    e.preventDefault();
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col text-slate-900">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 transition-all">
        <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2 select-none" title={language === 'ar' ? 'انقر 5 مرات للوصول للوحة الإدارة العليا' : 'Click 5 times for Super Admin'}>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-200 shadow-lg">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">VoiceAI</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
          <a href="/#features" onClick={handleScrollToFeatures} className="hover:text-indigo-600 transition-colors">
            {language === 'ar' ? 'المميزات' : 'Features'}
          </a>
          <Link to="/store" className="hover:text-indigo-600 transition-colors">
            {language === 'ar' ? 'المتجر التجريبي' : 'Demo Store'}
          </Link>
          <Link to="/about" className="hover:text-indigo-600 transition-colors">
            {language === 'ar' ? 'من نحن' : 'About Us'}
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 bg-slate-100 rounded-md"
          >
            {language === 'en' ? 'عربي' : 'EN'}
          </button>
          <Link
            to="/auth"
            className="hidden sm:inline-flex bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
          >
            {language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 pt-20 pb-10 mt-auto">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="bg-indigo-500 p-2 rounded-xl">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">VoiceAI</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {language === 'ar' 
                ? 'الحل الأمثل لتمكين المتاجر من بيع المزيد باستخدام قوة الذكاء الاصطناعي الصوتي والمحادثات المباشرة.' 
                : 'The ultimate solution empowering robust commerce via AI-driven conversational voice agents.'}
            </p>
          </div>

          <div>
            <h4 className="text-slate-50 font-bold mb-4">{language === 'ar' ? 'المنتجات' : 'Product'}</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link to="/auth" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'تسجيل الدخول للتجار' : 'Merchant Login'}</Link></li>
              <li><Link to="/store" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'المركب التجريبي' : 'Store Sandbox'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-50 font-bold mb-4">{language === 'ar' ? 'الشركة' : 'Company'}</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link to="/about" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'من نحن' : 'About Us'}</Link></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'اتصل بنا' : 'Contact Sales'}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-50 font-bold mb-4">{language === 'ar' ? 'قانوني وأمان' : 'Legal & Security'}</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link to="/terms" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'شروط الخدمة' : 'Terms of Service'}</Link></li>
              <li><Link to="/privacy" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
              <li><Link to="/security" className="hover:text-indigo-400 transition-colors">{language === 'ar' ? 'الأمان' : 'Security'}</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} VoiceAI SaaS. {language === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-4 text-slate-400">
             <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
