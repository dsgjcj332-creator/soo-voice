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
}

export function DashboardOverview() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { hasCompletedOnboarding, loadingSettings } = useSettings();
  const { currency } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedDailyTasks, setCompletedDailyTasks] = useState<string[]>([]);

  const localDayKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();
  const dailyTasksStorageKey = user?.uid ? `soovoice:daily-tasks:${user.uid}:${localDayKey}` : null;

  useEffect(() => {
    if (!dailyTasksStorageKey) return;
    try {
      const saved = window.localStorage.getItem(dailyTasksStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setCompletedDailyTasks(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setCompletedDailyTasks([]);
    }
  }, [dailyTasksStorageKey]);

  useEffect(() => {
    if (!dailyTasksStorageKey) return;
    try {
      window.localStorage.setItem(dailyTasksStorageKey, JSON.stringify(completedDailyTasks));
    } catch {
      // The checklist remains usable for this session if browser storage is unavailable.
    }
  }, [dailyTasksStorageKey, completedDailyTasks]);

  // Load + subscribe to orders (live, like the kitchen page)
  useEffect(() => {
    if (!user) return;
    if (user.provider === "local") {
      setOrders([]);
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const channel = supabase
      .channel("dashboard-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `ownerId=eq.${user.uid}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE" && payload.old) {
            setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
          } else if (payload.new) {
            const newOrder = payload.new as Order;
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === newOrder.id);
              if (exists) {
                return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
              }
              return [newOrder, ...prev];
            });
          }
        }
      )
      .subscribe();

    supabase
      .from("orders")
      .select("*")
      .eq("ownerId", user.uid)
      .order("createdAt", { ascending: false })
      .limit(50)
      .then(({ data }: any) => {
        setOrders(data || []);
        setLoading(false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Counts for the status row
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const preparingCount = orders.filter((o) => o.status === "preparing").length;

  // Today's served (createdAt within last 24h and status completed)
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const servedToday = orders.filter(
    (o) => o.status === "completed" && now - o.createdAt < DAY
  ).length;

  // Active orders (pending + preparing)
  const activeOrders = orders
    .filter((o) => o.status === "pending" || o.status === "preparing")
    .sort((a, b) => a.createdAt - b.createdAt); // oldest first — most urgent

  // Recent served (last 5)
  const recentServed = orders
    .filter((o) => o.status === "completed")
    .sort((a, b) => b.createdAt - a.createdAt)
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

      {/* Daily execution center — checklist is stored per merchant and day in this browser. */}
      <section id="daily-execution" className="mb-8 rounded-2xl border border-indigo-100 bg-white p-5 shadow-xs md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              {isAr ? "التنفيذ اليومي" : "Daily execution"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isAr ? "قائمة متابعة يومية للمطعم — محفوظة على هذا الجهاز." : "A daily restaurant checklist — saved in this browser on this device."}
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
                  aria-label={done ? (isAr ? "إلغاء إكمال المهمة" : "Mark task incomplete") : (isAr ? "إكمال المهمة" : "Mark task complete")}
                  aria-pressed={done}
                  onClick={() => setCompletedDailyTasks((current) => done ? current.filter((taskId) => taskId !== id) : [...current, id])}
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
      </section>

      {/* Status row — 3 quiet cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8">
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
                      {timeAgo(o.createdAt)} · {o.items?.length || 0} {isAr ? "صنف" : "items"}
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
