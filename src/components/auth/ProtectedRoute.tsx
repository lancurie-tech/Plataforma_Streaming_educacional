import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, hasModule, masterAdmin, tokenClaimsReady } = useAuth();
  const { login } = useTenantPublicPaths();
  const location = useLocation();
  const canUsePortalVendedor = hasModule('vendedores');

  if (loading || (user && !tokenClaimsReady)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user) {
    return <Navigate to={login} replace state={{ from: location.pathname }} />;
  }

  if (location.pathname.startsWith('/vendedor') && profile?.role !== 'vendedor') {
    const dest =
      masterAdmin ? '/master' : profile?.role === 'admin' ? '/admin' : '/cursos';
    return <Navigate to={dest} replace />;
  }

  if (profile?.role === 'vendedor') {
    const allowed = location.pathname.startsWith('/vendedor');
    if (!allowed) {
      if (!canUsePortalVendedor) {
        return <Navigate to="/" replace />;
      }
      return (
        <Navigate
          to={profile.mustChangePassword ? '/vendedor/definir-senha' : '/vendedor'}
          replace
        />
      );
    }
  }

  return <>{children}</>;
}
