import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  ArrowRight,
  Receipt,
  ChefHat as Kitchen,
  ClipboardCheck,
  MessageSquare,
  Utensils,
  Mic,
  PlugZap,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";
import { formatPrice } from "../lib/currency";

type DailyTaskKey = "kitchen" | "conversations" | "menu" | "voice" | "connections";
const DAILY_TASK_KEYS: DailyTaskKey[] = ["kitchen", "conversations", "menu", "voice", "connections"];

async function persistDailyTasks(ownerId: string, taskDate: string, completedIds: string[]): Promise<boolean> {
  const supabase = getSupabase();
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured || !supabase) return false;
  const completed = new Set(completedIds);
  const timestamp = new Date().toISOString();
  const rows = DAILY_TASK_KEYS.map((task_key) => ({
    owner_id: ownerId,
    task_date: taskDate,
    task_key,
    completed: completed.has(task_key),
    completed_by: completed.has(task_key) ? ownerId : null,
    completed_at: completed.has(task_key) ? timestamp : null,
  }));
  const { error } = await supabase
    .from("merchant_daily_tasks")
    .upsert(rows, { onConflict: "owner_id,task_date,task_key" });
  if (error) {
    console.warn("Daily checklist cloud save failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Dashboard overview — a real restaurant overview, not a SaaS analytics
 * dashboard. Built around the question the owner actually asks when
 * they log in: "what's happening right now?"
 *
 * Three things, in this order:
 *   1. Kitchen status — pending / preparing / served today (live from
 *      the orders table, realtime).
 *   2. Active orders — pending + preparing, with table number, items
 *      count, total, time elapsed. One-click jump to the kitchen page.
 *   3. Recent served — the last 5 completed orders today, with table
 *      and total.
 *
 * No charts. No week-over-week deltas. No "AI agent performance". The
 * owner wants to know what's on the line, not a bar chart of last
 * Tuesday's conversations.
 */

interface Order {
  id: string;
  ownerId: string;
  tableNumber: string;
  items: any[];
  total: number;
  status: string;
  createdAt: number;
  completedAt?: number | null;
}

export function DashboardOverview() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { hasCompletedOnboarding, loadingSettings } = useSettings();
  const { currency } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [servedTodayCount, setServedTodayCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedDailyTasks, setCompletedDailyTasks] = useState<string[]>([]);
  const [dailyTasksLoadedKey, setDailyTasksLoadedKey] = useState<string | null>(null);
  const [dailyTasksSyncStatus, setDailyTasksSyncStatus] = useState<'loading' | 'local' | 'syncing' | 'synced' | 'error'>('loading');

  const localDayKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();
  const dailyTasksStorageKey = user?.uid ? `soovoice:daily-tasks:${user.uid}:${localDayKey}` : null;

  useEffect(() => {
    if (!dailyTasksStorageKey) {
      setCompletedDailyTasks([]);
      setDailyTasksLoadedKey(dailyTasksStorageKey);
      setDailyTasksSyncStatus('local');
      return;
    }
    let cancelled = false;
    let initialLoadFinished = false;
    const queuedRealtimeRows: any[] = [];
    const readLocalTasks = () => {
      try {
        const saved = window.localStorage.getItem(dailyTasksStorageKey);
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => DAILY_TASK_KEYS.includes(id as DailyTaskKey))
          : [];
      } catch {
        return [];
      }
    };
    const localTasks = readLocalTasks();
    setDailyTasksLoadedKey(null);
    setDailyTasksSyncStatus('loading');

    if (!user || user.provider === 'local') {
      setCompletedDailyTasks(localTasks);
      setDailyTasksLoadedKey(dailyTasksStorageKey);
      setDailyTasksSyncStatus('local');
      return;
    }

    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setCompletedDailyTasks(localTasks);
      setDailyTasksLoadedKey(dailyTasksStorageKey);
      setDailyTasksSyncStatus('error');
      return;
    }

    const applyRealtimeRow = (row: any) => {
      if (!row || row.task_date !== localDayKey || !DAILY_TASK_KEYS.includes(row.task_key as DailyTaskKey)) return;
      setCompletedDailyTasks((current) => {
        if (row.completed) return current.includes(row.task_key) ? current : [...current, row.task_key];
        return current.filter((id) => id !== row.task_key);
      });
      setDailyTasksSyncStatus('synced');
    };

    const channel = supabase
      .channel(`daily-tasks-${user.uid}-${localDayKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'merchant_daily_tasks',
        filter: `owner_id=eq.${user.uid}`,
      }, (payload) => {
        const row = payload.new && Object.keys(payload.new).length
          ? payload.new
          : payload.old;
        if (!initialLoadFinished) queuedRealtimeRows.push(row);
        else applyRealtimeRow(row);
      })
      .subscribe();

    const loadRemoteTasks = async () => {
      const { data, error } = await supabase
        .from('merchant_daily_tasks')
        .select('task_key, completed, task_date')
        .eq('owner_id', user.uid)
        .eq('task_date', localDayKey);

      if (cancelled) return;
      if (error) {
        console.warn('Daily checklist cloud load failed:', error.message);
        setCompletedDailyTasks(localTasks);
        setDailyTasksSyncStatus('error');
      } else {
        const remoteTasks = (data || [])
          .filter((row: any) => row.completed && DAILY_TASK_KEYS.includes(row.task_key as DailyTaskKey))
          .map((row: any) => row.task_key as string);
        if (!(data || []).length && localTasks.length) {
          const migrated = await persistDailyTasks(user.uid, localDayKey, localTasks);
          if (cancelled) return;
          setCompletedDailyTasks(localTasks);
          setDailyTasksSyncStatus(migrated ? 'synced' : 'error');
        } else {
          setCompletedDailyTasks(remoteTasks);
          setDailyTasksSyncStatus('synced');
        }
      }
      initialLoadFinished = true;
      queuedRealtimeRows.forEach(applyRealtimeRow);
      setDailyTasksLoadedKey(dailyTasksStorageKey);
    };

    void loadRemoteTasks();

    // Realtime is preferred; polling keeps the checklist usable if the table
    // has not yet been added to the Supabase Realtime publication.
    const poll = window.setInterval(async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      const { data, error } = await supabase
        .from('merchant_daily_tasks')
        .select('task_key, completed')
        .eq('owner_id', user.uid)
        .eq('task_date', localDayKey);
      if (cancelled || error) return;
      const remoteTasks = (data || [])
        .filter((row: any) => row.completed && DAILY_TASK_KEYS.includes(row.task_key as DailyTaskKey))
        .map((row: any) => row.task_key as string);
      setCompletedDailyTasks((current) =>
        current.length === remoteTasks.length && current.every((id) => remoteTasks.includes(id))
          ? current
          : remoteTasks
      );
      setDailyTasksSyncStatus('synced');
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [dailyTasksStorageKey, localDayKey, user?.uid, user?.provider]);

  useEffect(() => {
    if (!dailyTasksStorageKey || dailyTasksLoadedKey !== dailyTasksStorageKey) return;
    try {
      window.localStorage.setItem(dailyTasksStorageKey, JSON.stringify(completedDailyTasks));
    } catch {
      // The cloud remains authoritative when available; local cache is best-effort.
    }
  }, [dailyTasksStorageKey, completedDailyTasks, dailyTasksLoadedKey]);

  const handleDailyTaskToggle = async (taskId: DailyTaskKey) => {
    const nextTasks = completedDailyTasks.includes(taskId)
      ? completedDailyTasks.filter((id) => id !== taskId)
      : [...completedDailyTasks, taskId];
    setCompletedDailyTasks(nextTasks);
    if (dailyTasksStorageKey) {
      try { window.localStorage.setItem(dailyTasksStorageKey, JSON.stringify(nextTasks)); } catch {}
    }
    if (!user || user.provider === 'local') {
      setDailyTasksSyncStatus('local');
      return;
    }
    setDailyTasksSyncStatus('syncing');
    const saved = await persistDailyTasks(user.uid, localDayKey, nextTasks);
    setDailyTasksSyncStatus(saved ? 'synced' : 'error');
  };

  const retryDailyTaskSync = async () => {
    if (!user || user.provider === 'local') return;
    setDailyTasksSyncStatus('syncing');
    const saved = await persistDailyTasks(user.uid, localDayKey, completedDailyTasks);
    setDailyTasksSyncStatus(saved ? 'synced' : 'error');
  };

  // Load + subscribe to orders (live, like the kitchen page)
  useEffect(() => {
    if (!user) return;
    if (user.provider === "local") {
      setOrders([]);
      setServedTodayCount(0);
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setOrders([]);
      setServedTodayCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let countRefreshSequence = 0;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const refreshServedTodayCount = async () => {
      const sequence = ++countRefreshSequence;
      try {
        // Count independently from the latest-200 dashboard list so busy
        // restaurants do not lose completed orders from the third status tile.
        // Legacy rows without completedAt fall back to their creation time.
        const [timestamped, legacy] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true })
            .eq("ownerId", user.uid).eq("status", "completed")
            .not("completedAt", "is", null).gte("completedAt", dayStartMs),
          supabase.from("orders").select("id", { count: "exact", head: true })
            .eq("ownerId", user.uid).eq("status", "completed")
            .is("completedAt", null).gte("createdAt", dayStartMs),
        ]);
        if (cancelled || sequence !== countRefreshSequence) return;
        if (timestamped.error || legacy.error) {
          console.warn("[Dashboard] Could not refresh completed-order count:", timestamped.error?.message || legacy.error?.message);
          return;
        }
        setServedTodayCount((timestamped.count || 0) + (legacy.count || 0));
      } catch (error) {
        if (!cancelled) console.warn("[Dashboard] Completed-order count refresh failed:", error);
      }
    };
    void refreshServedTodayCount();
    let initialLoadComplete = false;
    const queuedChanges: any[] = [];
    const applyOrderChange = (payload: any) => {
      if (payload.eventType === "DELETE" && payload.old?.id) {
        setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
        return;
      }
      if (!payload.new?.id || payload.new.ownerId !== user.uid) return;
      const nextOrder = payload.new as Order;
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === nextOrder.id);
        const next = exists
          ? prev.map((o) => (o.id === nextOrder.id ? { ...o, ...nextOrder } : o))
          : [nextOrder, ...prev];
        return next.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 200);
      });
    };

    const channel = supabase
      .channel(`dashboard-orders-${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `ownerId=eq.${user.uid}`,
        },
        (payload) => {
          // Queue changes during the initial query so a slow SELECT cannot
          // overwrite a kitchen status transition that arrived in realtime.
          if (!initialLoadComplete) queuedChanges.push(payload);
          else {
            applyOrderChange(payload);
            void refreshServedTodayCount();
          }
        }
      )
      .subscribe();

    const loadOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("ownerId", user.uid)
          .order("createdAt", { ascending: false })
          .limit(200);
        if (cancelled) return;
        if (error) throw error;
        setOrders((data || []).filter((o: any) => o.ownerId === user.uid));
        initialLoadComplete = true;
        queuedChanges.forEach(applyOrderChange);
        queuedChanges.length = 0;
        void refreshServedTodayCount();
      } catch (error) {
        console.error("[Dashboard] Could not load orders:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadOrders();
    const countPoll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshServedTodayCount();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(countPoll);
      queuedChanges.length = 0;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  // Counts for the status row
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;

  // Count completed orders created during the merchant's current local day.
  // The status is updated by the kitchen; realtime changes move the order
  // into this third tile without requiring a page refresh.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const servedToday = servedTodayCount ?? orders.filter((o) => {
    const completedAt = Number(o.completedAt ?? o.createdAt);
    return o.status === "completed" && Number.isFinite(completedAt) && completedAt >= todayStart.getTime();
  }).length;

  // Active orders (pending + preparing)
  const activeOrders = orders
    .filter((o) => o.status === "pending" || o.status === "preparing")
    .sort((a, b) => a.createdAt - b.createdAt); // oldest first — most urgent

  // Recent served (last 5)
  const recentServed = orders
    .filter((o) => o.status === "completed")
    .sort((a, b) => Number(b.completedAt ?? b.createdAt) - Number(a.completedAt ?? a.createdAt))
    .slice(0, 5);

  const dailyTasks = [
    {
      id: "kitchen",
      title: isAr ? "راجع الطلبات والمطبخ" : "Review orders and kitchen",
      description: activeOrders.length
        ? (isAr ? `${activeOrders.length} طلبات محتاجة متابعة` : `${activeOrders.length} orders need attention`)
        : (isAr ? "تأكد إن مفيش طلبات معلقة" : "Make sure no orders are waiting"),
      href: "/app/kitchen",
      Icon: Kitchen,
    },
    {
      id: "conversations",
      title: isAr ? "راجع محادثات العملاء" : "Review guest conversations",
      description: isAr ? "تابع الاستفسارات والطلبات التي تحتاج تدخل الموظفين" : "Follow up on questions and staff handoffs",
      href: "/app/conversations",
      Icon: MessageSquare,
    },
    {
      id: "menu",
      title: isAr ? "راجع المنيو والأسعار" : "Review menu and prices",
      description: isAr ? "تأكد إن الأصناف والأسعار والتوافر محدثين" : "Check item details, prices and availability",
      href: "/app/digital-menu",
      Icon: Utensils,
    },
    {
      id: "voice",
      title: isAr ? "اختبر المساعد الصوتي" : "Test the voice assistant",
      description: isAr ? "جرّب سؤالًا وطلبًا بصوت العميل" : "Try a guest question and an order flow",
      href: "/app/voice-studio",
      Icon: Mic,
    },
    {
      id: "connections",
      title: isAr ? "راجع حالة الربط" : "Review connections",
      description: isAr ? "تأكد من إعدادات الربط المتاحة" : "Check the integrations configured for this venue",
      href: "/app/integration",
      Icon: PlugZap,
    },
  ];

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return isAr ? `قبل ${diff} ثانية` : `${diff}s ago`;
    if (diff < 3600) return isAr ? `قبل ${Math.floor(diff / 60)} دقيقة` : `${Math.floor(diff / 60)}m ago`;
    return isAr ? `قبل ${Math.floor(diff / 3600)} ساعة` : `${Math.floor(diff / 3600)}h ago`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto font-sans">
      {/* Header — editorial, not dashboard-y */}
      <header className="mb-8">
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-400 mb-2">
          {isAr ? "نظرة عامة" : "Overview"}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            {isAr ? "ما يحدث الآن" : "What's happening now"}
          </h1>
          <a href="#daily-execution" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700">
            <ClipboardCheck className="h-4 w-4" />
            {isAr ? "التنفيذ اليومي" : "Daily execution"}
          </a>
        </div>
      </header>

      {/* Daily execution center — shared in the merchant account, with local demo fallback. */}
      <section id="daily-execution" className="mb-8 rounded-2xl border border-indigo-100 bg-white p-5 shadow-xs md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              {isAr ? "التنفيذ اليومي" : "Daily execution"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {dailyTasksSyncStatus === 'loading'
                ? (isAr ? 'جاري تحميل مهام اليوم...' : "Loading today's tasks...")
                : dailyTasksSyncStatus === 'syncing'
                  ? (isAr ? 'جاري مزامنة التغييرات مع حساب المطعم...' : 'Syncing changes to the restaurant account...')
                  : dailyTasksSyncStatus === 'synced'
                    ? (isAr ? 'المهام محفوظة في حساب المطعم ومتزامنة بين الأجهزة.' : 'Tasks are saved to the restaurant account and synced across devices.')
                    : dailyTasksSyncStatus === 'error'
                      ? (isAr ? 'تعذر تأكيد المزامنة. النسخة المحلية محفوظة ويمكن إعادة المحاولة.' : 'Cloud sync could not be confirmed. The local copy is kept; you can retry.')
                      : user?.provider === 'local'
                      ? (isAr ? 'وضع التجربة: المهام محفوظة على هذا الجهاز فقط.' : 'Demo mode: tasks are saved on this device only.')
                      : (isAr ? 'الاتصال السحابي غير متاح حاليًا؛ المهام المحلية محفوظة.' : 'Cloud storage is unavailable; the local copy is kept.')}
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
            {completedDailyTasks.length} / {dailyTasks.length} {isAr ? "مكتمل" : "completed"}
          </span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(completedDailyTasks.length / dailyTasks.length) * 100}%` }} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {dailyTasks.map(({ id, title, description, href, Icon }) => {
            const done = completedDailyTasks.includes(id);
            return (
              <div key={id} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${done ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50/70"}`}>
                <button
                  type="button"
                  disabled={dailyTasksSyncStatus === 'syncing' || dailyTasksSyncStatus === 'loading'}
                  aria-label={done ? (isAr ? "إلغاء إكمال المهمة" : "Mark task incomplete") : (isAr ? "إكمال المهمة" : "Mark task complete")}
                  aria-pressed={done}
                  onClick={() => void handleDailyTaskToggle(id as DailyTaskKey)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-indigo-400"}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <Icon className={`h-5 w-5 shrink-0 ${done ? "text-emerald-600" : "text-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${done ? "text-emerald-800 line-through" : "text-slate-800"}`}>{title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                </div>
                <Link to={href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50">
                  {isAr ? "افتح" : "Open"}
                </Link>
              </div>
            );
          })}
        </div>
        {dailyTasksSyncStatus === 'error' && user?.provider !== 'local' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              {isAr ? 'المهام موجودة محليًا، لكن لم يتم تأكيد حفظها على السحابة.' : 'Tasks are kept locally, but cloud persistence has not been confirmed.'}
            </p>
            <button type="button" onClick={() => void retryDailyTaskSync()} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-800 border border-amber-200 hover:bg-amber-100">
              {isAr ? 'إعادة المزامنة' : 'Retry sync'}
            </button>
          </div>
        )}
      </section>

      {/* Status row — 3 quiet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-8">
        <Link
          to="/app/kitchen"
          className="bg-white border border-amber-200/80 rounded-2xl p-4 md:p-5 shadow-xs hover:shadow-md transition-all flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-amber-700 uppercase tracking-wider">
              {isAr ? "بانتظار المطبخ" : "Awaiting"}
            </span>
          </div>
          <span className="text-3xl md:text-4xl font-extrabold text-slate-900">{pendingCount}</span>
        </Link>

        <Link
          to="/app/kitchen"
          className="bg-white border border-slate-300 rounded-2xl p-4 md:p-5 shadow-xs hover:shadow-md transition-all flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isAr ? "قيد التحضير" : "Preparing"}
            </span>
          </div>
          <span className="text-3xl md:text-4xl font-extrabold text-slate-900">{preparingCount}</span>
        </Link>

        <Link
          to="/app/kitchen"
          className="bg-white border border-emerald-200/80 rounded-2xl p-4 md:p-5 shadow-xs hover:shadow-md transition-all flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase tracking-wider">
              {isAr ? "تم التقديم اليوم" : "Served today"}
            </span>
          </div>
          <span className="text-3xl md:text-4xl font-extrabold text-slate-900">{servedToday}</span>
        </Link>
      </div>

      {/* Active orders — the most important section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Kitchen className="w-4 h-4 text-slate-500" />
            {isAr ? "طلبات نشطة" : "Active orders"}
          </h2>
          <Link
            to="/app/kitchen"
            className="text-xs md:text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            {isAr ? "كل الطلبات" : "All orders"}
            <ArrowRight className={`w-3.5 h-3.5 ${isAr ? "rotate-180" : ""}`} />
          </Link>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
            <Kitchen className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-500 text-sm">
              {isAr ? "مفيش طلبات نشطة دلوقتي" : "No active orders right now"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isAr
                ? "أول طلب من طاولاتك هيظهر هنا فورًا."
                : "Your first order will appear here the moment it arrives."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeOrders.slice(0, 6).map((o) => (
              <Link
                key={o.id}
                to="/app/kitchen"
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${o.status === "pending" ? "bg-amber-500" : "bg-slate-700"}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">
                      {isAr ? `طاولة ${o.tableNumber}` : `Table ${o.tableNumber}`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {timeAgo(o.createdAt)} · {o.items?.length || 0} {isAr ? "صنف" : "items"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-slate-900" dir="ltr">
                    {formatPrice(o.total, currency)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    o.status === "pending"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {o.status === "pending"
                      ? (isAr ? "بانتظار" : "Awaiting")
                      : (isAr ? "قيد التحضير" : "Preparing")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent served */}
      {recentServed.length > 0 && (
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            {isAr ? "آخر الطلبات المكتملة" : "Recently served"}
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {recentServed.map((o) => (
                <li key={o.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm">
                      {isAr ? `طاولة ${o.tableNumber}` : `Table ${o.tableNumber}`}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {timeAgo(Number(o.completedAt ?? o.createdAt))} · {o.items?.length || 0} {isAr ? "صنف" : "items"}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-700 shrink-0" dir="ltr">
                    {formatPrice(o.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!hasCompletedOnboarding && !loadingSettings && <OnboardingWizard />}
    </div>
  );
}
