import React, { useRef, useState, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  Trash2,
  HelpCircle,
  Save,
  Plus,
  Check,
  Info,
  Clock,
  Phone,
  MapPin,
  Building2,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useKnowledge, KnowledgeDocument } from "../contexts/KnowledgeContext";

/**
 * Restaurant Profile — the knowledge base the assistant is bound by.
 *
 * The earlier interface labelled this "AI Brain & Profile" and asked the
 * merchant to fill in "Structured Profile" JSON fields. That language fits
 * a developer, not a restaurant owner. The data is the same (we still
 * upsert a `business_profile` document to the same Supabase row), but the
 * questions are written the way a host would speak.
 *
 * Three sections:
 *   - Profile: identity + story + hours + location + payment + policies
 *   - FAQ: questions you hear often, with exact answers
 *   - Files: uploaded reference documents
 *
 * Plus a fourth, new section: "What the assistant must not say" — the
 * restaurant's own list of subjects the assistant should refuse or
 * redirect. Stored alongside the profile under `never_say`, parsed
 * transparently.
 */

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface NeverSayItem {
  id: string;
  topic: string;
  response: string;
}

interface ProfileData {
  companyName: string;
  companyOverview: string;
  companyPhone: string;
  companyAddress: string;
  companyHours: string;
  paymentMethods: string;
  deliveryPolicy: string;
  refundPolicy: string;
  neverSay: NeverSayItem[];
}

const DEFAULT_PROFILE: ProfileData = {
  companyName: "",
  companyOverview: "",
  companyPhone: "",
  companyAddress: "",
  companyHours: "",
  paymentMethods: "",
  deliveryPolicy: "",
  refundPolicy: "",
  neverSay: [],
};

