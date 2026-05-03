import { RESERVED_COMPANY_SLUGS } from '@/lib/slug';

/** Slugs extras reservados só para subdomínio (www já tratado no hostname). */
export const RESERVED_SUBDOMAIN_SLUGS = new Set([
  ...RESERVED_COMPANY_SLUGS,
  'www',
  'app',
  'cdn',
  'mail',
  'ftp',
]);

/** Normaliza slug público para path Firestore `tenantPublicSlugs/{slug}` e DNS label. */
export function normalizeTenantPublicSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_SUBDOMAIN_SLUGS.has(slug);
}
