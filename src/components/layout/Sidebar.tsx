import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Book,
  Settings,
  Code,
  CreditCard,
  ExternalLink,
  LogOut,
  QrCode,
  Utensils,
  ChefHat,
  Grid3x3,
  Mic,
  Palette,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { Logo } from "../brand/Logo";

const getNavigationGroups = (t: (k: string) => string, language: string) => [
  {
    label: t('nav.group.workspace'),
    items: [
      { name: t("nav.overview"), href: "/app", icon: LayoutDashboard },
      { name: t("nav.conversations"), href: "/app/conversations", icon: MessageSquare },
      { name: t("nav.kitchen"), href: "/app/kitchen", icon: ChefHat },
      { name: language === 'ar' ? 'المنيو الرقمي' : 'Digital Menu', href: "/app/digital-menu", icon: QrCode },
      { name: language === 'ar' ? 'مظهر المنيو' : 'Menu appearance', href: "/app/menu-designer", icon: Palette },
      { name: language === 'ar' ? 'مخطط الطاولات' : 'Floor plan', href: "/app/floor-plan", icon: Grid3x3 },
    ],
  },
  {
    label: t('nav.group.setup'),
    items: [
      { name: t("nav.kb"), href: "/app/knowledge-base", icon: Book },
      { name: language === 'ar' ? 'استوديو الصوت' : 'Voice studio', href: "/app/voice-studio", icon: Mic },
      { name: t("nav.integration"), href: "/app/integration", icon: Code },
    ],
  },
  {
    label: t('nav.system'),
    items: [
      { name: t("nav.billing"), href: "/app/billing", icon: CreditCard },
      { name: t("nav.settings"), href: "/app/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, language } = useLanguage();
  const { user, logout } = useAuth();
  const groups = getNavigationGroups(t, language);
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
    <>
      {/* Mobile overlay — only renders when the drawer is open on small
          screens. Tap anywhere outside the drawer to close it. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      />
      <aside
        className={`
          fixed lg:static inset-y-0 start-0 z-50
          flex h-full w-72 max-w-[85vw] lg:w-64 flex-col border-e border-slate-200 bg-white
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full lg:translate-x-0"}
          lg:translate-x-0 lg:!translate-x-0
        `}
        aria-label={language === 'ar' ? 'القائمة الجانبية' : 'Sidebar'}
      >
        {/* Mobile close button (visible only on small screens) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={language === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          className="lg:hidden absolute top-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none" 
          onClick={handleLogoClick}
          title={language === 'ar' ? 'انقر 5 مرات للإدارة' : 'Click 5 times for Admin'}
        >
          <Logo size={32} className="rounded-lg" />
          <span className="text-xl font-bold font-sans tracking-tight text-gray-900">
            SooVoice
          </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col px-4 py-4 space-y-5 min-h-0 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === '/app'}
                  onClick={onClose}
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
        ))}

        {/* Live dine-in preview (opens in a new tab) */}
        <div className="pt-2 border-t border-slate-100">
          <NavLink
            to={user?.uid ? `/store?ownerId=${user.uid}&table=1&preview=1` : "/store"}
            target="_blank"
            onClick={onClose}
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Utensils className="me-3 h-5 w-5 text-emerald-500" />
            <span className="flex-1">{language === 'ar' ? 'معاينة المنيو للطاولات' : 'Live Dine-In Menu'}</span>
            <ExternalLink className="h-4 w-4 opacity-50" />
          </NavLink>
        </div>
      </nav>

      <div className="flex shrink-0 border-t border-slate-200 p-4">
        <div className="flex items-center justify-between w-full relative group">
          <div className="flex items-center">
            <div>
              {user?.photoURL ? (
                <img
                  className="inline-block h-9 w-9 rounded-full"
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold select-none">
                  {(user?.displayName || user?.email || 'U').trim().charAt(0).toUpperCase()}
                </div>
              )}
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
      </aside>
    </>
  );
}
