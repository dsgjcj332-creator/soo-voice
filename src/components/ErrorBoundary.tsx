import React from 'react';

/**
 * ErrorBoundary — catches render-time exceptions.
 *
 * TWO failure modes are handled differently:
 *
 * 1. DOM-mutation conflicts — `removeChild` / `not a child` /
 *    `NotFoundError`. These are NOT real bugs. They happen when
 *    something outside React mutates the DOM tree React is managing:
 *      - Google Translate wrapping text nodes in <font> tags
 *      - Browser extensions (ad blockers, grammar checkers, etc.)
 *      - The document `dir` attribute flipping during a render
 *        (when the user switches AR ⇄ EN mid-commit)
 *    React's reconciliation then tries to remove a node that is no
 *    longer the child it expects, throws, and the whole tree crashes
 *    to a white screen / "Something went wrong" card.
 *
 *    FIX: silently remount the subtree by bumping a `key`. This throws
 *    away React's stale fiber tree and rebuilds from the current DOM,
 *    so the next render is clean. The user sees at most a single
 *    flicker — no error card, no reload needed.
 *
 * 2. Any other error — show the bilingual fallback card so the guest
 *    can reload. We log it so the merchant can copy the trace if it
 *    recurs.
 *
 * Uses React.createElement (not JSX) to avoid any JSX/TS typing issues
 * since this project doesn't have @types/react installed.
 */

const DOM_CONFLICT_PATTERNS = [
  'removechild',
  'not a child',
  'notfounderror',
  "the node to be removed is not a child of this node",
];

function isDomConflictError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return DOM_CONFLICT_PATTERNS.some((p) => msg.includes(p));
}

class ErrorBoundary extends (React as any).Component {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, recoverKey: 0 };
  }

  static getDerivedStateFromError(error: any): any {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any): void {
    if (isDomConflictError(error)) {
      // DOM-mutation conflict — silently remount the subtree. Bumping
      // the key forces React to throw away its stale fiber tree and
      // rebuild from the current DOM state, which is the only way to
      // recover cleanly after an external mutation.
      console.warn(
        '[ErrorBoundary] DOM-mutation conflict (likely Google Translate or a dir flip). Auto-remounting subtree — no user action needed.',
        error
      );
      this.setState((s: any) => ({
        hasError: false,
        error: null,
        recoverKey: s.recoverKey + 1,
      }));
      return;
    }
    console.error('[ErrorBoundary] caught:', error, errorInfo);
  }

  render(): any {
    if (this.state.hasError) {
      const error = this.state.error as any;
      const h = React.createElement;
      // Detect the active language so the fallback card speaks the
      // right language. We can't use the LanguageContext here (we're
      // above the provider in the tree), so read it from the document
      // element's lang attribute, which the provider keeps in sync.
      const isAr =
        typeof document !== 'undefined' &&
        (document.documentElement.lang || '').startsWith('ar');
      return h('div', { className: 'min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans' },
        h('div', { className: 'max-w-sm w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-lg' },
          h('div', { className: 'w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl' }, '⚠️'),
          h('h2', { className: 'text-lg font-bold text-slate-900 mb-2' },
            isAr ? 'حدث خطأ ما' : 'Something went wrong'),
          h('p', { className: 'text-sm text-slate-500 mb-6 leading-relaxed' },
            isAr
              ? 'حدث خطأ غير متوقع في الصفحة. عادة ما يحل إعادة التحميل المشكلة.'
              : 'The page hit an unexpected error. Reloading usually fixes it.'),
          h('button', {
            onClick: () => window.location.reload(),
            className: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer',
          }, isAr ? 'إعادة تحميل الصفحة' : 'Reload page'),
          error ? h('details', { className: 'mt-4 text-start' },
            h('summary', { className: 'text-xs text-slate-400 cursor-pointer' },
              isAr ? 'تفاصيل الخطأ' : 'Error details'),
            h('pre', { className: 'mt-2 text-[10px] font-mono text-slate-500 overflow-x-auto max-h-32 p-2 bg-slate-50 rounded-lg' },
              String(error.message || error) + '\n' + String(error.stack || '')
            )
          ) : null
        )
      );
    }
    // The recoverKey forces a full subtree remount when we recover from
    // a DOM conflict, so React never reuses the stale fiber tree.
    return React.createElement(
      React.Fragment,
      { key: this.state.recoverKey },
      this.props.children
    );
  }
}

export { ErrorBoundary };
