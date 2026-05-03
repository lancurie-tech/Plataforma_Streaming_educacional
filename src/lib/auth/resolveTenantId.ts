import type { UserProfile } from '@/types';

export function resolveTenantId(profile: UserProfile | null): string | null {
  if (!profile) return null;
  if (typeof profile.tenantId === 'string' && profile.tenantId) return profile.tenantId;
  if (typeof profile.companyId === 'string' && profile.companyId) return profile.companyId;
  return null;
}
