import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Mic, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export function Auth() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConfigured, source } = getSupabaseConfig();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isConfigured) {
        const supabase = getSupabase();
        if (supabase) {
          // Trigger Supabase Google Login
          const { error: sbError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin + '/app'
            }
          });
          if (sbError) throw sbError;
        }
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        navigate('/app');
      }
    } catch (err: any) {
      console.error(err);
      
      let errorMessage = language === 'ar' ? 'فشل تسجيل الدخول. حاول مرة أخرى.' : 'Authentication failed. Please try again.';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = language === 'ar' ? 'تم إغلاق نافذة تسجيل الدخول. يرجى المحاولة مرة أخرى.' : 'Sign-in popup was closed. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = language === 'ar' ? 'تم حظر نافذة منبثقة بواسطة المتصفح. يرجى السماح بالنوافذ المنبثقة.' : 'Popup disabled by browser. Please allow popups for this site.';
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
            {isConfigured ? 'SUPABASE ACTIVE' : 'FIREBASE ACTIVE'}
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
          
          <p className="text-sm text-slate-500 mb-6 text-center">
             {language === 'ar' 
               ? (isConfigured ? 'مستعد للاتصال بـ Supabase الخاص بك' : 'الرجاء الدخول بواسطة حساب جوجل الخاص بك')
               : (isConfigured ? 'Ready to connect to your Supabase instance' : 'Please sign in using your Google account')}
          </p>

          <div className="w-full space-y-3">
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

            {/* Quick Demo Login Button */}
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
              {language === 'ar' ? 'دخول سريع للتجربة والمراجعة' : 'Quick Demo Sign-In'}
            </button>
          </div>

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
