import { Bell, Search, Globe, Menu } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 flex shrink-0 gap-3">
      {/* Hamburger — only visible on small screens. Opens the sidebar drawer. */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={language === 'ar' ? 'فتح القائمة' : 'Open menu'}
        className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 min-w-0">
        <form className="flex w-full md:ms-0" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <div className="relative w-full text-slate-400 focus-within:text-indigo-600">
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <input
              id="search-field"
              className="block h-full w-full border-transparent py-2 ps-8 pe-3 text-slate-900 placeholder-slate-400 focus:border-transparent focus:placeholder-slate-500 focus:outline-none focus:ring-0 sm:text-sm bg-transparent min-w-0"
              placeholder={t('header.search')}
              type="search"
              name="search"
            />
          </div>
        </form>
      </div>
      <div className="ms-2 flex items-center md:ms-6 gap-2 sm:gap-4 shrink-0">
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-indigo-600 focus:outline-none transition-colors border border-slate-200 min-h-[36px]"
          aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'en' ? 'العربية' : 'EN'}</span>
          <span className="sm:hidden font-bold">{language === 'en' ? 'ع' : 'EN'}</span>
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-full bg-slate-50 p-2 text-slate-400 border border-slate-200 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-[36px] min-w-[36px]"
          aria-label="View notifications"
        >
          <span className="sr-only">View notifications</span>
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
