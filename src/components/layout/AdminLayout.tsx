import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  BookOpen,
  LogOut,
  UserRound,
  Tv,
  Users,
  Eye,
  ExternalLink,
  Radio,
  FileText,
  Images,
  Palette,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import { resolveTenantIdFromProfile } from '@/lib/firestore/tenancy';
import { useBrand } from '@/contexts/useBrand';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebarLayout } from '@/components/layout/DashboardSidebarLayout';
const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2 ${
    isActive ? 'bg-(--brand-primary) text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  }`;

export function AdminLayout() {
  const brand = useBrand();
  const paths = useTenantPublicPaths();
  const { logout, hasModule, profile } = useAuth();
  const navigate = useNavigate();
  const tenantForMarketplace = resolveTenantIdFromProfile(profile);
  const canStreaming = hasModule('streaming');
  const canCursos = hasModule('cursos');
  const canVendedores = hasModule('vendedores');

  async function handleLogout() {
    await logout();
    navigate(paths.login, { replace: true });
  }

  const sidebarBody = (
    <>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Administração">
        {canStreaming ? (
          <NavLink to={paths.streaming} className={navCls}>
            <ExternalLink size={18} className="shrink-0" />
            Ver streaming (site público)
          </NavLink>
        ) : null}
        {canCursos ? (
          <NavLink to="/admin" end className={navCls}>
            <LayoutGrid size={18} className="shrink-0" />
            Visão geral
          </NavLink>
        ) : null}
        {canCursos ? (
          <NavLink to="/admin/dashboard" className={navCls}>
            <LayoutDashboard size={18} className="shrink-0" />
            Dashboard
          </NavLink>
        ) : null}
        {canCursos ? (
          <NavLink to="/admin/empresas" className={navCls}>
            <Building2 size={18} className="shrink-0" />
            Empresas
          </NavLink>
        ) : null}
        {canVendedores ? (
          <NavLink to="/admin/vendedores" className={navCls}>
            <Users size={18} className="shrink-0" />
            Vendedores
          </NavLink>
        ) : null}
        {canCursos ? (
          <NavLink to="/admin/cursos" className={navCls}>
            <BookOpen size={18} className="shrink-0" />
            Cursos
          </NavLink>
        ) : null}
        {canStreaming ? (
          <NavLink to="/admin/streaming" className={navCls}>
            <Tv size={18} className="shrink-0" />
            Home streaming
          </NavLink>
        ) : null}
        {canStreaming ? (
          <NavLink to="/admin/canais" className={navCls}>
            <Radio size={18} className="shrink-0" />
            Canais
          </NavLink>
        ) : null}
        {canStreaming ? (
          <NavLink to="/admin/streaming-banners" className={navCls}>
            <Images size={18} className="shrink-0" />
            Banners streaming
          </NavLink>
        ) : null}
        {tenantForMarketplace ? (
          <NavLink to="/admin/marketplace" className={navCls}>
            <ShoppingBag size={18} className="shrink-0" />
            Marketplace
          </NavLink>
        ) : null}
        <NavLink to="/admin/identidade-visual" className={navCls}>
          <Palette size={18} className="shrink-0" />
          Identidade visual
        </NavLink>
        <NavLink to="/admin/conteudo-site" className={navCls}>
          <FileText size={18} className="shrink-0" />
          Conteúdo do site
        </NavLink>
        {canStreaming ? (
          <NavLink to="/admin/streaming-analytics" className={navCls}>
            <Eye size={18} className="shrink-0" />
            Audiência streaming
          </NavLink>
        ) : null}
        <NavLink to="/admin/conta" className={navCls}>
          <UserRound size={18} className="shrink-0" />
          Conta e senha
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
    <DashboardSidebarLayout sidebarTitle={`${brand.platformShortName} · Admin`} sidebarBody={sidebarBody}>
      <Outlet />
    </DashboardSidebarLayout>
  );
}
