import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  Check,
  Clock,
  ChefHat,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { formatPrice } from '../lib/currency';

/**
 * Kitchen — order display.
 *
 * Designed as a real kitchen ticket board, not a SaaS dashboard:
 *
 *   - Quiet palette — paper-cream, ink-slate, a single accent for the
 *     status badge. No colored metric counters, no big indigo rings.
 *   - Mono font for the order number, the items, and the total. This is
 *     what a thermal printer would produce; the kitchen sees a ticket,
 *     not a UI.
 *   - Each ticket is a tall vertical card with a clear header (order
 *     number + table + status) and a clear footer (the next action).
 *   - The status filter is a single horizontal text selector, not a
 *     row of pill buttons.
 *   - The bottom "preview each table" block is replaced with a single
 *     quiet link to the floor plan, since that's where the action lives.
 */

const STATUS_META: Record<string, { labelAr: string; labelEn: string; dot: string; ring: string }> = {
  pending: { labelAr: 'بانتظار المطبخ', labelEn: 'Awaiting kitchen', dot: 'bg-amber-500', ring: 'border-amber-200' },
  preparing: { labelAr: 'قيد التحضير', labelEn: 'In preparation', dot: 'bg-slate-700', ring: 'border-slate-300' },
  completed: { labelAr: 'تم التقديم', labelEn: 'Served', dot: 'bg-emerald-600', ring: 'border-emerald-200' },
  cancelled: { labelAr: 'ملغي', labelEn: 'Cancelled', dot: 'bg-rose-400', ring: 'border-rose-200' },
};

