import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeFirestoreBranding } from '@/lib/brand';
import { BrandingContext } from '@/contexts/brandingContext';
import { subscribeBranding, type BrandingFirestoreDoc } from '@/lib/firestore/branding';

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
  const [remote, setRemote] = useState<BrandingFirestoreDoc | null | undefined>(undefined);

  useEffect(() => subscribeBranding(setRemote), []);

  const value = useMemo(() => mergeFirestoreBranding(remote ?? null), [remote]);

  useEffect(() => {
    if (remote === undefined) return;
    setHeadIcon('icon', value.faviconSrc);
    setHeadIcon('apple-touch-icon', value.faviconSrc);
    document.title = value.platformShortName;
    setCssVar('--brand-primary', value.palette.primary);
    setCssVar('--brand-primary-hover', value.palette.primaryHover);
    setCssVar('--brand-accent', value.palette.accent);
    setCssVar('--brand-bg', value.palette.background);
    setCssVar('--brand-text', value.palette.text);
    setCssVar('--brand-text-muted', value.palette.textMuted);
  }, [remote, value.faviconSrc, value.platformShortName, value.palette]);

  // Evita pintar UI com fallback antes de receber o primeiro snapshot remoto.
  if (remote === undefined) return null;

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
