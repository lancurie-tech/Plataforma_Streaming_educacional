import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';

/**
 * Índice `/:tenantSlug` — envia para a primeira área pública permitida pelos entitlements do tenant.
 */
export function TenantSlugWelcomePage() {
  const navigate = useNavigate();
  const { loading, entitlementsLoading, hasModule } = useAuth();
  const paths = useTenantPublicPaths();

  useEffect(() => {
    if (loading || entitlementsLoading) return;
    if (hasModule('streaming')) {
      navigate(paths.streaming, { replace: true });
      return;
    }
    if (hasModule('cursos')) {
      navigate(paths.cursos, { replace: true });
      return;
    }
    navigate(paths.sobre, { replace: true });
  }, [loading, entitlementsLoading, hasModule, navigate, paths]);

  return (
    <p className="text-center text-sm text-zinc-500">A redirecionar…</p>
  );
}
