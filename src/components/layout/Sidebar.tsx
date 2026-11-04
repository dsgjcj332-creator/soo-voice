import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Book,
  Settings,
  Code,
  CreditCard,
  Store,
  ExternalLink,
  LogOut,
  QrCode,
  Utensils
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";

const getNavigation = (t: (k: string) => string, language: string) => [
  { name: t("nav.overview"), href: "/app", icon: LayoutDashboard },
  { name: language === 'ar' ? 'طلبات المطبخ الحية (KDS)' : 'Live Kitchen Orders (KDS)', href: "/app/integration", icon: Utensils },
  { name: language === 'ar' ? 'المنيو والـ QR' : 'Digital Menu & QR', href: "/app/digital-menu", icon: QrCode },
  { name: t("nav.conversations"), href: "/app/conversations", icon: MessageSquare },
  { name: t("nav.kb"), href: "/app/knowledge-base", icon: Book },
  { name: t("nav.settings"), href: "/app/settings", icon: Settings },
];

export function Sidebar() {
  const { t, language } = useLanguage();
  const { user, logout } = useAuth();
  const navigation = getNavigation(t, language);
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);

  React.useEffect(() => {
    if (clickCount > 0) {
      const timer = setTimeout(() => setClickCount(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setClickCount(0); // Reset after triggering
      navigate('/admin');
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="flex h-full w-64 flex-col border-e border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none" 
          onClick={handleLogoClick}
          title={language === 'ar' ? 'انقر 5 مرات للإدارة' : 'Click 5 times for Admin'}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <span className="font-bold">V</span>
          </div>
          <span className="text-xl font-bold font-sans tracking-tight text-gray-900">
            VoiceAI
          </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col px-4 py-4 space-y-4">
        
        {/* Workspace navigation */}
        <div>
          <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {language === 'ar' ? 'مساحة العمل' : 'Workspace'}
          </p>
          <div className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/app'}
              className={({ isActive }) =>
                cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "me-3 h-5 w-5 shrink-0",
                      isActive
                        ? "text-indigo-600"
                        : "text-slate-400 group-hover:text-indigo-500",
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
          </div>
        </div>

        {/* Demo Store Link */}
        <div className="pt-4 border-t border-slate-100">
          <NavLink
            to={user?.uid ? `/store?ownerId=${user.uid}&table=1` : "/store"}
            target="_blank"
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Utensils className="me-3 h-5 w-5 text-emerald-500" />
            <span className="flex-1">{language === 'ar' ? 'معاينة المنيو للطاولات' : 'Live Dine-In Menu'}</span>
            <ExternalLink className="h-4 w-4 opacity-50" />
          </NavLink>
        </div>

        <div className="pt-4">
          <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {t('nav.system')}
          </h3>
          <div className="mt-2 space-y-1">
            <NavLink
              to="/app/integration"
              className={({ isActive }) =>
                cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Code className={cn("me-3 h-5 w-5", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500")} />
                  {t('nav.integration')}
                </>
              )}
            </NavLink>
            <NavLink
              to="/app/billing"
              className={({ isActive }) =>
                cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <CreditCard className={cn("me-3 h-5 w-5", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500")} />
                  {t('nav.billing')}
                </>
              )}
            </NavLink>
          </div>
        </div>
      </nav>

      <div className="flex shrink-0 border-t border-slate-200 p-4">
        <div className="flex items-center justify-between w-full relative group">
          <div className="flex items-center">
            <div>
              <img
                className="inline-block h-9 w-9 rounded-full"
                src={user?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
                alt=""
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="ms-3 overflow-hidden">
              <p className="text-sm font-medium text-slate-700 truncate w-32">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs font-medium text-slate-500 truncate w-32">
                {user?.email}
              </p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
