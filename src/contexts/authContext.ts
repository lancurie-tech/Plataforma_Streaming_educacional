import { createContext } from 'react';
import type { User } from 'firebase/auth';
import type { TenantEntitlements, UserProfile } from '@/types';

export type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  /**
   * Slug de URL do tenant do utilizador (`tenants/{id}.publicSlug` ou id do doc).
   * Usado no apex para links `/${slug}/streaming` quando o URL ainda não traz o prefixo.
   */
  tenantUrlSlug: string | null;
  /** Custom claim `master_admin` no token Firebase (operador da plataforma). */
  masterAdmin: boolean;
  /** `false` brevemente após login até termos lido o token (para guards). */
  tokenClaimsReady: boolean;
  entitlements: TenantEntitlements | null;
  entitlementsLoading: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
  hasModule: (moduleId: string) => boolean;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
