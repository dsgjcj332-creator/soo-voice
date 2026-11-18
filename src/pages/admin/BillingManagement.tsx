import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgePercent, CreditCard, Plus, RefreshCw, Tags } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabase, getSupabaseConfig } from '../../lib/supabase';

type Plan = { id: string; plan_key: string; display_name: string; description: string | null; is_active: boolean; sort_order: number };
type Price = { id: string; plan_id: string; currency: string; billing_interval: string; amount_minor: number; is_active: boolean; effective_from: string; effective_until: string | null };
type Promotion = { id: string; code: string; discount_type: string; percent_off: number | null; amount_off_minor: number | null; currency: string | null; starts_at: string; ends_at: string; max_redemptions: number | null; redemption_count: number; first_ten_offer: boolean; is_active: boolean };
type Subscription = { id: string; owner_id: string; plan_id: string; status: string; currency: string | null; billing_interval: string | null; trial_ends_at: string | null; current_period_end: string | null };
type AdminData = { plans: Plan[]; prices: Price[]; promotions: Promotion[]; subscriptions: Subscription[] };

const emptyData: AdminData = { plans: [], prices: [], promotions: [], subscriptions: [] };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

export function AdminBillingManagement() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [planForm, setPlanForm] = useState({ plan_key: '', display_name: '', description: '' });
  const [priceForm, setPriceForm] = useState({ plan_id: '', currency: 'EGP', billing_interval: 'monthly', amount: '' });
  const [promoForm, setPromoForm] = useState({ code: '', discount_type: 'percent', percent_off: '50', amount_off: '', currency: 'EGP', starts_at: '', ends_at: '', max_redemptions: '', first_ten_offer: false });

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const supabase = getSupabase();
    if (!supabase || !user || user.provider !== 'supabase') throw new Error(isAr ? 'يلزم تسجيل دخول أدمن بحساب Supabase.' : 'A Supabase administrator session is required.');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) throw new Error(isAr ? 'جلسة الإدارة منتهية. سجل الدخول مرة أخرى.' : 'Admin session expired. Please sign in again.');
    const response = await fetch(`/api/admin/billing${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${sessionData.session.access_token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }, [user, isAr]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [catalog, promotions, subscriptions] = await Promise.all([
        api('/plans'),
        api('/promotions'),
        api('/subscriptions?limit=50&offset=0'),
      ]);
      setData({
        plans: Array.isArray(catalog.plans) ? catalog.plans : [],
        prices: Array.isArray(catalog.prices) ? catalog.prices : [],
        promotions: Array.isArray(promotions) ? promotions : [],
        subscriptions: Array.isArray(subscriptions.items) ? subscriptions.items : [],
      });
      setPriceForm(current => ({ ...current, plan_id: current.plan_id || catalog.plans?.[0]?.id || '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load billing data');
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (path: string, body: unknown, success: string) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      setNotice(success);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    } finally { setSaving(false); }
  };

  const togglePlan = async (plan: Plan) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !plan.is_active }) });
      setNotice(isAr ? 'تم تحديث حالة الباقة.' : 'Plan status updated.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update plan'); }
    finally { setSaving(false); }
  };

  const togglePromotion = async (promo: Promotion) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/promotions/${promo.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !promo.is_active }) });
      setNotice(isAr ? 'تم تحديث حالة العرض.' : 'Promotion status updated.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update promotion'); }
    finally { setSaving(false); }
  };

  const money = (minor: number, currency: string) => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', { style: 'currency', currency }).format(minor / 100);
  const dateInput = (value: string) => value ? new Date(value).toISOString() : '';

  return (
    <div className="mx-auto max-w-7xl p-5 md:p-8" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isAr ? 'إدارة الباقات والاشتراكات' : 'Plans & Billing Management'}</h1>
          <p className="mt-1 text-sm text-slate-500">{isAr ? 'إدارة كتالوج الأسعار والعروض ومراجعة الاشتراكات من خلال API محمي للأدمن.' : 'Manage plan pricing and promotions, and review subscriptions through the protected admin API.'}</p>
        </div>
        <button type="button" className={buttonClass} onClick={() => void load()} disabled={loading || saving}><RefreshCw className="h-4 w-4" />{isAr ? 'تحديث البيانات' : 'Refresh data'}</button>
      </div>

      {error && <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      {!getSupabaseConfig().isConfigured && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{isAr ? 'إعدادات Supabase غير مكتملة.' : 'Supabase is not configured.'}</p>}

      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={e => { e.preventDefault(); void submit('/plans', { plan_key: planForm.plan_key.trim().toLowerCase(), display_name: planForm.display_name.trim(), description: planForm.description, features: {}, usage_limits: {}, is_active: false }, isAr ? 'تم إنشاء الباقة كغير نشطة.' : 'Plan created as inactive.'); setPlanForm({ plan_key: '', display_name: '', description: '' }); }}>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><CreditCard className="h-5 w-5 text-indigo-600" />{isAr ? 'إضافة باقة' : 'Create a plan'}</h2>
          <label className="block text-sm font-medium">{isAr ? 'المفتاح (مثال growth)' : 'Plan key (e.g. growth)'}<input required pattern="[a-z][a-z0-9_-]{1,39}" className={inputClass} value={planForm.plan_key} onChange={e => setPlanForm({ ...planForm, plan_key: e.target.value })} /></label>
          <label className="mt-3 block text-sm font-medium">{isAr ? 'اسم الباقة' : 'Display name'}<input required maxLength={100} className={inputClass} value={planForm.display_name} onChange={e => setPlanForm({ ...planForm, display_name: e.target.value })} /></label>
          <label className="mt-3 block text-sm font-medium">{isAr ? 'الوصف' : 'Description'}<textarea maxLength={2000} className={inputClass} rows={2} value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} /></label>
          <p className="my-3 text-xs text-slate-500">{isAr ? 'الباقة تُنشأ غير نشطة. فعّلها بعد إضافة سعر ومراجعة حدود الاستخدام.' : 'Plans are created inactive. Activate only after adding a price and reviewing usage limits.'}</p>
          <button className={buttonClass} disabled={saving || loading}><Plus className="h-4 w-4" />{isAr ? 'إنشاء الباقة' : 'Create plan'}</button>
        </form>

        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={e => { e.preventDefault(); void submit('/prices', { plan_id: priceForm.plan_id, currency: priceForm.currency, billing_interval: priceForm.billing_interval, amount_minor: Math.round(Number(priceForm.amount) * 100), is_active: false }, isAr ? 'تمت إضافة السعر كسجل غير نشط.' : 'Price added as an inactive record.'); setPriceForm({ ...priceForm, amount: '' }); }}>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><Tags className="h-5 w-5 text-indigo-600" />{isAr ? 'إضافة سعر للباقة' : 'Add a plan price'}</h2>
          <label className="block text-sm font-medium">{isAr ? 'الباقة' : 'Plan'}<select required className={inputClass} value={priceForm.plan_id} onChange={e => setPriceForm({ ...priceForm, plan_id: e.target.value })}><option value="">{isAr ? 'اختر باقة' : 'Select a plan'}</option>{data.plans.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.plan_key})</option>)}</select></label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">{isAr ? 'العملة' : 'Currency'}<select className={inputClass} value={priceForm.currency} onChange={e => setPriceForm({ ...priceForm, currency: e.target.value })}><option>EGP</option><option>USD</option><option>SAR</option><option>AED</option></select></label>
            <label className="block text-sm font-medium">{isAr ? 'الدورة' : 'Interval'}<select className={inputClass} value={priceForm.billing_interval} onChange={e => setPriceForm({ ...priceForm, billing_interval: e.target.value })}><option value="monthly">{isAr ? 'شهري' : 'Monthly'}</option><option value="yearly">{isAr ? 'سنوي' : 'Yearly'}</option></select></label>
          </div>
          <label className="mt-3 block text-sm font-medium">{isAr ? 'السعر (بالوحدة الرئيسية)' : 'Price (major currency units)'}<input required type="number" min="0" step="0.01" className={inputClass} value={priceForm.amount} onChange={e => setPriceForm({ ...priceForm, amount: e.target.value })} /></label>
          <p className="my-3 text-xs text-slate-500">{isAr ? 'السعر الجديد يُحفظ غير نشط ولا يغيّر أسعار الاشتراكات الحالية.' : 'New prices are inactive and do not change existing subscriptions.'}</p>
          <button className={buttonClass} disabled={saving || loading || !priceForm.plan_id || priceForm.amount === ''}><Plus className="h-4 w-4" />{isAr ? 'إضافة السعر' : 'Add price'}</button>
        </form>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><BadgePercent className="h-5 w-5 text-indigo-600" />{isAr ? 'إنشاء عرض أو خصم' : 'Create a promotion'}</h2>
        <form onSubmit={e => { e.preventDefault(); const body = { code: promoForm.code.trim().toUpperCase(), discount_type: promoForm.discount_type, ...(promoForm.discount_type === 'percent' ? { percent_off: Number(promoForm.percent_off) } : { amount_off_minor: Math.round(Number(promoForm.amount_off) * 100), currency: promoForm.currency }), starts_at: dateInput(promoForm.starts_at), ends_at: dateInput(promoForm.ends_at), max_redemptions: promoForm.max_redemptions ? Number(promoForm.max_redemptions) : null, first_ten_offer: promoForm.first_ten_offer, applicable_plan_keys: [], is_active: false }; void submit('/promotions', body, isAr ? 'تم إنشاء العرض غير نشط.' : 'Promotion created as inactive.'); setPromoForm({ ...promoForm, code: '' }); }}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">{isAr ? 'كود الخصم' : 'Promotion code'}<input required pattern="[A-Za-z0-9_-]{3,40}" className={inputClass} value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} /></label>
            <label className="text-sm font-medium">{isAr ? 'نوع الخصم' : 'Discount type'}<select className={inputClass} value={promoForm.discount_type} onChange={e => setPromoForm({ ...promoForm, discount_type: e.target.value })}><option value="percent">{isAr ? 'نسبة مئوية' : 'Percentage'}</option><option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed amount'}</option></select></label>
            {promoForm.discount_type === 'percent' ? <label className="text-sm font-medium">{isAr ? 'نسبة الخصم %' : 'Discount %'}<input required type="number" min="1" max="100" className={inputClass} value={promoForm.percent_off} onChange={e => setPromoForm({ ...promoForm, percent_off: e.target.value })} /></label> : <><label className="text-sm font-medium">{isAr ? 'قيمة الخصم' : 'Discount amount'}<input required type="number" min="0.01" step="0.01" className={inputClass} value={promoForm.amount_off} onChange={e => setPromoForm({ ...promoForm, amount_off: e.target.value })} /></label><label className="text-sm font-medium">{isAr ? 'العملة' : 'Currency'}<select className={inputClass} value={promoForm.currency} onChange={e => setPromoForm({ ...promoForm, currency: e.target.value })}><option>EGP</option><option>USD</option><option>SAR</option><option>AED</option></select></label></>}
            <label className="text-sm font-medium">{isAr ? 'يبدأ في' : 'Starts at'}<input required type="datetime-local" className={inputClass} value={promoForm.starts_at} onChange={e => setPromoForm({ ...promoForm, starts_at: e.target.value })} /></label>
            <label className="text-sm font-medium">{isAr ? 'ينتهي في' : 'Ends at'}<input required type="datetime-local" className={inputClass} value={promoForm.ends_at} onChange={e => setPromoForm({ ...promoForm, ends_at: e.target.value })} /></label>
            <label className="text-sm font-medium">{isAr ? 'حد الاستخدام (اختياري)' : 'Redemption cap (optional)'}<input type="number" min="1" className={inputClass} value={promoForm.max_redemptions} onChange={e => setPromoForm({ ...promoForm, max_redemptions: e.target.value })} /></label>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={promoForm.first_ten_offer} onChange={e => setPromoForm({ ...promoForm, first_ten_offer: e.target.checked })} />{isAr ? 'عرض خاص لأول عشرة مطاعم (إعداد فقط، لا يضمن الحجز بعد)' : 'First-ten restaurant offer (configuration only; redemption is not live yet)'}</label>
          <div className="mt-4"><button className={buttonClass} disabled={saving}><Plus className="h-4 w-4" />{isAr ? 'إنشاء العرض' : 'Create promotion'}</button></div>
        </form>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-slate-900">{isAr ? 'الباقات والأسعار' : 'Plans & prices'}</h2>
          {loading ? <p className="text-sm text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</p> : data.plans.length === 0 ? <p className="text-sm text-slate-500">{isAr ? 'لا توجد باقات بعد.' : 'No plans yet.'}</p> : <div className="space-y-3">{data.plans.map(plan => <div key={plan.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{plan.display_name} <span className="text-xs text-slate-400">({plan.plan_key})</span></p><p className="text-xs text-slate-500">{plan.description}</p></div><button type="button" disabled={saving} onClick={() => void togglePlan(plan)} className={plan.is_active ? 'rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700' : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600'}>{plan.is_active ? (isAr ? 'نشطة — إيقاف' : 'Active — deactivate') : (isAr ? 'غير نشطة — تفعيل' : 'Inactive — activate')}</button></div><div className="mt-2 flex flex-wrap gap-2">{data.prices.filter(price => price.plan_id === plan.id).map(price => <span key={price.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs">{money(price.amount_minor, price.currency)} / {price.billing_interval} · {price.is_active ? (isAr ? 'نشط' : 'active') : (isAr ? 'غير نشط' : 'inactive')}</span>)}</div></div>)}</div>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-slate-900">{isAr ? 'العروض والخصومات' : 'Promotions'}</h2>
          {data.promotions.length === 0 ? <p className="text-sm text-slate-500">{isAr ? 'لا توجد عروض.' : 'No promotions yet.'}</p> : <div className="space-y-3">{data.promotions.map(promo => <div key={promo.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold">{promo.code} · {promo.discount_type === 'percent' ? `${promo.percent_off}%` : money(promo.amount_off_minor || 0, promo.currency || 'EGP')}</p><p className="text-xs text-slate-500">{new Date(promo.starts_at).toLocaleDateString()} – {new Date(promo.ends_at).toLocaleDateString()} · {promo.redemption_count}{promo.max_redemptions ? `/${promo.max_redemptions}` : ''}</p>{promo.first_ten_offer && <p className="text-xs text-indigo-600">{isAr ? 'عرض أول عشرة' : 'First-ten offer'}</p>}</div><button type="button" disabled={saving} onClick={() => void togglePromotion(promo)} className={promo.is_active ? 'rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700' : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600'}>{promo.is_active ? (isAr ? 'نشط — إيقاف' : 'Active — deactivate') : (isAr ? 'غير نشط — تفعيل' : 'Inactive — activate')}</button></div>)}</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-900">{isAr ? 'اشتراكات المطاعم (قراءة فقط)' : 'Merchant subscriptions (read only)'}</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-start text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">{isAr ? 'المطعم / المالك' : 'Merchant owner'}</th><th className="p-2">{isAr ? 'الباقة' : 'Plan'}</th><th className="p-2">{isAr ? 'الحالة' : 'Status'}</th><th className="p-2">{isAr ? 'العملة والدورة' : 'Currency / interval'}</th><th className="p-2">{isAr ? 'نهاية الفترة' : 'Period ends'}</th></tr></thead><tbody>{data.subscriptions.map(sub => <tr key={sub.id} className="border-b border-slate-100"><td className="p-2 font-mono text-xs">{sub.owner_id.slice(0, 8)}…</td><td className="p-2">{data.plans.find(p => p.id === sub.plan_id)?.display_name || sub.plan_id.slice(0, 8)}</td><td className="p-2">{sub.status}</td><td className="p-2">{sub.currency || '—'} / {sub.billing_interval || '—'}</td><td className="p-2">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : sub.trial_ends_at ? (isAr ? 'تجربة حتى ' : 'Trial until ') + new Date(sub.trial_ends_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-slate-500">{isAr ? 'تعديل حالة الاشتراك والفواتير والمدفوعات غير متاح هنا؛ لن يتم إنشاء دفع أو تفعيل مدفوع يدويًا.' : 'Subscription, invoice and payment mutations are intentionally unavailable here. No payment is collected or marked paid manually.'}</p>
      </section>
    </div>
  );
}
