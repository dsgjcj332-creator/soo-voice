import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { 
  ShieldAlert, 
  Users, 
  Database, 
  Settings, 
  LogOut, 
  Activity,
  Globe,
  Mic,
  Menu,
  X
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";

export function SuperAdminLayout() {
  const { language, setLanguage } = useLanguage();
  const { superAdminLogout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: language === 'ar' ? 'نظرة عامة' : 'Overview', href: '/admin', icon: Activity },
    { name: language === 'ar' ? 'إدارة المتاجر' : 'Merchants', href: '/admin/merchants', icon: Users },
    { name: language === 'ar' ? 'استوديو الأصوات' : 'Voice Studio', href: '/admin/voices', icon: Mic },
    { name: language === 'ar' ? 'الخوادم والـ API' : 'Servers & API', href: '/admin/servers', icon: Database },
    { name: language === 'ar' ? 'إعدادات النظام' : 'System Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Admin Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex h-full w-64 flex-col border-e border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-300 lg:static lg:!translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            <span className="text-lg font-bold tracking-tight text-white">
              SuperAdmin
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex flex-1 flex-col px-4 py-6 space-y-2">
          <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {language === 'ar' ? 'إدارة المنصة' : 'Platform Management'}
          </div>
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/admin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-rose-500/10 text-rose-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                )
              }
            >
              {({ isActive }) => (
                <React.Fragment>
                  <item.icon
                    className={cn(
                      "me-3 h-5 w-5 shrink-0",
                      isActive ? "text-rose-400" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {item.name}
                </React.Fragment>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
             onClick={() => { superAdminLogout(); navigate('/'); }}
             className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="me-3 h-5 w-5 opacity-50" />
            {language === 'ar' ? 'الخروج للواجهة' : 'Exit to Front'}
          </button>
        </div>
      </div>

      {/* Admin Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Admin Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-rose-200 bg-white px-4 sm:px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ms-2 text-slate-500 hover:text-slate-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
             <div className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                {language === 'ar' ? 'وضع المصمم العالي' : 'God Mode'}
             </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'عربي' : 'EN'}
             </button>
             <div className="hidden sm:flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                 <ShieldAlert className="w-4 h-4 text-rose-600" />
               </div>
               <div className="leading-tight">
                 <p className="text-xs font-bold text-slate-800">Super Admin</p>
                 <p className="text-[10px] text-slate-400">{language === 'ar' ? 'مدير النظام' : 'System Owner'}</p>
               </div>
             </div>
             <button
                onClick={() => { superAdminLogout(); navigate('/'); }}
                className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors px-3 py-1.5 rounded-lg border border-red-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'خروج' : 'Logout'}</span>
             </button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto w-full bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
