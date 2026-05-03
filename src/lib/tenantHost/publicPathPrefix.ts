import { STORAGE_NS } from '@/lib/brand';

/** sessionStorage: último tenant público (path ou host) para pós-login do aluno. */
export const TENANT_PUBLIC_SLUG_STORAGE_KEY = `${STORAGE_NS}.tenantPublicSlug`;

export function publicPathPrefixFromSlug(slug: string | null | undefined): string {
  const s = slug?.trim().toLowerCase();
  return s ? `/${s}` : '';
}

export function rememberTenantSlugForPostLogin(slug: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (slug) sessionStorage.setItem(TENANT_PUBLIC_SLUG_STORAGE_KEY, slug);
  else sessionStorage.removeItem(TENANT_PUBLIC_SLUG_STORAGE_KEY);
}

export function readTenantSlugForPostLogin(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(TENANT_PUBLIC_SLUG_STORAGE_KEY);
}
