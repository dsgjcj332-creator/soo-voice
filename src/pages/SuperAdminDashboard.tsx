import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Store, Activity, MessageSquare, Check, X, ShieldBan } from 'lucide-react';
import { motion } from 'motion/react';
import { subscribeToMerchants, approveMerchant, blockMerchant, deleteMerchant, Merchant } from '../services/merchants';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';

export function SuperAdminDashboard() {
  const { language } = useLanguage();
  const [registrations, setRegistrations] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations24h, setConversations24h] = useState<number | null>(null);
  const [orders24h, setOrders24h] = useState<number | null>(null);
  const [adminActionError, setAdminActionError] = useState("");
  const [billingOverview, setBillingOverview] = useState<{
    activePlans: number | null;
    activeSubscriptions: number | null;
    trialingSubscriptions: number | null;
    pastDueSubscriptions: number | null;
    openInvoices: number | null;
    paidInvoices: number | null;
    activePromotions: number | null;
  }>({
    activePlans: null,
    activeSubscriptions: null,
    trialingSubscriptions: null,
    pastDueSubscriptions: null,
    openInvoices: null,
    paidInvoices: null,
    activePromotions: null,
  });
  const [billingOverviewError, setBillingOverviewError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToMerchants((data) => {
      setRegistrations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Billing overview is visible only to trusted app_metadata admins via
  // database RLS; the browser receives read-only aggregates, never write access.
  useEffect(() => {
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) return;
    let cancelled = false;

    const fetchBillingOverview = async () => {
      const [plans, active, trialing, pastDue, openInvoices, paidInvoices, promotions] = await Promise.all([
        supabase.from('billing_plans').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('merchant_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('merchant_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trialing'),
        supabase.from('merchant_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'past_due'),
        supabase.from('billing_invoices').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('billing_invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
        supabase.from('billing_promotions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      const firstError = [plans, active, trialing, pastDue, openInvoices, paidInvoices, promotions]
        .find((result) => result.error)?.error;
      if (cancelled) return;
      if (firstError) {
        setBillingOverviewError(firstError.message);
        return;
      }
      setBillingOverviewError("");
      setBillingOverview({
        activePlans: plans.count ?? 0,
        activeSubscriptions: active.count ?? 0,
        trialingSubscriptions: trialing.count ?? 0,
        pastDueSubscriptions: pastDue.count ?? 0,
        openInvoices: openInvoices.count ?? 0,
        paidInvoices: paidInvoices.count ?? 0,
        activePromotions: promotions.count ?? 0,
      });
    };

    void fetchBillingOverview();
    const interval = window.setInterval(() => void fetchBillingOverview(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Real platform activity from the database (last 24 hours)
  useEffect(() => {
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) return;

    const since = Date.now() - 24 * 60 * 60 * 1000;
    const fetchActivity = async () => {
      try {
        const [{ count: convCount, error: convErr }, { count: ordCount, error: ordErr }] = await Promise.all([
          supabase.from('conversations').select('id', { count: 'exact', head: true }).gte('createdAt', since),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('createdAt', since),
        ]);
        if (!convErr) setConversations24h(convCount ?? 0);
        if (!ordErr) setOrders24h(ordCount ?? 0);
      } catch (err) {
        console.error('Failed to load platform activity:', err);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    setAdminActionError("");
    try {
      await approveMerchant(id);
    } catch (e) {
      setAdminActionError(e instanceof Error ? e.message : "Could not approve merchant");
    }
  };

  const handleBlock = async (id: string) => {
    setAdminActionError("");
    try {
      await blockMerchant(id);
    } catch (e) {
      setAdminActionError(e instanceof Error ? e.message : "Could not block merchant");
    }
  };

  const handleDelete = async (id: string) => {
    setAdminActionError("");
    try {
      if (window.confirm(language === "ar" ? "متأكد إنك عاوز تحذف سجل المتجر؟" : "Delete this merchant record?")) {
        await deleteMerchant(id);
      }
    } catch (e) {
      setAdminActionError(e instanceof Error ? e.message : "Could not delete merchant");
    }
  };

  const STATS = [
    { id: 1, name: language === 'ar' ? 'إجمالي التجار' : 'Total Merchants', stat: registrations.length.toString(), icon: Store, trend: '—', trendType: 'neutral' },
    { id: 2, name: language === 'ar' ? 'طلبات الطاولات (24 ساعة)' : 'Orders (24h)', stat: orders24h === null ? '—' : orders24h.toString(), icon: Activity, trend: '—', trendType: 'neutral' },
    { id: 3, name: language === 'ar' ? 'محادثات المساعد (24 ساعة)' : 'Voice Sessions (24h)', stat: conversations24h === null ? '—' : conversations24h.toString(), icon: MessageSquare, trend: '—', trendType: 'neutral' },
    { id: 4, name: language === 'ar' ? 'تجار نشطون' : 'Active Merchants', stat: registrations.filter(r => r.status === 'Active').length.toString(), icon: Users, trend: '—', trendType: 'neutral' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'نظرة عامة على النظام' : 'System Overview'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' ? 'احصائيات مباشرة وخلاصة نشاط المتاجر.' : 'Live metrics and merchants activity feed.'}
        </p>
      </div>

      {adminActionError && <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{adminActionError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {STATS.map((item, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={item.id}
            className="relative overflow-hidden rounded-2xl bg-white p-6 border border-slate-200 shadow-sm"
          >
            <dt>
              <div className="absolute rounded-xl bg-slate-50 p-3">
                <item.icon className="h-6 w-6 text-slate-600" aria-hidden="true" />
              </div>
              <p className="ms-16 truncate text-sm font-medium text-slate-500">{item.name}</p>
            </dt>
            <dd className="ms-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-2xl font-bold text-slate-900">{item.stat}</p>
              <p
                className={`ms-2 flex items-baseline text-sm font-semibold ${
                  item.trendType === 'positive' ? 'text-green-600' : 'text-slate-500'
                }`}
              >
                {item.trend}
              </p>
            </dd>
          </motion.div>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800">{language === 'ar' ? 'نظرة عامة على الاشتراكات والفوترة' : 'Subscriptions & Billing Overview'}</h2>
            <p className="mt-1 text-xs text-slate-500">{language === 'ar' ? 'قراءة مباشرة من سجلات الفوترة، بدون تفعيل أو تعديل مالي من المتصفح.' : 'Live read-only billing records; no financial changes are made from the browser.'}</p>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{language === 'ar' ? 'عرض فقط' : 'Read only'}</span>
        </div>
        {billingOverviewError && (
          <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {language === 'ar' ? 'تعذر تحميل بيانات الفوترة. تأكد من تطبيق ترحيل الفوترة وتعيين دور الإدارة الموثوق.' : 'Could not load billing data. Apply the billing migration and verify the trusted admin role.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [language === 'ar' ? 'الباقات النشطة' : 'Active plans', billingOverview.activePlans],
            [language === 'ar' ? 'اشتراكات نشطة' : 'Active subscriptions', billingOverview.activeSubscriptions],
            [language === 'ar' ? 'فترات تجريبية' : 'Trialing', billingOverview.trialingSubscriptions],
            [language === 'ar' ? 'متأخرة السداد' : 'Past due', billingOverview.pastDueSubscriptions],
            [language === 'ar' ? 'فواتير مفتوحة' : 'Open invoices', billingOverview.openInvoices],
            [language === 'ar' ? 'فواتير مدفوعة' : 'Paid invoices', billingOverview.paidInvoices],
            [language === 'ar' ? 'عروض نشطة' : 'Active promotions', billingOverview.activePromotions],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{value === null ? '—' : value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-slate-400">
          {language === 'ar' ? 'الإيرادات النقدية لن تظهر هنا قبل توصيل بوابة دفع موثقة ومطابقة المدفوعات الناجحة بالفواتير.' : 'Cash revenue is intentionally omitted until a verified payment gateway reconciles successful payments to invoices.'}
        </p>
      </section>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">
                  {language === 'ar' ? 'إدارة المتاجر السريعة' : 'Quick Merchants Management'}
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
                 {registrations.length} {language === 'ar' ? 'تاجر' : 'Merchants'}
              </span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">{language === 'ar' ? 'المتجر' : 'Store'}</th>
                  <th className="px-6 py-3">{language === 'ar' ? 'المنصة' : 'Platform'}</th>
                  <th className="px-6 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-3 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                    </td>
                  </tr>
                ) : registrations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {language === 'ar' ? 'لا توجد متاجر حالياً.' : 'No merchants found.'}
                    </td>
                  </tr>
                ) : registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                       <div className="font-bold text-slate-900">{reg.store}</div>
                       <div className="text-xs text-slate-400">{reg.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700">
                          {reg.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${
                        reg.status === 'Active' ? 'text-green-600' : 
                        reg.status === 'Pending' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                           reg.status === 'Active' ? 'bg-green-500' : 
                           reg.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2 rtl:space-x-reverse">
                      {reg.status === 'Pending' && (
                        <button 
                          onClick={() => handleApprove(reg.id)}
                          className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {reg.status !== 'Blocked' && (
                        <button 
                          onClick={() => handleBlock(reg.id)}
                          className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors" title="Block"
                        >
                          <ShieldBan className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(reg.id)}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Delete record"
                      >
                         <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
           <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
              {language === 'ar' ? 'نشاط المنصة المباشر' : 'Live Platform Activity'}
              <MessageSquare className="w-4 h-4 text-slate-400" />
           </h3>
           <div className="flex-1 flex flex-col justify-center gap-6">
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                 <div>
                    <span className="text-slate-800 font-bold block">{language === 'ar' ? 'محادثات صوتية (24 ساعة)' : 'Voice sessions (24h)'}</span>
                    <span className="text-xs text-slate-500">{language === 'ar' ? 'من قاعدة البيانات المباشرة' : 'from the live database'}</span>
                 </div>
                 <span className="text-2xl font-black text-indigo-600">{conversations24h === null ? '—' : conversations24h}</span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                 <div>
                    <span className="text-slate-800 font-bold block">{language === 'ar' ? 'طلبات مُنشأة (24 ساعة)' : 'Orders created (24h)'}</span>
                    <span className="text-xs text-slate-500">{language === 'ar' ? 'من المنيو الرقمي والمساعد الصوتي' : 'from digital menu & voice agent'}</span>
                 </div>
                 <span className="text-2xl font-black text-emerald-600">{orders24h === null ? '—' : orders24h}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
