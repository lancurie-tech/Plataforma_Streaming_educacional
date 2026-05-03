import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, LogOut, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { DashboardSidebarLayout } from '@/components/layout/DashboardSidebarLayout';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2 ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  }`;

export function MasterLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebarBody = (
    <>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Master">
        <NavLink to="/master" end className={navCls}>
          <Building2 size={18} className="shrink-0" />
          Tenants (organizações)
        </NavLink>
        <NavLink to="/master/tenants/novo" className={navCls}>
          <Plus size={18} className="shrink-0" />
          Nova organização
        </NavLink>
        <NavLink to="/master/marketplace" className={navCls}>
          <ShoppingBag size={18} className="shrink-0" />
          Marketplace (pedidos)
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
    <DashboardSidebarLayout sidebarTitle="Console master" sidebarBody={sidebarBody}>
      <Outlet />
    </DashboardSidebarLayout>
  );
}
