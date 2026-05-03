import { useMemo } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';
import { publicPathPrefixFromSlug } from '@/lib/tenantHost/publicPathPrefix';

/** URLs públicas com prefixo de tenant (`/slug/...`) — URL atual ou, no apex, slug do perfil. */
export function useTenantPublicPaths() {
  const { publicPathPrefix } = usePublicTenantHost();
  const { tenantUrlSlug } = useAuth();
  const fromAuth = publicPathPrefixFromSlug(tenantUrlSlug);
  const p = publicPathPrefix || fromAuth;

  return useMemo(
    () => ({
      prefix: p,
      streaming: p ? `${p}/streaming` : '/login',
      cursos: p ? `${p}/cursos` : '/login',
      sobre: p ? `${p}/sobre` : '/sobre',
      contato: p ? `${p}/contato` : '/contato',
      login: p ? `${p}/login` : '/login',
      canal: (channelId: string) => (p ? `${p}/canal/${channelId}` : '/login'),
      curso: (courseId: string) => (p ? `${p}/curso/${courseId}` : '/login'),
      defaultHome: p ? `${p}/streaming` : '/login',
    }),
    [p],
  );
}
