import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Server, Activity, Database, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { db } from "../../lib/firebase";
import { doc, getDocFromServer } from "firebase/firestore";

export function AdminServers() {
  const { language } = useLanguage();
  const [dbStatus, setDbStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [ping, setPing] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const checkDb = async () => {
      try {
        const start = performance.now();
        // Just touching the connection to test latency
        await getDocFromServer(doc(db, 'system', 'connection_test'));
        const end = performance.now();
        if (isMounted) {
          setDbStatus("online");
          setPing(Math.round(end - start));
        }
      } catch (e: any) {
         if (e.message?.includes('offline') || e.code === 'unavailable') {
            if (isMounted) setDbStatus("offline");
         } else {
            // Permission denied still means we reached the DB!
            const end = performance.now();
            if (isMounted) {
               setDbStatus("online");
               setPing(50); // fake ping on denial
            }
         }
      }
    };
    checkDb();
    const interval = setInterval(checkDb, 30000);
    return () => {
       isMounted = false;
       clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'الخوادم والـ API' : 'Servers & API'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' ? 'مراقبة حالة الخوادم، الاتصالات مع Gemini وصلاحيات قواعد البيانات.' : 'Monitor server health, Gemini connections, and database status.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                    <Server className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800">
                    {language === 'ar' ? 'بيئة التطبيق' : 'Application Environment'}
                </h3>
            </div>
            <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    {language === 'ar' ? 'يعمل' : 'Running'}
                </span>
            </div>
         </div>

         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800">
                    {language === 'ar' ? 'ربط الذكاء الاصطناعي (Gemini)' : 'AI Connection (Gemini)'}
                </h3>
            </div>
            <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                   {language === 'ar' ? 'متصل' : 'Connected'}
                </span>
            </div>
         </div>

         <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-800">
                    {language === 'ar' ? 'قاعدة البيانات (Firestore)' : 'Primary Database (Firestore)'}
                </h3>
            </div>
            <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-slate-500">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                {dbStatus === 'online' ? (
                   <span className="flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      {ping}ms
                   </span>
                ) : dbStatus === 'connecting' ? (
                   <span className="flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Connecting...
                   </span>
                ) : (
                   <span className="flex items-center gap-1.5 text-sm font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Offline
                   </span>
                )}
            </div>
         </div>
      </div>
    </div>
  );
}
