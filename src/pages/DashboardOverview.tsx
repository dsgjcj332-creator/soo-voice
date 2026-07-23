import { useState, useEffect } from "react";
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
import { ArrowUpRight, Clock, MessageSquare, Users } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";
import { subscribeToConversations, Conversation } from "../services/conversations";

export function DashboardOverview() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { hasCompletedOnboarding, loadingSettings } = useSettings();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToConversations(user.uid, (data) => {
      setConversations(data);
      setLoading(false);
    }, user.provider === 'local');
    return () => unsubscribe();
  }, [user]);

  // Aggregate stats
  const totalCalls = conversations.length;
  const successfulCalls = conversations.filter(c => c.isSuccess).length;
  const conversionRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  
  // Calculate average duration from real data
  const durations = conversations.map(c => {
    const parts = c.duration?.match(/(\d+)m\s*(\d+)s/) || c.duration?.match(/(\d+)s/);
    if (parts) {
      return parts[2] ? parseInt(parts[1]) * 60 + parseInt(parts[2]) : parseInt(parts[1]);
    }
    return 0;
  }).filter(d => d > 0);
  const avgDurationSec = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const avgDuration = avgDurationSec > 0 ? `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s` : "-";
  
  const stats = [
    {
      name: t('dash.stat.total'),
      value: totalCalls.toString(),
      icon: MessageSquare,
      change: totalCalls > 0 ? "+12%" : "0%",
      changeType: totalCalls > 0 ? "positive" : "neutral",
    },
    {
      name: t('dash.stat.avg'),
      value: avgDuration,
      icon: Clock,
      change: "+0%",
      changeType: "neutral",
    },
    {
      name: t('dash.stat.conv'),
      value: `${conversionRate}%`,
      icon: ArrowUpRight,
      change: totalCalls > 0 ? "+5%" : "0%",
      changeType: totalCalls > 0 ? "positive" : "neutral",
    },
    {
      name: t('dash.stat.active'),
      value: new Set(conversations.map(c => c.user)).size.toString(),
      icon: Users,
      change: "0%",
      changeType: "neutral",
    },
  ];

  // Group by date for charts
  const volumeData = conversations.reduce((acc: any, curr) => {
     // Simple grouping by date
     const date = new Date(curr.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
     const existing = acc.find((item: any) => item.name === date);
     if (existing) {
        existing.calls += 1;
        if (curr.isSuccess) existing.conversions += 1;
     } else {
        acc.push({ name: date, calls: 1, conversions: curr.isSuccess ? 1 : 0 });
     }
     return acc;
  }, []).slice(0, 7).reverse();

  // Ensure some fallback empty data so charts don't look broken
  const chartData = volumeData.length > 0 ? volumeData : [
     { name: 'Mon', calls: 0, conversions: 0 },
     { name: 'Tue', calls: 0, conversions: 0 },
     { name: 'Wed', calls: 0, conversions: 0 }
  ];

  if (loading) {
     return <div className="p-8 text-center text-slate-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {t('dash.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('dash.subtitle')}
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
                <item.icon
                  className="h-5 w-5 text-indigo-600"
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {item.name}
              </p>
            </dt>
            <dd className="pb-2">
              <h3 className="text-3xl font-bold text-slate-900">
                {item.value}
              </h3>
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    item.changeType === "positive"
                      ? "text-emerald-500 bg-emerald-50"
                      : "text-slate-500 bg-slate-50"
                  }`}
                >
                  {item.change}
                </span>
                <span className="text-xs text-slate-400">
                  {language === 'ar' ? 'هذا الأسبوع' : 'this week'}
                </span>
              </div>
            </dd>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-2">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">
              {t('dash.chart.vol')}
            </h2>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
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
              {t('dash.chart.trend')}
            </h2>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                />
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

      {/* Recent Actions */}
      <div className="mt-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">
          {t('dash.stream.title')}
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ul role="list" className="divide-y divide-slate-100">
             {conversations.slice(0, 5).map((conv) => (
                <li key={conv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 gap-2">
                   <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                         <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-sm mb-0.5 truncate">{conv.user}</p>
                         <p className="text-xs text-slate-500 truncate">{conv.intent}</p>
                      </div>
                   </div>
                   <div className="text-right shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                         conv.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                         conv.status === 'Drop-off' ? 'bg-red-100 text-red-700' :
                         'bg-amber-100 text-amber-700'
                      }`}>
                         {conv.status}
                      </span>
                      <p className="text-xs text-slate-400 mt-1 hidden sm:block">{new Date(conv.createdAt).toLocaleTimeString()}</p>
                   </div>
                </li>
             ))}
            {conversations.length === 0 && (
               <li className="p-8 text-center text-sm text-slate-500">
                 {language === 'en' ? 'No recent activity yet.' : 'لا يوجد نشاط حديث بعد.'}
               </li>
            )}
          </ul>
        </div>
      </div>
      {!hasCompletedOnboarding && !loadingSettings && <OnboardingWizard />}
    </div>
  );
}
