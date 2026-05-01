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
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useBrand } from '@/contexts/useBrand';
import { useNavigate } from 'react-router-dom';
import { DashboardSidebarLayout } from '@/components/layout/DashboardSidebarLayout';
const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2 ${
    isActive ? 'bg-(--brand-primary) text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  }`;

export function AdminLayout() {
  const brand = useBrand();
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebarBody = (
    <>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Administração">
        <NavLink to="/streaming" className={navCls}>
          <ExternalLink size={18} className="shrink-0" />
          Ver streaming (site público)
        </NavLink>
        <NavLink to="/admin" end className={navCls}>
          <LayoutGrid size={18} className="shrink-0" />
          Visão geral
        </NavLink>
        <NavLink to="/admin/dashboard" className={navCls}>
          <LayoutDashboard size={18} className="shrink-0" />
          Dashboard
        </NavLink>
        <NavLink to="/admin/empresas" className={navCls}>
          <Building2 size={18} className="shrink-0" />
          Empresas
        </NavLink>
        <NavLink to="/admin/vendedores" className={navCls}>
          <Users size={18} className="shrink-0" />
          Vendedores
        </NavLink>
        <NavLink to="/admin/cursos" className={navCls}>
          <BookOpen size={18} className="shrink-0" />
          Cursos
        </NavLink>
        <NavLink to="/admin/streaming" className={navCls}>
          <Tv size={18} className="shrink-0" />
          Home streaming
        </NavLink>
        <NavLink to="/admin/canais" className={navCls}>
          <Radio size={18} className="shrink-0" />
          Canais
        </NavLink>
        <NavLink to="/admin/streaming-banners" className={navCls}>
          <Images size={18} className="shrink-0" />
          Banners streaming
        </NavLink>
        <NavLink to="/admin/identidade-visual" className={navCls}>
          <Palette size={18} className="shrink-0" />
          Identidade visual
        </NavLink>
        <NavLink to="/admin/conteudo-site" className={navCls}>
          <FileText size={18} className="shrink-0" />
          Conteúdo do site
        </NavLink>
        <NavLink to="/admin/streaming-analytics" className={navCls}>
          <Eye size={18} className="shrink-0" />
          Audiência streaming
        </NavLink>
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
