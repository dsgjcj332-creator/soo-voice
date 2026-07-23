import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Mic, ShieldCheck, Sparkles, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

type AuthMode = 'login' | 'signup';

export function Auth() {
  const { language } = useLanguage();
  const { demoLogin, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isConfigured, source } = getSupabaseConfig();

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      
      if (isConfigured) {
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
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError(language === 'ar' ? 'الرجاء إدخال الاسم' : 'Please enter your name');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name.trim(), email, password);
      }
      navigate('/app');
    } catch (err: any) {
      console.error(err);
      let errorMessage = language === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Please try again.';

      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = language === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = language === 'ar' ? 'هذا البريد الإلكتروني مسجل بالفعل' : 'This email is already registered';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = language === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = language === 'ar' ? 'كلمة المرور ضعيفة جداً' : 'Password is too weak';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = language === 'ar' ? 'محاولات كثيرة. حاول لاحقاً' : 'Too many attempts. Try again later';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    demoLogin();
    navigate('/app');
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-6 sm:p-8 text-center bg-indigo-600 text-white relative">
          <div className="absolute top-4 right-4 bg-white/10 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" />
            {isConfigured ? 'SUPABASE' : 'FIREBASE'}
          </div>
          
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Mic className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">
            {language === 'ar' ? 'مرحباً بك في VoiceAI' : 'Welcome to VoiceAI'}
          </h2>
          <p className="text-indigo-200 text-sm">
            {language === 'ar' 
              ? 'سجل دخولك لإدارة مساعدك الصوتي' 
              : 'Sign in to manage your voice agent'}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-4 w-full p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center leading-relaxed">
              {error}
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                mode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {language === 'ar' ? 'حساب جديد' : 'Sign Up'}
            </button>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  {language === 'ar' ? 'الاسم' : 'Name'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'ar' ? 'اسمك الكامل' : 'Your full name'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === 'ar' ? 'you@example.com' : 'you@example.com'}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'ar' ? '••••••••' : '••••••••'}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                </>
              ) : (
                mode === 'login' 
                  ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')
                  : (language === 'ar' ? 'إنشاء حساب' : 'Create Account')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">
              {language === 'ar' ? 'أو' : 'OR'}
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer disabled:opacity-60 mb-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading 
              ? (language === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...') 
              : (language === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google')}
          </button>

          {/* Demo Login */}
          <button
            onClick={handleDemoLogin}
            disabled={loading || googleLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-5 h-5 text-amber-400" />
            {language === 'ar' ? 'دخول سريع للتجربة' : 'Quick Demo Sign-In'}
          </button>

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
