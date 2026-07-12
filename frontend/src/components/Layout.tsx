import { Link, Outlet } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';

export function Layout() {
  const { dark, toggle } = useDarkMode();

  return (
    <div className="industrial-grid min-h-screen bg-slate-100 text-slate-900 dark:bg-industrial-bg dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-industrial-border dark:bg-industrial-panel/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-600 font-mono text-sm font-bold text-white">
              TM
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">Telemetry Monitor</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-industrial-muted">
                Industrial IoT Platform
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 sm:inline-flex dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-industrial-border dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {dark ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 dark:border-industrial-border dark:text-industrial-muted">
        Fleet telemetry · anomaly detection · operator dashboard
      </footer>
    </div>
  );
}
