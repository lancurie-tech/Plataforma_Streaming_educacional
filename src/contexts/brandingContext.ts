import { createContext } from 'react';
import type { ResolvedBranding } from '@/lib/brand';

export const BrandingContext = createContext<ResolvedBranding | null>(null);
