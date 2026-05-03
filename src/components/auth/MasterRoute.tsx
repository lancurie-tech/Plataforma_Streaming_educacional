import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';
import { getCanonicalApexOrigin } from '@/lib/tenantHost/apex';

export function MasterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, masterAdmin, tokenClaimsReady } = useAuth();
  const { resolvedSlug } = usePublicTenantHost();

  useEffect(() => {
    if (!masterAdmin || !resolvedSlug) return;
    const apex = getCanonicalApexOrigin();
    if (!apex) return;
    try {
      const targetHost = new URL(apex).hostname;
      if (window.location.hostname === targetHost) return;
    } catch {
      return;
    }
    const next = `${apex.replace(/\/$/, '')}/master`;
    window.location.replace(next);
  }, [masterAdmin, resolvedSlug]);

  if (loading || !tokenClaimsReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        A verificar permissões…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/master' }} />;
  }

  if (!masterAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
