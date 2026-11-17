import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, PlugZap } from "lucide-react";
import { Logo } from "../components/brand/Logo";
import { useLanguage } from "../contexts/LanguageContext";

export function OAuthInstall() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();

  // This route is a landing/authorization placeholder only. No POS provider
  // OAuth client, callback verification, token exchange, or installation
  // persistence is configured here yet.
  const rawPlatform = searchParams.get("platform") || "POS";
  const rawShop = searchParams.get("shop") || "";
  const platform = rawPlatform.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80) || "POS";
  const shopName = rawShop.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160);

  const isArabic = language === "ar";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex justify-center">
        <div className="flex items-center gap-2">
          <Logo size={36} className="rounded-xl shadow-sm" />
          <span className="font-bold text-xl text-slate-800 tracking-tight">SooVoice</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center py-12 px-6">
        <section className="w-full max-w-lg bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
          <div className="p-8 text-center border-b border-slate-200">
            <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-3">
              {isArabic ? "الربط المباشر غير متاح بعد" : "Direct authorization is not available yet"}
            </h1>
            <p className="text-sm text-slate-600 leading-7">
              {isArabic
                ? `طلب الربط مع ${platform} لم يكتمل. لم يتم منح أي صلاحيات ولم يتم إنشاء اتصال أو نقل بيانات.`
                : `The ${platform} authorization flow is not configured. No permissions were granted, no connection was created, and no store data was transferred.`}
            </p>
            {shopName && (
              <p className="mt-4 inline-flex max-w-full break-all font-mono text-xs bg-slate-50 px-3 py-2 border border-slate-200 rounded-lg text-slate-500">
                {shopName}
              </p>
            )}
          </div>

          <div className="p-8 space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <PlugZap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-6">
                  {isArabic
                    ? "تقدر تراجع موصلات الكاشير المتاحة حاليًا من صفحة الربط. أي موصل غير مكتمل هيظهر بوضوح من غير ما نعرض نجاح وهمي."
                    : "You can review the currently available POS connector setup from the Connections page. Unsupported flows remain clearly marked instead of reporting a false success."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/integration")}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              {isArabic ? "الانتقال إلى صفحة الربط" : "Open Connections"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="w-full text-slate-600 hover:text-slate-900 font-semibold py-2 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {isArabic ? "العودة للوحة التحكم" : "Back to dashboard"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
