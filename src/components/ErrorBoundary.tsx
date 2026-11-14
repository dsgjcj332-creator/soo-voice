/**
 * ErrorBoundary — catches render-time exceptions and shows a fallback
 * instead of a white screen. Uses a plain React.Component subclass with
 * the bare minimum typing to satisfy the TS compiler (we don't have
 * @types/react in this project, so the class fields have to be declared
 * explicitly as `any` to avoid TS2339 errors).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
class ErrorBoundary extends (require('react').Component as any) {
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
      return require('react').createElement(
        'div',
        { className: 'min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans' },
        require('react').createElement(
          'div',
          { className: 'max-w-sm w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-lg' },
          require('react').createElement('div', { className: 'w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl' }, '⚠️'),
          require('react').createElement('h2', { className: 'text-lg font-bold text-slate-900 mb-2' }, 'Something went wrong'),
          require('react').createElement('p', { className: 'text-sm text-slate-500 mb-6 leading-relaxed' }, 'The page hit an unexpected error. Reloading usually fixes it.'),
          require('react').createElement('button', {
            onClick: () => window.location.reload(),
            className: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer',
          }, 'Reload page'),
          error ? require('react').createElement('details', { className: 'mt-4 text-start' },
            require('react').createElement('summary', { className: 'text-xs text-slate-400 cursor-pointer' }, 'Error details'),
            require('react').createElement('pre', { className: 'mt-2 text-[10px] font-mono text-slate-500 overflow-x-auto max-h-32 p-2 bg-slate-50 rounded-lg' }, String(error.message || error))
          ) : null
        )
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
