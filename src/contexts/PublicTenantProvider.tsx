import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getTenantPublicSlugDoc, type TenantPublicSlugDoc } from '@/lib/firestore/tenantPublicSlug';
import { isReservedPublicSlug } from '@/lib/tenantHost/normalizePublicSlug';
import { parsePathTenantForPublicHost } from '@/lib/tenantHost/parsePathTenant';
import {
  rememberTenantSlugForPostLogin,
  publicPathPrefixFromSlug,
} from '@/lib/tenantHost/publicPathPrefix';
import { resolveHostTenantMode } from '@/lib/tenantHost/resolveSubdomain';
import {
  PublicTenantContext,
  type PublicTenantContextValue,
  type TenantPublicResolutionMode,
} from '@/contexts/publicTenantContext';

async function loadSlugDoc(
  slug: string,
  cancelled: () => boolean
): Promise<{ ok: true; doc: TenantPublicSlugDoc } | { ok: false }> {
  try {
    const doc = await getTenantPublicSlugDoc(slug);
    if (cancelled()) return { ok: false };
    if (!doc) return { ok: false };
    return { ok: true, doc };
  } catch {
    if (cancelled()) return { ok: false };
    return { ok: false };
  }
}

export function PublicTenantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [resolutionMode, setResolutionMode] = useState<TenantPublicResolutionMode>('apex');
  const [publicSnapshot, setPublicSnapshot] = useState<TenantPublicSlugDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostError, setHostError] = useState<PublicTenantContextValue['hostError']>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setHostError(null);

      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

      // 1) Subdomínio (quando `VITE_PUBLIC_APP_APEX_DOMAIN` está definido e o host não é apex)
      const hostMode = resolveHostTenantMode(hostname);
      if (hostMode.kind === 'tenant') {
        const hs = hostMode.slug;
        if (isReservedPublicSlug(hs)) {
          setResolvedSlug(hs);
          setPublicSnapshot(null);
          setResolutionMode('subdomain');
          setHostError('invalid_slug');
          rememberTenantSlugForPostLogin(null);
          setLoading(false);
          return;
        }

        const loaded = await loadSlugDoc(hs, () => cancelled);
        if (cancelled) return;
        if (!loaded.ok) {
          setResolvedSlug(hs);
          setPublicSnapshot(null);
          setResolutionMode('subdomain');
          setHostError('not_found');
          rememberTenantSlugForPostLogin(null);
          setLoading(false);
          return;
        }

        setResolvedSlug(hs);
        setPublicSnapshot(loaded.doc);
        setResolutionMode('subdomain');
        setHostError(null);
        rememberTenantSlugForPostLogin(hs);
        setLoading(false);
        return;
      }

      // 2) Path `/slug/streaming`, … (Firebase Hosting default e apex sem DNS wildcard)
      const pathCand = parsePathTenantForPublicHost(location.pathname);
      if (pathCand) {
        const ps = pathCand.slug;
        if (isReservedPublicSlug(ps)) {
          setResolvedSlug(ps);
          setPublicSnapshot(null);
          setResolutionMode('path');
          setHostError('invalid_slug');
          rememberTenantSlugForPostLogin(null);
          setLoading(false);
          return;
        }

        const loaded = await loadSlugDoc(ps, () => cancelled);
        if (cancelled) return;
        if (!loaded.ok) {
          setResolvedSlug(ps);
          setPublicSnapshot(null);
          setResolutionMode('path');
          setHostError('not_found');
          rememberTenantSlugForPostLogin(null);
          setLoading(false);
          return;
        }

        setResolvedSlug(ps);
        setPublicSnapshot(loaded.doc);
        setResolutionMode('path');
        setHostError(null);
        rememberTenantSlugForPostLogin(ps);
        setLoading(false);
        return;
      }

      // 3) Apex — sem tenant no URL
      setResolvedSlug(null);
      setPublicSnapshot(null);
      setResolutionMode('apex');
      setHostError(null);
      rememberTenantSlugForPostLogin(null);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.key]);

  const isSuspended =
    publicSnapshot != null && publicSnapshot.status !== 'active';

  const publicPathPrefix = useMemo(
    () => publicPathPrefixFromSlug(resolvedSlug),
    [resolvedSlug],
  );

  const value = useMemo(
    (): PublicTenantContextValue => ({
      resolvedSlug,
      publicPathPrefix,
      resolutionMode,
      publicSnapshot,
      loading,
      hostError,
      isSuspended,
    }),
    [resolvedSlug, publicPathPrefix, resolutionMode, publicSnapshot, loading, hostError, isSuspended],
  );

  return <PublicTenantContext.Provider value={value}>{children}</PublicTenantContext.Provider>;
}
