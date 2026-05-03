import { useContext } from 'react';
import { PublicTenantContext } from '@/contexts/publicTenantContext';

export function usePublicTenantHost() {
  const ctx = useContext(PublicTenantContext);
  if (!ctx) {
    throw new Error('usePublicTenantHost deve ser usado dentro de PublicTenantProvider');
  }
  return ctx;
}
