import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeFirestoreBranding } from '@/lib/brand';
import { BrandingContext } from '@/contexts/brandingContext';
import { subscribeBranding, type BrandingFirestoreDoc } from '@/lib/firestore/branding';

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<BrandingFirestoreDoc | null>(null);

  useEffect(() => subscribeBranding(setRemote), []);

  const value = useMemo(() => mergeFirestoreBranding(remote), [remote]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
