import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Store, Activity, Database, TrendingUp, Check, X, ShieldBan } from 'lucide-react';
import { motion } from 'motion/react';
import { subscribeToMerchants, approveMerchant, blockMerchant, deleteMerchant, Merchant } from '../services/merchants';

export function SuperAdminDashboard() {
  const { language } = useLanguage();
  const [registrations, setRegistrations] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToMerchants((data) => {
      setRegistrations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await approveMerchant(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBlock = async (id: string) => {
    try {
      await blockMerchant(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm("Are you sure?")) {
        await deleteMerchant(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const STATS = [
    { id: 1, name: 'Total Merchants', stat: registrations.length.toString(), icon: Store, trend: '0%', trendType: 'neutral' },
    { id: 2, name: 'Active Users (24h)', stat: '0', icon: Users, trend: '0%', trendType: 'neutral' },
    { id: 3, name: 'Voice Queries (24h)', stat: '0', icon: Activity, trend: '0%', trendType: 'neutral' },
    { id: 4, name: 'System Load', stat: '0%', icon: Database, trend: '0%', trendType: 'neutral' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {language === 'ar' ? 'نظرة عامة على النظام' : 'System Overview'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {language === 'ar' ? 'احصائيات مباشرة وخلاصة نشاط المتاجر.' : 'Live metrics and merchants activity feed.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {STATS.map((item, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={item.id}
            className="relative overflow-hidden rounded-2xl bg-white p-6 border border-slate-200 shadow-sm"
          >
            <dt>
              <div className="absolute rounded-xl bg-slate-50 p-3">
                <item.icon className="h-6 w-6 text-slate-600" aria-hidden="true" />
              </div>
              <p className="ms-16 truncate text-sm font-medium text-slate-500">{item.name}</p>
            </dt>
            <dd className="ms-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-2xl font-bold text-slate-900">{item.stat}</p>
              <p
                className={`ms-2 flex items-baseline text-sm font-semibold ${
                  item.trendType === 'positive' ? 'text-green-600' : 'text-slate-500'
                }`}
              >
                {item.trend}
              </p>
            </dd>
          </motion.div>
        ))}
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">
                  {language === 'ar' ? 'إدارة المتاجر السريعة' : 'Quick Merchants Management'}
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
                 {registrations.length} {language === 'ar' ? 'تاجر' : 'Merchants'}
              </span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">{language === 'ar' ? 'المتجر' : 'Store'}</th>
                  <th className="px-6 py-3">{language === 'ar' ? 'المنصة' : 'Platform'}</th>
                  <th className="px-6 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-3 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                    </td>
                  </tr>
                ) : registrations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {language === 'ar' ? 'لا توجد متاجر حالياً.' : 'No merchants found.'}
                    </td>
                  </tr>
                ) : registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                       <div className="font-bold text-slate-900">{reg.store}</div>
                       <div className="text-xs text-slate-400">{reg.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          reg.platform === 'Shopify' ? 'bg-green-100 text-green-700' :
                          reg.platform === 'Salla' ? 'bg-teal-100 text-teal-700' :
                          reg.platform === 'WooCommerce' ? 'bg-purple-100 text-purple-700' :
                          'bg-indigo-100 text-indigo-700'
                      }`}>
                          {reg.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${
                        reg.status === 'Active' ? 'text-green-600' : 
                        reg.status === 'Pending' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                           reg.status === 'Active' ? 'bg-green-500' : 
                           reg.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2 rtl:space-x-reverse">
                      {reg.status === 'Pending' && (
                        <button 
                          onClick={() => handleApprove(reg.id)}
                          className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {reg.status !== 'Blocked' && (
                        <button 
                          onClick={() => handleBlock(reg.id)}
                          className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md transition-colors" title="Block"
                        >
                          <ShieldBan className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(reg.id)}
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
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
           <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
              {language === 'ar' ? 'استهلاك الذكاء الاصطناعي' : 'AI API Usage'}
              <TrendingUp className="w-4 h-4 text-slate-400" />
           </h3>
           <div className="flex-1 flex flex-col justify-center gap-8">
              <div>
                 <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-slate-800 font-bold block mb-1">Gemini Pro API</span>
                      <span className="text-xs text-slate-500">0 / 10M tokens</span>
                    </div>
                    <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded text-sm">0%</span>
                 </div>
                 <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                     <div className="bg-rose-500 h-full rounded-full transition-all duration-1000" style={{ width: '0%' }}></div>
                 </div>
              </div>

              <div>
                 <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-slate-800 font-bold block mb-1">Text-to-Speech (TTS)</span>
                      <span className="text-xs text-slate-500">0 / 10k hours</span>
                    </div>
                    <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded text-sm">0%</span>
                 </div>
                 <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                     <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: '0%' }}></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
