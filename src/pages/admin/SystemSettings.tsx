import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Settings, Lock, AppWindow, Bell } from "lucide-react";
import { subscribeToSettings, updateSettings, SystemSettings } from "../../services/settings";

export function AdminSystemSettings() {
  const { language } = useLanguage();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSettings((data) => {
      setSettings(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleRegistration = async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      await updateSettings({ allowNewRegistrations: !settings.allowNewRegistrations });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleIntegration = async (key: keyof SystemSettings['integrations']) => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      await updateSettings({
        integrations: {
          ...settings.integrations,
          [key]: !settings.integrations[key]
        }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto flex justify-center items-center h-full">
         <p className="text-slate-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'إعدادات النظام العامة' : 'Global System Settings'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' ? 'قم بضبط إعدادات المنصة الأساسية التي تؤثر على جميع التجار.' : 'Configure core platform settings that affect all merchants.'}
        </p>
      </div>

      <div className="space-y-6 flex-1">
         {/* Authentication */}
         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-lg">
                <Lock className="w-5 h-5 text-slate-400" />
                {language === 'ar' ? 'إعدادات التوثيق الدخول' : 'Authentication Settings'}
            </h3>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div>
                        <div className="font-bold text-sm text-slate-700">{language === 'ar' ? 'السماح بالتسجيل الجديد' : 'Allow New Registrations'}</div>
                        <div className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'تفعيل أو إيقاف تسجيل التجار الجدد يدوياً.' : 'Enable or disable manual merchant signups.'}</div>
                    </div>
                    <button 
                       onClick={handleToggleRegistration}
                       disabled={saving}
                       className={`w-11 h-6 rounded-full relative transition-colors ${settings.allowNewRegistrations ? 'bg-indigo-600' : 'bg-slate-200'}${saving ? ' opacity-50' : ''}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${settings.allowNewRegistrations ? 'left-[calc(100%-22px)]' : 'left-0.5'}`}></div>
                    </button>
                </div>
            </div>
         </div>

         {/* Integrations Toggle */}
         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-lg">
                <AppWindow className="w-5 h-5 text-slate-400" />
                {language === 'ar' ? 'تطبيقات المتاجر (App Stores)' : 'Platform App Stores'}
            </h3>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                        <div className="font-bold text-sm text-slate-700">{language === 'ar' ? 'دمج منهمنك (MNMKNK)' : 'MNMKNK Integration'}</div>
                        <div className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'تفعيل أو إيقاف ربط المتاجر القادمة من MNMKNK.' : 'Enable or disable incoming merchants from MNMKNK.'}</div>
                    </div>
                    <button 
                       onClick={() => handleToggleIntegration('mnmknk')}
                       disabled={saving}
                       className={`w-11 h-6 rounded-full relative transition-colors ${settings.integrations?.mnmknk !== false ? 'bg-indigo-600' : 'bg-slate-200'}${saving ? ' opacity-50' : ''}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${settings.integrations?.mnmknk !== false ? 'left-[calc(100%-22px)]' : 'left-0.5'}`}></div>
                    </button>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                        <div className="font-bold text-sm text-slate-700">{language === 'ar' ? 'دمج Shopify' : 'Shopify Integration'}</div>
                        <div className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'قبول المتاجر القادمة من متجر شوبيفاي.' : 'Accept incoming merchants from Shopify via OAuth.'}</div>
                    </div>
                    <button 
                       onClick={() => handleToggleIntegration('shopify')}
                       disabled={saving}
                       className={`w-11 h-6 rounded-full relative transition-colors ${settings.integrations?.shopify !== false ? 'bg-indigo-600' : 'bg-slate-200'}${saving ? ' opacity-50' : ''}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${settings.integrations?.shopify !== false ? 'left-[calc(100%-22px)]' : 'left-0.5'}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                        <div className="font-bold text-sm text-slate-700">{language === 'ar' ? 'دمج منصة سلة' : 'Salla Integration'}</div>
                        <div className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'تفعيل تطبيق سلة للرد الآلي.' : 'Enable Salla app for automated voice agent.'}</div>
                    </div>
                    <button 
                       onClick={() => handleToggleIntegration('salla')}
                       disabled={saving}
                       className={`w-11 h-6 rounded-full relative transition-colors ${settings.integrations?.salla !== false ? 'bg-indigo-600' : 'bg-slate-200'}${saving ? ' opacity-50' : ''}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${settings.integrations?.salla !== false ? 'left-[calc(100%-22px)]' : 'left-0.5'}`}></div>
                    </button>
                </div>
            </div>
         </div>
      </div>
{/* 
      <div className="mt-8 text-center pb-8">
         <p className="text-sm text-green-600 font-bold bg-green-50 p-2 rounded-lg inline-block border border-green-200">
            {language === 'ar' 
               ? 'متصل بقاعدة البيانات الحية (Firestore)' 
               : 'Connected to live Firestore database'}
         </p>
      </div> */}

    </div>
  );
}
