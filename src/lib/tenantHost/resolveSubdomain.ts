import { getConfiguredApexDomain } from '@/lib/tenantHost/apex';

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Extrai o primeiro label do subdomínio para `slug.dominioapex.com`.
 * Não suporta nested multi-nível (`a.b.apex.com`) no MVP.
 */
export function extractTenantSubdomainLabel(hostname: string, apexDomain: string): string | null {
  const host = normalizeHost(hostname);
  const apex = normalizeHost(apexDomain);
  if (!host || !apex) return null;

  if (host === apex || host === `www.${apex}`) {
    return null;
  }

  const suffix = `.${apex}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const subPart = host.slice(0, -suffix.length);
  if (!subPart || subPart.includes('.')) {
    return null;
  }

  return subPart;
}

export type HostTenantResolution =
  | { kind: 'apex' }
  | { kind: 'tenant'; slug: string };

/**
 * Resolve se o browser está no apex ou num host de tenant por subdomínio.
 * Em localhost, usa `VITE_PUBLIC_TENANT_SLUG_DEV` para simular tenant (opcional).
 */
export function resolveHostTenantMode(hostname: string): HostTenantResolution {
  const devSlug = import.meta.env.VITE_PUBLIC_TENANT_SLUG_DEV?.trim();
  if (
    devSlug &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost'))
  ) {
    return { kind: 'tenant', slug: devSlug };
  }

  const apex = getConfiguredApexDomain();
  if (!apex) {
    return { kind: 'apex' };
  }

  const label = extractTenantSubdomainLabel(hostname, apex);
  if (!label) {
    return { kind: 'apex' };
  }

  return { kind: 'tenant', slug: label };
}
