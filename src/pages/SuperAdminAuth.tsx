import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldAlert, KeyRound, Eye, EyeOff, Lock } from 'lucide-react';
import { motion } from 'motion/react';

const ADMIN_SECRET_CODE = import.meta.env.VITE_ADMIN_SECRET_CODE || "soovoice-super-2026";

export function SuperAdminAuth() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      if (code === ADMIN_SECRET_CODE) {
        localStorage.setItem('superadmin_session', 'true');
        localStorage.setItem('superadmin_login_time', Date.now().toString());
        navigate('/admin');
      } else {
        setError(language === 'ar' ? 'كود خاطئ. تم رفض الوصول.' : 'Invalid code. Access denied.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-800"
      >
        {/* Header */}
        <div className="p-8 text-center bg-gradient-to-b from-rose-600/20 to-transparent relative">
          <div className="flex justify-center mb-4">
            <div className="bg-rose-500/20 p-4 rounded-2xl border border-rose-500/30">
              <ShieldAlert className="h-10 w-10 text-rose-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {language === 'ar' ? 'لوحة الإدارة العليا' : 'Super Admin Access'}
          </h2>
          <p className="text-slate-400 text-sm">
            {language === 'ar' 
              ? 'أدخل الكود السري للوصول إلى لوحة تحكم النظام' 
              : 'Enter the secret code to access the system control panel'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg text-center"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              {language === 'ar' ? 'الكود السري' : 'Secret Code'}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={language === 'ar' ? '••••••••••••' : '••••••••••••'}
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 pl-11 pr-11 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-500/20 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {language === 'ar' ? 'جاري التحقق...' : 'Verifying...'}
              </span>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                {language === 'ar' ? 'دخول لوحة الإدارة' : 'Enter Admin Panel'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-slate-500 hover:text-slate-300 text-sm font-medium py-2 transition-colors"
          >
            {language === 'ar' ? 'العودة للواجهة' : 'Back to homepage'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
