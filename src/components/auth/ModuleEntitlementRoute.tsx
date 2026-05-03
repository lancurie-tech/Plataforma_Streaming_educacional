import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';

type ModuleEntitlementRouteProps = {
  moduleId: string;
  fallbackTo?: string;
  children: React.ReactNode;
};

function resolveFallback(fallbackTo: string, publicPathPrefix: string): string {
  if (fallbackTo !== '/' || !publicPathPrefix) {
    return fallbackTo;
  }
  return `${publicPathPrefix}/sobre`;
}

export function ModuleEntitlementRoute({
  moduleId,
  fallbackTo = '/admin',
  children,
}: ModuleEntitlementRouteProps) {
  const { loading, entitlementsLoading, hasModule } = useAuth();
  const { publicPathPrefix } = usePublicTenantHost();
  const effectiveFallback = resolveFallback(fallbackTo, publicPathPrefix);

  if (loading || entitlementsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando...
      </div>
    );
  }

  if (!hasModule(moduleId)) {
    return <Navigate to={effectiveFallback} replace />;
  }

  return <>{children}</>;
}
