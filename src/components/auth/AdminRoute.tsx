import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';
import { resolveTenantIdFromProfile } from '@/lib/firestore/tenancy';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, masterAdmin, tokenClaimsReady } = useAuth();
  const { publicSnapshot, resolvedSlug } = usePublicTenantHost();

  if (loading || (user && !tokenClaimsReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  /** Operador master não usa o painel do cliente — mesmo com `role: admin` no perfil. */
  if (masterAdmin) {
    return <Navigate to="/master" replace />;
  }

  const actorTenant = resolveTenantIdFromProfile(profile);
  if (resolvedSlug && publicSnapshot && actorTenant && actorTenant !== publicSnapshot.tenantId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Conta noutro ambiente</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Esta sessão pertence a outra organização. Termine a sessão e entre com a conta do painel
          deste endereço.
        </p>
        <Link
          to="/login"
          className="rounded-lg border border-violet-500/50 bg-violet-600/20 px-4 py-2 text-sm text-violet-200 hover:bg-violet-600/30"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
