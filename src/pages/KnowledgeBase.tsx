import React, { useRef, useState, useEffect } from "react";
import { 
  FileText, 
  Link as LinkIcon, 
  UploadCloud, 
  Database, 
  Trash2, 
  Building2, 
  HelpCircle, 
  Save, 
  Plus, 
  Check, 
  AlertCircle, 
  Info,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  RotateCcw
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useKnowledge, KnowledgeDocument } from "../contexts/KnowledgeContext";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
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
}

const DEFAULT_PROFILE: ProfileData = {
  companyName: "",
  companyOverview: "",
  companyPhone: "",
  companyAddress: "",
  companyHours: "",
  paymentMethods: "",
  deliveryPolicy: "",
  refundPolicy: ""
};

export function KnowledgeBase() {
  const { t, language } = useLanguage();
  const { documents, addDocument, addOrUpdateDocument, removeDocument } = useKnowledge();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"profile" | "faqs" | "files">("profile");

  // Profile Form States
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // FAQ States
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [faqSaveStatus, setFaqSaveStatus] = useState<"idle" | "saving" | "success">("idle");

  // Parse existing structured documents from context
  useEffect(() => {
    // 1. Find and parse business profile doc
    const profileDoc = documents.find(d => d.id === "business_profile");
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
          refundPolicy: parsed.refundPolicy || ""
        });
      } catch (err) {
        console.error("Error parsing business profile content:", err);
      }
    }

    // 2. Find and parse FAQs doc
    const faqDoc = documents.find(d => d.id === "strict_faqs");
    if (faqDoc && faqDoc.content) {
      try {
        const parsed = JSON.parse(faqDoc.content);
        if (Array.isArray(parsed)) {
          setFaqs(parsed);
        }
      } catch (err) {
        console.error("Error parsing FAQs content:", err);
      }
    }
  }, [documents]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    if (saveStatus === "success") setSaveStatus("idle");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await addOrUpdateDocument(
        "business_profile",
        "Business Profile",
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

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newFaq: FAQItem = {
      id: "faq_" + Math.random().toString(36).substring(2, 11),
      question: newQuestion.trim(),
      answer: newAnswer.trim()
    };

    const updatedFaqs = [...faqs, newFaq];
    setFaqs(updatedFaqs);
    setNewQuestion("");
    setNewAnswer("");
    setFaqSaveStatus("saving");

    try {
      await addOrUpdateDocument(
        "strict_faqs",
        "Strict FAQs",
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
    const confirmMsg = language === "ar" ? "هل أنت متأكد من حذف هذا السؤال؟" : "Are you sure you want to delete this question?";
    if (!window.confirm(confirmMsg)) return;

    const updatedFaqs = faqs.filter(f => f.id !== faqId);
    setFaqs(updatedFaqs);

    try {
      await addOrUpdateDocument(
        "strict_faqs",
        "Strict FAQs",
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

  // Filter out the structured docs from the standard uploaded documents table
  const uploadedFilesOnly = documents.filter(
    d => d.id !== "business_profile" && d.id !== "strict_faqs"
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto font-sans" id="kb-root-container">
      {/* Title Header */}
      <div className="mb-8" id="kb-header-block">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800" id="kb-main-title">
          {t('kb.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500" id="kb-main-subtitle">
          {t('kb.subtitle')}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2 scrollbar-none" id="kb-tabs-bar">
        <button
          id="tab-btn-profile"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "profile"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {language === "ar" ? "ملف وثقافة الشركة" : "Company Profile"}
        </button>

        <button
          id="tab-btn-faqs"
          onClick={() => setActiveTab("faqs")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "faqs"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          {language === "ar" ? "الأسئلة الشائعة والأجوبة الدقيقة" : "Strict FAQ Guide"}
        </button>

        <button
          id="tab-btn-files"
          onClick={() => setActiveTab("files")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "files"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          <FileText className="w-4 h-4" />
          {language === "ar" ? "الملفات وقواعد البيانات RAG" : "Indexed Documents (RAG)"}
        </button>
      </div>

      {/* TAB CONTENT 1: BUSINESS PROFILE */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6" id="profile-form">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex gap-3 text-sm text-amber-800" id="profile-strict-notice">
            <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">
                {language === "ar" ? "توجيه ذكي وصارم للمساعد الصوتي:" : "Strict AI Guardrails Info:"}
              </p>
              <p className="text-xs text-amber-700/90 mt-1 leading-relaxed">
                {language === "ar"
                  ? "عندما يملأ التاجر هذه المعلومات، يلتزم المساعد الصوتي (الذكاء الاصطناعي) بها تماماً ولا يخترع معلومات خارجها. على سبيل المثال: سيجيب بأسعار الفروع ومواعيد العمل والسياسات المدونة هنا بدقة متناهية."
                  : "By filling these details, the Voice AI agent gains absolute knowledge about your brand, hours, branch location, policies, and channels, and is strictly restricted from making up facts outside this profile."}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6" id="profile-fields-card">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-indigo-500" />
              {language === "ar" ? "معلومات الهوية الأساسية" : "Basic Brand Identity"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {language === "ar" ? "اسم الشركة / المحل التجاري" : "Company / Brand Name"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="companyName"
                    value={profile.companyName}
                    onChange={handleProfileChange}
                    placeholder={language === "ar" ? "مثال: شاورما جراج، عقارات النخبة..." : "e.g., Shawarma Garage, Elite Estates..."}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {language === "ar" ? "رقم الهاتف والواتساب للدعم" : "Contact Phone / WhatsApp"}
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
                    placeholder={language === "ar" ? "مثال: +966 50 123 4567" : "e.g., +966 50 123 4567"}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl ps-10 pe-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {language === "ar" ? "نبذة عن الشركة، الرسالة والنشاط" : "Brand Mission & Overview"}
              </label>
              <textarea
                name="companyOverview"
                rows={3}
                value={profile.companyOverview}
                onChange={handleProfileChange}
                placeholder={language === "ar" ? "اكتب نبذة كاملة عن شركتك، ما الذي تقدمه، رسالتها، وقيمها للعملاء..." : "Brief overview of what you do, your primary focus, and what sets you apart..."}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-6" id="profile-ops-card">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5 text-indigo-500" />
              {language === "ar" ? "تفاصيل التشغيل والموقع والسياسات" : "Operational Details & Policies"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {language === "ar" ? "العناوين، الفروع والموقع الجغرافي" : "Addresses & Branches Location"}
                </label>
                <textarea
                  name="companyAddress"
                  rows={2}
                  value={profile.companyAddress}
                  onChange={handleProfileChange}
                  placeholder={language === "ar" ? "مثال: الفرع الرئيسي في الرياض حي الصحافة، وفرع جدة شارع التحلية..." : "e.g., Main branch in Riyadh Olaya Dist, Jeddah branch on Tahlia St..."}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {language === "ar" ? "أوقات ومواعيد العمل الرسمية" : "Working & Opening Hours"}
                </label>
                <textarea
                  name="companyHours"
                  rows={2}
                  value={profile.companyHours}
                  onChange={handleProfileChange}
                  placeholder={language === "ar" ? "مثال: يومياً من الساعة 1 ظهرًا حتى 1 بعد منتصف الليل، والجمعة من 4 عصراً..." : "e.g., Daily from 1 PM to 1 AM, Fridays from 4 PM to 2 AM..."}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  {language === "ar" ? "طرق الدفع المقبولة" : "Accepted Payment Methods"}
                </label>
                <input
                  type="text"
                  name="paymentMethods"
                  value={profile.paymentMethods}
                  onChange={handleProfileChange}
                  placeholder={language === "ar" ? "مثال: نقداً، مدى، فيزا، Apple Pay" : "e.g., Cash on delivery, Visa, Apple Pay"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  {language === "ar" ? "الشحن ومناطق وأسعار التوصيل" : "Shipping & Delivery Policy"}
                </label>
                <input
                  type="text"
                  name="deliveryPolicy"
                  value={profile.deliveryPolicy}
                  onChange={handleProfileChange}
                  placeholder={language === "ar" ? "مثال: توصيل مجاني للطلبات فوق 150 ريال، التوصيل بـ 15 ريال" : "e.g., Free shipping over $50, standard shipping $5"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  {language === "ar" ? "سياسة الاسترجاع والتبديل" : "Return & Refund Policy"}
                </label>
                <input
                  type="text"
                  name="refundPolicy"
                  value={profile.refundPolicy}
                  onChange={handleProfileChange}
                  placeholder={language === "ar" ? "مثال: الاسترجاع خلال 7 أيام والتبديل خلال 14 يوماً" : "e.g., Refund within 7 days, exchange within 14 days"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Action Trigger Row */}
          <div className="flex items-center justify-end gap-3 pt-2" id="profile-action-row">
            {saveStatus === "success" && (
              <span className="text-sm text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <Check className="w-4 h-4 animate-bounce" />
                {language === "ar" ? "تم حفظ وتحديث ملف الشركة بنجاح!" : "Profile updated successfully!"}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm text-red-600 font-bold flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                <AlertCircle className="w-4 h-4" />
                {language === "ar" ? "فشل حفظ الملف. حاول مجدداً." : "Failed to save profile. Try again."}
              </span>
            )}

            <button
              id="save-profile-btn"
              type="submit"
              disabled={saveStatus === "saving"}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveStatus === "saving" 
                ? (language === "ar" ? "جاري الحفظ..." : "Saving...") 
                : (language === "ar" ? "حفظ ملف الشركة والسياسات" : "Save Company Profile")}
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT 2: CUSTOM FAQS */}
      {activeTab === "faqs" && (
        <div className="space-y-6" id="faqs-tab-content">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex gap-3 text-sm text-blue-800" id="faqs-strict-notice">
            <Info className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold">
                {language === "ar" ? "أجوبة مخصصة ودقيقة للغاية (Strict FAQs):" : "Custom Direct Answers (Strict FAQs):"}
              </p>
              <p className="text-xs text-blue-700/90 mt-1 leading-relaxed">
                {language === "ar"
                  ? "أضف هنا الأسئلة المتكررة الشائعة للعملاء وإجاباتها الدقيقة المحددة. المساعد الصوتي سيتبنى هذه الصيغ الدقيقة فوراً لحسم نقاشات العملاء والطلبات الخاصة."
                  : "Insert standard client queries and their precise replies here. The Voice AI will immediately look up these matching questions first to serve callers perfectly."}
              </p>
            </div>
          </div>

          {/* New FAQ Form */}
          <form onSubmit={handleAddFaq} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4" id="add-faq-form">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Plus className="w-4 h-4 text-indigo-600" />
              {language === "ar" ? "إضافة سؤال وجواب جديد" : "Add New FAQ Rule"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder={language === "ar" ? "اكتب السؤال الشائع هنا... (مثل: هل يوجد توصيل مجاني؟)" : "Write standard question... (e.g., Is there a promo code?)"}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder={language === "ar" ? "اكتب الجواب الدقيق الملتزم به... (مثل: التوصيل مجاني للطلبات فوق 200 ريال)" : "Write strict precise answer..."}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2" id="faq-form-actions">
              <button
                id="add-faq-btn"
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                {language === "ar" ? "إدراج السؤال في عقل الإيجنت" : "Add FAQ Rule"}
              </button>
            </div>
          </form>

          {/* FAQs List */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden" id="faqs-list-card">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between" id="faqs-list-header">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {language === "ar" ? "قائمة الأسئلة الشائعة المسجلة" : "Configured FAQ Database"}
              </h4>
              {faqSaveStatus === "success" && (
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">
                  {language === "ar" ? "مزامنة ناجحة!" : "Synced!"}
                </span>
              )}
            </div>

            {faqs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm" id="faqs-empty-state">
                {language === "ar"
                  ? "لا يوجد أسئلة مخصصة حالياً. أضف أسئلة بالأعلى لتبدأ المزامنة."
                  : "No FAQ items configured yet. Add questions above to teach your AI agent."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100" id="faqs-rows-container">
                {faqs.map((faq, index) => (
                  <div key={faq.id || index} className="p-6 hover:bg-slate-50/50 flex justify-between items-start gap-4 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">Q</span>
                        {faq.question}
                      </p>
                      <p className="text-sm text-slate-500 ps-7 flex items-start gap-2">
                        <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">A</span>
                        {faq.answer}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteFaq(faq.id)}
                      className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title={language === "ar" ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: ORIGINAL FILES MANAGER */}
      {activeTab === "files" && (
        <div className="space-y-6" id="files-tab-content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2" id="kb-actions-grid">
            <div 
              id="file-upload-card"
              onClick={handleTriggerUpload}
              className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center"
            >
              <input 
                type="file" 
                accept=".txt,.csv,.json"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
              />
              <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-800">
                {language === 'ar' ? 'رفع ملفات' : 'Upload Files'}
              </h3>
              <p className="text-xs text-slate-500 mt-2">TXT, CSV, JSON</p>
            </div>

            <div className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-not-allowed opacity-70 flex flex-col items-center">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <LinkIcon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-800">
                {language === 'ar' ? 'مزامنة موقع ويب' : 'Sync Website'}
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                {language === 'ar' ? 'قريباً' : 'Coming soon'}
              </p>
            </div>

            <div className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-not-allowed opacity-70 flex flex-col items-center">
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-800">
                {language === 'ar' ? 'قاعدة بيانات' : 'Database API'}
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                {language === 'ar' ? 'قريباً' : 'Coming soon'}
              </p>
            </div>
          </div>

          <h2 className="text-base font-bold text-slate-800 mb-2">
            {language === 'ar' ? 'المستندات وقواعد البيانات المرتبطة' : 'Indexed Documents'}
          </h2>
          
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden" id="files-table-card">
            {uploadedFilesOnly.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {language === 'ar' ? 'لا يوجد ملفات حالياً. جرب رفع ملف نصي .txt' : 'No documents yet. Try uploading a .txt file!'}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200" id="files-table">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-start text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {language === 'ar' ? 'الاسم' : 'Name'}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-start text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {language === 'ar' ? 'النوع' : 'Type'}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-start text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {language === 'ar' ? 'الحالة' : 'Status'}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-start text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {language === 'ar' ? 'إجراء' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {uploadedFilesOnly.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800 flex items-center gap-3">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {doc.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {doc.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-bold rounded ${
                            doc.status === "نشط" || doc.status === "Active" || doc.status === "مؤرشف" || doc.status === "Indexed"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        <button 
                          onClick={() => removeDocument(doc.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
