import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type PosConnection = {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
  created_at: string;
};

const PROVIDERS = [
  ['foodics', 'Foodics'], ['toast', 'Toast'], ['square', 'Square'],
  ['clover', 'Clover'], ['lightspeed', 'Lightspeed'],
  ['oracle_simphony', 'Oracle Simphony'], ['odoo', 'Odoo'],
  ['shopify_pos', 'Shopify POS'], ['salla', 'Salla'], ['custom', 'نظام آخر / Custom'],
];

export function PosConnectionsPanel({ language }: { language: string }) {
  const { user } = useAuth();
  const isArabic = language === 'ar';
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [provider, setProvider] = useState('foodics');
  const [displayName, setDisplayName] = useState('');
  const [credentialsText, setCredentialsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const request = useCallback(async (method: 'GET' | 'POST', body?: unknown) => {
    const supabase = getSupabase();
    if (!supabase || !user || user.provider !== 'supabase') {
      throw new Error(isArabic ? 'يلزم تسجيل الدخول بحساب موثّق.' : 'A verified Supabase session is required.');
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error(isArabic ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.' : 'Your session expired. Please sign in again.');
    const response = await fetch('/api/pos/connections', {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || (isArabic ? 'تعذر إتمام العملية.' : 'The request could not be completed.'));
    return result;
  }, [user, isArabic]);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = await request('GET');
      setConnections(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'تعذر تحميل الاتصالات.' : 'Could not load connections.'));
    } finally {
      setLoading(false);
    }
  }, [request, isArabic]);

  useEffect(() => {
    if (user?.provider === 'supabase') void loadConnections();
  }, [user?.provider, user?.uid, loadConnections]);

  const saveConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    let credentials: unknown;
    try {
      credentials = JSON.parse(credentialsText);
      if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) throw new Error('invalid');
      if (Object.keys(credentials as Record<string, unknown>).length === 0) throw new Error('empty');
    } catch {
      setError(true);
      setMessage(isArabic ? 'أدخل بيانات الاعتماد بصيغة JSON صحيحة تحتوي على حقول.' : 'Enter a valid JSON object containing credential fields.');
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await request('POST', { provider, displayName: displayName.trim() || undefined, credentials });
      setCredentialsText('');
      setDisplayName('');
      setShowForm(false);
      setMessage(isArabic ? 'تم حفظ بيانات الربط المشفّرة. الحالة: قيد الإعداد، ولم يتم اختبار الاتصال بعد.' : 'Encrypted credentials saved. Status: pending setup; the provider connection has not been tested.');
      await loadConnections();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : (isArabic ? 'فشل حفظ الربط.' : 'Could not save connection.'));
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      pending: ['قيد الإعداد', 'Pending setup'],
      connected: ['متصل', 'Connected'],
      degraded: ['يحتاج مراجعة', 'Degraded'],
      reauthorization_required: ['يحتاج إعادة تفويض', 'Reauthorization required'],
      disconnected: ['غير متصل', 'Disconnected'],
    };
    return labels[status] || [status, status];
  };

  if (!user || user.provider !== 'supabase') {
    return <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="font-bold text-slate-900">{isArabic ? 'تكاملات أنظمة الكاشير' : 'POS integrations'}</h2>
      <p className="mt-2 text-sm text-amber-900">{isArabic ? 'سجّل الدخول بحساب Supabase موثّق لإدارة اتصالات الكاشير. حساب العرض المحلي لا يملك صلاحية الربط.' : 'Sign in with a verified Supabase account to manage POS connections. Local demo accounts cannot create connections.'}</p>
    </section>;
  }

  return <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">{isArabic ? 'تكاملات أنظمة الكاشير (POS)' : 'Point-of-sale integrations'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{isArabic ? 'إدارة بيانات الربط لكل مزوّد من مكان واحد. بيانات الاعتماد تُشفّر على السيرفر ولا تُعاد إلى المتصفح.' : 'Manage credentials for different POS providers in one place. Credentials are encrypted server-side and never returned to the browser.'}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void loadConnections()} disabled={loading} className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label={isArabic ? 'تحديث' : 'Refresh'}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button type="button" onClick={() => { setShowForm(v => !v); setMessage(''); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />{isArabic ? 'إضافة نظام كاشير' : 'Add POS'}</button>
      </div>
    </div>

    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{isArabic ? 'الربط المحفوظ يظهر كـ «قيد الإعداد» حتى نضيف موصلًا فعليًا للمزوّد ونجري اختبار مصادقة ناجحًا. إضافة البيانات وحدها لا تعني أن الطلبات أو المنيو تتم مزامنتها.' : 'A saved connection remains “Pending setup” until a real provider adapter is implemented and authentication succeeds. Saving credentials alone does not synchronize menus or orders.'}</p>
    </div>

    {showForm && <form onSubmit={saveConnection} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs font-bold text-slate-600">{isArabic ? 'مزود الكاشير' : 'POS provider'}
          <select value={provider} onChange={e => setProvider(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium">
            {PROVIDERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">{isArabic ? 'اسم تعريفي (اختياري)' : 'Display name (optional)'}
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} placeholder={isArabic ? 'مثال: فرع الزقازيق' : 'e.g. Main branch'} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-600">{isArabic ? 'بيانات الاعتماد بصيغة JSON' : 'Credentials as JSON'}
        <textarea value={credentialsText} onChange={e => setCredentialsText(e.target.value)} required rows={6} autoComplete="off" spellCheck={false} placeholder={'{\n  "apiKey": "YOUR_SECRET",\n  "storeId": "YOUR_STORE_ID"\n}'} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs" />
      </label>
      <p className="text-xs leading-5 text-slate-500">{isArabic ? 'استخدم أسماء الحقول التي يحددها مزوّدك. لا تلصق بيانات حقيقية في بيئة تجريبية غير موثوقة. لن نعرض هذه القيم بعد الحفظ.' : 'Use the field names specified by your provider. Do not paste live secrets into an untrusted test environment. Values will not be displayed after saving.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !credentialsText.trim()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isArabic ? 'حفظ مشفّر' : 'Save encrypted'}</button>
        <button type="button" onClick={() => { setShowForm(false); setCredentialsText(''); }} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200">{isArabic ? 'إلغاء' : 'Cancel'}</button>
      </div>
    </form>}

    {message && <p role="status" className={`mt-4 flex items-start gap-2 text-sm ${error ? 'text-rose-700' : 'text-emerald-700'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}

    <div className="mt-6 space-y-3">
      {loading && <p className="py-5 text-center text-sm text-slate-500">{isArabic ? 'جارٍ تحميل الاتصالات...' : 'Loading connections...'}</p>}
      {!loading && connections.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500">{isArabic ? 'لا توجد أنظمة كاشير مضافة حتى الآن.' : 'No POS connections have been added yet.'}</div>}
      {connections.map(connection => {
        const label = statusLabel(connection.status);
        return <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
          <div><p className="font-bold text-slate-800">{connection.display_name || PROVIDERS.find(p => p[0] === connection.provider)?.[1] || connection.provider}</p><p className="mt-1 text-xs text-slate-500">{connection.provider}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${connection.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{isArabic ? label[0] : label[1]}</span>
        </div>;
      })}
    </div>
  </section>;
}
