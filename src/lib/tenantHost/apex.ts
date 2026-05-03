/**
 * Domínio apex da app (ex.: plataforma.com) — usado para extrair subdomínio.
 * `VITE_PUBLIC_APP_APEX_DOMAIN` deve ser só o host, sem protocolo nem path.
 */
export function getConfiguredApexDomain(): string | undefined {
  const raw = import.meta.env.VITE_PUBLIC_APP_APEX_DOMAIN?.trim();
  return raw || undefined;
}

/**
 * Origem canónica do painel / marketing no apex (links e redirects do master).
 * Preferir `VITE_PUBLIC_APP_ORIGIN`; senão compõe com o apex configurado ou origem atual (localhost).
 */
export function getCanonicalApexOrigin(): string {
  const explicit = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()?.replace(/\/$/, '');
  if (explicit) return explicit;

  if (typeof window === 'undefined') return '';

  const { protocol, host, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${host}`;
  }

  const apex = getConfiguredApexDomain();
  if (apex) {
    return `${protocol}//${apex}`;
  }

  return window.location.origin;
}
