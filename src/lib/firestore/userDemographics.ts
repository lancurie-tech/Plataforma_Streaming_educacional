import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { parseStudentDemographics } from '@/lib/studentDemographics';
import type { StudentDemographics } from '@/types';

const CHUNK = 24;

/**
 * Lê `users/{uid}.demographics` em lote (painel admin/vendedor).
 */
export async function fetchUserDemographicsForUids(
  uids: string[]
): Promise<Map<string, StudentDemographics>> {
  const unique = [...new Set(uids.filter(Boolean))];
  const out = new Map<string, StudentDemographics>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) return;
        const d = parseStudentDemographics(snap.data().demographics);
        if (d) out.set(uid, d);
      })
    );
  }
  return out;
}