export function KitchenDisplay() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { user } = useAuth();
  const { currency } = useSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'completed'>('all');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(true);
    setLoadError("");
    if (user.provider === 'local') {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setOrders([]);
      setLoadError(isAr ? 'قاعدة البيانات غير متاحة؛ لم يتم تحميل الطلبات.' : 'Database is unavailable; orders could not be loaded.');
      setLoadingOrders(false);
      return;
    }

    let disposed = false;
    let initialLoadComplete = false;
    const pendingChanges: any[] = [];

    const applyChange = (payload: any) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (deletedId) setOrders((current) => current.filter((order) => order.id !== deletedId));
        return;
      }
      const incoming = payload.new;
      if (!incoming?.id || incoming.ownerId !== user.uid) return;
      setOrders((current) => {
        const exists = current.some((order) => order.id === incoming.id);
        const next = exists
          ? current.map((order) => order.id === incoming.id ? { ...order, ...incoming } : order)
          : [incoming, ...current];
        return next.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      });
    };

    const channel = supabase
      .channel(`kitchen-orders-${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `ownerId=eq.${user.uid}` },
        (payload) => {
          if (!initialLoadComplete) {
            pendingChanges.push(payload);
            return;
          }
          applyChange(payload);
        },
      )
      .subscribe();

    const loadOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('ownerId', user.uid)
          .order('createdAt', { ascending: false })
          .limit(200);
        if (disposed) return;
        if (error) throw error;
        setOrders((data ?? []).filter((order) => order.ownerId === user.uid));
        for (const payload of pendingChanges) applyChange(payload);
        pendingChanges.length = 0;
        initialLoadComplete = true;
        setLoadError("");
      } catch (error) {
        if (disposed) return;
        initialLoadComplete = true;
        setLoadError(error instanceof Error ? error.message : (isAr ? 'تعذر تحميل الطلبات.' : 'Could not load orders.'));
      } finally {
        if (!disposed) setLoadingOrders(false);
      }
    };

    void loadOrders();

    const poll = window.setInterval(async () => {
      if (document.visibilityState !== 'visible' || disposed) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('ownerId', user.uid)
          .order('createdAt', { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!data || disposed) return;
        setOrders((current) => {
          const next = data.filter((order) => order.ownerId === user.uid);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        setLoadError("");
      } catch (error) {
        if (!disposed) setLoadError(error instanceof Error ? error.message : (isAr ? 'تعذر تحديث الطلبات.' : 'Could not refresh orders.'));
      }
    }, 5000);

    return () => {
      disposed = true;
      pendingChanges.length = 0;
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [user?.uid, user?.provider, isAr]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!user || user.provider === 'local') {
      setActionError(isAr ? 'تغيير حالة الطلبات غير متاح في وضع التجربة.' : 'Order updates are unavailable in demo mode.');
      return;
    }
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setActionError(isAr ? 'قاعدة البيانات غير متاحة؛ لم تتغير حالة الطلب.' : 'Database is unavailable; order status was not changed.');
      return;
    }

    const previous = orders.find((order) => order.id === orderId)?.status;
    setActionError("");
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: newStatus } : order));
    try {
      const updateResult = await supabase
        .from('orders')
        .update({
          status: newStatus,
          completedAt: newStatus === 'completed' ? Date.now() : null,
        })
        .eq('id', orderId)
        .eq('ownerId', user.uid)
        .select('id,status')
        .maybeSingle();

      const missingCompletionColumn = Boolean(updateResult.error) &&
        /completedAt|schema cache|column .* does not exist/i.test(String(updateResult.error?.message || ''));
      if (missingCompletionColumn) {
        // Keep kitchen actions working while a deployment is waiting for the
        // additive timestamp migration. The dashboard falls back to createdAt
        // until the migration is applied.
        const fallback = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId)
          .eq('ownerId', user.uid)
          .select('id,status')
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        if (!fallback.data) throw new Error(isAr ? 'الطلب غير موجود أو لا تملك صلاحية تعديله.' : 'Order not found or not allowed.');
        setActionError(isAr
          ? 'تم تحديث حالة الطلب. لتسجيل وقت الإنجاز بدقة، طبّق ترحيل completedAt على قاعدة البيانات.'
          : 'Order status updated. Apply the completedAt migration to track exact completion time.');
        return;
      }
      if (updateResult.error) throw updateResult.error;
      if (!updateResult.data) throw new Error(isAr ? 'الطلب غير موجود أو لا تملك صلاحية تعديله.' : 'Order not found or not allowed.');
    } catch (error) {
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: previous || order.status } : order));
      setActionError(error instanceof Error ? error.message : (isAr ? 'فشل تحديث حالة الطلب.' : 'Could not update order status.'));
    }
  };

  const handleArchiveOrder = async (orderId: string) => {
    if (!user || user.provider === 'local') {
      setActionError(isAr ? 'الأرشفة غير متاحة في وضع التجربة.' : 'Archiving is unavailable in demo mode.');
      return;
    }
    const msg = isAr ? 'هل تريد حذف هذا الطلب نهائيًا؟' : 'Permanently delete this order?';
    if (!window.confirm(msg)) return;
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setActionError(isAr ? 'قاعدة البيانات غير متاحة؛ لم يتم حذف الطلب.' : 'Database is unavailable; the order was not deleted.');
      return;
    }
    setActionError("");
    try {
      const { data, error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('ownerId', user.uid)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(isAr ? 'الطلب غير موجود أو لا تملك صلاحية حذفه.' : 'Order not found or not allowed.');
      setOrders((current) => current.filter((order) => order.id !== orderId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (isAr ? 'فشل حذف الطلب.' : 'Could not delete order.'));
    }
  };

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  const filteredOrders = orders.filter((o) =>
    statusFilter === 'all' ? true : o.status === statusFilter
  );

  const isDemo = user?.provider === 'local';

  return (
    <div className="min-h-full bg-stone-50 font-sans" id="kitchen-page-root">
      <div className="max-w-6xl mx-auto p-4 md:p-10">
        {/* Header — editorial, not dashboard-y */}
        <header className="mb-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-400 mb-2">
              {isAr ? 'المطبخ' : 'Kitchen'}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              {isAr ? 'شاشة الطلبات' : 'Order tickets'}
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-2xl leading-relaxed">
              {isAr
                ? 'كل طلب يصل من الطاولة يظهر هنا فورًا. كل تذكرة تصعد حتى تُقدّم.'
                : 'Every order from a table arrives here at once. Each ticket moves up until it is served.'}
            </p>
          </div>
          {/* Open this kitchen in a full-screen tab — useful for a wall-mounted display */}
          <a
            href={`/app/kitchen`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-colors"
            title={isAr ? 'افتح هذه الشاشة في نافذة جديدة — مناسب للعرض على حائط المطبخ' : 'Open this screen in a new window — useful for a kitchen wall display'}
          >
            <ExternalLink className="w-4 h-4" />
            {isAr ? 'فتح في صفحة أخرى' : 'Open in a new tab'}
          </a>
        </header>

        {isDemo && (
          <div className="mb-8 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3.5 rounded-lg text-sm">
            {isAr
              ? 'وضع التجربة — الطلبات الحقيقية لا تصل إلى شاشة المطبخ في هذا الوضع.'
              : 'Demo mode — real guest orders are not connected to this kitchen screen.'}
          </div>
        )}
        {loadError && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{loadError}</div>}
        {actionError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</div>}

        {/* Status filter — single horizontal text selector, not a pill row */}
        <div className="mb-10 flex items-center gap-6 border-b border-stone-200 pb-3 overflow-x-auto scrollbar-none">
          {[
            { key: 'all', labelAr: 'الكل', labelEn: 'All', count: counts.all },
            { key: 'pending', labelAr: 'بانتظار', labelEn: 'Awaiting', count: counts.pending },
            { key: 'preparing', labelAr: 'قيد التحضير', labelEn: 'Preparing', count: counts.preparing },
            { key: 'completed', labelAr: 'تم التقديم', labelEn: 'Served', count: counts.completed },
          ].map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key as any)}
                className={`shrink-0 text-sm transition-colors cursor-pointer ${
                  active ? 'text-slate-900 font-bold' : 'text-slate-400 hover:text-slate-700 font-medium'
                }`}
              >
                {isAr ? f.labelAr : f.labelEn}
                <span className={`ms-2 ${active ? 'text-slate-400' : 'text-slate-300'}`}>
                  {f.count}
                </span>
                {active && <span className="block h-px bg-slate-900 -mb-3 mt-1" />}
              </button>
            );
          })}
        </div>

        {/* Orders stream */}
        {loadingOrders ? (
          <div className="py-20 text-center text-slate-400 font-mono text-sm flex flex-col items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
            {isAr ? 'جاري الاتصال بالطاولات...' : 'Connecting to tables...'}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-24 text-center">
            <ChefHat className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 font-medium">
              {isAr ? 'لا توجد طلبات في هذه الحالة الآن.' : 'No tickets in this state right now.'}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              {isAr
                ? 'أول طلب من طاولاتك سيظهر هنا لحظة وصوله.'
                : 'Your first order from the tables will appear here the moment it arrives.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.pending;
              const time = new Date(order.createdAt).toLocaleTimeString(
                isAr ? 'ar-EG' : 'en-US',
                { hour: '2-digit', minute: '2-digit' }
              );
              return (
                <article
                  key={order.id}
                  className={`bg-white border ${meta.ring} rounded-lg overflow-hidden flex flex-col transition-shadow hover:shadow-sm`}
                >
                  {/* Ticket header */}
                  <header className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      <span className="font-mono text-xs font-bold text-slate-500">
                        №{order.id.replace('order_', '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{time}</span>
                    </div>
                  </header>

                  {/* Table */}
                  <div className="px-5 py-4 border-b border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                      {isAr ? 'الطاولة' : 'Table'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 tracking-tight">
                      {order.tableNumber || (isAr ? 'سفري' : 'Walk-in')}
                    </p>
                  </div>

                  {/* Items */}
                  <div className="px-5 py-4 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      {isAr ? 'الأطباق' : 'Items'}
                    </p>
                    <ul className="space-y-2.5">
                      {order.items?.map((item: any, idx: number) => (
                        <li key={idx} className="flex items-baseline justify-between gap-3 font-mono text-xs">
                          <span className="text-slate-700 flex-1">
                            <span className="font-bold text-slate-900">{item.quantity}×</span>
                            <span className="ms-1.5">{item.name}</span>
                          </span>
                          <span className="text-slate-400 shrink-0" dir="ltr">
                            {formatPrice(item.price * item.quantity, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer: status + action */}
                  <footer className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900" dir="ltr">
                        {formatPrice(order.total, currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="text-xs font-bold text-slate-900 bg-stone-100 hover:bg-stone-200 px-4 min-h-[44px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {isAr ? 'ابدأ' : 'Begin'}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className="text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-4 min-h-[44px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isAr ? 'قُدّم' : 'Served'}
                        </button>
                      )}
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          title={isAr ? 'إلغاء' : 'Cancel'}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-rose-50"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleArchiveOrder(order.id)}
                        title={isAr ? 'أرشفة' : 'Archive'}
                        className="text-slate-300 hover:text-slate-500 transition-colors cursor-pointer p-2 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer link — quiet, not a "table preview" card */}
        {!loadingOrders && orders.length > 0 && (
          <div className="mt-12 pt-6 border-t border-stone-200 flex items-center justify-between text-sm">
            <p className="text-slate-400">
              {isAr
                ? 'ترتيب الطاولات وأكواد الـ QR من صفحة «مخطط الطاولات».'
                : 'Table placement and QR codes live on the floor plan page.'}
            </p>
            <a
              href="/app/floor-plan"
              className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 transition-colors"
            >
              {isAr ? 'مخطط الطاولات' : 'Floor plan'}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
