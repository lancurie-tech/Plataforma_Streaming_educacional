import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

type Props = {
  /** Título curto na barra superior (mobile) e na área da marca na gaveta */
  sidebarTitle: string;
  /** Navegação + ações inferiores (ex.: Sair), sem a linha da marca */
  sidebarBody: ReactNode;
  children: ReactNode;
};

/**
 * Layout em duas colunas: sidebar fixa em `lg+`, gaveta com overlay no mobile.
 */
export function DashboardSidebarLayout({ sidebarTitle, sidebarBody, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMobileOpen(false);
    });
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Barra superior só no mobile: abre a gaveta */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 px-3 backdrop-blur supports-backdrop-filter:bg-zinc-950/80 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          aria-expanded={mobileOpen}
          aria-controls="dashboard-sidebar"
          aria-label="Abrir menu de navegação"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-100">{sidebarTitle}</span>
      </header>

      {/* Overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-h-[calc(100dvh-3.5rem)] lg:min-h-screen">
        <aside
          id="dashboard-sidebar"
          className={[
            'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-zinc-800 bg-zinc-900/95 shadow-2xl transition-transform duration-200 ease-out',
            'lg:static lg:z-0 lg:w-56 lg:max-w-none lg:translate-x-0 lg:bg-zinc-900/40 lg:shadow-none',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          ].join(' ')}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-4 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{sidebarTitle}</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Fechar menu"
            >
              <X size={22} />
            </button>
          </div>

          <div className="hidden border-b border-transparent px-3 py-6 lg:block">
            <div className="px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{sidebarTitle}</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 lg:px-3 lg:pt-0">
            {sidebarBody}
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-auto px-3 py-5 sm:px-5 sm:py-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
