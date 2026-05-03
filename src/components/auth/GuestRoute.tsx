import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { resolveTenantId } from '@/lib/auth/resolveTenantId';
import {
  publicPathPrefixFromSlug,
  readTenantSlugForPostLogin,
} from '@/lib/tenantHost/publicPathPrefix';

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const {
    user,
    profile,
    loading,
    masterAdmin,
    tokenClaimsReady,
    entitlementsLoading,
    tenantUrlSlug,
  } = useAuth();

  if (loading || (user && !tokenClaimsReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (user) {
    if (masterAdmin) {
      return <Navigate to="/master" replace />;
    }
    if (profile?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (profile?.role === 'vendedor') {
      return (
        <Navigate
          to={profile.mustChangePassword ? '/vendedor/definir-senha' : '/vendedor'}
          replace
        />
      );
    }

    const tenantId = resolveTenantId(profile ?? null);
    const waitingStudentTenant =
      Boolean(tenantId) && entitlementsLoading;

    if (waitingStudentTenant) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Carregando…
        </div>
      );
    }

    const session = readTenantSlugForPostLogin();
    const prefix = publicPathPrefixFromSlug(session || tenantUrlSlug);
    if (!prefix) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to={`${prefix}/streaming`} replace />;
  }

  return <>{children}</>;
}
