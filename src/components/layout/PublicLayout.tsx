/* Context + hooks são exportados juntos; Fast Refresh continua aceitável neste ficheiro. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Tv,
  UserRound,
  X,
} from 'lucide-react';
import { HeaderLogoImg } from '@/components/layout/HeaderLogoImg';
import { useAuth } from '@/contexts/useAuth';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { StreamingAssistantWidget } from '@/components/public/StreamingAssistantWidget';

/** Foco do vídeo em destaque na home (para o assistente e transcrição no servidor). */
export type StreamingAssistantFocus = { trackId: string; entryId: string } | null;

type StreamingAssistantFocusContextValue = {
  focus: StreamingAssistantFocus;
  setStreamingFocus: (f: StreamingAssistantFocus) => void;
};

const StreamingAssistantFocusContext =
  createContext<StreamingAssistantFocusContextValue | null>(null);

export function useStreamingAssistantFocus() {
  const ctx = useContext(StreamingAssistantFocusContext);
  if (!ctx) {
    throw new Error('useStreamingAssistantFocus deve ser usado dentro de PublicAssistantProviders');
  }
  return ctx;
}

export type AssistantCourseContextValue = {
  courseId: string;
  courseTitle: string;
} | null;

/** Foco "Saiba mais sobre o vídeo" no curso — transcrição Vimeo no assistente. */
export type CourseVideoAssistFocus = {
  moduleId: string;
  stepId: string;
  vimeoUrl: string;
  title: string;
  body?: string;
};

type AssistantCourseCtx = {
  courseAssist: AssistantCourseContextValue;
  setAssistantCourse: (c: AssistantCourseContextValue) => void;
  courseVideoAssist: CourseVideoAssistFocus | null;
  setCourseVideoAssist: (v: CourseVideoAssistFocus | null) => void;
};

const AssistantCourseContext = createContext<AssistantCourseCtx | null>(null);

/** Abre/fecha o painel flutuante do Mentor / MedivoxAI (dentro de `PublicAssistantProviders`). */
type AssistantPanelCtx = { open: boolean; setOpen: (v: boolean) => void };
const AssistantPanelContext = createContext<AssistantPanelCtx | null>(null);

export function useAssistantChatPanelOptional() {
  return useContext(AssistantPanelContext);
}

/** Existe quando a árvore está dentro de `PublicAssistantProviders` (layout público ou preview do vendedor). */
export function useAssistantCourseOptional() {
  return useContext(AssistantCourseContext);
}

export function useAssistantCourse() {
  const ctx = useContext(AssistantCourseContext);
  if (!ctx) {
    throw new Error('useAssistantCourse deve ser usado dentro de PublicAssistantProviders');
  }
  return ctx;
}

/** Providers do assistente (streaming + curso). Reutilizável na área do vendedor no preview do curso. */
export function PublicAssistantProviders({ children }: { children: ReactNode }) {
  const [focus, setStreamingFocus] = useState<StreamingAssistantFocus>(null);
  const [courseAssist, setAssistantCourse] = useState<AssistantCourseContextValue>(null);
  const [courseVideoAssist, setCourseVideoAssist] = useState<CourseVideoAssistFocus | null>(null);
  const [assistantPanelOpen, setAssistantPanelOpen] = useState(false);

  /** Fora da página de curso o foco de vídeo não conta (evita `setState` em `useEffect`). */
  const courseVideoAssistResolved = courseAssist ? courseVideoAssist : null;

  const focusVal = useMemo(
    () => ({ focus, setStreamingFocus }),
    [focus]
  );
  const courseVal = useMemo(
    () => ({
      courseAssist,
      setAssistantCourse,
      courseVideoAssist: courseVideoAssistResolved,
      setCourseVideoAssist,
    }),
    [courseAssist, courseVideoAssistResolved]
  );
  const panelVal = useMemo(
    () => ({ open: assistantPanelOpen, setOpen: setAssistantPanelOpen }),
    [assistantPanelOpen]
  );
  return (
    <StreamingAssistantFocusContext.Provider value={focusVal}>
      <AssistantPanelContext.Provider value={panelVal}>
        <AssistantCourseContext.Provider value={courseVal}>
          {children}
        </AssistantCourseContext.Provider>
      </AssistantPanelContext.Provider>
    </StreamingAssistantFocusContext.Provider>
  );
}

const subNavCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
  }`;

export function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }
  const showAssistant =
    pathname === '/streaming' ||
    pathname === '/cursos' ||
    pathname.startsWith('/canal/') ||
    pathname.startsWith('/curso/');

  return (
    <PublicAssistantProviders>
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto grid h-18 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <div aria-hidden className="pointer-events-none" />
          <Link
            to="/"
            className="flex justify-center"
            aria-label="Medivox — entrada e boas-vindas"
          >
            <HeaderLogoImg />
          </Link>
          <div className="flex justify-end gap-2 sm:gap-3">
            {!authLoading && user ? (
              <div className="relative flex justify-end" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-zinc-600/90 px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/80 hover:text-emerald-200 sm:px-3 sm:text-sm"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  aria-label={accountMenuOpen ? 'Fechar menu da conta' : 'Abrir menu da conta'}
                >
                  {accountMenuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
                  <span className="hidden sm:inline">Conta</span>
                </button>
                {accountMenuOpen ? (
                  <div
                    className="absolute right-0 z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
                    role="menu"
                  >
                    {profile?.role === 'admin' ? (
                      <Link
                        to="/admin"
                        className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                        onClick={() => setAccountMenuOpen(false)}
                        role="menuitem"
                      >
                        <LayoutDashboard size={18} aria-hidden />
                        Painel admin
                      </Link>
                    ) : null}
                    {profile?.role === 'vendedor' ? (
                      <Link
                        to="/vendedor"
                        className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                        onClick={() => setAccountMenuOpen(false)}
                        role="menuitem"
                      >
                        Área de vendas
                      </Link>
                    ) : null}
                      <Link
                        to="/streaming"
                        className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                        onClick={() => setAccountMenuOpen(false)}
                        role="menuitem"
                      >
                        <Tv size={18} aria-hidden />
                      Streaming
                    </Link>
                    <Link
                      to="/cursos"
                      className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => setAccountMenuOpen(false)}
                      role="menuitem"
                    >
                      <BookOpen size={18} aria-hidden />
                      {profile?.role === 'student' ? 'Meus programas' : 'Programas'}
                    </Link>
                    {profile?.role === 'student' ? (
                      <>
                        <Link
                          to="/perfil"
                          className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                          onClick={() => setAccountMenuOpen(false)}
                          role="menuitem"
                        >
                          <UserRound size={18} aria-hidden />
                          Área do aluno
                        </Link>
                        <Link
                          to="/certificados"
                          className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                          onClick={() => setAccountMenuOpen(false)}
                          role="menuitem"
                        >
                          <Award size={18} aria-hidden />
                          Certificados e histórico
                        </Link>
                      </>
                    ) : null}
                    {profile?.role !== 'student' ? (
                      <Link
                        to="/perfil"
                        className="flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                        onClick={() => setAccountMenuOpen(false)}
                        role="menuitem"
                      >
                        <UserRound size={18} aria-hidden />
                        Área do usuário
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 border-t border-zinc-800 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      onClick={() => void handleLogout()}
                      role="menuitem"
                    >
                      <LogOut size={18} aria-hidden />
                      Sair
                    </button>
                  </div>
                ) : null}
              </div>
            ) : !authLoading && !user ? (
              <Link
                to="/login"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-600/90 text-zinc-300 transition-colors hover:border-emerald-500/55 hover:bg-emerald-500/10 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60"
                aria-label="Entrar"
                title="Entrar"
              >
                <Menu size={22} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
        <nav
          className="border-t border-zinc-800/80 bg-zinc-950/90"
          aria-label="Áreas do site"
        >
          <div className="mx-auto flex max-w-6xl justify-center gap-1 px-4 py-2">
            <NavLink to="/streaming" end className={subNavCls}>
              Streaming
            </NavLink>
            <NavLink to="/cursos" className={subNavCls}>
              <span className="inline-flex items-center gap-1.5">
                Education
                <span
                  className="rounded-full bg-emerald-500/20 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40"
                  title="Novo"
                >
                  Novo
                </span>
              </span>
            </NavLink>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>
      {showAssistant ? <StreamingAssistantWidget /> : null}
      <LegalFooter />
    </div>
    </PublicAssistantProviders>
  );
}
