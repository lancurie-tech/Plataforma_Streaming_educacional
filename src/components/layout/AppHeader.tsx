import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LogOut,
  UserRound,
  Menu,
  X,
  LayoutDashboard,
  Award,
  Tv,
  BookOpen,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import { useBrand } from '@/contexts/useBrand';
import { HeaderLogoImg } from '@/components/layout/HeaderLogoImg';

export function AppHeader() {
  const brand = useBrand();
  const { logout, profile, hasModule, masterAdmin } = useAuth();
  const paths = useTenantPublicPaths();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canCursos = hasModule('cursos');
  const canStreaming = hasModule('streaming');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate(paths.login, { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-backdrop-filter:bg-zinc-950/85">
      <div className="relative mx-auto flex h-18 max-w-5xl items-center justify-between px-3 sm:px-4">
        {/* Coluna esquerda — equilibra o menu à direita para o logo ficar centrado no ecrã */}
        <div className="w-11 shrink-0 sm:w-12" aria-hidden />

        <Link
          to={paths.prefix ? paths.streaming : '/'}
          className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 touch-manipulation"
          aria-label={`${brand.platformShortName} — página inicial e streaming`}
          title="Página inicial (streaming)"
        >
          <HeaderLogoImg />
        </Link>

        <div className="relative flex w-11 shrink-0 justify-end sm:w-12" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-zinc-700 text-zinc-200 hover:bg-zinc-800 active:bg-zinc-800/80"
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          {open ? (
            <div
              className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              role="menu"
            >
              {masterAdmin ? (
                <Link
                  to="/master"
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <Building2 size={18} />
                  Console master
                </Link>
              ) : profile?.role === 'admin' ? (
                <Link
                  to="/admin"
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <LayoutDashboard size={18} />
                  Painel admin
                </Link>
              ) : null}
              {canStreaming ? (
                <Link
                  to={paths.streaming}
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <Tv size={18} />
                  Streaming (início)
                </Link>
              ) : null}
              {canCursos ? (
                <Link
                  to={paths.cursos}
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <BookOpen size={18} />
                  Meus cursos
                </Link>
              ) : null}
              {!masterAdmin && profile?.role !== 'admin' && canCursos ? (
                <Link
                  to="/certificados"
                  className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <Award size={18} />
                  Certificados e histórico
                </Link>
              ) : null}
              <Link
                to="/perfil"
                className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                <UserRound size={18} />
                Área do usuário
              </Link>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={18} />
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
