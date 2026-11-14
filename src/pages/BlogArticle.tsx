import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, Calendar, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getPostBySlug, formatBlogDate, getPostsByDateDesc } from '../lib/blogPosts';

export function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  if (!slug) {
    navigate('/blog');
    return null;
  }

  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <div className="bg-white flex-1 flex items-center justify-center py-32 px-6">
        <div className="text-center max-w-md">
          <p className="text-6xl font-extrabold text-slate-200 mb-4">404</p>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">
            {isAr ? 'المقال غير موجود' : 'Article not found'}
          </h1>
          <p className="text-slate-500 mb-8">
            {isAr
              ? 'قد يكون الرابط غير صحيح أو أن المقال حُذف.'
              : 'The link may be incorrect, or the article may have been removed.'}
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            {isAr ? (
              <>
                <ArrowRight className="w-4 h-4" />
                العودة إلى المدونة
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4" />
                Back to the blog
              </>
            )}
          </Link>
        </div>
      </div>
    );
  }

  // Next post (oldest, by date desc) — for the "continue reading" link.
  const allPosts = getPostsByDateDesc();
  const currentIdx = allPosts.findIndex((p) => p.slug === post.slug);
  const nextPost = allPosts.slice(currentIdx + 1).find((p) => p.slug !== post.slug) || null;

  return (
    <div className="bg-white flex-1 font-sans">
      <article>
        {/* Header */}
        <header className="px-6 pt-16 pb-10 max-w-3xl mx-auto">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-6"
          >
            {isAr ? (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                العودة إلى المدونة
              </>
            ) : (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to the blog
              </>
            )}
          </Link>

          <div className="flex items-center gap-3 mb-5">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              {isAr ? post.categoryLabelAr : post.categoryLabelEn}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight mb-5">
            {isAr ? post.titleAr : post.titleEn}
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed mb-6">
            {isAr ? post.excerptAr : post.excerptEn}
          </p>

          <div className="flex items-center gap-5 text-xs text-slate-500 border-t border-slate-100 pt-5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatBlogDate(post.dateIso, language)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {isAr ? `${post.readingTimeMin} دقائق قراءة` : `${post.readingTimeMin} min read`}
            </span>
            <span className="text-slate-400">
              {isAr ? post.authorAr : post.authorEn}
            </span>
          </div>
        </header>

        {/* Cover band */}
        <div className="aspect-[16/5] max-w-5xl mx-auto bg-gradient-to-br from-indigo-100 via-violet-100 to-slate-50 flex items-center justify-center mb-10 rounded-3xl overflow-hidden">
          <span className="text-8xl font-extrabold text-indigo-600/20 select-none">
            {(isAr ? post.categoryLabelAr : post.categoryLabelEn).charAt(0)}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 max-w-3xl mx-auto pb-16">
          <div className="prose prose-slate max-w-none">
            {(isAr ? post.bodyAr : post.bodyEn).map((para, i) => (
              <p
                key={i}
                className="text-slate-700 leading-relaxed mb-6 text-base md:text-lg"
                style={{ textAlign: isAr ? 'right' : 'left' }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* Author footer */}
          <div className="border-t border-slate-100 mt-12 pt-8 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-lg select-none">
              S
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                {isAr ? post.authorAr : post.authorEn}
              </p>
              <p className="text-xs text-slate-500">
                {isAr ? 'ملاحظات من تجربة SooVoice في الضيافة.' : 'Notes from the SooVoice hospitality practice.'}
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* Continue reading */}
      {nextPost && (
        <section className="bg-slate-50 border-t border-slate-100 py-12">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
              {isAr ? 'تابع القراءة' : 'Continue reading'}
            </p>
            <Link
              to={`/blog/${nextPost.slug}`}
              className="group block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                {isAr ? nextPost.categoryLabelAr : nextPost.categoryLabelEn}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-3 mb-2 group-hover:text-indigo-700 transition-colors">
                {isAr ? nextPost.titleAr : nextPost.titleEn}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                {isAr ? nextPost.excerptAr : nextPost.excerptEn}
              </p>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
