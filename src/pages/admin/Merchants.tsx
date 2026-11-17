import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Store, Search, Filter, Check, ShieldBan, X } from "lucide-react";
import { subscribeToMerchants, approveMerchant, blockMerchant, deleteMerchant, Merchant } from "../../services/merchants";

export function AdminMerchants() {
  const { language } = useLanguage();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToMerchants((data) => {
      setMerchants(data);
      setLoading(false);
    }, (message) => {
      setError(message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    try {
       await approveMerchant(id);
    } catch (e) {
       setError(e instanceof Error ? e.message : (language === 'ar' ? 'تعذر اعتماد المتجر' : 'Could not approve merchant'));
    }
  };

  const handleBlock = async (id: string) => {
    try {
       await blockMerchant(id);
    } catch (e) {
       setError(e instanceof Error ? e.message : (language === 'ar' ? 'تعذر حظر المتجر' : 'Could not block merchant'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm("Are you sure?")) {
        await deleteMerchant(id);
      }
    } catch (e) {
       setError(e instanceof Error ? e.message : (language === 'ar' ? 'تعذر حذف المتجر' : 'Could not delete merchant'));
    }
  };

  const filteredMerchants = merchants.filter((merchant) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [merchant.store, merchant.email, merchant.platform].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'all' || merchant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {language === 'ar' ? 'إدارة المتاجر المسجلة' : 'Registered Merchants'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {language === 'ar' ? 'البحث أو الإشراف أو حظر المتاجر المرتبطة بالمنصة.' : 'Search, moderate, or block stores connected to the platform.'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                   type="search" 
                   value={search}
                   onChange={(event) => setSearch(event.target.value)}
                   placeholder={language === 'ar' ? 'ابحث باسم المتجر أو البريد...' : 'Search store or email...'} 
                   className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={language === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
              <option value="all">{language === 'ar' ? 'كل الحالات' : 'All statuses'}</option>
              <option value="Pending">{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</option>
              <option value="Active">{language === 'ar' ? 'نشط' : 'Active'}</option>
              <option value="Blocked">{language === 'ar' ? 'محظور' : 'Blocked'}</option>
            </select>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className={`flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm ${filteredMerchants.length === 0 ? 'flex flex-col items-center justify-center text-center p-12' : 'overflow-hidden'}`}>
        {loading ? (
             <div className="p-12 text-center text-slate-500">
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
             </div>
         ) : filteredMerchants.length === 0 ? (
           <>
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                 <Store className="w-8 h-8 text-slate-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-800 mb-2">
                 {merchants.length === 0 ? (language === 'ar' ? 'لا توجد متاجر في قاعدة البيانات' : 'No Merchants in Database') : (language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching merchants')}
             </h3>
             <p className="text-sm text-slate-500 max-w-sm">
                 {merchants.length === 0
                    ? (language === 'ar' ? 'عند تسجيل المطاعم من خلال الموقع أو التسجيل اليدوي، سيظهرون هنا.' : 'When restaurants register via the website or manually, they will appear here.')
                    : (language === 'ar' ? 'جرّب تغيير البحث أو فلتر الحالة.' : 'Try changing your search or status filter.')}
             </p>
           </>
         ) : (
             <div className="overflow-x-auto w-full h-full">
               <table className="w-full text-left text-sm text-slate-600">
                 <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                   <tr>
                     <th className="px-6 py-4">{language === 'ar' ? 'المتجر' : 'Store'}</th>
                     <th className="px-6 py-4">{language === 'ar' ? 'المنصة' : 'Platform'}</th>
                     <th className="px-6 py-4">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                     <th className="px-6 py-4">{language === 'ar' ? 'التسجيل' : 'Registration Date'}</th>
                     <th className="px-6 py-4 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredMerchants.map((merchant) => (
                      <tr key={merchant.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-bold text-slate-900">{merchant.store}</div>
                           <div className="text-xs text-slate-400">{merchant.email}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                              {merchant.platform}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-bold ${
                            merchant.status === 'Active' ? 'text-green-600' : 
                            merchant.status === 'Pending' ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                               merchant.status === 'Active' ? 'bg-green-500' : 
                               merchant.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            {merchant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                           {new Date(merchant.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2 rtl:space-x-reverse">
                           {merchant.status === 'Pending' && (
                             <button 
                               onClick={() => handleApprove(merchant.id)}
                               className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Approve"
                             >
                               <Check className="w-4 h-4" />
                             </button>
                           )}
                           {merchant.status !== 'Blocked' && (
                             <button 
                               onClick={() => handleBlock(merchant.id)}
                               className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors" title="Block"
                             >
                               <ShieldBan className="w-4 h-4" />
                             </button>
                           )}
                           <button 
                             onClick={() => handleDelete(merchant.id)}
                             className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Delete record"
                           >
                              <X className="w-4 h-4" />
                           </button>
                        </td>
                      </tr>
                   ))}
                 </tbody>
               </table>
             </div>
         )}
      </div>
    </div>
  );
}
