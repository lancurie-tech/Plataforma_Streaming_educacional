import { useContext } from 'react';
import { BrandingContext } from '@/contexts/brandingContext';
import type { ResolvedBranding } from '@/lib/brand';

export function useBrand(): ResolvedBranding {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error('useBrand deve ser usado dentro de BrandingProvider');
  }
  return ctx;
}
