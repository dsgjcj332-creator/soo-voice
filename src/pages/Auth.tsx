import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { Logo } from '../components/brand/Logo';

export function Auth() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConfigured, source } = getSupabaseConfig();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const isArabic = language === 'ar';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    if (mode === 'signup' && !name.trim()) {
      setError(isArabic ? 'اكتب اسمك أولاً.' : 'Please enter your name first.');
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      if (!supabase) {
        setError(isArabic ? 'التسجيل غير متاح حالياً. جرّب الدخول للتجربة.' : 'Sign up is not available yet. Try the demo instead.');
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        navigate('/app');
        return;
      }

      // Preferred path: an edge function that skips email confirmation (if
      // deployed on the Supabase project). Fallback: native Supabase signup,
      // which works on any project — if email confirmation is enabled there,
      // the visitor gets the friendly "confirm your email" message below.
      const { url } = getSupabaseConfig();
      let accountCreated = false;
      try {
        const signupResponse = await fetch(`${url}/functions/v1/signup-test-no-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, fullName: name.trim() }),
        });
        if (signupResponse.ok) {
          accountCreated = true;
        } else {
          const signupResult = await signupResponse.json().catch(() => null);
          const msg = String(signupResult?.error || '').toLowerCase();
          const missing = signupResponse.status === 404 || signupResponse.status === 405
            || msg.includes('not found') || msg.includes('no function');
          // Surface real validation errors; only fall back when the function
          // itself is not deployed on this Supabase project.
          if (!missing) {
            throw new Error(signupResult?.error || 'signup_failed');
          }
        }
      } catch (fetchErr: any) {
        // Network failure reaching the edge function → native signup fallback.
        if (!(fetchErr instanceof TypeError)) throw fetchErr;
      }

      if (!accountCreated) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
      }

      // Native signup already returns a session when confirmation is disabled.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      navigate('/app');
    } catch (err: any) {
      const message = String(err?.message || '').toLowerCase();
      if (message.includes('email') && (message.includes('confirm') || message.includes('verified'))) {
        setError(isArabic ? 'أكد بريدك الإلكتروني من الرسالة المرسلة إليك.' : 'Please confirm your email from the message we sent you.');
      } else if (message.includes('invalid') || message.includes('credential') || message.includes('password')) {
        setError(isArabic ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
      } else if (message.includes('already registered') || message.includes('already exists')) {
        setError(isArabic ? 'البريد الإلكتروني مسجل بالفعل. سجّل الدخول بدلاً من ذلك.' : 'This email is already registered. Try signing in instead.');
      } else {
        setError(isArabic ? 'حدث خطأ غير متوقع. حاول مرة أخرى.' : 'Something unexpected happened. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const demoUser = { uid: 'demo-merchant-local', email: 'demo@soovoice.app', displayName: 'SooVoice Demo', photoURL: null, provider: 'local' as const };
    localStorage.setItem('local_demo_user', JSON.stringify(demoUser));
    window.location.assign('/app');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <header className="relative bg-indigo-600 px-7 pb-8 pt-7 text-center text-white">
          <div className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-mono">
            <ShieldCheck className="h-3 w-3" /> {isConfigured ? 'SUPABASE ACTIVE' : 'SETUP MODE'}
          </div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Logo size={38} /></div>
          <h1 className="text-2xl font-bold">{isArabic ? 'مرحباً بك في SooVoice' : 'Welcome to SooVoice'}</h1>
          <p className="mt-2 text-sm text-indigo-100">{isArabic ? 'ابدأ بإدارة مساعدك الصوتي بسهولة' : 'Manage your voice assistant with ease'}</p>
        </header>

        <section className="p-7">
          {error && <div className="mb-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => { setMode('signin'); setError(null); }} className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{isArabic ? 'تسجيل الدخول' : 'Sign in'}</button>
            <button type="button" onClick={() => { setMode('signup'); setError(null); }} className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>{isArabic ? 'تسجيل جديد' : 'Create account'}</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && <input aria-label={isArabic ? 'الاسم' : 'Name'} required value={name} onChange={(event) => setName(event.target.value)} placeholder={isArabic ? 'الاسم الكامل' : 'Full name'} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />}
            <input aria-label={isArabic ? 'البريد الإلكتروني' : 'Email'} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isArabic ? 'البريد الإلكتروني' : 'Email address'} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <input aria-label={isArabic ? 'كلمة المرور' : 'Password'} required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isArabic ? 'كلمة المرور (6 أحرف على الأقل)' : 'Password (at least 6 characters)'} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? (isArabic ? 'جاري المعالجة...' : 'Processing...') : mode === 'signin' ? (isArabic ? 'دخول' : 'Sign in') : (isArabic ? 'إنشاء الحساب' : 'Create account')}<ArrowRight className="h-4 w-4" /></button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-100" />{isArabic ? 'أو' : 'OR'}<div className="h-px flex-1 bg-slate-100" /></div>
          <button type="button" disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-400" title={isArabic ? 'سيتم تفعيله قريباً' : 'Coming soon'}><span className="text-lg font-bold">G</span>{isArabic ? 'التسجيل باستخدام Google (قريباً)' : 'Continue with Google (Coming soon)'}<Clock3 className="h-4 w-4" /></button>

          <div className="my-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-center text-xs font-semibold text-slate-500">{isArabic ? 'تريد تجربة النظام أولاً؟' : 'Want to explore first?'}</p>
            <button type="button" onClick={handleDemoLogin} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white transition hover:bg-slate-800"><Sparkles className="h-4 w-4 text-amber-400" />{isArabic ? 'دخول للتجربة' : 'Enter demo'}</button>
            <p className="mt-2 text-center text-[11px] text-slate-400">{isArabic ? 'تجربة محلية بدون إنشاء حساب' : 'Local demo without creating an account'}</p>
          </div>
          {isConfigured && <p className="text-center text-[10px] font-mono text-slate-400">Connecting via: {source}</p>}
        </section>
      </div>
    </main>
  );
}
