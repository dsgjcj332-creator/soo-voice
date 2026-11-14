import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  ArrowUpRight, Clock, MessageSquare, Users, Utensils, Sparkles, Activity,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";
import { subscribeToConversations, Conversation } from "../services/conversations";
import { getSupabase, getSupabaseConfig } from "../lib/supabase";

/**
 * Premium dashboard overview — built to answer three questions a luxury
 * restaurant owner actually asks, in this order:
 *
 *   1. When am I busy?
 *   2. What are they asking about?
 *   3. Are my chef specials doing their job?
 *
 * The standard "total / avg / conversion / active" cards stay at the top
 * because owners are used to them. Below them, three new panels:
 *
 *   - Peak hours heatmap — a 24-hour horizontal bar chart showing which
 *     hours of the day see the most guest questions.
 *   - Top-asked dishes — extracted from the conversation intent field
 *     (e.g. "burger", "truffle pizza", "chef secret"). Counts occurrences.
 *   - Chef specials conversation rate — of all conversations, what share
 *     mention a dish flagged as chef-special (isAiOnly) in the menu.
 *
 * The peak hours and top-asked dishes rely only on the conversations
 * feed. The chef specials rate additionally reads the menu_items table
 * to know which dish names are marked isAiOnly. For demo / unconfigured
 * accounts, all three panels render an honest empty state.
 */

