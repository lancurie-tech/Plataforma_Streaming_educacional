import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AssignmentExpiryRow } from '@/types';
import { getCompany, listCoursesCatalog } from '@/lib/firestore/admin';

/** Prazos de liberação apenas nas empresas da carteira do vendedor. */
export async function listAssignmentExpiryRowsForManagedCompanies(
  managedCompanyIds: string[]
): Promise<AssignmentExpiryRow[]> {
  if (!managedCompanyIds.length) return [];
  const catalog = await listCoursesCatalog();
  const titleById = new Map(catalog.map((c) => [c.id, c.title]));
  const out: AssignmentExpiryRow[] = [];
  const now = Date.now();

  for (const coId of managedCompanyIds) {
    const co = await getCompany(coId);
    if (!co) continue;
    const snap = await getDocs(collection(db, 'companies', coId, 'allowedCourses'));
    for (const d of snap.docs) {
      const x = d.data() as Record<string, unknown>;
      const ts = x.expiresAt as { toDate?: () => Date } | undefined;
      const exp = ts?.toDate?.();
      if (!exp) continue;
      const ms = exp.getTime() - now;
      out.push({
        companyId: co.id,
        companyName: co.name,
        courseId: d.id,
        courseTitle: titleById.get(d.id) ?? d.id,
        expiresAt: exp,
        daysRemaining: Math.ceil(ms / 86_400_000),
        isExpired: ms <= 0,
      });
    }
  }
  out.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return out;
}
