import React from 'react';

/**
 * ErrorBoundary — catches render-time exceptions and shows a fallback
 * instead of a white screen. Wraps the entire App so any page crash
 * shows a recoverable error card instead of a blank page.
 *
 * Uses React.createElement (not JSX) to avoid any JSX/TS typing issues
 * since this project doesn't have @types/react installed.
 */

class ErrorBoundary extends (React as any).Component {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): any {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any): void {
    console.error('[ErrorBoundary] caught:', error, errorInfo);
  }

  render(): any {
    if (this.state.hasError) {
      const error = this.state.error as any;
      const h = React.createElement;
      return h('div', { className: 'min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans' },
        h('div', { className: 'max-w-sm w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-lg' },
          h('div', { className: 'w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl' }, '⚠️'),
          h('h2', { className: 'text-lg font-bold text-slate-900 mb-2' }, 'Something went wrong'),
          h('p', { className: 'text-sm text-slate-500 mb-6 leading-relaxed' }, 'The page hit an unexpected error. Reloading usually fixes it.'),
          h('button', {
            onClick: () => window.location.reload(),
            className: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer',
          }, 'Reload page'),
          error ? h('details', { className: 'mt-4 text-start' },
            h('summary', { className: 'text-xs text-slate-400 cursor-pointer' }, 'Error details'),
            h('pre', { className: 'mt-2 text-[10px] font-mono text-slate-500 overflow-x-auto max-h-32 p-2 bg-slate-50 rounded-lg' },
              String(error.message || error) + '\n' + String(error.stack || '')
            )
          ) : null
        )
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
