import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { parsePathTenantForPublicHost } from '@/lib/tenantHost/parsePathTenant';
import { readTenantSlugForPostLogin } from '@/lib/tenantHost/publicPathPrefix';

const slugToTenantIdCache = new Map<string, string>();
let currentUserTenantCache: string | null = null;

function readTenantSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const byPath = parsePathTenantForPublicHost(window.location.pathname);
  return byPath?.slug ?? null;
}

async function resolveTenantIdFromSlug(slug: string): Promise<string> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return '';
  const cached = slugToTenantIdCache.get(normalized);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, 'tenantPublicSlugs', normalized));
    const tenantId = snap.exists() ? String(snap.data().tenantId ?? '').trim() : normalized;
    const finalId = tenantId || normalized;
    slugToTenantIdCache.set(normalized, finalId);
    return finalId;
  } catch {
    return normalized;
  }
}

async function resolveTenantIdFromAuth(): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) return '';
  if (currentUserTenantCache) return currentUserTenantCache;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const d = snap.data() as Record<string, unknown> | undefined;
    const tenantId =
      typeof d?.tenantId === 'string' && d.tenantId.trim()
        ? d.tenantId.trim()
        : typeof d?.companyId === 'string' && d.companyId.trim()
          ? d.companyId.trim()
          : '';
    currentUserTenantCache = tenantId || null;
    return tenantId;
  } catch {
    return '';
  }
}

/**
 * Resolve tenant ativo para leitura/escrita de conteúdo.
 * Sem fallback global intencionalmente: se não resolver tenant, retorna string vazia.
 */
export async function resolveActiveTenantId(): Promise<string> {
  const slug = readTenantSlugFromLocation() || readTenantSlugForPostLogin();
  if (slug) {
    return resolveTenantIdFromSlug(slug);
  }
  return resolveTenantIdFromAuth();
}

export function tenantContentPath(tenantId: string, collectionName: string): string {
  return `tenants/${tenantId}/${collectionName}`;
}

