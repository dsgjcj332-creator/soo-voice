import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings, Currency } from '../contexts/SettingsContext';
import {
  Globe, Settings2, DollarSign, ExternalLink,
  Store, MapPin, Phone, Mic, MicOff, Timer, Navigation, ShieldCheck, CheckCircle2, Clock, Instagram, Facebook, MessageCircle, Save, Loader2, AlertCircle,
} from 'lucide-react';
import { CURRENCY_LIST } from '../lib/currency';
import { useStoreSettings, SESSION_MINUTES_OPTIONS, GEO_RADIUS_OPTIONS } from '../lib/storeSettings';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export function Settings() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { currency, setCurrency, saveSettings: savePreferences } = useSettings();
  const {
    settings: storeSettings,
    update: updateStoreSettings,
    save: saveStoreSettings,
  } = useStoreSettings(user?.uid, user?.provider !== 'local');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const updateStoreSettingsWithStatus = (patch: Parameters<typeof updateStoreSettings>[0]) => {
    updateStoreSettings(patch);
    setSaveStatus('idle');
  };

  const handleSaveSettings = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    const [storeSaved, preferencesSaved] = await Promise.all([
      saveStoreSettings(),
      savePreferences(),
    ]);
    setSaveStatus(storeSaved && preferencesSaved ? 'saved' : 'error');
  };

  // Geo capture status for the "use my location" flow
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'done' | 'error'>('idle');

  const isAr = language === 'ar';

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateStoreSettingsWithStatus({
          geoLat: Number(pos.coords.latitude.toFixed(6)),
          geoLng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoStatus('done');
        setTimeout(() => setGeoStatus('idle'), 2500);
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const sessionLabel = (m: number) => {
    if (m === 0) return isAr ? 'مفتوح دائماً' : 'Always open';
    if (m === 120) return isAr ? 'ساعتان' : '2 hours';
    return isAr ? `${m} دقائق` : `${m} min`;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {isAr ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr
            ? 'كل ما يخص متجرك: بيانات المطعم، تجربة المنيو للزبون، والتحكم في الوصول والصوت.'
            : 'Everything for your store: restaurant profile, menu experience, access control and voice.'}
        </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saveStatus === 'saving'}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveStatus === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveStatus === 'saving'
              ? (isAr ? 'جاري الحفظ...' : 'Saving...')
              : (isAr ? 'حفظ الإعدادات' : 'Save settings')}
          </button>
          {saveStatus === 'saved' && (
            <span role="status" className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {user?.provider === 'local'
                ? (isAr ? 'تم حفظ الإعدادات على هذا الجهاز' : 'Settings saved on this device')
                : (isAr ? 'تم تأكيد حفظ الإعدادات في حسابك' : 'Settings saved to your account')}
            </span>
          )}
          {saveStatus === 'error' && (
            <span role="alert" className="flex items-center gap-1 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {isAr ? 'الحفظ السحابي لم يتأكد. راجع الاتصال أو صلاحيات قاعدة البيانات وحاول تاني.' : 'Cloud save was not confirmed. Check connection and database permissions, then retry.'}
            </span>
          )}
        </div>
      </div>

      {/* ============ Restaurant Profile Card ============ */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isAr ? 'معلومات المطعم (هوية المتجر)' : 'Restaurant Profile'}
            </h2>
            <p className="text-sm text-slate-500">
              {isAr
                ? 'الاسم والبيانات دي تظهر للزبون في المنيو عند مسح الكود وعلى ستاند الـ QR.'
                : 'These details appear on the customer menu and the printed QR stand.'}
            </p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {isAr ? 'اسم المطعم (بالعربي)' : 'Restaurant name (Arabic)'}
            </label>
            <input
              type="text"
              value={storeSettings.restaurantName}
              onChange={(e) => updateStoreSettingsWithStatus({ restaurantName: e.target.value })}
              placeholder={isAr ? 'مثال: مطعم الأصالة' : 'e.g. El-Asala Restaurant'}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {isAr ? 'اسم المطعم (بالإنجليزي — اختياري)' : 'Restaurant name (English — optional)'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={storeSettings.restaurantNameEn}
              onChange={(e) => updateStoreSettingsWithStatus({ restaurantNameEn: e.target.value })}
              placeholder={isAr ? 'e.g. Asala Restaurant' : 'e.g. Asala Restaurant'}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Logo URL */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-slate-400" />
              {isAr ? 'رابط شعار المطعم (لوجو)' : 'Restaurant logo URL'}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="url"
                dir="ltr"
                value={storeSettings.logoUrl}
                onChange={(e) => updateStoreSettingsWithStatus({ logoUrl: e.target.value })}
                placeholder={isAr ? 'https://example.com/logo.png' : 'https://example.com/logo.png'}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              {storeSettings.logoUrl && (
                <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                  <img
                    src={storeSettings.logoUrl}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {isAr
                ? 'يظهر اللوجو في المنيو والفاتورة وستاند الـ QR. ضع رابط صورة مباشر.'
                : 'Appears on the menu, invoice, and QR stand. Paste a direct image URL.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-slate-400" />
              {isAr ? 'رقم الهاتف / الواتساب' : 'Phone / WhatsApp'}
            </label>
            <input
              type="tel"
              dir="ltr"
              value={storeSettings.phone}
              onChange={(e) => updateStoreSettingsWithStatus({ phone: e.target.value })}
              placeholder="+20 100 000 0000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              {isAr ? 'عنوان المطعم' : 'Restaurant address'}
            </label>
            <input
              type="text"
              value={storeSettings.address}
              onChange={(e) => updateStoreSettingsWithStatus({ address: e.target.value })}
              placeholder={isAr ? 'مثال: 15 شارع التحرير، الدقي، الجيزة' : '15 Tahreer St., Dokki, Giza'}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              {isAr ? 'مواعيد العمل' : 'Working hours'}
            </label>
            <input
              type="text"
              value={storeSettings.workingHours}
              onChange={(e) => updateStoreSettingsWithStatus({ workingHours: e.target.value })}
              placeholder={isAr
                ? 'مثال: يوميًا 12 ظهرًا – 12 منتصف الليل، الجمعة 2 – 12'
                : 'Daily 12pm–12am; Fridays 2pm–12am'}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              {isAr
                ? 'تظهر هذه المواعيد للضيف في المنيو، ويلتزم بها المساعد الصوتي عند سؤاله عنها.'
                : 'Shown to the guest on the menu; the voice assistant uses this when asked about hours.'}
            </p>
          </div>

          {/* Social / contact links */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Instagram className="w-4 h-4 text-slate-400" />
              {isAr ? 'إنستجرام' : 'Instagram'}
            </label>
            <input
              type="url"
              dir="ltr"
              value={storeSettings.instagram}
              onChange={(e) => updateStoreSettingsWithStatus({ instagram: e.target.value })}
              placeholder="https://instagram.com/your-restaurant"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Facebook className="w-4 h-4 text-slate-400" />
              {isAr ? 'فيسبوك' : 'Facebook'}
            </label>
            <input
              type="url"
              dir="ltr"
              value={storeSettings.facebook}
              onChange={(e) => updateStoreSettingsWithStatus({ facebook: e.target.value })}
              placeholder="https://facebook.com/your-restaurant"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-slate-400" />
              {isAr ? 'واتساب' : 'WhatsApp'}
            </label>
            <input
              type="text"
              dir="ltr"
              value={storeSettings.whatsapp}
              onChange={(e) => updateStoreSettingsWithStatus({ whatsapp: e.target.value })}
              placeholder="+20 100 000 0000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              {isAr
                ? 'تظهر هذه الروابط في أسفل المنيو أمام الضيف — اختياري تمامًا.'
                : 'These links appear at the bottom of the guest menu — all optional.'}
            </p>
          </div>

          <p className="md:col-span-2 text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {isAr
              ? 'يتم الاحتفاظ بالتعديلات محليًا فورًا، واضغط «حفظ الإعدادات» لتأكيد حفظها في حسابك السحابي.'
              : 'Edits are kept locally immediately. Select “Save settings” to confirm they are stored in your cloud account.'}
          </p>
        </div>
      </div>

      {/* ============ Voice studio shortcut ============ */}
      <Link
        to="/app/voice-studio"
        className="mt-8 bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex items-center justify-between gap-3 hover:bg-indigo-100 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-indigo-900">
              {isAr ? 'استوديو الصوت — اللهجة والنبرة' : 'Voice studio — dialect & voice tone'}
            </h2>
            <p className="text-sm text-indigo-700/80">
              {isAr
                ? 'اختر لهجة المساعد ونبرة الصوت، واسمعها قبل النشر.'
                : 'Choose the dialect and voice tone, and preview them before publishing.'}
            </p>
          </div>
        </div>
        <ExternalLink className="w-5 h-5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* ============ Table Experience & Access Control Card ============ */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isAr ? 'تجربة الطاولة والتحكم في الوصول' : 'Table Experience & Access Control'}
            </h2>
            <p className="text-sm text-slate-500">
              {isAr
                ? 'اضبط المنيو زي ما تحب بالظبط: الصوت، المدة، والنطاق الجغرافي حول المطعم.'
                : 'Fine-tune the menu exactly as you like: voice, session time, and geo-fence.'}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Voice waiter visibility */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              {storeSettings.showVoiceWidget ? (
                <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <Mic className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-10 w-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                  <MicOff className="h-5 w-5" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {isAr ? 'المساعد الصوتي على المنيو' : 'Voice assistant on the menu'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {isAr
                    ? 'لو أغلقت الخيار، المنيو يبقى يدوي فقط (تصفح فقط). تقدر تفتحه أو تقفله في أي وقت.'
                    : 'When off, the menu becomes manual-only (browse only). Toggle anytime.'}
                </p>
              </div>
            </div>
            <Toggle
              checked={storeSettings.showVoiceWidget}
              onChange={(v) => updateStoreSettingsWithStatus({ showVoiceWidget: v })}
            />
          </div>

          {/* Session duration */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-500" />
              {isAr ? 'مدة بقاء المنيو مفتوح بعد مسح الكود' : 'Menu stays open after scanning for'}
            </label>
            <p className="text-xs text-slate-500 mb-3">
              {isAr
                ? 'بعد انتهاء المدة، تظهر للزبون شاشة تنهي الجلسة ويحتاج مسح الكود من جديد.'
                : 'After the duration ends, guests see a session-expired screen and must scan the code again.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {SESSION_MINUTES_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateStoreSettingsWithStatus({ sessionMinutes: m })}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    storeSettings.sessionMinutes === m
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {sessionLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Geo-fence */}
          <div className="p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {isAr ? 'قفل النطاق الجغرافي (حول موقع المطعم)' : 'Geo-fence (around restaurant location)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {isAr
                      ? 'المنيو يفتح فقط للزبون اللي جوه النطاق المحدد حول موقع المطعم — يعني الكود يشتغل في المكان نفسه فقط.'
                      : 'The menu opens only for guests inside the selected radius around your restaurant — the code works on-site only.'}
                  </p>
                </div>
              </div>
              <Toggle
                checked={storeSettings.geoEnabled}
                disabled={!storeSettings.geoLat || !storeSettings.geoLng}
                onChange={(v) => updateStoreSettingsWithStatus({ geoEnabled: v })}
              />
            </div>

            {/* Location capture */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={captureLocation}
                disabled={geoStatus === 'locating'}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <MapPin className="w-4 h-4" />
                {geoStatus === 'locating'
                  ? (isAr ? 'جاري تحديد موقعك...' : 'Locating...')
                  : (isAr ? 'استخدم موقعي الحالي كموقع المطعم' : 'Use my current location')}
              </button>
              {storeSettings.geoLat != null && storeSettings.geoLng != null && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5" dir="ltr">
                  {storeSettings.geoLat.toFixed(5)}, {storeSettings.geoLng.toFixed(5)}
                </span>
              )}
              {geoStatus === 'done' && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {isAr ? 'تم حفظ الموقع' : 'Location saved'}
                </span>
              )}
              {geoStatus === 'error' && (
                <span className="text-[11px] font-bold text-red-500">
                  {isAr ? 'مش قادرين نحدد الموقع — اسمح بصلاحية الموقع للمتصفح وحاول تاني.' : 'Could not get location — allow browser location permission and retry.'}
                </span>
              )}
            </div>

            {/* Radius picker */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                {isAr ? 'نطاق الفتح حول المطعم' : 'Open radius around the restaurant'}
              </label>
              <div className="flex flex-wrap gap-2">
                {GEO_RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => updateStoreSettingsWithStatus({ geoRadiusKm: r })}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                      storeSettings.geoRadiusKm === r
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {r < 1 ? `${Math.round(r * 1000)} ${isAr ? 'متر' : 'm'}` : `${r} ${isAr ? 'كم' : 'km'}`}
                  </button>
                ))}
              </div>
              {!storeSettings.geoLat && (
                <p className="mt-2 text-[11px] text-amber-600 font-semibold">
                  {isAr
                    ? 'حدد موقع المطعم الأول (زر "استخدم موقعي الحالي") حتى يتفعل هذا القفل.'
                    : 'Set the restaurant location first ("Use my current location") to enable this lock.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* ============ Currency Card ============ */}
      <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isAr ? 'العملة الافتراضية' : 'Default Currency'}
            </h2>
            <p className="text-sm text-slate-500">
              {isAr ? 'اختر العملة التي ستظهر في الفواتير والمنيو' : 'Select the currency used across billing, invoices, and menu pricing'}
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CURRENCY_LIST.map((cur) => (
              <label
                key={cur.code}
                className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                  currency === cur.code ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm block">
                    {isAr ? `${cur.labelAr} (${cur.code})` : `${cur.labelEn} (${cur.code})`}
                  </span>
                  <span className="text-[11px] text-slate-400" dir="ltr">{cur.symbol}</span>
                </div>
                <input
                  type="radio"
                  name="currency"
                  value={cur.code}
                  checked={currency === cur.code}
                  onChange={(e) => {
                    setCurrency(e.target.value as Currency);
                    setSaveStatus('idle');
                  }}
                  className="w-4 h-4 text-amber-600 border-slate-300 focus:ring-amber-500"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
