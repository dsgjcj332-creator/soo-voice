import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Mic, Upload, Play, CheckCircle2, AlertCircle, Plus, Star, Trash2 } from "lucide-react";
import { subscribeToGlobalVoices, GlobalVoice, addGlobalVoice, deleteGlobalVoice } from "../../services/globalVoices";
import { useAuth } from "../../contexts/AuthContext";

export function AdminVoices() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [voices, setVoices] = useState<GlobalVoice[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalVoices((data) => {
      setVoices(data);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateVoice = async () => {
    if (!newVoiceName.trim() || creating) return;
    setCreating(true);
    try {
      await addGlobalVoice(newVoiceName, "Premium", true);
      setNewVoiceName("");
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert("Failed to create voice.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (window.confirm("Are you sure?")) {
      await deleteGlobalVoice(id);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Mic className="w-6 h-6 text-indigo-600" />
            {language === 'ar' ? 'استوديو الأصوات وتدريب النماذج' : 'Voice Studio & Cloning'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            {language === 'ar' 
               ? 'إدارة نماذج الذكاء الاصطناعي الصوتية. قم برفع عينات صوتية للمشاهير لعمل نسخة رقمية من أصواتهم وإتاحتها للتجار.' 
               : 'Manage AI voice models. Upload voice samples of celebrities to create digital clones and offer them to merchants.'}
          </p>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5" />
          {language === 'ar' ? 'تدريب صوت جديد' : 'Train New Voice'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
               <Star className="w-32 h-32" />
            </div>
            <h3 className="text-lg font-bold mb-1 relative z-10">{language === 'ar' ? 'الأصوات المشهورة المتاحة' : 'Available Celebrity Voices'}</h3>
            <p className="text-3xl font-extrabold relative z-10">{voices.filter(v => v.celebrity && v.status === 'Active').length}</p>
            <p className="text-indigo-100 text-sm mt-3 relative z-10">
              {language === 'ar' ? 'أصوات جاهزة للبيع للتجار' : 'Voices ready to be sold to merchants'}
            </p>
         </div>

         <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-slate-500 text-sm font-bold mb-1">{language === 'ar' ? 'حالة الـ API الخاصة بالاستنساخ' : 'Cloning API Status'}</h3>
            <p className="text-slate-800 text-xl font-bold flex items-center gap-2">
               ElevenLabs <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Connected</span>
            </p>
         </div>
         
         <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
               <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-slate-500 text-sm font-bold mb-1">{language === 'ar' ? 'يتم تدريبها حالياً' : 'Currently Training'}</h3>
            <p className="text-slate-800 text-xl font-bold">
               {voices.filter(v => v.status === 'Training').length} {language === 'ar' ? 'نماذج' : 'models'}
            </p>
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1">
        <div className="overflow-x-auto w-full h-full">
           <table className="w-full text-left text-sm text-slate-600">
             <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
               <tr>
                 <th className="px-6 py-4">{language === 'ar' ? 'اسم الصوت / الشخصية' : 'Voice Name / Persona'}</th>
                 <th className="px-6 py-4">{language === 'ar' ? 'النوع' : 'Type'}</th>
                 <th className="px-6 py-4">{language === 'ar' ? 'حالة التدريب' : 'Training Status'}</th>
                 <th className="px-6 py-4">{language === 'ar' ? 'التسعير' : 'Access Level'}</th>
                 <th className="px-6 py-4 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {voices.map(voice => (
                   <tr key={voice.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                         <button className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors">
                            <Play className="w-4 h-4 ml-0.5" />
                         </button>
                         {voice.name}
                      </td>
                      <td className="px-6 py-4">
                         {voice.celebrity ? (
                            <span className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-1 rounded w-fit">
                               <Star className="w-3 h-3 fill-amber-500" /> المشاهير
                            </span>
                         ) : (
                            <span className="text-slate-500 font-medium text-xs bg-slate-100 px-2 py-1 rounded w-fit">قياسي</span>
                         )}
                      </td>
                      <td className="px-6 py-4">
                         {voice.status === 'Active' ? (
                            <span className="text-emerald-600 font-bold text-xs flex items-center gap-1.5">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> جاهز للاستخدام
                            </span>
                         ) : (
                            <span className="text-indigo-600 font-bold text-xs flex items-center gap-1.5">
                               <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /> جاري التدريب
                            </span>
                         )}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 text-xs font-bold rounded ${voice.priceModel === 'Premium' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {voice.priceModel}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <button 
                            onClick={() => handleDeleteVoice(voice.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-2"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </td>
                   </tr>
                ))}
             </tbody>
           </table>
           {voices.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                 {language === 'ar' ? 'لا يوجد أصوات مضافة بعد.' : 'No voices added yet.'}
              </div>
           )}
        </div>
      </div>

      {/* Upload Modal */}
      {showModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-lg text-slate-800">
                     {language === 'ar' ? 'تدريب نموذج صوتي جديد' : 'Train New Voice Model'}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
               </div>
               <div className="p-6 space-y-5 flex-1 relative">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2">{language === 'ar' ? 'اسم الشخص / المشهور' : 'Persona / Celebrity Name'}</label>
                     <input 
                        type="text" 
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none" 
                        placeholder="e.g. Amr Diab" 
                     />
                  </div>
                  
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors group">
                     <div className="bg-indigo-50 text-indigo-600 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                     </div>
                     <p className="font-bold text-slate-800">{language === 'ar' ? 'ارفع عينات صوتية للمشهور' : 'Upload Audio Samples'}</p>
                     <p className="text-xs text-slate-500 mt-1 max-w-xs">{language === 'ar' ? 'يجب أن لا تقل المدة عن 5 دقائق للحصول على جودة عالية (بدون موسيقى خلفية).' : 'Must be at least 5 minutes of clean audio without background noise.'}</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-sm">
                     <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                     <p className="text-amber-800 leading-relaxed font-medium">
                        {language === 'ar' 
                           ? 'تنبيه قانوني: تأكد من الحصول على موافقات حقوق النشر أو عقود الشراكات مع المشاهير قبل دمج أصواتهم وإتاحتها للتجار.' 
                           : 'Legal Warning: Ensure you have explicit consent and commercial licensing agreements before cloning and reselling celebrity voices.'}
                     </p>
                  </div>
               </div>
               <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                  <button disabled={creating} onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                     {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button disabled={creating || !newVoiceName.trim()} onClick={handleCreateVoice} className="px-5 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-sm transition-colors flex items-center gap-2">
                     <Mic className="w-4 h-4" />
                     {creating ? (language === 'ar' ? 'جاري...' : 'Training...') : (language === 'ar' ? 'بدء استنساخ الصوت' : 'Start Voice Cloning')}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
