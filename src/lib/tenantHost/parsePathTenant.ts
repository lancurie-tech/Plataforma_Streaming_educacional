import { RESERVED_SUBDOMAIN_SLUGS } from '@/lib/tenantHost/normalizePublicSlug';

/** Segmentos raiz que não são slug de tenant (rotas globais da SPA). */
const EXTRA_ROOT_RESERVED = [
  'streaming',
  'canal',
  'certificados',
  'meus-cursos',
  'redefinir-senha',
] as const;

/**
 * Primeiro segmento da URL que nunca é tratado como slug de tenant em modo path.
 */
const RESERVED_FIRST_SEGMENT = new Set<string>([
  ...RESERVED_SUBDOMAIN_SLUGS,
  ...EXTRA_ROOT_RESERVED,
  'curso',
]);

/** Primeiro segmento da URL que não pode ser `/:tenantSlug` (rotas globais / lexicon interno). */
export function isReservedApexPathSegment(segment: string): boolean {
  return RESERVED_FIRST_SEGMENT.has(segment.toLowerCase());
}

/**
 * Segundos segmentos que indicam área pública do tenant (`/slug/streaming`, …).
 * Evita tratar `/slug/lixo` como tenant sem rota correspondente.
 */
const TENANT_PUBLIC_SECOND_SEGMENTS = new Set([
  'streaming',
  'cursos',
  'sobre',
  'contato',
  'termos',
  'privacidade',
  'compromissos',
  'confidencialidade-vendedor',
  'canal',
  'curso',
]);

/** Inclui login/cadastro para resolver tenant em `/slug/login` (marca + sessão). */
const TENANT_HOST_SECOND_SEGMENTS = new Set<string>([
  ...TENANT_PUBLIC_SECOND_SEGMENTS,
  'login',
  'cadastro',
]);

/**
 * Resolve slug de tenant para carregar `tenantPublicSlugs/{slug}` em qualquer rota pública sob `/slug/…`,
 * incluindo `/slug/login` e `/slug/cadastro`.
 */
export function parsePathTenantForPublicHost(pathname: string): { slug: string } | null {
  const path = pathname.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 1) return null;

  if (parts.length === 1) {
    const only = parts[0].toLowerCase();
    if (RESERVED_FIRST_SEGMENT.has(only)) return null;
    return { slug: only };
  }

  const [first, second] = parts;
  const f = first.toLowerCase();
  if (RESERVED_FIRST_SEGMENT.has(f)) return null;
  const s = second.toLowerCase();
  if (!TENANT_HOST_SECOND_SEGMENTS.has(s)) return null;

  return { slug: f };
}

/**
 * Extrai slug de tenant do path `/slug` ou `/slug/streaming`, …
 * Não confunde com `/:empresa/login|cadastro`.
 */
export function parsePathTenantCandidate(pathname: string): { slug: string } | null {
  const path = pathname.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 1) return null;

  if (parts.length === 1) {
    const only = parts[0].toLowerCase();
    if (RESERVED_FIRST_SEGMENT.has(only)) return null;
    return { slug: only };
  }

  const [first, second] = parts;
  const f = first.toLowerCase();
  if (RESERVED_FIRST_SEGMENT.has(f)) return null;
  if (second === 'login' || second === 'cadastro') return null;
  const s = second.toLowerCase();
  if (!TENANT_PUBLIC_SECOND_SEGMENTS.has(s)) return null;

  return { slug: f };
}
