import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { tenantContentPath } from '@/lib/firestore/tenantContentScope';
import { getTenantEntitlements, listTenants } from '@/lib/firestore/tenancy';
import type { TenantDoc } from '@/types';

export type TenantConsumptionRow = {
  tenant: TenantDoc;
  /** Limite contratual `limits.maxActiveUsers` quando definido nos entitlements. */
  maxActiveUsers: number | null;
  companiesLinked: number;
  /** Perfis com `users.tenantId` igual ao tenant (não inclui só `companyId`). */
  usersWithTenantId: number;
  courses: number;
  channels: number;
  streamingBanners: number;
  streamingTracks: number;
};

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return -1;
  }
}

export async function loadMasterConsumptionRows(): Promise<TenantConsumptionRow[]> {
  const tenants = await listTenants();
  const rows = await Promise.all(
    tenants.map(async (tenant): Promise<TenantConsumptionRow> => {
      const tid = tenant.id;
      const ent = await getTenantEntitlements(tid);
      const lim = ent?.limits?.maxActiveUsers;
      const maxActiveUsers =
        typeof lim === 'number' && Number.isFinite(lim) && lim >= 0 ? lim : null;

      const [
        companiesLinked,
        usersWithTenantId,
        courses,
        channels,
        streamingBanners,
        streamingTracks,
      ] = await Promise.all([
        safeCount(async () => {
          const q = query(collection(db, 'companies'), where('tenantId', '==', tid));
          const snap = await getCountFromServer(q);
          return snap.data().count;
        }),
        safeCount(async () => {
          const q = query(collection(db, 'users'), where('tenantId', '==', tid));
          const snap = await getCountFromServer(q);
          return snap.data().count;
        }),
        safeCount(async () => {
          const snap = await getCountFromServer(collection(db, tenantContentPath(tid, 'courses')));
          return snap.data().count;
        }),
        safeCount(async () => {
          const snap = await getCountFromServer(collection(db, tenantContentPath(tid, 'channels')));
          return snap.data().count;
        }),
        safeCount(async () => {
          const snap = await getCountFromServer(
            collection(db, tenantContentPath(tid, 'streamingBanners'))
          );
          return snap.data().count;
        }),
        safeCount(async () => {
          const snap = await getCountFromServer(collection(db, tenantContentPath(tid, 'streamingTracks')));
          return snap.data().count;
        }),
      ]);

      return {
        tenant,
        maxActiveUsers,
        companiesLinked,
        usersWithTenantId,
        courses,
        channels,
        streamingBanners,
        streamingTracks,
      };
    })
  );

  return rows;
}
