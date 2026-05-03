import { createContext } from 'react';
import type { TenantPublicSlugDoc } from '@/lib/firestore/tenantPublicSlug';

export type TenantPublicResolutionMode = 'apex' | 'subdomain' | 'path';

export type PublicTenantContextValue = {
  /** `null` = apex / marketing / sem tenant no URL */
  resolvedSlug: string | null;
  /** Prefixo `/${slug}` para links (`''` no apex). */
  publicPathPrefix: string;
  resolutionMode: TenantPublicResolutionMode;
  publicSnapshot: TenantPublicSlugDoc | null;
  loading: boolean;
  hostError: 'not_found' | 'invalid_slug' | null;
  isSuspended: boolean;
};

export const PublicTenantContext = createContext<PublicTenantContextValue | undefined>(undefined);
