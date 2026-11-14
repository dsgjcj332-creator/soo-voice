import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  BLOG_POSTS,
  getPostsByDateDesc,
  getCategories,
  BlogCategory,
  formatBlogDate,
} from '../lib/blogPosts';

export function Blog() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const allPosts = getPostsByDateDesc();
  const categories = getCategories();

  const filtered = allPosts.filter((post) => {
    const matchesCategory = activeCategory === 'all' || post.category === activeCategory;
    const q = query.trim().toLowerCase();
    if (!q) return matchesCategory;
    const matchesQuery =
      (isAr ? post.titleAr : post.titleEn).toLowerCase().includes(q) ||
      (isAr ? post.excerptAr : post.excerptEn).toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const featured = allPosts[0];

  return (
    <div className="bg-white flex-1 font-sans">
      {/* Hero */}
      <section className="px-6 pt-20 pb-12 max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-indigo-600 mb-3">
          {isAr ? 'المدونة' : 'Blog'}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
          {isAr ? 'ملاحظات من مطبخ الضيافة' : 'Notes from the hospitality kitchen'}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
          {isAr
            ? 'كتابات عن الضيافة الراقية، دور الصوت في خدمة الضيف، والتفاصيل التي تُصنع منها تجربة الطاولة.'
            : 'Writing on fine hospitality, the role of voice in service, and the details that make a table experience.'}
        </p>
      </section>

      {/* Featured post */}
      {featured && activeCategory === 'all' && !query && (
        <section className="px-6 pb-12 max-w-5xl mx-auto">
          <Link
            to={`/blog/${featured.slug}`}
            className="block group rounded-3xl overflow-hidden border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all bg-slate-50"
          >
            <div className="grid md:grid-cols-2">
              <div className="aspect-[4/3] md:aspect-auto bg-gradient-to-br from-indigo-100 via-violet-100 to-white flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10" />
                <span className="text-6xl font-extrabold text-indigo-600/30 select-none">
                  {isAr ? '★' : 'S'}
                </span>
              </div>
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider mb-3">
                  <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                    {isAr ? featured.categoryLabelAr : featured.categoryLabelEn}
                  </span>
                  <span className="text-slate-400">
                    {isAr ? 'مقال مميّز' : 'Featured'}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 leading-tight group-hover:text-indigo-700 transition-colors">
                  {isAr ? featured.titleAr : featured.titleEn}
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  {isAr ? featured.excerptAr : featured.excerptEn}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {isAr ? `${featured.readingTimeMin} دقائق قراءة` : `${featured.readingTimeMin} min read`}
                  </span>
                  <span>{formatBlogDate(featured.dateIso, language)}</span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Filter bar */}
      <section className="px-6 max-w-5xl mx-auto pb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {categories.map((c) => (
              <button
                key={c.value}
                onClick={() => setActiveCategory(c.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === c.value
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isAr ? c.labelAr : c.labelEn}
              </button>
            ))}
          </div>

          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث في المقالات...' : 'Search articles...'}
              className="w-full ps-9 pe-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Posts grid */}
      <section className="px-6 max-w-5xl mx-auto pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="font-bold">{isAr ? 'لا توجد مقالات مطابقة' : 'No matching articles'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filtered.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="aspect-[16/9] bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 flex items-center justify-center relative">
                  <span className="text-5xl font-extrabold text-indigo-600/20 select-none">
                    {(isAr ? post.categoryLabelAr : post.categoryLabelEn).charAt(0)}
                  </span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {isAr ? post.categoryLabelAr : post.categoryLabelEn}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight mb-2 group-hover:text-indigo-700 transition-colors">
                    {isAr ? post.titleAr : post.titleEn}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                    {isAr ? post.excerptAr : post.excerptEn}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {isAr ? `${post.readingTimeMin} دقائق` : `${post.readingTimeMin} min`}
                      </span>
                      <span>{formatBlogDate(post.dateIso, language)}</span>
                    </div>
                    <span className="flex items-center gap-1 text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAr ? 'اقرأ' : 'Read'}
                      <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer note */}
      <section className="border-t border-slate-100 bg-slate-50 py-12">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 leading-relaxed">
            {isAr
              ? `ننشر بشكل دوري. لدينا حاليًا ${BLOG_POSTS.length} مقالات.`
              : `We publish periodically. There are currently ${BLOG_POSTS.length} articles.`}
          </p>
        </div>
      </section>
    </div>
  );
}
