import type { User } from 'firebase/auth';
import type { UserProfile } from '@/types';
import {
  publicPathPrefixFromSlug,
  readTenantSlugForPostLogin,
} from '@/lib/tenantHost/publicPathPrefix';

/** Destino após login de aluno: `state.from` ou home de streaming com prefixo de tenant. */
export function postLoginStudentPath(from: unknown, tenantUrlSlug: string | null): string {
  if (
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    from !== '/login'
  ) {
    return from;
  }
  const session = readTenantSlugForPostLogin();
  const base = publicPathPrefixFromSlug(session || tenantUrlSlug);
  return base ? `${base}/streaming` : '/login';
}

/**
 * Destino após login na página `/login`: operador master (claim `master_admin` ou `role: master`) → `/master`; resto conforme papel no perfil.
 */
export async function resolvePostLoginPath(
  user: User,
  profile: UserProfile,
  from: unknown,
  tenantUrlSlug: string | null,
): Promise<string> {
  if (profile.role === 'master') {
    return '/master';
  }
  try {
    const tk = await user.getIdTokenResult(true);
    if (tk.claims.master_admin === true) {
      return '/master';
    }
  } catch {
    /* fallback pelo perfil */
  }

  if (profile.role === 'admin') {
    const base = publicPathPrefixFromSlug(tenantUrlSlug);
    return base ? `${base}/admin` : '/admin';
  }
  if (profile.role === 'vendedor') {
    if (profile.mustChangePassword) {
      return '/vendedor/definir-senha';
    }
    return '/vendedor';
  }
  return postLoginStudentPath(from, tenantUrlSlug);
}
