import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeFirestoreBranding } from '@/lib/brand';
import { BrandingContext } from '@/contexts/brandingContext';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';
import {
  mergeBrandingFirestoreLayers,
  subscribeBranding,
  subscribeTenantPublicBranding,
  type BrandingFirestoreDoc,
} from '@/lib/firestore/branding';

function setHeadIcon(rel: string, href: string) {
  const head = document.head;
  if (!head) return;
  const selector = `link[data-branding="${rel}"]`;
  const existing = head.querySelector(selector) as HTMLLinkElement | null;
  if (!href.trim()) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.createElement('link');
  link.setAttribute('data-branding', rel);
  link.rel = rel;
  link.href = href;
  if (rel === 'icon') link.type = 'image/png';
  if (!existing) head.appendChild(link);
}

function setCssVar(name: string, value: string) {
  const root = document.documentElement;
  if (!root) return;
  root.style.setProperty(name, value);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { publicSnapshot, resolvedSlug } = usePublicTenantHost();
  const [globalRemote, setGlobalRemote] = useState<BrandingFirestoreDoc | null | undefined>(undefined);
  const [tenantRemote, setTenantRemote] = useState<BrandingFirestoreDoc | null>(null);

  useEffect(() => subscribeBranding(setGlobalRemote), []);

  useEffect(() => {
    const tid = publicSnapshot?.tenantId?.trim() || null;
    return subscribeTenantPublicBranding(tid, setTenantRemote);
  }, [publicSnapshot?.tenantId]);

  const layered = useMemo(
    () => mergeBrandingFirestoreLayers(globalRemote ?? null, tenantRemote),
    [globalRemote, tenantRemote],
  );

  const value = useMemo(() => mergeFirestoreBranding(layered), [layered]);

  useEffect(() => {
    if (globalRemote === undefined) return;
    setHeadIcon('icon', value.faviconSrc);
    setHeadIcon('apple-touch-icon', value.faviconSrc);
    const tenantTitle =
      resolvedSlug && publicSnapshot?.displayName?.trim()
        ? publicSnapshot.displayName.trim()
        : value.platformShortName;
    document.title = tenantTitle;
    setCssVar('--brand-primary', value.palette.primary);
    setCssVar('--brand-primary-hover', value.palette.primaryHover);
    setCssVar('--brand-accent', value.palette.accent);
    setCssVar('--brand-bg', value.palette.background);
    setCssVar('--brand-text', value.palette.text);
    setCssVar('--brand-text-muted', value.palette.textMuted);
  }, [globalRemote, resolvedSlug, publicSnapshot, value.faviconSrc, value.platformShortName, value.palette]);

  // Evita pintar UI com fallback antes de receber o primeiro snapshot global.
  if (globalRemote === undefined) return null;

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
