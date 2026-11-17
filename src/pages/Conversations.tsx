import { useEffect, useMemo, useState } from "react";
import {
  PlayCircle,
  Download,
  FileText,
  Calendar,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToConversations, Conversation } from "../services/conversations";

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getTranscript(conversation: Conversation): string {
  for (const key of ["transcript", "transcript_text", "transcriptText", "conversation_text"]) {
    const value = readText(conversation[key]);
    if (value.trim()) return value;
  }
  return "";
}

function getRecordingUrl(conversation: Conversation): string {
  for (const key of ["recordingUrl", "recording_url", "audioUrl", "audio_url", "recording"]) {
    const value = readText(conversation[key]).trim();
    if (!value) continue;
    try {
      const parsed = new URL(value, window.location.origin);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
    } catch {
      // Ignore malformed or unsupported media URLs.
    }
  }
  return "";
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export function Conversations() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    setConversationsList([]);
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.provider === "local") {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToConversations(
      user.uid,
      (data) => {
        setConversationsList(data);
        setLoading(false);
      },
      (message) => {
        setLoadError(message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user?.uid, user?.provider]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversationsList.filter((conversation) => {
      const statusMatches = filter === "All" || conversation.status === filter;
      const searchable = [
        conversation.id,
        conversation.user,
        conversation.intent,
        conversation.status,
        getTranscript(conversation),
      ].map((value) => String(value ?? "").toLowerCase()).join(" ");
      return statusMatches && (!query || searchable.includes(query));
    });
  }, [conversationsList, filter, search]);

  const exportCsv = () => {
    const columns = [
      "id", "date", "user", "intent", "status", "duration", "isSuccess", "transcript",
    ];
    const rows = filteredConversations.map((conversation) => [
      conversation.id,
      conversation.date,
      conversation.user,
      conversation.intent,
      conversation.status,
      conversation.duration,
      conversation.isSuccess,
      getTranscript(conversation),
    ]);
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `soovoice-conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const selectedTranscript = selectedConversation ? getTranscript(selectedConversation) : "";
  const selectedRecording = selectedConversation ? getRecordingUrl(selectedConversation) : "";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">{t("conv.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("conv.subtitle")}</p>
          <p className="mt-2 text-xs text-slate-400">
            {isAr ? `عدد المحادثات: ${conversationsList.length}` : `${conversationsList.length} conversations`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isAr ? "ابحث بالاسم أو النية أو النص..." : "Search name, intent or transcript..."}
              className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white py-2 ps-9 pe-3 text-sm text-slate-700"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="All">{t("conv.filter.all")}</option>
            <option value="Resolved">{t("conv.filter.resolved")}</option>
            <option value="Transferred">{t("conv.filter.transfer")}</option>
            <option value="Converted">{t("conv.filter.converted")}</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredConversations.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("conv.btn.export")}
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {isAr ? "تعذر تحميل بعض بيانات المحادثات. راجع إعدادات الاتصال والصلاحيات." : "Some conversation data could not be loaded. Check the connection and access policies."}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul role="list" className="divide-y divide-slate-100">
          {loading ? (
            <li className="p-8 text-center text-sm text-slate-500">
              {isAr ? "جاري تحميل المحادثات..." : "Loading conversations..."}
            </li>
          ) : filteredConversations.length === 0 ? (
            <li className="flex flex-col items-center p-12 text-center text-sm text-slate-500">
              <MessageSquare className="mb-3 h-8 w-8 text-slate-200" />
              <span>{search || filter !== "All"
                ? (isAr ? "مفيش نتائج مطابقة للبحث أو الفلتر." : "No conversations match this search or filter.")
                : t("conv.empty")}</span>
            </li>
          ) : (
            filteredConversations.map((conv) => {
              const transcriptAvailable = Boolean(getTranscript(conv));
              const recordingAvailable = Boolean(getRecordingUrl(conv));
              return (
                <li key={conv.id} className="transition-colors hover:bg-slate-50">
                  <div className="flex flex-col justify-between gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-sm font-semibold text-indigo-600">{conv.id}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-slate-400" /> {conv.date || "—"}
                        </span>
                        <span className="font-medium text-slate-700">{conv.user || (isAr ? "زائر" : "Guest")}</span>
                        {conv.intent && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">{conv.intent}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${conv.isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {conv.status || (isAr ? "غير محدد" : "Unknown")}
                        </span>
                        <span className="rounded bg-slate-50 px-2 py-1 font-mono text-sm text-slate-500">{conv.duration || "—"}</span>
                      </div>
                      <div className="flex items-center gap-3 border-s border-slate-200 ps-4">
                        <button
                          type="button"
                          disabled={!recordingAvailable}
                          onClick={() => setSelectedConversation(conv)}
                          className="text-slate-400 transition-colors hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                          title={isAr ? "تشغيل التسجيل" : "Play recording"}
                          aria-label={isAr ? "تشغيل التسجيل" : "Play recording"}
                        >
                          <PlayCircle className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          disabled={!transcriptAvailable}
                          onClick={() => setSelectedConversation(conv)}
                          className="text-slate-400 transition-colors hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                          title={isAr ? "عرض النص" : "View transcript"}
                          aria-label={isAr ? "عرض النص" : "View transcript"}
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                        <a
                          href={getRecordingUrl(conv) || undefined}
                          download
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!recordingAvailable}
                          onClick={(event) => { if (!recordingAvailable) event.preventDefault(); }}
                          className="text-slate-400 transition-colors hover:text-indigo-600 aria-disabled:pointer-events-none aria-disabled:opacity-30"
                          title={isAr ? "تنزيل التسجيل" : "Download recording"}
                          aria-label={isAr ? "تنزيل التسجيل" : "Download recording"}
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="conversation-detail-title">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="conversation-detail-title" className="font-bold text-slate-900">
                  {isAr ? "تفاصيل المحادثة" : "Conversation details"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">{selectedConversation.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedConversation(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={isAr ? "إغلاق" : "Close"}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {selectedRecording && (
              <div className="mb-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">{isAr ? "التسجيل الصوتي" : "Audio recording"}</p>
                <audio controls preload="none" className="w-full" src={selectedRecording}>
                  {isAr ? "المتصفح لا يدعم تشغيل الصوت." : "Your browser does not support audio playback."}
                </audio>
                <a href={selectedRecording} download target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                  <Download className="h-4 w-4" /> {isAr ? "تنزيل التسجيل" : "Download recording"}
                </a>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">{isAr ? "نص المحادثة" : "Transcript"}</p>
              {selectedTranscript ? (
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedTranscript}</pre>
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  {isAr ? "لا يوجد نص محفوظ لهذه المحادثة." : "No transcript is stored for this conversation."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
