import { useState, useEffect } from "react";
import { PlayCircle, Download, ExternalLink, Calendar, MessageSquare } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToConversations, Conversation } from "../services/conversations";

export function Conversations() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToConversations(user.uid, (data) => {
      setConversationsList(data);
      setLoading(false);
    }, user.provider === 'local');
    return () => unsubscribe();
  }, [user]);

  const filteredConversations = filter === "All" || filter === t('conv.filter.all')
    ? conversationsList
    : conversationsList.filter(c => c.status === filter);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {t('conv.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('conv.subtitle')}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="block rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border text-slate-700 bg-white"
          >
            <option value="All">{t('conv.filter.all')}</option>
            <option value="Resolved">{t('conv.filter.resolved')}</option>
            <option value="Transferred">{t('conv.filter.transfer')}</option>
            <option value="Converted">{t('conv.filter.converted')}</option>
          </select>
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg shadow-sm text-sm font-medium hover:bg-slate-50 transition-colors">
            {t('conv.btn.export')}
          </button>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow-sm border border-slate-200 rounded-2xl">
        <ul role="list" className="divide-y divide-slate-100">
          {loading ? (
             <li className="p-8 text-center text-sm text-slate-500">
               {language === 'ar' ? 'جاري التحميل...' : 'Loading calls...'}
             </li>
          ) : filteredConversations.length === 0 ? (
            <li className="p-12 text-center text-sm text-slate-500 flex flex-col items-center">
              <MessageSquare className="w-8 h-8 text-slate-200 mb-3" />
              {t('conv.empty')}
            </li>
          ) : (
            filteredConversations.map((conv) => (
              <li key={conv.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between w-full">
                    {/* Left Side: Info */}
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {conv.id}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-400" /> {conv.date}
                        </span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="truncate text-slate-700 font-medium">{conv.user}</span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="truncate font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {conv.intent}
                        </span>
                      </div>
                    </div>
  
                    {/* Right Side: Status and Actions */}
                    <div className="mt-4 flex items-center sm:mt-0 sm:ms-6 gap-3 sm:gap-6 justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            conv.isSuccess
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {conv.status}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">
                          {conv.duration}
                        </span>
                      </div>
  
                      <div className="flex items-center gap-2 sm:gap-3 border-s border-slate-200 ps-3 sm:ps-4">
                        <button
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Play recording"
                        >
                          <PlayCircle className="w-5 h-5" />
                        </button>
                        <button
                          className="text-slate-400 hover:text-indigo-600 transition-colors hidden sm:block"
                          title="View Transcript"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        <button
                          className="text-slate-400 hover:text-indigo-600 transition-colors hidden sm:block"
                          title="Download Audio"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