export function DashboardOverview() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { hasCompletedOnboarding, loadingSettings } = useSettings();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [aiOnlyNames, setAiOnlyNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.provider === "local") {
      setConversations([]);
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToConversations(user.uid, (data) => {
      setConversations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Load the names of chef-special (isAiOnly) dishes — used to detect chef
  // specials conversation rate.
  useEffect(() => {
    if (!user || user.provider === "local") return;
    const supabase = getSupabase();
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured || !supabase) return;
    supabase
      .from("menu_items")
      .select("name,isAiOnly")
      .eq("ownerId", user.uid)
      .then(({ data }: any) => {
        if (!data) return;
        const names: string[] = data
          .filter((d: any) => d.isAiOnly)
          .map((d: any) => String(d.name || "").toLowerCase())
          .filter(Boolean);
        setAiOnlyNames(names);
      });
  }, [user]);

  // ---------- Stats cards (existing) ----------
  const totalCalls = conversations.length;
  const successfulCalls = conversations.filter((c) => c.isSuccess).length;
  const conversionRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  const averageDurationSeconds =
    totalCalls > 0
      ? Math.round(
          conversations.reduce((sum, c) => {
            const match = c.duration.match(/(?:(\d+)m)?\s*(?:(\d+)s)?/);
            return sum + (Number(match?.[1] || 0) * 60) + Number(match?.[2] || 0);
          }, 0) / totalCalls
        )
      : 0;
  const avgDuration =
    averageDurationSeconds > 0
      ? `${Math.floor(averageDurationSeconds / 60)}m ${averageDurationSeconds % 60}s`
      : "-";

  const activeCustomers = new Set(
    conversations.map((c) => c.user).filter(Boolean)
  ).size;

  // ---------- Week-over-week deltas ----------
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = conversations.filter((c) => now - new Date(c.createdAt).getTime() <= WEEK);
  const prevWeek = conversations.filter((c) => {
    const age = now - new Date(c.createdAt).getTime();
    return age > WEEK && age <= 2 * WEEK;
  });
  const pctChange = (
    current: number,
    previous: number
  ): { change: string; changeType: "positive" | "negative" | "neutral" } => {
    if (previous === 0) {
      return current > 0
        ? { change: isAr ? "جديد" : "new", changeType: "positive" }
        : { change: "—", changeType: "neutral" };
    }
    const delta = Math.round(((current - previous) / previous) * 100);
    if (delta === 0) return { change: "0%", changeType: "neutral" };
    return {
      change: `${delta > 0 ? "+" : ""}${delta}%`,
      changeType: delta > 0 ? "positive" : "negative",
    };
  };
  const prevSuccessful = prevWeek.filter((c) => c.isSuccess).length;
  const prevConvRate = prevWeek.length > 0 ? Math.round((prevSuccessful / prevWeek.length) * 100) : 0;
  const thisWeekConvRate = thisWeek.length > 0 ? Math.round((thisWeek.filter((c) => c.isSuccess).length / thisWeek.length) * 100) : 0;
  const totalChange = pctChange(thisWeek.length, prevWeek.length);
  const convChange = pctChange(thisWeekConvRate, prevConvRate);

  const stats = [
    {
      name: t("dash.stat.total"),
      value: totalCalls.toString(),
      icon: MessageSquare,
      change: totalChange.change,
      changeType: totalChange.changeType,
    },
    {
      name: t("dash.stat.avg"),
      value: avgDuration,
      icon: Clock,
      change: "—",
      changeType: "neutral",
    },
    {
      name: t("dash.stat.conv"),
      value: `${conversionRate}%`,
      icon: ArrowUpRight,
      change: convChange.change,
      changeType: convChange.changeType,
    },
    {
      name: t("dash.stat.active"),
      value: activeCustomers.toString(),
      icon: Users,
      change: "—",
      changeType: "neutral",
    },
  ];

  // ---------- Existing weekly chart data ----------
  const volumeData = conversations
    .reduce((acc: any[], curr) => {
      const date = new Date(curr.createdAt).toLocaleDateString("en-US", { weekday: "short" });
      const existing = acc.find((item) => item.name === date);
      if (existing) {
        existing.calls += 1;
        if (curr.isSuccess) existing.conversions += 1;
      } else {
        acc.push({ name: date, calls: 1, conversions: curr.isSuccess ? 1 : 0 });
      }
      return acc;
    }, [])
    .slice(0, 7)
    .reverse();

  // ---------- NEW: Peak hours heatmap (24-hour distribution) ----------
  const peakHoursData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const c of conversations) {
      const h = new Date(c.createdAt).getHours();
      counts[h].count++;
    }
    return counts;
  }, [conversations]);

  const peakHour = useMemo(() => {
    return peakHoursData.reduce(
      (peak, curr) => (curr.count > peak.count ? curr : peak),
      peakHoursData[0]
    );
  }, [peakHoursData]);

  const slowestHours = useMemo(
    () => peakHoursData.filter((h) => h.count === 0).map((h) => h.hour),
    [peakHoursData]
  );

  // ---------- NEW: Top-asked dishes ----------
  const topAskedDishes = useMemo(() => {
    // Extract candidate words from the intent strings — common dish words
    // mentioned in restaurant voice logs.
    const stopWords = new Set([
      "the", "a", "an", "what", "is", "of", "and", "or", "in", "with",
      "i", "we", "have", "do", "you", "to", "for", "on", "at", "by",
      "how", "much", "please", "menu", "order", "price", "available",
      "want", "would", "like", "any", "is", "are", "be", "this", "that",
    ]);
    const counts = new Map<string, number>();
    for (const c of conversations) {
      const text = (c.intent || "").toLowerCase();
      if (!text) continue;
      // Try multi-word phrase detection (e.g. "truffle pizza")
      const phrases = [
        /chef['\s-]*special/g,
        /secret\s+\w+/g,
        /\b(\w+\s+\w+)\b/g, // pairs
      ];
      // Single tokens too
      const tokens = text.split(/[\s,\.\؟?!\-:;()0-9]+/).filter((t) => t.length >= 4 && !stopWords.has(t));
      for (const t of tokens) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [conversations]);

  // ---------- NEW: Chef specials conversation rate ----------
  const chefSpecialsRate = useMemo(() => {
    if (conversations.length === 0) return 0;
    if (aiOnlyNames.length === 0) return 0;
    let hits = 0;
    for (const c of conversations) {
      const text = (c.intent || "").toLowerCase();
      // Also detect generic "chef special" / "secret" language
      if (/chef['\s-]*special|secret|off[-\s]*menu|hidden/.test(text)) {
        hits++;
        continue;
      }
      for (const name of aiOnlyNames) {
        if (text.includes(name)) {
          hits++;
          break;
        }
      }
    }
    return Math.round((hits / conversations.length) * 100);
  }, [conversations, aiOnlyNames]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  const hasData = conversations.length > 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {t("dash.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("dash.subtitle")}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <dt>
              <div className="absolute top-5 end-5 rounded-md bg-indigo-50 p-2">
                <item.icon className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {item.name}
              </p>
            </dt>
            <dd className="pb-2">
              <h3 className="text-3xl font-bold text-slate-900">{item.value}</h3>
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    item.changeType === "positive"
                      ? "text-emerald-500 bg-emerald-50"
                      : item.changeType === "negative"
                      ? "text-rose-500 bg-rose-50"
                      : "text-slate-500 bg-slate-50"
                  }`}
                >
                  {item.change}
                </span>
                <span className="text-xs text-slate-400">
                  {isAr ? "مقارنة بالأسبوع الماضي" : "vs last week"}
                </span>
              </div>
            </dd>
          </div>
        ))}
      </div>

      {/* Existing weekly charts */}
      <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-2">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">
              {t("dash.chart.vol")}
            </h2>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="calls" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">
              {t("dash.chart.trend")}
            </h2>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#10B981", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ============ NEW: Premium insights panels ============ */}
      <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-3">
        {/* Peak hours */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h2 className="text-base font-bold text-slate-800">
                {isAr ? "ساعات الذروة" : "Peak hours"}
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {isAr ? "توزيع الأسئلة على 24 ساعة" : "Distribution across 24 hours"}
            </span>
          </div>

          {hasData ? (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHoursData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}:00`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      labelFormatter={(h) => (isAr ? `الساعة ${h}:00` : `${h}:00`)}
                    />
                    <Bar dataKey="count" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {peakHour.count > 0 ? (
                  isAr
                    ? `أكثر ساعة نشاطًا: ${peakHour.hour}:00 (${peakHour.count} ${
                        peakHour.count === 1 ? "محادثة" : "محادثة"
                      }).`
                    : `Busiest hour: ${peakHour.hour}:00 (${peakHour.count} ${
                        peakHour.count === 1 ? "conversation" : "conversations"
                      }).`
                ) : (
                  isAr
                    ? "لا توجد بيانات كافية بعد لتحديد ساعة الذروة."
                    : "Not enough data yet to identify a peak hour."
                )}
              </p>
            </>
          ) : (
            <EmptyInsight text={isAr ? "لا توجد محادثات بعد لرصد ساعات الذروة." : "No conversations yet to identify peak hours."} />
          )}
        </div>

        {/* Chef specials conversation rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-800">
                {isAr ? "أطباق الشيف السرية" : "Chef specials"}
              </h2>
            </div>
          </div>

          {hasData && aiOnlyNames.length > 0 ? (
            <>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                {isAr
                  ? "نسبة المحادثات التي ذكرت أحد أطباقك السرية:"
                  : "Share of conversations that mention one of your secret dishes:"}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-extrabold text-amber-600">{chefSpecialsRate}%</h3>
                <span className="text-xs text-slate-400">
                  {isAr ? `من ${conversations.length} محادثة` : `of ${conversations.length} conversations`}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {chefSpecialsRate < 10
                    ? isAr
                      ? "نسبة منخفضة. جرّب تلميحًا أقوى في تحية المساعد عن وجود أطباق سرية، أو إضافة إشارة على ستاند الطاولة."
                      : "Low. Try a stronger hint in the assistant's greeting about secret dishes, or add a quiet note on the table stand."
                    : chefSpecialsRate < 30
                    ? isAr
                      ? "نسبة معقولة. لوّح للضيوف بالأطباق السرية في لحظة اقتراح المساعد."
                      : "Reasonable. Mention the secret dishes during the assistant's suggestion moment."
                    : isAr
                    ? "نسبة جيدة. ضيوفك يكتشفون الأطباق السرية بنجاح."
                    : "Strong. Your guests are finding your secret dishes successfully."}
                </p>
              </div>
            </>
          ) : (
            <EmptyInsight
              text={
                !hasData
                  ? isAr
                    ? "لا توجد محادثات بعد لقياس هذا الرقم."
                    : "No conversations yet to measure this."
                  : isAr
                  ? "لم تُعلّم أي طبق كـ«سرّي للمساعد فقط». أضِف طبقًا وأفعّل خيار «للمساعد فقط» في صفحة المنيو الرقمي."
                  : "No dishes are marked 'assistant-only' yet. Add a dish and toggle 'assistant-only' on the digital menu page."
              }
            />
          )}
        </div>
      </div>

      {/* Top-asked dishes — full width */}
      <div className="mt-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-800">
              {isAr ? "أكثر الأطباق سؤالاً" : "Most-asked dishes"}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {isAr ? "مستخرجة من نية المحادثات" : "Extracted from conversation intents"}
          </span>
        </div>

        {hasData && topAskedDishes.length > 0 ? (
          <div className="space-y-2">
            {topAskedDishes.map((d, i) => {
              const max = topAskedDishes[0].count || 1;
              const width = Math.max(8, Math.round((d.count / max) * 100));
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-xs font-bold text-slate-700 capitalize truncate">
                    {d.name}
                  </div>
                  <div className="flex-1 h-7 bg-slate-50 rounded-xl overflow-hidden">
                    <div
                      className="h-full bg-indigo-100 rounded-xl flex items-center justify-end pe-2"
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-xs font-extrabold text-indigo-700">{d.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
              {isAr
                ? "هذه أكثر الكلمات تكرارًا في نية محادثات الضيوف. لو رأيت كلمة تُسأل كثيرًا لكن طبقها لا يُطلب، راجع وصف الطبق أو سعره."
                : "These are the most common words in your guests' conversation intents. If a word is asked often but its dish is rarely ordered, review the dish description or its price."}
            </p>
          </div>
        ) : (
          <EmptyInsight text={isAr ? "لا توجد بيانات كافية لاستخراج الأطباق الأكثر سؤالاً." : "Not enough data yet to extract the most-asked dishes."} />
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">
          {t("dash.stream.title")}
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ul role="list" className="divide-y divide-slate-100">
            {conversations.slice(0, 5).map((conv) => (
              <li key={conv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm mb-0.5">{conv.user}</p>
                    <p className="text-xs text-slate-500">{conv.intent}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      conv.status === "Resolved"
                        ? "bg-green-100 text-green-700"
                        : conv.status === "Drop-off"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {conv.status}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(conv.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="p-8 text-center text-sm text-slate-500">
                {isAr ? "لا يوجد نشاط حديث بعد." : "No recent activity yet."}
              </li>
            )}
          </ul>
        </div>
      </div>

      {!hasCompletedOnboarding && !loadingSettings && <OnboardingWizard />}
    </div>
  );
}

function EmptyInsight({ text }: { text: string }) {
  return (
    <div className="py-12 text-center text-slate-400">
      <Activity className="w-8 h-8 mx-auto mb-2 text-slate-200" />
      <p className="text-xs max-w-xs mx-auto leading-relaxed">{text}</p>
    </div>
  );
}
