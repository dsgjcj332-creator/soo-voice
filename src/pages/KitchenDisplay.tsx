import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Bell,
  Utensils,
  CheckCircle2,
  RefreshCw,
  Trash,
  Filter,
  HelpCircle,
  Wifi,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getSupabase, getSupabaseConfig } from '../lib/supabase';
import { formatPrice } from '../lib/currency';

export function KitchenDisplay() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { currency } = useSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'completed'>('all');

  const ownerId = user?.uid || 'merchant_abc123';

  useEffect(() => {
    if (!user) return;
    if (user.provider === 'local') {
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(true);
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setLoadingOrders(false);
      return;
    }

    const channel = supabase
      .channel('kitchen-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `ownerId=eq.${user.uid}`,
        },
        (payload) => {
          if (payload.new) {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === (payload.new as any).id);
              if (exists) {
                return prev.map((o) =>
                  o.id === (payload.new as any).id ? (payload.new as any) : o
                );
              }
              return [(payload.new as any), ...prev];
            });
          }
        }
      )
      .subscribe();

    supabase
      .from('orders')
      .select('*')
      .eq('ownerId', user.uid)
      .order('createdAt', { ascending: false })
      .then(({ data }) => {
        setOrders(data || []);
        setLoadingOrders(false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const supabase = getSupabase();
      const { isConfigured } = getSupabaseConfig();
      if (isConfigured && supabase) {
        await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من أرشفة هذا الطلب؟' : 'Archive this order?')) return;
    try {
      const supabase = getSupabase();
      const { isConfigured } = getSupabaseConfig();
      if (isConfigured && supabase) {
        await supabase.from('orders').delete().eq('id', orderId);
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch (err) {
      console.error('Error deleting order:', err);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const isDemo = user?.provider === 'local';

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans" id="kitchen-page-root">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'المطبخ — شاشة الطلبات' : 'Kitchen — Order Display'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar'
            ? 'استقبال الطلبات لحظة وصولها من الطاولات، وتحديث حالتها حتى التقديم للضيف.'
            : 'Receive orders the moment they arrive from the tables, and track each one until it is served.'}
        </p>
      </div>

      {isDemo && (
        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl text-sm font-medium">
          {language === 'ar'
            ? 'وضع التجربة المحلي — الطلبات تُحفظ على هذا الجهاز فقط ولا تصل إلى شاشة المطبخ.'
            : 'Local demo mode — orders stay on this device and do not reach the kitchen display.'}
        </div>
      )}

      <div className="space-y-6">
        {/* Summary Metric Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                {language === 'ar' ? 'طلبات قيد الانتظار' : 'Pending'}
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{pendingOrders.length}</h3>
            </div>
            <div className="bg-amber-100 text-amber-700 p-3 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                {language === 'ar' ? 'جاري التحضير' : 'In Preparation'}
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{preparingOrders.length}</h3>
            </div>
            <div className="bg-indigo-100 text-indigo-700 p-3 rounded-xl">
              <Utensils className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                {language === 'ar' ? 'تم التقديم' : 'Served'}
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{completedOrders.length}</h3>
            </div>
            <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider me-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            {language === 'ar' ? 'تصفية:' : 'Filter:'}
          </span>
          {[
            { key: 'all', labelAr: 'الكل', labelEn: 'All', count: orders.length },
            { key: 'pending', labelAr: 'قيد الانتظار', labelEn: 'Pending', count: pendingOrders.length },
            { key: 'preparing', labelAr: 'جاري التحضير', labelEn: 'Preparing', count: preparingOrders.length },
            { key: 'completed', labelAr: 'مكتمل', labelEn: 'Served', count: completedOrders.length },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === f.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {language === 'ar' ? f.labelAr : f.labelEn} ({f.count})
            </button>
          ))}
        </div>

        {/* Orders Stream Grid */}
        {loadingOrders ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-medium">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-slate-400" />
            {language === 'ar' ? 'جاري الاتصال بقاعدة البيانات...' : 'Connecting to live feed...'}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto">
            <Utensils className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700">
              {language === 'ar' ? 'لا توجد طلبات في هذه الحالة الآن' : 'No orders in this state right now'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {language === 'ar'
                ? 'سيظهر أول طلب هنا تلقائياً لحظة وصوله من طاولاتك.'
                : 'Your first order will appear here automatically the moment it arrives from your tables.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => {
              const statusColors: Record<string, string> = {
                pending: 'bg-amber-50 text-amber-700 border-amber-200/80',
                preparing: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                completed: 'bg-green-50 text-green-700 border-green-200/80',
                cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
              };
              return (
                <div
                  key={order.id}
                  className={`bg-white border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                    order.status === 'pending' ? 'border-amber-400 ring-2 ring-amber-400/10' : 'border-slate-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                      <span className="font-extrabold text-slate-800 text-sm">#{order.id.replace('order_', '')}</span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusColors[order.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {order.status === 'pending' && (language === 'ar' ? 'قيد الانتظار' : 'Pending')}
                        {order.status === 'preparing' && (language === 'ar' ? 'يجري التجهيز' : 'Preparing')}
                        {order.status === 'completed' && (language === 'ar' ? 'تم التقديم' : 'Served')}
                        {order.status === 'cancelled' && (language === 'ar' ? 'ملغي' : 'Cancelled')}
                      </span>
                    </div>
                    <div className="mb-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-500">
                        {language === 'ar' ? 'طاولة التقديم:' : 'Table:'}
                      </span>
                      <span className="bg-indigo-600 text-white font-extrabold text-xs px-3 py-1 rounded-lg">
                        {language === 'ar' ? `طاولة ${order.tableNumber}` : `Table ${order.tableNumber}`}
                      </span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {language === 'ar' ? 'الأطباق' : 'Items'}
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs font-medium text-slate-700">
                            <span>
                              {item.name} <span className="text-indigo-600 font-extrabold ms-1">x{item.quantity}</span>
                            </span>
                            <span className="font-mono text-slate-500" dir="ltr">
                              {formatPrice(item.price * item.quantity, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500">
                        {language === 'ar' ? 'الإجمالي:' : 'Total:'}
                      </span>
                      <span className="text-base font-extrabold text-indigo-600 font-mono" dir="ltr">
                        {formatPrice(order.total, currency)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          {language === 'ar' ? 'بدء التحضير' : 'Start Prep'}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          {language === 'ar' ? 'تم التقديم' : 'Serve'}
                        </button>
                      )}
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                          title={language === 'ar' ? 'إلغاء الطلب' : 'Cancel'}
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer border border-slate-200/50"
                        title={language === 'ar' ? 'أرشفة' : 'Archive'}
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Live Table Preview */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 md:p-8 space-y-4 mt-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base">
                {language === 'ar' ? 'معاينة المنيو لكل طاولة' : 'Preview each table menu'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'افتح رابط أي طاولة لمعاينة ما يراه ضيوفك على هاتفهم.'
                  : 'Open any table link to preview what your guests see on their phones.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 5].map((tbl) => {
              const demoUrl = `/store?ownerId=${ownerId}&table=${tbl}`;
              return (
                <div
                  key={tbl}
                  className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {language === 'ar' ? `طاولة ${tbl}` : `Table ${tbl}`}
                      </span>
                      <Wifi className="w-3.5 h-3.5 text-green-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 select-all truncate mb-3">
                      {window.location.origin}
                      {demoUrl}
                    </p>
                  </div>
                  <a
                    href={demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 text-xs font-bold text-center py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {language === 'ar' ? 'فتح' : 'Open'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
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
