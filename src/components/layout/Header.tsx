import { Bell, Search, Globe, Menu } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 flex shrink-0">
      <div className="flex flex-1 items-center">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ms-2 me-3 text-slate-500 hover:text-slate-700 rounded-md"
        >
          <Menu className="h-6 w-6" />
        </button>
        <form className="hidden sm:flex w-full md:ms-0" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <div className="relative w-full text-slate-400 focus-within:text-indigo-600">
            <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <input
              id="search-field"
              className="block h-full w-full border-transparent py-2 ps-8 pe-3 text-slate-900 placeholder-slate-400 focus:border-transparent focus:placeholder-slate-500 focus:outline-none focus:ring-0 sm:text-sm bg-transparent"
              placeholder={t('header.search')}
              type="search"
              name="search"
            />
          </div>
        </form>
      </div>
      <div className="ms-4 flex items-center md:ms-6 gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 focus:outline-none transition-colors border border-slate-200"
        >
          <Globe className="h-4 w-4" />
          {language === 'en' ? 'العربية' : 'EN'}
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-full bg-slate-50 p-1.5 text-slate-400 border border-slate-200 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span className="sr-only">View notifications</span>
          <Bell className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
