import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, ExternalLink, FileText, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { DashboardSidebarLayout } from '@/components/layout/DashboardSidebarLayout';
import { PublicAssistantProviders } from '@/components/layout/PublicLayout';
import { StreamingAssistantWidget } from '@/components/public/StreamingAssistantWidget';
import { VendedorOnboardingTour } from '@/components/vendedor/VendedorOnboardingTour';
import { useBrand } from '@/contexts/useBrand';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2 ${
    isActive ? 'bg-sky-500/15 text-sky-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  }`;

export function VendedorLayout() {
  const brand = useBrand();
  const paths = useTenantPublicPaths();
  const { logout, user, hasModule } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showCourseAssistant =
    pathname.startsWith('/vendedor/curso/') &&
    hasModule('cursos') &&
    hasModule('chat');
  const canStreaming = hasModule('streaming');

  async function handleLogout() {
    await logout();
    navigate(paths.login, { replace: true });
  }

  const sidebarBody = (
    <>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Área do vendedor">
        {canStreaming ? (
          <NavLink to={paths.streaming} className={navCls}>
            <ExternalLink size={18} className="shrink-0" />
            Streaming (público)
          </NavLink>
        ) : null}
        <NavLink to="/vendedor" end className={navCls} data-vendedor-tour="inicio">
          <Home size={18} className="shrink-0" />
          Início
        </NavLink>
        <NavLink to="/vendedor/relatorios" className={navCls} data-vendedor-tour="relatorios">
          <BarChart3 size={18} className="shrink-0" />
          Relatórios
        </NavLink>
        <NavLink to="/vendedor/cursos" className={navCls} data-vendedor-tour="cursos">
          <BookOpen size={18} className="shrink-0" />
          Cursos
        </NavLink>
        <NavLink to="/vendedor/documentacao" className={navCls} data-vendedor-tour="documentacao">
          <FileText size={18} className="shrink-0" />
          Documentação
        </NavLink>
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 lg:min-h-0 lg:py-2"
      >
        <LogOut size={18} className="shrink-0" />
        Sair
      </button>
    </>
  );

  return (
    <PublicAssistantProviders>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <div className="min-h-0 flex-1">
          <DashboardSidebarLayout sidebarTitle={`${brand.platformShortName} · Vendas`} sidebarBody={sidebarBody}>
            <Outlet />
          </DashboardSidebarLayout>
        </div>
        {showCourseAssistant ? <StreamingAssistantWidget /> : null}
        <LegalFooter showVendorConfidentialityLink />
        {user ? <VendedorOnboardingTour userId={user.uid} /> : null}
      </div>
    </PublicAssistantProviders>
  );
}
