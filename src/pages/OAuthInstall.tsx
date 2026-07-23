import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ShieldCheck, Loader2, Bot, Database, Blocks, LogIn } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export function OAuthInstall() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  
  const platform = searchParams.get("platform") || "Shopify";
  const shopName = searchParams.get("shop") || "mystore.com";
  
  const [status, setStatus] = useState<"review" | "login" | "installing" | "success" | "error">("review");
  const [errorMessage, setErrorMessage] = useState("");

  const finalizeInstall = async (currentUser = user) => {
    if (!currentUser) return;
    setStatus("installing");
    
    try {
      const merchantId = Math.random().toString(36).substring(2, 12);
      await setDoc(doc(db, "merchants", merchantId), {
        id: merchantId,
        store: shopName,
        platform: platform,
        status: "Active",
        ownerId: currentUser.uid,
        email: currentUser.email || "",
        createdAt: Date.now()
      });

      setStatus("success");
      setTimeout(() => {
        navigate("/app/integration?success=true");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to install to database.");
    }
  };

  const handleInstall = async () => {
    if (!user) {
      setStatus("login");
    } else {
      await finalizeInstall();
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await finalizeInstall(result.user);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || 'Authentication failed');
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-12 rounded-3xl shadow-lg border border-slate-200 text-center max-w-md w-full">
          <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {language === 'ar' ? 'تم الربط بنجاح!' : 'Integration Successful!'}
          </h2>
          <p className="text-slate-500">
            {language === 'ar' 
              ? 'تم حقن الويدجت الصوتي في متجرك وبدأ الاستماع لتحديثات منتجاتك تلقائياً.' 
              : 'The Voice Widget has been securely injected and is now syncing your products automatically.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex justify-center">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">VoiceAI SaaS</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-16 px-6">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-8 text-center border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 mb-3">
              {language === 'ar' ? 'طلب صلاحيات الربط' : 'Authorization Request'}
            </h1>
            <p className="text-sm text-slate-600">
              {language === 'ar' 
                ? `يرغب تطبيق VoiceAI بالاتصال بمتجرك على ${platform}`
                : `VoiceAI is requesting access to your ${platform} store`}
            </p>
            <div className="mt-4 font-mono text-xs bg-white px-3 py-2 border border-slate-200 rounded-lg inline-block text-slate-500">
              {shopName}
            </div>
          </div>

          <div className="p-8">
            {status === "error" && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl">
                   {errorMessage}
                </div>
            )}

            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
              {language === 'ar' ? 'الصلاحيات المطلوبة:' : 'Requested Permissions:'}
            </h3>

            <div className="space-y-6">
              <div className="flex gap-4">
                <Database className="w-6 h-6 text-indigo-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {language === 'ar' ? 'قراءة المنتجات والطلبات' : 'Read Products & Orders'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar' 
                      ? 'لكي يتمكن المساعد الصوتي من الإجابة عن المنتجات وتفاصيلها نيابة عنك.' 
                      : 'Allows the AI to answer catalog questions accurately.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Blocks className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {language === 'ar' ? 'تعديل سلة المشتريات (Cart)' : 'Modify Cart States'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar' 
                      ? 'للسماح للعملاء بإضافة المنتجات صوتياً مباشرة دون تدخل.' 
                      : 'Allows voice commands to dynamically add items to user carts.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {language === 'ar' ? 'حقن السكربت (Theme App Extension)' : 'Theme Script Injection'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar' 
                      ? 'يقوم التطبيق بتركيب المايكروفون الخاص بنا بأمان دون لمس أو تخريب أكوادك الأصلية نهائياً.' 
                      : 'Securely renders the voice widget on your storefront without manual code edits.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            {status === "login" ? (
               <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-slate-700 text-center mb-2">
                     {language === 'ar' ? 'قم بربط متجرك بحسابك لدينا' : 'Link this store to your account'}
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-3"
                  >
                     <LogIn className="w-5 h-5 text-indigo-600" />
                     {language === 'ar' ? 'تسجيل الدخول / إنشاء حساب' : 'Log in / Sign up'}
                  </button>
               </div>
            ) : (
                <button
                  onClick={handleInstall}
                  disabled={status === "installing"}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400"
                >
                  {status === "installing" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {language === 'ar' ? 'جاري توثيق الحساب...' : 'Authenticating...'}
                    </>
                  ) : (
                    language === 'ar' ? 'موافقة وتثبيت التطبيق' : 'Authorize & Install App'
                  )}
                </button>
            )}
            <p className="text-center text-xs text-slate-400 mt-4">
              {language === 'ar' 
                ? 'بالضغط على موافقة، أنت توافق على سياسة الخصوصية الخاصة بنا الخاصة بالمتاجر.' 
                : 'By installing, you agree to our Merchant Privacy Policy.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
