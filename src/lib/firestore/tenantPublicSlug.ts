import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { TenantStatus } from '@/types';

export const TENANT_PUBLIC_SLUGS = 'tenantPublicSlugs';

export type TenantPublicSlugDoc = {
  tenantId: string;
  displayName: string;
  enabledModuleIds: string[];
  status: TenantStatus;
};

function parseSnap(data: Record<string, unknown> | undefined): TenantPublicSlugDoc | null {
  if (!data) return null;
  const tenantId = typeof data.tenantId === 'string' ? data.tenantId : '';
  if (!tenantId) return null;
  const displayName = typeof data.displayName === 'string' ? data.displayName : tenantId;
  const enabledModuleIds = Array.isArray(data.enabledModuleIds)
    ? (data.enabledModuleIds as string[])
    : [];
  const status = (data.status as TenantStatus) ?? 'active';
  return { tenantId, displayName, enabledModuleIds, status };
}

export async function getTenantPublicSlugDoc(slug: string): Promise<TenantPublicSlugDoc | null> {
  const id = slug.trim().toLowerCase();
  if (!id) return null;
  const snap = await getDoc(doc(db, TENANT_PUBLIC_SLUGS, id));
  if (!snap.exists()) return null;
  return parseSnap(snap.data() as Record<string, unknown>);
}

/** Garante que o slug público não está associado a outro tenant. */
export async function assertPublicSlugAvailableForTenant(
  slug: string,
  tenantId: string,
): Promise<boolean> {
  const id = slug.trim().toLowerCase();
  if (!id) return true;
  const existing = await getTenantPublicSlugDoc(id);
  if (!existing) return true;
  return existing.tenantId === tenantId;
}

/**
 * Mantém o índice público em sync com o tenant (apenas chamado do console master).
 * Quando `nextSlug` está vazio, remove o doc público anterior (se existia).
 */
export async function syncTenantPublicSlugDoc(opts: {
  tenantId: string;
  previousSlug: string | null | undefined;
  nextSlug: string | null | undefined;
  displayName: string;
  enabledModuleIds: string[];
  status: TenantStatus;
}): Promise<void> {
  const prev = (opts.previousSlug ?? '').trim().toLowerCase();
  const next = (opts.nextSlug ?? '').trim().toLowerCase();

  const batch = writeBatch(db);
  let ops = 0;

  if (next) {
    if (prev && prev !== next) {
      batch.delete(doc(db, TENANT_PUBLIC_SLUGS, prev));
      ops += 1;
    }
    batch.set(
      doc(db, TENANT_PUBLIC_SLUGS, next),
      {
        tenantId: opts.tenantId,
        displayName: opts.displayName,
        enabledModuleIds: opts.enabledModuleIds,
        status: opts.status,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;
  } else if (prev) {
    batch.delete(doc(db, TENANT_PUBLIC_SLUGS, prev));
    ops += 1;
  }

  if (ops === 0) return;
  await batch.commit();
}
