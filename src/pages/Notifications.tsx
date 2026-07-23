import React, { useState, useEffect } from 'react';
import {
  Bell, ShoppingBag, CheckCircle2, AlertCircle, Info,
  Trash2, Filter, Check, Clock, X, Zap
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface NotificationItem {
  id: string;
  type: 'order' | 'system' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function Notifications() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'orders' | 'system'>('all');

  // Load notifications from localStorage
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`notifications_${user.uid}`);
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {
        setNotifications(defaultNotifications);
      }
    } else {
      setNotifications(defaultNotifications);
    }
  }, [user]);

  const saveNotifications = (updated: NotificationItem[]) => {
    setNotifications(updated);
    if (user) {
      localStorage.setItem(`notifications_${user.uid}`, JSON.stringify(updated));
    }
  };

  const handleMarkRead = (id: string) => {
    saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = () => {
    saveNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleDelete = (id: string) => {
    saveNotifications(notifications.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف كل الإشعارات؟' : 'Are you sure you want to delete all notifications?')) {
      saveNotifications([]);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'orders') return n.type === 'order';
    if (filter === 'system') return n.type === 'system' || n.type === 'warning';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return ShoppingBag;
      case 'success': return CheckCircle2;
      case 'warning': return AlertCircle;
      case 'system': return Info;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'order': return 'text-indigo-600 bg-indigo-50';
      case 'success': return 'text-emerald-600 bg-emerald-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      case 'system': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return language === 'ar' ? `منذ ${days} يوم` : `${days}d ago`;
    if (hours > 0) return language === 'ar' ? `منذ ${hours} ساعة` : `${hours}h ago`;
    if (mins > 0) return language === 'ar' ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    return language === 'ar' ? 'الآن' : 'Just now';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="bg-indigo-100 p-2.5 rounded-xl">
                <Bell className="w-6 h-6 text-indigo-600" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                {language === 'ar' ? 'مركز الإشعارات' : 'Notifications Center'}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {language === 'ar' 
                  ? `${unreadCount} إشعار غير مقروء من إجمالي ${notifications.length}` 
                  : `${unreadCount} unread out of ${notifications.length} notifications`}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-500" />
              {language === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all read'}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-white border border-slate-200 text-rose-600 px-4 py-2 rounded-xl shadow-sm text-sm font-medium hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {language === 'ar' ? 'مسح الكل' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'all', label: language === 'ar' ? 'الكل' : 'All', count: notifications.length },
          { id: 'unread', label: language === 'ar' ? 'غير مقروء' : 'Unread', count: unreadCount },
          { id: 'orders', label: language === 'ar' ? 'الطلبات' : 'Orders', count: notifications.filter(n => n.type === 'order').length },
          { id: 'system', label: language === 'ar' ? 'النظام' : 'System', count: notifications.filter(n => n.type === 'system' || n.type === 'warning').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === tab.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-16 text-center">
          <div className="bg-slate-50 p-4 rounded-2xl w-fit mx-auto mb-4">
            <Bell className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-700 mb-1">
            {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
          </h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {language === 'ar' 
              ? 'ستظهر هنا إشعارات الطلبات الجديدة والتنبيهات وتحديثات النظام' 
              : 'Order alerts, system updates, and notifications will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => {
            const Icon = getIcon(notif.type);
            return (
              <div
                key={notif.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
                  !notif.read ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-xl shrink-0 ${getColor(notif.type)}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className={`text-sm ${!notif.read ? 'font-extrabold text-slate-800' : 'font-bold text-slate-700'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-indigo-600 rounded-full shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(notif.timestamp)}
                      </div>
                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'تعليم كمقروء' : 'Mark read'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
        <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-indigo-900">
            {language === 'ar' ? 'إشعارات في الوقت الفعلي' : 'Real-time Notifications'}
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            {language === 'ar' 
              ? 'يتم تخزين الإشعارات محلياً. عند ربط النظام بـ Firebase أو Supabase، ستصلك الإشعارات لحظياً.' 
              : 'Notifications are stored locally. When connected to Firebase or Supabase, you will receive real-time push notifications.'}
          </p>
        </div>
      </div>
    </div>
  );
}

const defaultNotifications: NotificationItem[] = [
  {
    id: 'notif_1',
    type: 'order',
    title: 'طلب جديد من طاولة رقم 3',
    message: 'عميل طلب 2x برجر لحم + 1x بطاطس. الإجمالي: $30.97',
    timestamp: Date.now() - 5 * 60 * 1000,
    read: false,
  },
  {
    id: 'notif_2',
    type: 'system',
    title: 'تم تحديث المساعد الصوتي',
    message: 'تم تثبيت الإصدار الجديد من المحرك الصوتي بدعم اللهجة المصرية',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    read: false,
  },
  {
    id: 'notif_3',
    type: 'success',
    title: 'تم ربط متجر Shopify بنجاح',
    message: 'المنتجات تتزامن تلقائياً الآن. تم استيراد 142 منتج.',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    read: true,
  },
  {
    id: 'notif_4',
    type: 'warning',
    title: 'اقتراب حد الـ API',
    message: 'استهلكت 85% من حد المكالمات الشهري. فكر في ترقية الباقة.',
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    read: false,
  },
  {
    id: 'notif_5',
    type: 'order',
    title: 'طلب جديد من طاولة رقم 7',
    message: 'عميل طلب 1x بيتزا مارجريتا + 2x كولا. الإجمالي: $18.50',
    timestamp: Date.now() - 26 * 60 * 60 * 1000,
    read: true,
  },
];
