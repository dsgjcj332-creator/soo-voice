import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Mic, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export function Auth() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConfigured, source } = getSupabaseConfig();

  const [mode, setMode] = useState<'demo' | 'email'>('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleEmailLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      if (!supabase) {
        setError(language === 'ar' ? 'Supabase غير مهيأ' : 'Supabase is not configured');
        return;
      }

      if (mode === 'email') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate('/app');
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { displayName: name } },
      });
      if (signUpError) throw signUpError;
      setError(language === 'ar' ? 'تم إنشاء الحساب، يمكنك تسجيل الدخول الآن.' : 'Account created, you can sign in now.');
      setMode('email');
    } catch (err: any) {
      console.error(err);
      let errorMessage = language === 'ar' ? 'فشل المصادقة. حاول مرة أخرى.' : 'Authentication failed. Please try again.';
      if (err.message) errorMessage = err.message;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabase = getSupabase();
      if (supabase) {
        const { error: sbError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/app'
          }
        });
        if (sbError) throw sbError;
      }
    } catch (err: any) {
      console.error(err);
      
      let errorMessage = language === 'ar' ? 'فشل تسجيل الدخول. حاول مرة أخرى.' : 'Authentication failed. Please try again.';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = language === 'ar' ? 'تم إغلاق نافذة تسجيل الدخول. يرجى المحاولة مرة أخرى.' : 'Sign-in popup was closed. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = language === 'ar' ? 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة للموقع.' : 'Popup blocked by browser. Please allow popups.';
      } else if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        errorMessage = language === 'ar'
          ? `النطاق "${domain}" غير مسجل. تأكد من إضافة النطاق في إعدادات Supabase أو استخدم الدخول السريع.`
          : `Domain "${domain}" is not authorized. Make sure it's added in Supabase Auth settings or use Quick Demo Sign-In.`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick Developer Demo Login - local only, no backend required
  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const demoUser = {
        uid: 'demo-merchant-local',
        email: 'demo@voiceai.com',
        displayName: 'Demo Merchant',
        photoURL: null,
        provider: 'local' as const,
      };
      localStorage.setItem('local_demo_user', JSON.stringify(demoUser));
      navigate('/app');
    } catch (err: any) {
      console.error(err);
      setError(language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 text-center bg-indigo-600 text-white relative">
          <div className="absolute top-4 right-4 bg-white/10 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" />
            {isConfigured ? 'SUPABASE ACTIVE' : 'LOCAL MODE'}
          </div>
          
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Mic className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'مرحباً بك في VoiceAI' : 'Welcome to VoiceAI'}
          </h2>
          <p className="text-indigo-200 text-sm">
            {language === 'ar' 
              ? 'سجل دخولك لإدارة مساعدك الصوتي' 
              : 'Sign in to manage your voice agent'}
          </p>
        </div>

        <div className="p-8 flex flex-col items-center">
          {error && (
            <div className="mb-4 w-full p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center leading-relaxed">
              {error}
            </div>
          )}
          
          {/* Auth Mode Tabs */}
          <div className="w-full flex gap-2 mb-4">
            <button
              onClick={() => setMode('demo')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${mode === 'demo' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {language === 'ar' ? 'تجربة محلية' : 'Local Demo'}
            </button>
            <button
              onClick={() => setMode('email')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${mode === 'email' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {language === 'ar' ? 'بريد إلكتروني' : 'Email'}
            </button>
          </div>

          {mode === 'demo' ? (
            <div className="w-full space-y-3">
              {/* Quick Demo Login - Primary for local/dev */}
              <button
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg cursor-pointer ring-2 ring-amber-400/50"
              >
                <Sparkles className="w-5 h-5 text-amber-400" />
                {loading 
                  ? (language === 'ar' ? 'جاري الدخول...' : 'Signing in...') 
                  : (language === 'ar' ? 'دخول سريع للتجربة والمراجعة' : 'Quick Demo Sign-In')}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                {language === 'ar' ? 'لا يحتاج حساب أو إنترنت. بيانات محفوظة على جهازك.' : 'No account needed. Data saved locally on your device.'}
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {mode === 'email' && !email && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'ar' ? 'الاسم (اختياري)' : 'Name (optional)'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email address'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleEmailLogin}
                disabled={loading || !email || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading 
                  ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') 
                  : (mode === 'email' 
                    ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In') 
                    : (language === 'ar' ? 'إنشاء حساب' : 'Create Account'))}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'email' ? 'signup' : 'email')}
                className="w-full text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                {mode === 'email'
                  ? (language === 'ar' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'No account? Create one')
                  : (language === 'ar' ? 'لديك حساب؟ سجل دخولك' : 'Have an account? Sign in')}
              </button>
            </div>
          )}

          {mode !== 'email' && (
            <div className="w-full mt-4">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>

              {/* Google Login - Secondary */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {loading 
                  ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') 
                  : (language === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google')}
              </button>
            </div>
          )}

          {isConfigured && (
            <p className="mt-4 text-[11px] text-slate-400 text-center font-mono">
              Connecting via: {source}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