export function KnowledgeBase() {
  const { language } = useLanguage();
  const { documents, addDocument, addOrUpdateDocument, removeDocument } = useKnowledge();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"profile" | "faqs" | "files">("profile");
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [faqSaveStatus, setFaqSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  // New "never say" inline-add fields (kept inside the profile tab)
  const [newTopic, setNewTopic] = useState("");
  const [newResponse, setNewResponse] = useState("");

  // Parse existing structured documents from context
  useEffect(() => {
    const profileDoc = documents.find((d) => d.id === "business_profile");
    if (profileDoc && profileDoc.content) {
      try {
        const parsed = JSON.parse(profileDoc.content);
        setProfile({
          companyName: parsed.companyName || "",
          companyOverview: parsed.companyOverview || "",
          companyPhone: parsed.companyPhone || "",
          companyAddress: parsed.companyAddress || "",
          companyHours: parsed.companyHours || "",
          paymentMethods: parsed.paymentMethods || "",
          deliveryPolicy: parsed.deliveryPolicy || "",
          refundPolicy: parsed.refundPolicy || "",
          neverSay: Array.isArray(parsed.neverSay) ? parsed.neverSay : [],
        });
      } catch (err) {
        console.error("Error parsing business profile content:", err);
      }
    }

    const faqDoc = documents.find((d) => d.id === "strict_faqs");
    if (faqDoc && faqDoc.content) {
      try {
        const parsed = JSON.parse(faqDoc.content);
        if (Array.isArray(parsed)) setFaqs(parsed);
      } catch (err) {
        console.error("Error parsing FAQs content:", err);
      }
    }
  }, [documents]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    if (saveStatus === "success") setSaveStatus("idle");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await addOrUpdateDocument(
        "business_profile",
        "Restaurant Profile",
        "Structured Profile",
        JSON.stringify(profile)
      );
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };

  const handleAddNeverSay = () => {
    if (!newTopic.trim() || !newResponse.trim()) return;
    const item: NeverSayItem = {
      id: "ns_" + Math.random().toString(36).substring(2, 11),
      topic: newTopic.trim(),
      response: newResponse.trim(),
    };
    const updated = [...profile.neverSay, item];
    setProfile((prev) => ({ ...prev, neverSay: updated }));
    setNewTopic("");
    setNewResponse("");
    if (saveStatus === "success") setSaveStatus("idle");
  };

  const handleDeleteNeverSay = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      neverSay: prev.neverSay.filter((n) => n.id !== id),
    }));
    if (saveStatus === "success") setSaveStatus("idle");
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newFaq: FAQItem = {
      id: "faq_" + Math.random().toString(36).substring(2, 11),
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
    };

    const updatedFaqs = [...faqs, newFaq];
    setFaqs(updatedFaqs);
    setNewQuestion("");
    setNewAnswer("");
    setFaqSaveStatus("saving");

    try {
      await addOrUpdateDocument(
        "strict_faqs",
        "Frequently asked questions",
        "Structured FAQs",
        JSON.stringify(updatedFaqs)
      );
      setFaqSaveStatus("success");
      setTimeout(() => setFaqSaveStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    const confirmMsg = isAr
      ? "هل تريد حذف هذا السؤال؟"
      : "Delete this question?";
    if (!window.confirm(confirmMsg)) return;

    const updatedFaqs = faqs.filter((f) => f.id !== faqId);
    setFaqs(updatedFaqs);

    try {
      await addOrUpdateDocument(
        "strict_faqs",
        "Frequently asked questions",
        "Structured FAQs",
        JSON.stringify(updatedFaqs)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        await addDocument(file.name, content);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const uploadedFilesOnly = documents.filter(
    (d) => d.id !== "business_profile" && d.id !== "strict_faqs"
  );

  const tabItems = [
    { id: "profile" as const, labelAr: "مطعمك", labelEn: "Your restaurant", icon: Building2 },
    { id: "faqs" as const, labelAr: "أسئلة ضيوفك", labelEn: "Guest questions", icon: HelpCircle },
    { id: "files" as const, labelAr: "ملفات مرجعية", labelEn: "Reference files", icon: FileText },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {isAr ? "مطعمك" : "Your restaurant"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed max-w-2xl">
          {isAr
            ? "هذه هي المعلومات التي يعتمد عليها مساعدك الصوتي. كلما كانت أدق، كانت إجاباته أوفى. اكتبها كما تحكي لضيفك."
            : "This is what your voice assistant relies on. The more precise it is, the better the answers. Write it as you would tell a guest."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2 scrollbar-none">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* ============ Profile tab ============ */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Notice */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-sm text-indigo-900">
            <Info className="w-5 h-5 shrink-0 text-indigo-500 mt-0.5" />
            <div>
              <p className="font-bold">
                {isAr ? "ما تكتبه هنا، يلتزم به المساعد." : "What you write here, the assistant commits to."}
              </p>
              <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">
                {isAr
                  ? "المساعد لا يخترع معلومات خارج هذا الملف. إن سُئل عن شيء غير مذكور هنا، يكتفي بأن يقول إنه لا يعرف."
                  : "The assistant does not invent information beyond this profile. If asked about something not listed here, it says it does not know."}
              </p>
            </div>
          </div>

          {/* Identity card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-indigo-500" />
              {isAr ? "هوية المطعم" : "Identity"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {isAr ? "اسم المطعم" : "Restaurant name"}
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={profile.companyName}
                  onChange={handleProfileChange}
                  placeholder={isAr ? "مثال: مطعم الأصالة" : "e.g. Asala"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {isAr ? "رقم الهاتف / الواتساب" : "Phone / WhatsApp"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    name="companyPhone"
                    value={profile.companyPhone}
                    onChange={handleProfileChange}
                    placeholder={isAr ? "مثال: +20 100 000 0000" : "e.g. +20 100 000 0000"}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl ps-10 pe-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {isAr ? "قصة مطعمك" : "Your restaurant's story"}
              </label>
              <textarea
                name="companyOverview"
                rows={3}
                value={profile.companyOverview}
                onChange={handleProfileChange}
                placeholder={
                  isAr
                    ? "اكتب هنا كما تحكي لضيفك: ما تطبخه، من أين جاء، ما الذي يميزك..."
                    : "Write as you would tell a guest: what you cook, where it came from, what sets you apart..."
                }
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
              />
            </div>
          </div>

          {/* Operations card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5 text-indigo-500" />
              {isAr ? "التشغيل والموقع" : "Operations & location"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {isAr ? "العنوان" : "Address"}
                </label>
                <textarea
                  name="companyAddress"
                  rows={2}
                  value={profile.companyAddress}
                  onChange={handleProfileChange}
                  placeholder={isAr ? "مثال: 15 شارع التحرير، الدقي، الجيزة" : "e.g. 15 Tahreer St, Dokki, Giza"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {isAr ? "أوقات العمل" : "Opening hours"}
                </label>
                <textarea
                  name="companyHours"
                  rows={2}
                  value={profile.companyHours}
                  onChange={handleProfileChange}
                  placeholder={isAr ? "مثال: يوميًا من 12 ظهرًا حتى 12 منتصف الليل، عدا الجمعة من 2 ظهرًا" : "e.g. Daily 12pm–12am; Fridays 2pm–12am"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {isAr ? "طرق الدفع" : "Payment methods"}
                </label>
                <textarea
                  name="paymentMethods"
                  rows={2}
                  value={profile.paymentMethods}
                  onChange={handleProfileChange}
                  placeholder={isAr ? "مثال: نقدي، فيزا، ماستركارد، فودافون كاش" : "e.g. Cash, Visa, Mastercard, mobile wallet"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {isAr ? "سياسة التوصيل" : "Delivery policy"}
                </label>
                <textarea
                  name="deliveryPolicy"
                  rows={2}
                  value={profile.deliveryPolicy}
                  onChange={handleProfileChange}
                  placeholder={isAr ? "مثال: داخل نطاق 5 كم، 30 ج.م رسوم" : "e.g. within 5km, EGP 30 fee"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {isAr ? "سياسة الاسترجاع" : "Refund policy"}
              </label>
              <textarea
                name="refundPolicy"
                rows={2}
                value={profile.refundPolicy}
                onChange={handleProfileChange}
                placeholder={isAr ? "مثال: لا استرجاع بعد إرسال الطلب للمطبخ" : "e.g. no refunds after the order reaches the kitchen"}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
              />
            </div>
          </div>

          {/* ============ What the assistant must not say ============ */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldX className="w-5 h-5 text-rose-500" />
              {isAr ? "ما لا يُسمح لمساعدك بقوله" : "What your assistant must not say"}
            </h3>

            <div className="flex gap-3 items-start text-sm">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-slate-600 leading-relaxed">
                {isAr
                  ? "لكل مطعم مواضيع يفضّل ألا يتطرق إليها المساعد — وصفات الشيف، تكلفة الأطباق، آراء في المنافسين. أضِف هنا ما تريد للمساعد أن يرفضه أو يحيله لموظف، وكيف تريد أن يرد عند سؤاله عنه."
                  : "Every restaurant has subjects the assistant should not approach — chef recipes, dish cost, opinions on competitors. Add here what you want it to refuse or escalate, and how it should respond when asked."}
              </p>
            </div>

            {/* Existing list */}
            {profile.neverSay.length > 0 && (
              <div className="space-y-2">
                {profile.neverSay.map((ns) => (
                  <div
                    key={ns.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-rose-100 bg-rose-50/40"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-700">
                        {isAr ? "لا تقل:" : "Do not say:"} <span className="text-rose-700">{ns.topic}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {isAr ? "الردّ:" : "Reply:"} <span className="text-slate-700">{ns.response}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNeverSay(ns.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new */}
            <div className="border border-dashed border-slate-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {isAr ? "إضافة موضوع جديد" : "Add a new subject"}
              </p>
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder={isAr ? "ما هو الموضوع؟ (مثال: وصفة برجر الأصالة)" : "What is the subject? (e.g. the Asala burger recipe)"}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 outline-none transition-all"
              />
              <input
                type="text"
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                placeholder={isAr ? "كيف يرد المساعد؟ (مثال: «هذه سرّ الشيف — يسعدني أن أحضر لك الطبق بدلاً من ذلك.»)" : "How should the assistant reply? (e.g. \"That is the chef's secret — I'd be glad to bring you the dish instead.\")"}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-800 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleAddNeverSay}
                disabled={!newTopic.trim() || !newResponse.trim()}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAr ? "أضف للقائمة" : "Add to list"}
              </button>
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
              disabled={saveStatus === "saving"}
            >
              <Save className="w-4 h-4" />
              {saveStatus === "saving"
                ? isAr ? "جاري الحفظ..." : "Saving..."
                : isAr ? "حفظ ملف المطعم" : "Save restaurant profile"}
            </button>

            {saveStatus === "success" && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                {isAr ? "تم الحفظ" : "Saved"}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs font-bold text-rose-600">
                {isAr ? "تعذّر الحفظ — حاول مرة أخرى" : "Could not save — try again"}
              </span>
            )}
          </div>
        </form>
      )}

      {/* ============ FAQ tab ============ */}
      {activeTab === "faqs" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              {isAr ? "أسئلة تسمعها كثيرًا" : "Questions you hear often"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {isAr
                ? "أضف الأسئلة التي يكررها ضيوفك، مع الإجابة التي تريد أن يقولها المساعد حرفيًا."
                : "Add questions your guests repeat, with the exact answer you want the assistant to give."}
            </p>

            <form onSubmit={handleAddFaq} className="space-y-3">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder={isAr ? "السؤال..." : "Question..."}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
              />
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder={isAr ? "الإجابة كما تريد أن تُقال..." : "The answer as it should be spoken..."}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
              />
              <button
                type="submit"
                disabled={!newQuestion.trim() || !newAnswer.trim()}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAr ? "أضف السؤال" : "Add question"}
              </button>
              {faqSaveStatus === "success" && (
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {isAr ? "تم الحفظ" : "Saved"}
                </p>
              )}
            </form>
          </div>

          {faqs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <HelpCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-500">{isAr ? "لا توجد أسئلة بعد" : "No questions yet"}</p>
              <p className="text-xs mt-1">{isAr ? "أضف أول سؤال يكرره ضيوفك." : "Add the first question your guests repeat."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm">{faq.question}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{faq.answer}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteFaq(faq.id)}
                      className="text-slate-300 hover:text-rose-600 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ Files tab ============ */}
      {activeTab === "files" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-indigo-500" />
              {isAr ? "ملفات مرجعية" : "Reference files"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {isAr
                ? "ارفع ملفات نصية (txt, md) يستعين بها المساعد عند الحاجة — قائمة الموردين، شهادات الجودة، أوراق الحساسية الغذائية."
                : "Upload text files (txt, md) the assistant can use when needed — supplier lists, quality certificates, allergen sheets."}
            </p>

            <button
              onClick={handleTriggerUpload}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {isAr ? "رفع ملف" : "Upload file"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {uploadedFilesOnly.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-500">{isAr ? "لا توجد ملفات" : "No files"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadedFilesOnly.map((doc: KnowledgeDocument) => (
                <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-slate-300 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
